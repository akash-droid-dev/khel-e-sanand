/**
 * Attempts calculator — G04 Softball Throw (SBT), G05 Kids Javelin (KJT),
 * G08 Standing Broad Jump (SBJ).
 *
 * Spec §19, §20, §23. Two scoring modes, and a competition uses exactly one:
 *   Distance      — best valid measured attempt, ties by the approved next-best chain.
 *   TargetPoints   — KJT only, zone → points, aggregated Best or Sum.
 * §20 is emphatic that "A zone score cannot be added to a distance", so the two modes
 * never share a value field; mixing them is a validation failure, not a coercion.
 */
import type { DisciplineCode, ResultStatus } from '@khel/contracts';
import type {
  BaseRuleProfile, CalculationOutput, ParticipantResult, ParticipantRef,
  ValidationIssue, TieRule,
} from '../types.js';
import { nonScoringResult } from '../types.js';
import { rankParticipants, applyRanking, type ComparatorResolver } from '../tie.js';
import { toMillimetres, formatDistance, MeasurementError, type DistanceUnit } from '../units/measure.js';

/** §19: "outcome (valid/foul/pass/not_taken)". */
export const ATTEMPT_OUTCOME = ['valid', 'foul', 'pass', 'not_taken'] as const;
export type AttemptOutcome = (typeof ATTEMPT_OUTCOME)[number];

export interface AttemptObservation {
  observation_id: string;
  participant_id: string;
  /** 1-based, must be sequential and within the profile's attempt cap. */
  attempt_no: number;
  outcome: AttemptOutcome;
  /** Distance mode: the raw measurement exactly as the judge recorded it. */
  raw_value?: string | null;
  raw_unit?: DistanceUnit | null;
  /** TargetPoints mode: the zone the official declared. Never a distance. */
  zone_id?: string | null;
  /** §19: practice throws are tagged and excluded from results. */
  is_practice?: boolean;
  /** Judge's reason for a foul, or the reason a replacement attempt was granted. */
  reason?: string | null;
  /** §19: "An official replacement attempt explicitly references the void attempt." */
  replaces_observation_id?: string | null;
  /** The official who made the validity decision. */
  judge_membership_id?: string | null;
}

export interface AttemptsRuleProfile extends BaseRuleProfile {
  discipline: Extract<DisciplineCode, 'SBT' | 'KJT' | 'SBJ'>;
  /** Number of attempts each athlete is entitled to. */
  attempts: number;
  scoring_mode: 'Distance' | 'TargetPoints';
  /** Distance mode: unit the judges record in. Everything normalises to integer mm. */
  measurement_unit?: DistanceUnit;
  /** TargetPoints mode (KJT only): zone id → integer points. */
  zone_mapping?: Record<string, number>;
  /** TargetPoints mode: how attempts combine. */
  aggregation?: 'Best' | 'Sum';
  /** Implement profile pinned to this competition; attempts must match it. */
  implement_profile_id?: string | null;
}

export interface AttemptsInput {
  profile: AttemptsRuleProfile;
  participants: ParticipantRef[];
  observations: AttemptObservation[];
}

export function calculateAttempts(input: AttemptsInput): CalculationOutput {
  const { profile, participants, observations } = input;
  const issues: ValidationIssue[] = [];
  const explanation: string[] = [];

  if (profile.scoring_mode === 'TargetPoints' && profile.discipline !== 'KJT') {
    issues.push({
      code: 'SCORING_MODE_NOT_SUPPORTED',
      message: `Target-points scoring is configured only for Kids Javelin Throw, not ${profile.discipline}.`,
    });
  }
  explanation.push(
    `${profile.discipline}: ${profile.scoring_mode} mode, ${profile.attempts} attempt(s) per athlete.`,
  );

  // Practice attempts never reach the result (§19).
  const live = observations.filter((o) => !o.is_practice);

  // Superseded attempts: a replacement voids exactly the attempt it names (§19).
  const replaced = new Set(
    live.map((o) => o.replaces_observation_id).filter((v): v is string => !!v),
  );
  const effective = live.filter((o) => !replaced.has(o.observation_id));

  const byParticipant = new Map<string, AttemptObservation[]>();
  for (const p of participants) byParticipant.set(p.participant_id, []);
  for (const o of effective) {
    const list = byParticipant.get(o.participant_id);
    if (!list) {
      issues.push({
        code: 'UNKNOWN_PARTICIPANT',
        message: `Attempt recorded for a participant who is not in this fixture.`,
        observation_id: o.observation_id,
        participant_id: o.participant_id,
      });
      continue;
    }
    list.push(o);
  }

  const results: ParticipantResult[] = [];

  for (const p of participants) {
    const attempts = (byParticipant.get(p.participant_id) ?? [])
      .slice()
      .sort((a, b) => a.attempt_no - b.attempt_no);

    issues.push(...validateAttemptSequence(attempts, profile));

    // §23 GT-027: an unrecorded attempt leaves the round INCOMPLETE. It is not NM,
    // and it is certainly not a zero-distance valid attempt.
    const unresolved = attempts.filter((a) => a.outcome === 'not_taken');
    const recordedCount = attempts.length;
    const missingCount = profile.attempts - recordedCount;

    if (unresolved.length > 0 || missingCount > 0) {
      const r = nonScoringResult(
        p.participant_id, 'Completed',
        `Round incomplete: ${unresolved.length} attempt(s) marked not taken and ` +
        `${Math.max(0, missingCount)} attempt(s) not recorded. An unrecorded attempt is ` +
        `not a foul and not a zero mark.`,
        attempts.map((a) => a.observation_id),
      );
      r.primary_display = 'Incomplete';
      results.push(r);
      issues.push({
        code: 'ATTEMPT_ROUND_INCOMPLETE',
        message:
          `${p.display_name}: ${recordedCount}/${profile.attempts} attempts recorded, ` +
          `${unresolved.length} still marked not taken.`,
        participant_id: p.participant_id,
      });
      continue;
    }

    const computed = profile.scoring_mode === 'Distance'
      ? computeDistance(p, attempts, profile, issues)
      : computeTargetPoints(p, attempts, profile, issues);
    results.push(computed);
  }

  // ---- Ranking -------------------------------------------------------------
  // Distance and points both rank higher-is-better; the tie chain differs per profile.
  const resolver = makeResolver(byParticipant, profile);
  const ranking = rankParticipants(
    results.map((r) => ({ participant_id: r.participant_id, primary_value: r.primary_value })),
    {
      direction: 'HigherWins',
      policy: profile.tie_procedure,
      allowSharedPlace: profile.allow_shared_place,
      resolve: resolver,
    },
  );
  applyRanking(results, ranking);

  const winner = results.find((r) => r.rank === 1 && !r.shared_rank)?.participant_id ?? null;
  const standings = results
    .filter((r) => r.rank !== null)
    .sort((a, b) => a.rank! - b.rank!)
    .map((r) => r.participant_id);

  return {
    discipline: profile.discipline,
    rule_version_id: profile.rule_version_id,
    participants: results,
    winner_participant_id: winner,
    standings,
    unresolved: ranking.unresolved,
    issues,
    complete: issues.length === 0 && ranking.unresolved.length === 0,
    explanation,
  };
}

/* ------------------------------------------------------------------ *
 * Distance mode
 * ------------------------------------------------------------------ */

function computeDistance(
  p: ParticipantRef,
  attempts: AttemptObservation[],
  profile: AttemptsRuleProfile,
  issues: ValidationIssue[],
): ParticipantResult {
  const trace: string[] = [];
  const marks: number[] = [];
  const obsIds = attempts.map((a) => a.observation_id);

  for (const a of attempts) {
    if (a.outcome !== 'valid') {
      trace.push(`Attempt ${a.attempt_no}: ${a.outcome}${a.reason ? ` (${a.reason})` : ''} — no mark.`);
      // §19: "Store a valid distance only for a valid attempt."
      if (a.raw_value != null && a.raw_value !== '') {
        issues.push({
          code: 'MARK_ON_INVALID_ATTEMPT',
          message:
            `Attempt ${a.attempt_no} is recorded as ${a.outcome} but carries a distance. ` +
            `A distance is stored only for a valid attempt.`,
          observation_id: a.observation_id,
          participant_id: p.participant_id,
        });
      }
      continue;
    }

    if (a.raw_value == null || a.raw_value === '') {
      issues.push({
        code: 'VALID_ATTEMPT_WITHOUT_MARK',
        message: `Attempt ${a.attempt_no} is marked valid but no distance was recorded.`,
        observation_id: a.observation_id,
        participant_id: p.participant_id,
      });
      continue;
    }

    const unit = a.raw_unit ?? profile.measurement_unit ?? 'm';
    try {
      const mm = toMillimetres(a.raw_value, unit);
      marks.push(mm);
      trace.push(`Attempt ${a.attempt_no}: valid, ${a.raw_value} ${unit} = ${mm} mm.`);
    } catch (err) {
      issues.push({
        code: 'MEASUREMENT_INVALID',
        message: err instanceof MeasurementError ? err.message : String(err),
        observation_id: a.observation_id,
        participant_id: p.participant_id,
      });
    }
  }

  // §19 / GT-013: no valid attempt yields NM — never a numeric rank, never zero.
  if (marks.length === 0) {
    const r = nonScoringResult(
      p.participant_id, 'NM',
      'No valid attempt. NM is a status, not a zero distance, and carries no rank.',
      obsIds,
    );
    r.reason_trace.unshift(...trace);
    return r;
  }

  const sortedDesc = [...marks].sort((a, b) => b - a);
  const best = sortedDesc[0]!;
  trace.push(`Best valid mark: ${best} mm from ${marks.length} valid attempt(s).`);

  return {
    participant_id: p.participant_id,
    status: 'Completed',
    primary_value: best,
    primary_display: formatDistance(best, 'm'),
    secondary_values: [],
    rank: null,
    shared_rank: false,
    components: { valid_attempts: marks.length, best_mm: best },
    reason_trace: trace,
    source_observation_ids: obsIds,
  };
}

/* ------------------------------------------------------------------ *
 * Target-points mode (KJT only)
 * ------------------------------------------------------------------ */

function computeTargetPoints(
  p: ParticipantRef,
  attempts: AttemptObservation[],
  profile: AttemptsRuleProfile,
  issues: ValidationIssue[],
): ParticipantResult {
  const trace: string[] = [];
  const obsIds = attempts.map((a) => a.observation_id);
  const mapping = profile.zone_mapping ?? {};
  const points: number[] = [];

  for (const a of attempts) {
    if (a.outcome !== 'valid') {
      trace.push(`Attempt ${a.attempt_no}: ${a.outcome} — no zone points.`);
      continue;
    }

    // GT-017: a distance entered into a zone field is a type failure, not a conversion.
    if (a.raw_value != null && a.raw_value !== '') {
      issues.push({
        code: 'DISTANCE_IN_TARGET_MODE',
        message:
          `Attempt ${a.attempt_no} carries a distance measurement, but this competition ` +
          `is configured for target points. A zone score and a distance are different ` +
          `quantities and cannot be combined.`,
        observation_id: a.observation_id,
        participant_id: p.participant_id,
      });
      continue;
    }

    if (!a.zone_id) {
      issues.push({
        code: 'ZONE_MISSING',
        message: `Attempt ${a.attempt_no} is valid but no landing zone was declared by the official.`,
        observation_id: a.observation_id,
        participant_id: p.participant_id,
      });
      continue;
    }

    const value = mapping[a.zone_id];
    if (value === undefined) {
      issues.push({
        code: 'ZONE_NOT_IN_MAPPING',
        message: `Zone "${a.zone_id}" is not part of the approved zone mapping for this rule version.`,
        observation_id: a.observation_id,
        participant_id: p.participant_id,
      });
      continue;
    }

    points.push(value);
    trace.push(`Attempt ${a.attempt_no}: valid, zone ${a.zone_id} = ${value} point(s).`);
  }

  if (points.length === 0) {
    const r = nonScoringResult(
      p.participant_id, 'NM', 'No valid attempt scored a zone.', obsIds,
    );
    r.reason_trace.unshift(...trace);
    return r;
  }

  const aggregation = profile.aggregation ?? 'Sum';
  const total = aggregation === 'Sum'
    ? points.reduce((a, b) => a + b, 0)
    : Math.max(...points);
  trace.push(`${aggregation} of ${points.join(', ')} = ${total} point(s).`);

  return {
    participant_id: p.participant_id,
    status: 'Completed',
    primary_value: total,
    primary_display: `${total} pts`,
    secondary_values: [],
    rank: null,
    shared_rank: false,
    components: { valid_attempts: points.length, total_points: total },
    reason_trace: trace,
    source_observation_ids: obsIds,
  };
}

/* ------------------------------------------------------------------ *
 * Validation and tie resolution
 * ------------------------------------------------------------------ */

function validateAttemptSequence(
  attempts: AttemptObservation[],
  profile: AttemptsRuleProfile,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<number>();

  for (const a of attempts) {
    if (seen.has(a.attempt_no)) {
      issues.push({
        code: 'DUPLICATE_ATTEMPT_NUMBER',
        message: `Attempt ${a.attempt_no} is recorded more than once.`,
        observation_id: a.observation_id,
        participant_id: a.participant_id,
      });
    }
    seen.add(a.attempt_no);

    if (a.attempt_no < 1) {
      issues.push({
        code: 'ATTEMPT_NUMBER_INVALID',
        message: `Attempt numbers start at 1.`,
        observation_id: a.observation_id,
        participant_id: a.participant_id,
      });
    }

    // §19: exceeding the cap needs a recorded replacement/exception, not a silent extra go.
    if (a.attempt_no > profile.attempts && !a.replaces_observation_id) {
      issues.push({
        code: 'ATTEMPT_CAP_EXCEEDED',
        message:
          `Attempt ${a.attempt_no} exceeds the ${profile.attempts}-attempt profile and does not ` +
          `reference a voided attempt. An extra attempt requires a recorded official replacement.`,
        observation_id: a.observation_id,
        participant_id: a.participant_id,
      });
    }
  }
  return issues;
}

/**
 * Tie comparators for measured events.
 * GT-014: "A:13.1/12.4; B:13.1/12.3 → A ahead IF the next-best rule was adopted."
 * The "if" is load-bearing — with no NextBestMark rule in the policy the two stay tied.
 */
function makeResolver(
  byParticipant: Map<string, AttemptObservation[]>,
  profile: AttemptsRuleProfile,
): ComparatorResolver {
  return (participantId: string, rule: TieRule): number | null => {
    if (rule.comparator !== 'NextBestMark') return null;

    const ordinal = rule.ordinal ?? 2; // 2 = second-best mark
    const attempts = byParticipant.get(participantId) ?? [];
    const values: number[] = [];

    for (const a of attempts) {
      if (a.outcome !== 'valid') continue;
      if (profile.scoring_mode === 'Distance') {
        if (!a.raw_value) continue;
        try {
          values.push(toMillimetres(a.raw_value, a.raw_unit ?? profile.measurement_unit ?? 'm'));
        } catch { /* already reported as a validation issue */ }
      } else if (a.zone_id) {
        const v = profile.zone_mapping?.[a.zone_id];
        if (v !== undefined) values.push(v);
      }
    }

    values.sort((x, y) => y - x);
    // Fewer valid marks than the ordinal asks for: not comparable → official decision.
    return values.length >= ordinal ? values[ordinal - 1]! : null;
  };
}

/** Convenience factory for the commonest adopted chain: best, then 2nd best, then 3rd. */
export function nextBestTieChain(depth = 3): TieRule[] {
  const rules: TieRule[] = [];
  for (let i = 2; i <= depth; i += 1) {
    rules.push({
      comparator: 'NextBestMark',
      direction: 'HigherWins',
      ordinal: i,
      label: `${ordinalLabel(i)}-best valid mark`,
    });
  }
  return rules;
}

function ordinalLabel(n: number): string {
  return n === 2 ? 'Second' : n === 3 ? 'Third' : `${n}th`;
}

export const ATTEMPTS_STATUSES: readonly ResultStatus[] = ['Completed', 'NM', 'DNS', 'DQ'];
