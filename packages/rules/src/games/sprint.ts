/**
 * G02 Athletics — Sprint 30 m / 50 m / 60 m (SP30, SP50, SP60). §17.
 *
 * The central design point: place and time are DIFFERENT facts.
 * §17 — "Keep place and recorded time distinct because rounded displayed times can
 * match while the finish judge records a definite order."
 * So the finish judge's `official_finish_position` classifies the heat, the recorded
 * time supports cross-heat comparison, and a disagreement between the two opens a
 * review case rather than being resolved silently.
 */
import type { DisciplineCode, ResultStatus } from '@khel/contracts';
import type {
  BaseRuleProfile, CalculationOutput, ParticipantResult, ParticipantRef,
  UnresolvedDecision, ValidationIssue,
} from '../types.js';
import { nonScoringResult } from '../types.js';
import { toDurationMicroseconds, formatTime, decimalsForResolution, MeasurementError } from '../units/measure.js';

export const TIMING_METHOD = ['Manual', 'FullyAutomatic', 'ApprovedPlaceOnly'] as const;
export type TimingMethod = (typeof TIMING_METHOD)[number];

export interface SprintObservation {
  observation_id: string;
  participant_id: string;
  /** Lane number. Unique within a heat, within lane capacity (§17). */
  lane: number;
  /** The finish judge's recorded order. Authoritative for classifying this heat. */
  official_finish_position: number | null;
  /** Raw recorded time exactly as captured. Absent under ApprovedPlaceOnly. */
  raw_time_value?: string | null;
  raw_time_unit?: 's' | 'ms' | 'us';
  status: ResultStatus;
  /** Required whenever status is not Completed (§17). */
  official_decision?: string | null;
}

export interface SprintRuleProfile extends BaseRuleProfile {
  discipline: Extract<DisciplineCode, 'SP30' | 'SP50' | 'SP60'>;
  lane_count: number;
  timing_method: TimingMethod;
  /** Smallest unit the device actually resolves, in microseconds. */
  capture_resolution_us: number;
  /** Decimal seconds shown. May not exceed what capture_resolution_us supports. */
  display_precision: number;
  /** Q — qualifiers by place from each heat. */
  place_qualifiers: number;
  /** q — additional qualifiers by time across comparable heats. */
  time_qualifiers: number;
  final_capacity: number;
}

export interface SprintHeatInput {
  profile: SprintRuleProfile;
  /** Heat identifier — used to keep cross-heat comparisons honest. */
  heat_id: string;
  participants: ParticipantRef[];
  observations: SprintObservation[];
}

export function calculateSprintHeat(input: SprintHeatInput): CalculationOutput {
  const { profile, participants, observations, heat_id } = input;
  const issues: ValidationIssue[] = [];
  const unresolved: UnresolvedDecision[] = [];
  const explanation: string[] = [
    `${profile.discipline} heat ${heat_id}: timing ${profile.timing_method}, ` +
    `capture ${profile.capture_resolution_us} µs, display ${profile.display_precision} dp.`,
  ];

  // Lane integrity (§17: unique lane, within capacity).
  const lanes = new Map<number, string>();
  for (const o of observations) {
    if (o.lane < 1 || o.lane > profile.lane_count) {
      issues.push({
        code: 'LANE_OUT_OF_RANGE',
        message: `Lane ${o.lane} is outside the ${profile.lane_count}-lane profile.`,
        observation_id: o.observation_id, participant_id: o.participant_id,
      });
    }
    const held = lanes.get(o.lane);
    if (held) {
      issues.push({
        code: 'LANE_DUPLICATED',
        message: `Lane ${o.lane} is assigned to more than one athlete in this heat.`,
        observation_id: o.observation_id, participant_id: o.participant_id,
      });
    }
    lanes.set(o.lane, o.participant_id);
  }

  const byParticipant = new Map(observations.map((o) => [o.participant_id, o]));
  const results: ParticipantResult[] = [];

  for (const p of participants) {
    const o = byParticipant.get(p.participant_id);
    if (!o) {
      results.push(nonScoringResult(
        p.participant_id, 'DNS',
        'No result recorded for this entrant in the heat. Recorded as DNS pending official confirmation.',
      ));
      issues.push({
        code: 'HEAT_OUTCOME_MISSING',
        message: `${p.display_name} has no recorded outcome. Every lane must have an explicit outcome (§17).`,
        participant_id: p.participant_id,
      });
      continue;
    }

    // §17: DNS/DNF/DQ carry a reason and never an ordinary numeric rank.
    if (o.status !== 'Completed') {
      if (!o.official_decision) {
        issues.push({
          code: 'STATUS_WITHOUT_DECISION',
          message: `${p.display_name} is recorded ${o.status} without an official reason.`,
          observation_id: o.observation_id, participant_id: p.participant_id,
        });
      }
      results.push(nonScoringResult(
        p.participant_id, o.status,
        `${o.status}${o.official_decision ? `: ${o.official_decision}` : ''}. Not ranked.`,
        [o.observation_id],
      ));
      continue;
    }

    let micros: number | null = null;
    if (profile.timing_method === 'ApprovedPlaceOnly') {
      if (o.official_finish_position == null) {
        issues.push({
          code: 'PLACE_REQUIRED',
          message: `Place-only timing requires an official finish position for ${p.display_name}.`,
          observation_id: o.observation_id, participant_id: p.participant_id,
        });
      }
    } else if (o.raw_time_value == null || o.raw_time_value === '') {
      // §17: a completed run needs valid timing data or an expressly approved place-only mode.
      issues.push({
        code: 'TIME_REQUIRED',
        message:
          `${p.display_name} completed the run but no time was recorded, and this competition ` +
          `is not configured for place-only results.`,
        observation_id: o.observation_id, participant_id: p.participant_id,
      });
    } else {
      try {
        micros = toDurationMicroseconds(o.raw_time_value, o.raw_time_unit ?? 's');
      } catch (err) {
        issues.push({
          code: 'TIME_INVALID',
          message: err instanceof MeasurementError ? err.message : String(err),
          observation_id: o.observation_id, participant_id: p.participant_id,
        });
      }
    }

    if (o.official_finish_position == null) {
      issues.push({
        code: 'FINISH_POSITION_MISSING',
        message: `${p.display_name} has no recorded finish position from the judge.`,
        observation_id: o.observation_id, participant_id: p.participant_id,
      });
    }

    results.push({
      participant_id: p.participant_id,
      status: 'Completed',
      primary_value: micros,
      primary_display: micros === null
        ? 'Place only'
        : formatTime(micros, profile.display_precision, profile.capture_resolution_us),
      secondary_values: [],
      // Classification is the judge's order, not the clock (§17).
      rank: o.official_finish_position,
      shared_rank: false,
      components: o.official_finish_position != null
        ? { official_place: o.official_finish_position, lane: o.lane }
        : { lane: o.lane },
      reason_trace: [
        `Lane ${o.lane}. Official finish position ${o.official_finish_position ?? 'not recorded'}.`,
        micros === null
          ? 'No comparable time recorded.'
          : `Recorded time ${o.raw_time_value} ${o.raw_time_unit ?? 's'} = ${micros} µs.`,
      ],
      source_observation_ids: [o.observation_id],
    });
  }

  // Duplicate finish positions are a judging error, not something to average away.
  const places = new Map<number, string[]>();
  for (const r of results) {
    if (r.rank == null) continue;
    const list = places.get(r.rank) ?? [];
    list.push(r.participant_id);
    places.set(r.rank, list);
  }
  for (const [place, ids] of places) {
    if (ids.length > 1) {
      issues.push({
        code: 'FINISH_POSITION_DUPLICATED',
        message: `Finish position ${place} is recorded for ${ids.length} athletes in heat ${heat_id}.`,
      });
    }
  }

  // GT-008 / §17: judge order and clock must agree, or a review case opens.
  unresolved.push(...detectOrderTimeConflicts(results, heat_id));

  const standings = results
    .filter((r) => r.rank !== null)
    .sort((a, b) => a.rank! - b.rank!)
    .map((r) => r.participant_id);

  return {
    discipline: profile.discipline,
    rule_version_id: profile.rule_version_id,
    participants: results,
    winner_participant_id: standings[0] ?? null,
    standings,
    unresolved,
    issues,
    complete: issues.length === 0 && unresolved.length === 0,
    explanation,
  };
}

/**
 * A faster recorded time with a worse recorded place is a contradiction.
 * §17: "A conflict between official order and timing opens a review case.
 * Never resolve it silently." Equal displayed times with distinct places are NOT a
 * conflict — that is exactly the case GT-008 says to preserve.
 */
function detectOrderTimeConflicts(
  results: ParticipantResult[],
  heatId: string,
): UnresolvedDecision[] {
  const timed = results.filter(
    (r): r is ParticipantResult & { primary_value: number; rank: number } =>
      r.status === 'Completed' && r.primary_value !== null && r.rank !== null,
  );
  const out: UnresolvedDecision[] = [];

  for (let i = 0; i < timed.length; i += 1) {
    for (let j = i + 1; j < timed.length; j += 1) {
      const a = timed[i]!;
      const b = timed[j]!;
      const fasterIsA = a.primary_value < b.primary_value;
      const aheadIsA = a.rank < b.rank;
      if (a.primary_value === b.primary_value) continue; // equal times, distinct places: fine
      if (fasterIsA !== aheadIsA) {
        out.push({
          code: 'ORDER_TIME_CONFLICT',
          message:
            `In heat ${heatId} the finish judge and the timing disagree: ` +
            `one athlete is placed ahead but recorded slower. The software does not choose between them.`,
          participant_ids: [a.participant_id, b.participant_id],
          required_input:
            'The referee confirms either the finish order or the timing, and records the decision.',
        });
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Qualification to the final
 * ------------------------------------------------------------------ */

export interface HeatClassification {
  heat_id: string;
  /** Ordered by official finish position. */
  results: ParticipantResult[];
  /** Timing context for cross-heat comparability. */
  timing_method: TimingMethod;
  capture_resolution_us: number;
}

export interface QualificationOutcome {
  /** Qualified by place within their heat. */
  by_place: { participant_id: string; heat_id: string; place: number }[];
  /** Qualified by time across comparable heats. */
  by_time: { participant_id: string; heat_id: string; time_us: number }[];
  unresolved: UnresolvedDecision[];
  issues: ValidationIssue[];
  explanation: string[];
}

/**
 * §17: "first selects the configured number by place from each heat, then selects
 * remaining time qualifiers from eligible non-qualifiers across comparable heats.
 * Deduplicate entries. Stop on a cutoff tie requiring an official decision or extra capacity."
 */
export function qualifyToFinal(
  heats: HeatClassification[],
  profile: SprintRuleProfile,
): QualificationOutcome {
  const out: QualificationOutcome = {
    by_place: [], by_time: [], unresolved: [], issues: [], explanation: [],
  };
  const qualified = new Set<string>();

  // --- Q by place ---
  for (const heat of heats) {
    const ordered = heat.results
      .filter((r) => r.status === 'Completed' && r.rank !== null)
      .sort((a, b) => a.rank! - b.rank!);
    for (const r of ordered.slice(0, profile.place_qualifiers)) {
      if (qualified.has(r.participant_id)) continue; // deduplicate
      qualified.add(r.participant_id);
      out.by_place.push({ participant_id: r.participant_id, heat_id: heat.heat_id, place: r.rank! });
    }
  }
  out.explanation.push(
    `Q by place: top ${profile.place_qualifiers} from each of ${heats.length} heat(s) → ` +
    `${out.by_place.length} qualifier(s).`,
  );

  // --- q by time, across comparable heats only ---
  if (profile.time_qualifiers > 0) {
    const reference = heats[0];
    const comparable = reference
      ? heats.filter((h) =>
          h.timing_method === reference.timing_method &&
          h.capture_resolution_us === reference.capture_resolution_us)
      : [];

    if (comparable.length !== heats.length) {
      out.issues.push({
        code: 'HEATS_NOT_COMPARABLE',
        message:
          'Time qualification requires heats captured by the same method at the same resolution. ' +
          'Heats differ, so times cannot be compared across them.',
      });
    }

    const pool: { participant_id: string; heat_id: string; time_us: number }[] = [];
    for (const heat of comparable) {
      for (const r of heat.results) {
        if (qualified.has(r.participant_id)) continue;
        if (r.status !== 'Completed' || r.primary_value === null) continue;
        pool.push({ participant_id: r.participant_id, heat_id: heat.heat_id, time_us: r.primary_value });
      }
    }
    pool.sort((a, b) => a.time_us - b.time_us);

    const slots = profile.time_qualifiers;
    if (pool.length > slots) {
      const cutoff = pool[slots - 1]?.time_us;
      const boundary = pool.filter((x) => x.time_us === cutoff);
      // GT-007: a tie on the cutoff time blocks progression until an official decides.
      if (cutoff !== undefined && boundary.length > 1) {
        const insideCount = pool.slice(0, slots).filter((x) => x.time_us === cutoff).length;
        if (insideCount < boundary.length) {
          out.unresolved.push({
            code: 'TIE_REQUIRES_DECISION',
            message:
              `${boundary.length} athletes share the qualifying cut-off time and only ` +
              `${insideCount} time slot(s) remain. Progression is blocked.`,
            participant_ids: boundary.map((x) => x.participant_id),
            required_input:
              'The referee either applies the published tie procedure or authorises extra capacity in the final.',
          });
          out.explanation.push('q by time: blocked by a cut-off tie; no time qualifiers selected.');
          return out;
        }
      }
    }

    for (const x of pool.slice(0, slots)) {
      qualified.add(x.participant_id);
      out.by_time.push(x);
    }
    out.explanation.push(`q by time: next ${out.by_time.length} fastest non-qualifier(s).`);
  }

  // §17: "Final capacity must equal or exceed accepted qualifiers."
  const total = out.by_place.length + out.by_time.length;
  if (total > profile.final_capacity) {
    out.issues.push({
      code: 'FINAL_CAPACITY_EXCEEDED',
      message:
        `${total} athletes qualified but the final has capacity for ${profile.final_capacity}. ` +
        `Increase capacity or apply a published quota — athletes are not dropped automatically.`,
    });
  }
  out.explanation.push(`Total qualifiers: ${total} (final capacity ${profile.final_capacity}).`);
  return out;
}

/** Guard used when building a start list: SP30 results cannot seed an SP50 final (§17). */
export function assertSameDiscipline(a: DisciplineCode, b: DisciplineCode): void {
  if (a !== b) {
    throw new Error(
      `Discipline mismatch: a ${a} result cannot qualify an athlete into a ${b} round. ` +
      `Each sprint distance is an independent discipline (§17).`,
    );
  }
}

export { decimalsForResolution };
