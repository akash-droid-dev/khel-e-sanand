/**
 * Shared calculator contract.
 *
 * §15: "Calculation output: participant ID, completion status, primary result,
 * secondary tie values, proposed rank/winner, reason trace, unresolved decisions
 * and source observation IDs."
 *
 * Every calculator in this package is a PURE function of
 *   (rule profile, observations) → CalculationOutput
 * with no clock, no randomness, no database and no I/O. Two consequences the
 * specification depends on:
 *   - recomputing a locked result from its stored revision reproduces it exactly;
 *   - ties can never be broken by insertion order or record id, because the
 *     calculator cannot see either unless the tie policy names them.
 */
import type { ResultStatus, DisciplineCode } from '@khel/contracts';

/**
 * Which side of a two-participant fixture. Shared by every head-to-head discipline
 * (Kabaddi, Kho Kho, Tug of War, Badminton, Volleyball) so the concept has one
 * definition rather than one per calculator.
 */
export type Side = 'A' | 'B';

/** The opposing side. */
export const otherSide = (s: Side): Side => (s === 'A' ? 'B' : 'A');

/** A participant line in a result: either an individual entry or a team, never both (§14). */
export interface ParticipantRef {
  /** Stable key used throughout the calculation. Opaque to the calculator. */
  participant_id: string;
  kind: 'Entry' | 'Team';
  /** Display identity captured at snapshot time so later renames don't rewrite history (§2). */
  display_name: string;
  /** School credited for this result — frozen at fixture-participant snapshot (AT/§5). */
  school_display?: string;
}

/**
 * One participant's computed outcome.
 * `rank` is null for every non-Completed status — enforced structurally, because
 * GT-005 / §15 require that a DNF/DNS/DQ/NM can never receive rank 1 via a zero value.
 */
export interface ParticipantResult {
  participant_id: string;
  status: ResultStatus;
  /**
   * Primary comparable value in integer base units.
   * Distance → millimetres. Time → microseconds. Points → whole units.
   * null whenever status is not Completed, or no valid measurement exists.
   */
  primary_value: number | null;
  /** Human-facing rendering of primary_value at the profile's display precision. */
  primary_display: string;
  /** Ordered tie-break values, produced in the order the tie policy declares them. */
  secondary_values: number[];
  /** 1-based finishing rank. null unless status === 'Completed' and the tie resolved. */
  rank: number | null;
  /** True when this participant shares its rank with another (only if policy allows). */
  shared_rank: boolean;
  /** Score components kept separately from the total (§16: "Persist components separately"). */
  components?: Record<string, number>;
  /** Why this outcome — every step the calculator took, in order. */
  reason_trace: string[];
  /** Observation ids that produced this line, for review drill-down. */
  source_observation_ids: string[];
}

/**
 * Something a human official must decide before the result can be approved.
 * The calculator NEVER guesses past one of these (§15, GT-007, GT-024).
 */
export interface UnresolvedDecision {
  code:
    | 'TIE_REQUIRES_DECISION'
    | 'ORDER_TIME_CONFLICT'      // finish judge and timing disagree (§17)
    | 'ARBITER_CLAIM_PENDING'    // chess claim not adjudicated (GT-024)
    | 'INCOMPLETE_STRUCTURE'     // missing required turn/set/round (GT-011)
    | 'OFFICIAL_DISPOSITION_REQUIRED'; // abandoned / no-pull / restart (§24, §21)
  message: string;
  /** Participants the decision is between, where applicable. */
  participant_ids: string[];
  /** What the official has to supply. */
  required_input: string;
}

/** A rule the observations violate. Blocking — the revision cannot be submitted. */
export interface ValidationIssue {
  code: string;
  message: string;
  observation_id?: string;
  participant_id?: string;
}

export interface CalculationOutput {
  discipline: DisciplineCode;
  /** Rule version this calculation was pinned to. Stored with the result (§14 lineage). */
  rule_version_id: string;
  participants: ParticipantResult[];
  /** For head-to-head disciplines: the winning participant, if determined. */
  winner_participant_id: string | null;
  /** Ordered standings where the discipline produces them (heats, chess, league). */
  standings: string[];
  unresolved: UnresolvedDecision[];
  issues: ValidationIssue[];
  /** True only when there are no issues and no unresolved decisions. */
  complete: boolean;
  /** Top-level narrative of how the result was reached. */
  explanation: string[];
}

/** Base of every rule profile. Settings are typed configuration, never expressions (§6). */
export interface BaseRuleProfile {
  rule_version_id: string;
  discipline: DisciplineCode;
  /** Ordered, versioned tie policy. Exhausting it yields TIE_REQUIRES_DECISION (§15). */
  tie_procedure: TieRule[];
  /** When true, an exhausted tie policy may award a shared place instead of blocking. */
  allow_shared_place: boolean;
}

/**
 * One step of a tie policy.
 * Comparators are a closed catalogue — a tie can never be broken by an id, a name,
 * a school, data-entry time or hidden randomness (§15).
 */
export interface TieRule {
  comparator: TieComparator;
  direction: 'HigherWins' | 'LowerWins';
  /** For NextBestMark: which attempt rank to compare (2 = second-best, and so on). */
  ordinal?: number;
  /** Human label shown in the reason trace and on the review screen. */
  label: string;
}

export const TIE_COMPARATORS = [
  'NextBestMark',        // field events: compare 2nd best, then 3rd… (§19)
  'HeadToHead',          // result of the match(es) between the tied participants
  'PointsDifference',
  'PointsScored',
  'FewestConceded',
  'OfficialFinishOrder', // sprint judge's recorded order overrides equal times (§17)
  'Buchholz',            // chess: sum of opponents' scores (§22)
  'SonnebornBerger',
  'DirectEncounter',
  'MostWins',
  'DrawingOfLots',       // permitted ONLY when an official records the witnessed decision
  'SharedPlace',         // terminal: explicitly award equal rank
] as const;
export type TieComparator = (typeof TIE_COMPARATORS)[number];

/**
 * Comparators that cannot be computed from observations alone and always
 * require a recorded human decision. Reaching one produces TIE_REQUIRES_DECISION.
 */
export const HUMAN_DECISION_COMPARATORS: readonly TieComparator[] = ['DrawingOfLots'];

/** Convenience for calculators: a participant that did not produce a rankable result. */
export function nonScoringResult(
  participant_id: string,
  status: ResultStatus,
  reason: string,
  observationIds: string[] = [],
): ParticipantResult {
  return {
    participant_id,
    status,
    primary_value: null,
    primary_display: status,
    secondary_values: [],
    rank: null,
    shared_rank: false,
    reason_trace: [reason],
    source_observation_ids: observationIds,
  };
}
