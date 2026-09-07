/**
 * Match calculator for the two rally-scoring disciplines.
 *   G10 Badminton (BAD) — games to win; profile is effective-date aware (§25).
 *   G11 Volleyball (VOL) — sets to win, with a distinct deciding-set target (§26).
 *
 * Both are exactly two participants (side A and side B). Badminton's side may be a
 * single player or a two-person pair; volleyball's is a school team.
 */
import type { DisciplineCode, ResultStatus } from '@khel/contracts';
import type {
  BaseRuleProfile, CalculationOutput, ParticipantResult, ParticipantRef, ValidationIssue,
} from '../types.js';
import { evaluateUnit, decidingUnitNumber, maxUnits, type UnitRules } from './rally.js';

/** One completed or in-progress game/set. */
export interface UnitObservation {
  observation_id: string;
  /** 1-based game or set number. */
  unit_no: number;
  points_a: number;
  points_b: number;
  /** Operator asserts this unit is finished. An in-progress unit is not validated as final. */
  finalised: boolean;
}

export interface MatchRuleProfile extends BaseRuleProfile {
  discipline: Extract<DisciplineCode, 'BAD' | 'VOL'>;
  /** W — games (badminton) or sets (volleyball) needed to win the match. */
  units_to_win: number;
  /** T for an ordinary unit. */
  ordinary_target: number;
  /**
   * T for the deciding unit. Volleyball's fifth set is shorter (§26).
   * Badminton normally leaves this equal to the ordinary target.
   */
  deciding_target: number;
  /** L — required winning lead. */
  winning_margin: number;
  /** C — cap. null = uncapped, which is the ordinary volleyball profile (§26). */
  cap: number | null;
  /**
   * §25: BWF's 3×15 system takes effect 4 January 2027, so a badminton profile must
   * carry the date its rules apply from. A permanently hard-coded 21-point setting is
   * explicitly called out as wrong.
   */
  rule_effective_date?: string | null;
}

/** A match may end other than by playing it out (§25, §26). */
export type MatchTermination = 'Played' | 'Retirement' | 'Walkover' | 'Forfeit' | 'Abandoned';

export interface MatchInput {
  profile: MatchRuleProfile;
  /** Exactly two: index 0 is side A, index 1 is side B. */
  participants: [ParticipantRef, ParticipantRef];
  units: UnitObservation[];
  termination?: MatchTermination;
  /** Required whenever termination is not 'Played'. */
  termination_reason?: string | null;
  /** Side that retired / forfeited / received the walkover against them. */
  termination_side?: 'A' | 'B' | null;
}

export function calculateMatch(input: MatchInput): CalculationOutput {
  const { profile, participants } = input;
  const termination = input.termination ?? 'Played';
  const issues: ValidationIssue[] = [];
  const explanation: string[] = [];
  const [sideA, sideB] = participants;

  const unitWord = profile.discipline === 'VOL' ? 'set' : 'game';
  const deciding = decidingUnitNumber(profile.units_to_win);
  explanation.push(
    `${profile.discipline}: first to ${profile.units_to_win} ${unitWord}(s); ordinary target ` +
    `${profile.ordinary_target}, deciding ${unitWord} ${deciding} target ${profile.deciding_target}, ` +
    `lead ${profile.winning_margin}, cap ${profile.cap ?? 'none'}.`,
  );
  if (profile.discipline === 'BAD' && !profile.rule_effective_date) {
    issues.push({
      code: 'RULE_EFFECTIVE_DATE_MISSING',
      message:
        'Badminton rule profiles must record the date their scoring system applies from ' +
        '(§25: the BWF 3×15 change takes effect 4 January 2027).',
    });
  }

  const units = [...input.units].sort((a, b) => a.unit_no - b.unit_no);
  let winsA = 0;
  let winsB = 0;
  let matchDecidedAfter: number | null = null;
  const unitLines: string[] = [];
  const observationIds = units.map((u) => u.observation_id);

  for (const u of units) {
    // GT-038: once a side has W units, no further unit may be played.
    if (matchDecidedAfter !== null) {
      issues.push({
        code: 'UNIT_AFTER_MATCH_DECIDED',
        message:
          `${capitalise(unitWord)} ${u.unit_no} is recorded although the match was already ` +
          `won ${Math.max(winsA, winsB)}–${Math.min(winsA, winsB)} after ${unitWord} ` +
          `${matchDecidedAfter}. A decided match cannot contain further ${unitWord}s.`,
        observation_id: u.observation_id,
      });
      continue;
    }
    if (u.unit_no > maxUnits(profile.units_to_win)) {
      issues.push({
        code: 'UNIT_NUMBER_BEYOND_FORMAT',
        message:
          `${capitalise(unitWord)} ${u.unit_no} exceeds the maximum of ` +
          `${maxUnits(profile.units_to_win)} for a first-to-${profile.units_to_win} match.`,
        observation_id: u.observation_id,
      });
      continue;
    }

    const rules = unitRulesFor(u.unit_no, profile);
    const evaluation = evaluateUnit(u.points_a, u.points_b, rules);

    if (evaluation.state === 'Invalid') {
      issues.push({
        code: evaluation.code ?? 'UNIT_SCORE_INVALID',
        message: `${capitalise(unitWord)} ${u.unit_no}: ${evaluation.reason}`,
        observation_id: u.observation_id,
      });
      continue;
    }

    if (evaluation.state === 'Open') {
      if (u.finalised) {
        issues.push({
          code: 'UNIT_NOT_CLOSED',
          message: `${capitalise(unitWord)} ${u.unit_no} is marked complete but ${evaluation.reason}`,
          observation_id: u.observation_id,
        });
      } else {
        unitLines.push(`${capitalise(unitWord)} ${u.unit_no}: ${u.points_a}–${u.points_b} (in progress).`);
      }
      continue;
    }

    if (evaluation.winner === 'A') winsA += 1; else winsB += 1;
    unitLines.push(
      `${capitalise(unitWord)} ${u.unit_no}: ${u.points_a}–${u.points_b} to ` +
      `${evaluation.winner === 'A' ? sideA.display_name : sideB.display_name}. ${evaluation.reason}`,
    );

    if (winsA === profile.units_to_win || winsB === profile.units_to_win) {
      matchDecidedAfter = u.unit_no;
    }
  }

  explanation.push(...unitLines);

  // ---- Termination other than ordinary play ---------------------------------
  if (termination !== 'Played') {
    if (!input.termination_reason) {
      issues.push({
        code: 'TERMINATION_REASON_REQUIRED',
        message: `A ${termination} outcome requires a recorded official reason.`,
      });
    }
    if (!input.termination_side) {
      issues.push({
        code: 'TERMINATION_SIDE_REQUIRED',
        message: `A ${termination} outcome must name the side it applies to.`,
      });
    }
  }

  const statuses = resolveStatuses(termination, input.termination_side ?? null, winsA, winsB, profile);

  const resultA = buildSide(sideA, statuses.a, winsA, winsB, observationIds, unitLines);
  const resultB = buildSide(sideB, statuses.b, winsB, winsA, observationIds, unitLines);

  let winner: string | null = null;
  if (termination === 'Played') {
    if (winsA === profile.units_to_win) winner = sideA.participant_id;
    else if (winsB === profile.units_to_win) winner = sideB.participant_id;
  } else if (input.termination_side) {
    // The side that retired/forfeited loses; the other is credited (§25: no invented scores).
    winner = input.termination_side === 'A' ? sideB.participant_id : sideA.participant_id;
    explanation.push(
      `Match ended by ${termination} against side ` +
      `${input.termination_side === 'A' ? sideA.display_name : sideB.display_name}. ` +
      `Completed ${unitWord}s are retained; no unplayed rallies are invented.`,
    );
  }

  if (winner) {
    resultA.rank = winner === sideA.participant_id ? 1 : 2;
    resultB.rank = winner === sideB.participant_id ? 1 : 2;
  }

  if (termination === 'Played' && winner === null && issues.length === 0) {
    explanation.push(
      `Match is not yet decided: ${winsA}–${winsB} in ${unitWord}s, ` +
      `${profile.units_to_win} needed.`,
    );
  }

  return {
    discipline: profile.discipline,
    rule_version_id: profile.rule_version_id,
    participants: [resultA, resultB],
    winner_participant_id: winner,
    standings: winner
      ? [winner, winner === sideA.participant_id ? sideB.participant_id : sideA.participant_id]
      : [],
    unresolved: [],
    issues,
    complete: issues.length === 0 && winner !== null,
    explanation,
  };
}

/** Ordinary units use the ordinary target; the deciding unit uses its own (§26). */
function unitRulesFor(unitNo: number, profile: MatchRuleProfile): UnitRules {
  const isDeciding = unitNo === decidingUnitNumber(profile.units_to_win);
  return {
    target: isDeciding ? profile.deciding_target : profile.ordinary_target,
    margin: profile.winning_margin,
    cap: profile.cap,
  };
}

function resolveStatuses(
  termination: MatchTermination,
  side: 'A' | 'B' | null,
  winsA: number,
  winsB: number,
  profile: MatchRuleProfile,
): { a: ResultStatus; b: ResultStatus } {
  if (termination === 'Played') {
    const decided = winsA === profile.units_to_win || winsB === profile.units_to_win;
    return decided ? { a: 'Completed', b: 'Completed' } : { a: 'Completed', b: 'Completed' };
  }
  const loser: ResultStatus =
    termination === 'Retirement' ? 'Retired'
    : termination === 'Walkover' ? 'Walkover'
    : termination === 'Forfeit' ? 'DQ'
    : 'DNF';
  const winnerStatus: ResultStatus = termination === 'Abandoned' ? 'DNF' : 'Completed';
  if (side === 'A') return { a: loser, b: winnerStatus };
  if (side === 'B') return { a: winnerStatus, b: loser };
  return { a: 'DNF', b: 'DNF' };
}

function buildSide(
  ref: ParticipantRef,
  status: ResultStatus,
  own: number,
  opponent: number,
  observationIds: string[],
  unitLines: string[],
): ParticipantResult {
  return {
    participant_id: ref.participant_id,
    status,
    primary_value: status === 'Completed' ? own : null,
    primary_display: `${own}–${opponent}`,
    secondary_values: [],
    rank: null,
    shared_rank: false,
    components: { units_won: own, units_lost: opponent },
    reason_trace: [...unitLines],
    source_observation_ids: observationIds,
  };
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
