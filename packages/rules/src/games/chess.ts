/**
 * G07 Chess (CHE). §22.
 *
 * Two decisions shape this module.
 *
 * 1. HALF POINTS ARE INTEGERS. §22: "Store half-point units as integers (win 2,
 *    draw 1, loss 0) for the proposed conventional 1/0.5/0 profile."
 *    Note the reason is NOT float drift — 0.5 is exactly representable in IEEE-754,
 *    so summing draws is exact either way. The reasons are:
 *      - the award table becomes profile data, not a hard-coded 1/0.5/0 assumption:
 *        a school event may adopt 3–1–0, and integers express that without a rescale;
 *      - equality and ordering are unambiguous across TypeScript, JSON and the
 *        database column, with no numeric/decimal round-tripping to reason about;
 *      - Buchholz and Sonneborn-Berger sum and multiply awarded units, where an
 *        integer domain keeps every intermediate value exact by construction.
 *    Display divides by 2 at the edge (see `formatHalfUnits`).
 *
 * 2. THE SOFTWARE IS NOT AN ARBITER. §22: "A reported flag fall, repetition, illegal
 *    move or stalemate becomes an arbiter decision; the result-entry form does not
 *    infer a winner from a claim or device timer alone." Automated Swiss pairing is
 *    likewise refused unless a validated engine produced it — §22 forbids
 *    approximating Swiss by sorting scores and pairing adjacent players.
 */
import type { DisciplineCode } from '@khel/contracts';
import type {
  BaseRuleProfile, CalculationOutput, ParticipantResult, ParticipantRef,
  UnresolvedDecision, ValidationIssue, TieRule,
} from '../types.js';
import { rankParticipants, applyRanking, type ComparatorResolver } from '../tie.js';

/** Every outcome the entry form may offer. Points derive from the code, never typed in. */
export const CHESS_RESULT = [
  'WhiteWin', 'BlackWin', 'Draw',
  'WhiteForfeit', 'BlackForfeit', 'DoubleForfeit',
  'ByeWhite',       // the listed player received a bye
  'Postponed', 'Cancelled',
] as const;
export type ChessResult = (typeof CHESS_RESULT)[number];

/** Half-point units. Win 2, draw 1, loss 0 — see the note above. */
export const HALF_UNITS = { WIN: 2, DRAW: 1, LOSS: 0 } as const;

export interface ChessPairing {
  observation_id: string;
  round_no: number;
  board_no: number;
  white_participant_id: string;
  /** null when this is a bye. */
  black_participant_id: string | null;
}

export interface ChessBoardResult {
  observation_id: string;
  round_no: number;
  board_no: number;
  result_code: ChessResult;
  /** Whether the game was actually played over the board. Byes and forfeits are not. */
  played: boolean;
  termination_reason?: string | null;
  arbiter_membership_id?: string | null;
  /**
   * A player's claim (flag fall, repetition, illegal move) that the arbiter has not
   * yet ruled on. Blocks the round (GT-024).
   */
  pending_arbiter_claim?: string | null;
}

export interface ChessRuleProfile extends BaseRuleProfile {
  discipline: Extract<DisciplineCode, 'CHE'>;
  format: 'RoundRobin' | 'Swiss' | 'Knockout';
  rounds: number;
  /** §22: automatic pairing requires a named validated engine, never an approximation. */
  pairing_source: 'ManualApproved' | 'ImportedApprovedEngine';
  pairing_engine_id?: string | null;
  /** Half-units awarded for a bye under the adopted policy. 2 = a full point. */
  bye_half_units: number;
  /** Half-units the present player receives when the opponent forfeits. */
  forfeit_win_half_units: number;
  /** Ordered published tie-break list (§22, S08). */
  tie_break_order: TieRule[];
  /**
   * How unplayed games count towards opponents' Buchholz.
   * §22 warns that special cases need the adopted regulation, not a zero placeholder.
   */
  unplayed_game_policy: 'ExcludeFromBuchholz' | 'CountAsPlayedScore';
}

export interface ChessInput {
  profile: ChessRuleProfile;
  participants: ParticipantRef[];
  pairings: ChessPairing[];
  results: ChessBoardResult[];
}

interface Award { white: number; black: number; played: boolean }

/** Points follow from the result code. §22: users cannot submit inconsistent points. */
function awardFor(code: ChessResult, profile: ChessRuleProfile): Award | null {
  switch (code) {
    case 'WhiteWin':     return { white: HALF_UNITS.WIN, black: HALF_UNITS.LOSS, played: true };
    case 'BlackWin':     return { white: HALF_UNITS.LOSS, black: HALF_UNITS.WIN, played: true };
    case 'Draw':         return { white: HALF_UNITS.DRAW, black: HALF_UNITS.DRAW, played: true };
    case 'WhiteForfeit': return { white: HALF_UNITS.LOSS, black: profile.forfeit_win_half_units, played: false };
    case 'BlackForfeit': return { white: profile.forfeit_win_half_units, black: HALF_UNITS.LOSS, played: false };
    case 'DoubleForfeit':return { white: HALF_UNITS.LOSS, black: HALF_UNITS.LOSS, played: false };
    case 'ByeWhite':     return { white: profile.bye_half_units, black: 0, played: false };
    case 'Postponed':
    case 'Cancelled':    return null; // no award until resolved
  }
}

export function calculateChess(input: ChessInput): CalculationOutput {
  const { profile, participants } = input;
  const issues: ValidationIssue[] = [];
  const unresolved: UnresolvedDecision[] = [];
  const explanation: string[] = [
    `CHE ${profile.format}: ${profile.rounds} round(s), pairing source ${profile.pairing_source}, ` +
    `bye ${profile.bye_half_units / 2} point(s).`,
  ];

  if (profile.pairing_source === 'ImportedApprovedEngine' && !profile.pairing_engine_id) {
    issues.push({
      code: 'PAIRING_ENGINE_NOT_NAMED',
      message:
        'Automated pairing requires a named, validated pairing engine and rule version. ' +
        'Swiss pairing must not be approximated by sorting scores and pairing adjacent players (§22).',
    });
  }

  // ---- Pairing integrity ---------------------------------------------------
  const pairingKey = new Map<string, ChessPairing>();
  for (const p of input.pairings) {
    const boardKey = `${p.round_no}#${p.board_no}`;
    if (pairingKey.has(boardKey)) {
      issues.push({
        code: 'BOARD_DUPLICATED',
        message: `Round ${p.round_no} board ${p.board_no} is paired more than once.`,
        observation_id: p.observation_id,
      });
      continue;
    }
    pairingKey.set(boardKey, p);

    if (p.black_participant_id && p.white_participant_id === p.black_participant_id) {
      issues.push({
        code: 'SELF_PAIRING',
        message: `Round ${p.round_no} board ${p.board_no} pairs a player against themselves.`,
        observation_id: p.observation_id,
      });
    }
  }

  // GT-023: one assignment per player per round.
  const perRound = new Map<number, Map<string, number[]>>();
  for (const p of input.pairings) {
    const round = perRound.get(p.round_no) ?? new Map<string, number[]>();
    for (const id of [p.white_participant_id, p.black_participant_id]) {
      if (!id) continue;
      const boards = round.get(id) ?? [];
      boards.push(p.board_no);
      round.set(id, boards);
    }
    perRound.set(p.round_no, round);
  }
  for (const [roundNo, players] of perRound) {
    for (const [id, boards] of players) {
      if (boards.length > 1) {
        issues.push({
          code: 'PLAYER_ON_MULTIPLE_BOARDS',
          message:
            `Player ${id} is paired on boards ${boards.join(' and ')} in round ${roundNo}. ` +
            `Publication is blocked.`,
          participant_id: id,
        });
      }
    }
  }

  const known = new Set(participants.map((p) => p.participant_id));
  for (const p of input.pairings) {
    for (const id of [p.white_participant_id, p.black_participant_id]) {
      if (id && !known.has(id)) {
        issues.push({
          code: 'PAIRED_PLAYER_NOT_ENTERED',
          message: `Player ${id} is paired in round ${p.round_no} but is not an active entrant.`,
          observation_id: p.observation_id,
        });
      }
    }
  }

  // ---- Results -------------------------------------------------------------
  const halfUnits = new Map<string, number>(participants.map((p) => [p.participant_id, 0]));
  const playedGames = new Map<string, number>(participants.map((p) => [p.participant_id, 0]));
  /** participant → opponents in PLAYED games, for Buchholz. */
  const opponents = new Map<string, string[]>(participants.map((p) => [p.participant_id, []]));
  const boardLines: string[] = [];
  const resolvedBoards = new Set<string>();

  for (const r of input.results) {
    const boardKey = `${r.round_no}#${r.board_no}`;
    const pairing = pairingKey.get(boardKey);
    if (!pairing) {
      issues.push({
        code: 'RESULT_WITHOUT_PAIRING',
        message: `A result is recorded for round ${r.round_no} board ${r.board_no}, which was never paired.`,
        observation_id: r.observation_id,
      });
      continue;
    }

    // GT-024: an unruled claim never becomes a win.
    if (r.pending_arbiter_claim) {
      unresolved.push({
        code: 'ARBITER_CLAIM_PENDING',
        message:
          `Round ${r.round_no} board ${r.board_no}: "${r.pending_arbiter_claim}" is reported but ` +
          `not yet ruled on. The software does not infer a winner from a claim or a device timer.`,
        participant_ids: [pairing.white_participant_id, pairing.black_participant_id].filter(
          (x): x is string => !!x),
        required_input: 'The arbiter rules on the claim and records the decision.',
      });
      continue;
    }

    if (r.result_code === 'Postponed' || r.result_code === 'Cancelled') {
      unresolved.push({
        code: 'OFFICIAL_DISPOSITION_REQUIRED',
        message: `Round ${r.round_no} board ${r.board_no} is ${r.result_code.toLowerCase()} and unresolved.`,
        participant_ids: [pairing.white_participant_id, pairing.black_participant_id].filter(
          (x): x is string => !!x),
        required_input: 'Record the rescheduled result or the arbiter’s exclusion decision.',
      });
      continue;
    }

    const isBye = pairing.black_participant_id === null;
    if (isBye && r.result_code !== 'ByeWhite') {
      issues.push({
        code: 'BYE_RESULT_MISMATCH',
        message:
          `Round ${r.round_no} board ${r.board_no} is a bye but carries result ${r.result_code}.`,
        observation_id: r.observation_id,
      });
      continue;
    }
    if (!isBye && r.result_code === 'ByeWhite') {
      issues.push({
        code: 'BYE_ON_PLAYED_BOARD',
        message: `Round ${r.round_no} board ${r.board_no} has two players but is recorded as a bye.`,
        observation_id: r.observation_id,
      });
      continue;
    }

    const award = awardFor(r.result_code, profile);
    if (!award) continue;

    // GT-022: a bye may award a point but is never a played win.
    if (award.played !== r.played) {
      issues.push({
        code: 'PLAYED_FLAG_INCONSISTENT',
        message:
          `Round ${r.round_no} board ${r.board_no}: result ${r.result_code} implies played=` +
          `${award.played}, but the sheet records played=${r.played}. A bye or forfeit is not a played game.`,
        observation_id: r.observation_id,
      });
    }

    resolvedBoards.add(boardKey);
    const w = pairing.white_participant_id;
    const b = pairing.black_participant_id;

    halfUnits.set(w, (halfUnits.get(w) ?? 0) + award.white);
    if (b) halfUnits.set(b, (halfUnits.get(b) ?? 0) + award.black);

    if (award.played) {
      playedGames.set(w, (playedGames.get(w) ?? 0) + 1);
      if (b) {
        playedGames.set(b, (playedGames.get(b) ?? 0) + 1);
        opponents.get(w)!.push(b);
        opponents.get(b)!.push(w);
      }
    }

    boardLines.push(
      `R${r.round_no} B${r.board_no}: ${r.result_code}` +
      `${award.played ? '' : ' (not a played game)'}.`,
    );
  }

  // A round cannot be locked with an unresolved board (§22).
  for (const [boardKey, pairing] of pairingKey) {
    if (!resolvedBoards.has(boardKey)) {
      const [roundNo, boardNo] = boardKey.split('#');
      const already = unresolved.some((u) =>
        u.participant_ids.includes(pairing.white_participant_id));
      if (!already) {
        issues.push({
          code: 'BOARD_RESULT_MISSING',
          message: `Round ${roundNo} board ${boardNo} has no recorded result.`,
        });
      }
    }
  }
  explanation.push(...boardLines);

  // ---- Standings -----------------------------------------------------------
  const results: ParticipantResult[] = participants.map((p) => {
    const hu = halfUnits.get(p.participant_id) ?? 0;
    return {
      participant_id: p.participant_id,
      status: 'Completed',
      primary_value: hu,                        // integer half-units
      primary_display: formatHalfUnits(hu),     // "1.5"
      secondary_values: [],
      rank: null,
      shared_rank: false,
      components: {
        half_units: hu,
        played_games: playedGames.get(p.participant_id) ?? 0,
      },
      reason_trace: [
        `${hu} half-unit(s) = ${formatHalfUnits(hu)} point(s) from ` +
        `${playedGames.get(p.participant_id) ?? 0} played game(s).`,
      ],
      source_observation_ids: input.results.map((r) => r.observation_id),
    };
  });

  const resolver = makeChessResolver(halfUnits, opponents, playedGames);
  const ranking = rankParticipants(
    results.map((r) => ({ participant_id: r.participant_id, primary_value: r.primary_value })),
    {
      direction: 'HigherWins',
      policy: profile.tie_break_order,
      allowSharedPlace: profile.allow_shared_place,
      resolve: resolver,
    },
  );
  applyRanking(results, ranking);

  const standings = results
    .filter((r) => r.rank !== null)
    .sort((a, b) => a.rank! - b.rank!)
    .map((r) => r.participant_id);

  return {
    discipline: 'CHE',
    rule_version_id: profile.rule_version_id,
    participants: results,
    winner_participant_id: results.find((r) => r.rank === 1 && !r.shared_rank)?.participant_id ?? null,
    standings,
    unresolved: [...unresolved, ...ranking.unresolved],
    issues,
    complete: issues.length === 0 && unresolved.length === 0 && ranking.unresolved.length === 0,
    explanation,
  };
}

/** Render integer half-units as the familiar 1 / 0.5 / 1.5 scale. */
export function formatHalfUnits(halfUnits: number): string {
  const whole = Math.floor(halfUnits / 2);
  return halfUnits % 2 === 0 ? String(whole) : `${whole}.5`;
}

/**
 * Tie-break comparators.
 * §22: "Basic Buchholz is the sum of opponents' scores for fully played games;
 * special cases require the adopted regulation, not a zero-value placeholder."
 * Anything outside the implemented set returns null, which escalates to a decision
 * rather than quietly scoring zero.
 */
function makeChessResolver(
  halfUnits: Map<string, number>,
  opponents: Map<string, string[]>,
  playedGames: Map<string, number>,
): ComparatorResolver {
  return (participantId: string, rule: TieRule): number | null => {
    switch (rule.comparator) {
      case 'Buchholz': {
        const opps = opponents.get(participantId) ?? [];
        return opps.reduce((sum, o) => sum + (halfUnits.get(o) ?? 0), 0);
      }
      case 'MostWins': {
        // Wins are not separately recorded here; derived only where unambiguous.
        return null;
      }
      case 'DirectEncounter':
      case 'HeadToHead':
      case 'SonnebornBerger':
        return null; // requires the adopted regulation's exact handling
      default:
        return null;
    }
  };
}

/** Buchholz over played games only, exposed for the review screen's contribution table. */
export function buchholzContributions(
  participantId: string,
  opponents: Map<string, string[]>,
  halfUnits: Map<string, number>,
): { opponent_id: string; half_units: number }[] {
  return (opponents.get(participantId) ?? []).map((o) => ({
    opponent_id: o, half_units: halfUnits.get(o) ?? 0,
  }));
}
