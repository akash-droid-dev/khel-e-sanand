/**
 * G09 Tug of War (TOW). §24.
 *
 * §24's sharpest requirement: "A no-pull counts as no win and creates an explicit
 * replay linked to the same logical pull. Never increment both pull count and win
 * count for a no-pull." So a pull has two independent identities:
 *   - the LOGICAL pull number (which pull of the match this is), and
 *   - the replay sequence within it (attempt 1, 2, … after a no-pull).
 * A no-pull advances only the replay sequence.
 *
 * §24 also forbids the software from adjudicating: "Distance crossed, warnings or a
 * video are not independently adjudicated by the software." Only a declared outcome
 * from the judge counts.
 */
import type { DisciplineCode } from '@khel/contracts';
import type {
  Side,
  BaseRuleProfile, CalculationOutput, ParticipantResult, ParticipantRef,
  UnresolvedDecision, ValidationIssue,
} from '../types.js';

export const PULL_OUTCOME = ['TeamAWin', 'TeamBWin', 'NoPull', 'Abandoned'] as const;
export type PullOutcome = (typeof PULL_OUTCOME)[number];

export interface TugPull {
  observation_id: string;
  /** Logical pull number within the match. A no-pull does NOT advance it. */
  pull_no: number;
  /** Attempt within the logical pull. 1 for the first attempt, 2 after a no-pull. */
  replay_sequence: number;
  /** Which end each side occupied — validated against the end-change policy. */
  side_a_end: 'North' | 'South';
  outcome: PullOutcome;
  /** Mandatory for NoPull and Abandoned (§24). */
  official_reason?: string | null;
  judge_membership_id?: string | null;
  /** Roster confirmed at the start of this pull. */
  roster_confirmed: boolean;
}

export interface TugRuleProfile extends BaseRuleProfile {
  discipline: Extract<DisciplineCode, 'TOW'>;
  team_size: number;
  /** 'BestOfThree' is a knockout match; 'TwoPullLeague' awards table points instead. */
  pull_format: 'BestOfThree' | 'TwoPullLeague';
  /** Valid pull wins needed to take the match. Ignored in TwoPullLeague. */
  pulls_to_win: number;
  /** League profile only: outcome → table points. */
  league_points?: { win: number; draw: number; loss: number };
  /** Ends must change between pulls where the adopted profile requires it. */
  end_change_required: boolean;
}

export interface TugInput {
  profile: TugRuleProfile;
  participants: [ParticipantRef, ParticipantRef];
  pulls: TugPull[];
  /** Roster sizes as checked by the official before the match. */
  roster_sizes?: Record<Side, number>;
}

export function calculateTugOfWar(input: TugInput): CalculationOutput {
  const { profile, participants } = input;
  const issues: ValidationIssue[] = [];
  const unresolved: UnresolvedDecision[] = [];
  const explanation: string[] = [
    `TOW ${profile.pull_format}: team size ${profile.team_size}` +
    (profile.pull_format === 'BestOfThree'
      ? `, first to ${profile.pulls_to_win} valid pull win(s).`
      : ', table points from two pulls.'),
  ];

  // ---- Roster check (§24: weights, if collected, are restricted, never public) ----
  if (input.roster_sizes) {
    for (const side of ['A', 'B'] as Side[]) {
      const size = input.roster_sizes[side];
      if (size !== profile.team_size) {
        issues.push({
          code: 'TEAM_SIZE_MISMATCH',
          message:
            `Side ${side} presented ${size} puller(s); the approved profile requires ` +
            `${profile.team_size}.`,
        });
      }
    }
  }

  // ---- Deduplicate (GT-030) ------------------------------------------------
  const seenObs = new Set<string>();
  const seenAttempt = new Set<string>();
  const pulls: TugPull[] = [];
  let duplicates = 0;

  for (const p of [...input.pulls].sort(
    (a, b) => a.pull_no - b.pull_no || a.replay_sequence - b.replay_sequence,
  )) {
    if (seenObs.has(p.observation_id)) { duplicates += 1; continue; }
    seenObs.add(p.observation_id);
    const key = `${p.pull_no}#${p.replay_sequence}`;
    if (seenAttempt.has(key)) {
      issues.push({
        code: 'DUPLICATE_PULL_ATTEMPT',
        message: `Pull ${p.pull_no} attempt ${p.replay_sequence} is recorded more than once.`,
        observation_id: p.observation_id,
      });
      duplicates += 1;
      continue;
    }
    seenAttempt.add(key);
    pulls.push(p);
  }
  if (duplicates > 0) explanation.push(`${duplicates} duplicate pull record(s) ignored.`);

  // ---- Walk the pulls ------------------------------------------------------
  const wins: Record<Side, number> = { A: 0, B: 0 };
  let validPulls = 0;
  let noPulls = 0;
  let matchDecidedAfter: number | null = null;
  const lines: string[] = [];
  /** Logical pull number → attempts recorded for it. */
  const attemptsPerPull = new Map<number, TugPull[]>();

  for (const p of pulls) {
    const list = attemptsPerPull.get(p.pull_no) ?? [];
    list.push(p);
    attemptsPerPull.set(p.pull_no, list);

    if (!p.roster_confirmed) {
      issues.push({
        code: 'ROSTER_NOT_CONFIRMED',
        message: `Pull ${p.pull_no} attempt ${p.replay_sequence} began without a confirmed roster.`,
        observation_id: p.observation_id,
      });
    }

    if (matchDecidedAfter !== null && profile.pull_format === 'BestOfThree') {
      issues.push({
        code: 'PULL_AFTER_MATCH_DECIDED',
        message:
          `Pull ${p.pull_no} is recorded although the match was already won after pull ` +
          `${matchDecidedAfter}.`,
        observation_id: p.observation_id,
      });
      continue;
    }

    switch (p.outcome) {
      case 'NoPull': {
        // §24: no win, and it does not consume the logical pull.
        noPulls += 1;
        if (!p.official_reason) {
          issues.push({
            code: 'NO_PULL_REASON_REQUIRED',
            message: `Pull ${p.pull_no} attempt ${p.replay_sequence} is a no-pull with no recorded reason.`,
            observation_id: p.observation_id,
          });
        }
        lines.push(
          `Pull ${p.pull_no} attempt ${p.replay_sequence}: no pull` +
          `${p.official_reason ? ` (${p.official_reason})` : ''} — replay required, no win awarded.`,
        );
        break;
      }
      case 'Abandoned': {
        if (!p.official_reason) {
          issues.push({
            code: 'ABANDON_REASON_REQUIRED',
            message: `Pull ${p.pull_no} is abandoned with no recorded reason.`,
            observation_id: p.observation_id,
          });
        }
        unresolved.push({
          code: 'OFFICIAL_DISPOSITION_REQUIRED',
          message:
            `Pull ${p.pull_no} was abandoned${p.official_reason ? `: ${p.official_reason}` : ''}. ` +
            `An abandoned pull awaits an official disposition.`,
          participant_ids: participants.map((x) => x.participant_id),
          required_input: 'Record the official disposition for the abandoned pull.',
        });
        lines.push(`Pull ${p.pull_no} attempt ${p.replay_sequence}: abandoned.`);
        break;
      }
      case 'TeamAWin':
      case 'TeamBWin': {
        const side: Side = p.outcome === 'TeamAWin' ? 'A' : 'B';
        wins[side] += 1;
        validPulls += 1;
        lines.push(
          `Pull ${p.pull_no} attempt ${p.replay_sequence}: won by side ${side}.`,
        );
        if (profile.pull_format === 'BestOfThree' && wins[side] === profile.pulls_to_win) {
          matchDecidedAfter = p.pull_no;
        }
        break;
      }
    }
  }

  // A logical pull that only ever produced no-pulls is still outstanding.
  for (const [pullNo, attempts] of attemptsPerPull) {
    const decided = attempts.some((a) => a.outcome === 'TeamAWin' || a.outcome === 'TeamBWin');
    const abandoned = attempts.some((a) => a.outcome === 'Abandoned');
    if (!decided && !abandoned) {
      unresolved.push({
        code: 'OFFICIAL_DISPOSITION_REQUIRED',
        message:
          `Pull ${pullNo} has ${attempts.length} recorded attempt(s), all no-pulls. ` +
          `A valid pull is still required.`,
        participant_ids: participants.map((x) => x.participant_id),
        required_input: 'Record the replayed pull’s valid outcome.',
      });
    }
  }
  explanation.push(...lines);

  // ---- Match outcome -------------------------------------------------------
  const [refA, refB] = participants;
  let winner: string | null = null;
  const components: Record<Side, Record<string, number>> = {
    A: { pull_wins: wins.A, valid_pulls: validPulls, no_pulls: noPulls },
    B: { pull_wins: wins.B, valid_pulls: validPulls, no_pulls: noPulls },
  };

  if (profile.pull_format === 'BestOfThree') {
    if (wins.A >= profile.pulls_to_win) winner = refA.participant_id;
    else if (wins.B >= profile.pulls_to_win) winner = refB.participant_id;
    else if (unresolved.length === 0 && issues.length === 0) {
      // GT-029: 1–1 in a best-of-three is simply unfinished.
      unresolved.push({
        code: 'INCOMPLETE_STRUCTURE',
        message:
          `The match stands at ${wins.A}–${wins.B} and neither side has reached ` +
          `${profile.pulls_to_win} valid pull win(s). A further valid pull is required.`,
        participant_ids: [refA.participant_id, refB.participant_id],
        required_input: 'Record the outcome of the next valid pull.',
      });
    }
  } else {
    // League profile: table points, and a level result is a legitimate draw.
    const pts = profile.league_points ?? { win: 2, draw: 1, loss: 0 };
    const tableA = wins.A > wins.B ? pts.win : wins.A === wins.B ? pts.draw : pts.loss;
    const tableB = wins.B > wins.A ? pts.win : wins.A === wins.B ? pts.draw : pts.loss;
    components.A.table_points = tableA;
    components.B.table_points = tableB;
    if (wins.A > wins.B) winner = refA.participant_id;
    else if (wins.B > wins.A) winner = refB.participant_id;
    explanation.push(
      `League profile: ${wins.A}–${wins.B} in pulls → ${tableA}–${tableB} table point(s).`,
    );
  }

  const obsIds = pulls.map((p) => p.observation_id);
  const results: ParticipantResult[] = ([refA, refB] as ParticipantRef[]).map((ref, i) => {
    const side: Side = i === 0 ? 'A' : 'B';
    return {
      participant_id: ref.participant_id,
      status: 'Completed',
      primary_value: wins[side],
      primary_display: `${wins.A}–${wins.B}`,
      secondary_values: [],
      rank: null,
      shared_rank: false,
      components: components[side],
      reason_trace: [
        `${wins[side]} valid pull win(s) from ${validPulls} valid pull(s); ` +
        `${noPulls} no-pull(s) replayed.`,
      ],
      source_observation_ids: obsIds,
    };
  });

  if (winner) {
    results[0]!.rank = winner === refA.participant_id ? 1 : 2;
    results[1]!.rank = winner === refB.participant_id ? 1 : 2;
  } else if (profile.pull_format === 'TwoPullLeague' && wins.A === wins.B) {
    results[0]!.rank = 1; results[1]!.rank = 1;
    results[0]!.shared_rank = true; results[1]!.shared_rank = true;
  }

  return {
    discipline: 'TOW',
    rule_version_id: profile.rule_version_id,
    participants: results,
    winner_participant_id: winner,
    standings: winner
      ? [winner, winner === refA.participant_id ? refB.participant_id : refA.participant_id]
      : [],
    unresolved,
    issues,
    complete: issues.length === 0 && unresolved.length === 0 &&
      (winner !== null || profile.pull_format === 'TwoPullLeague'),
    explanation,
  };
}
