/**
 * G06 Cycling (CYC). §21.
 *
 * Two profiles that are genuinely different competitions, not two views of one:
 *   TimeTrial — riders started separately; ranked by final elapsed time + penalties.
 *   MassStart — riders started together; classified by the official FINISHING ORDER
 *               after the required distance. §21 is explicit that you must NOT rank
 *               all riders by personal elapsed time in a mass start.
 */
import type { DisciplineCode, ResultStatus } from '@khel/contracts';
import type {
  BaseRuleProfile, CalculationOutput, ParticipantResult, ParticipantRef,
  UnresolvedDecision, ValidationIssue,
} from '../types.js';
import { nonScoringResult } from '../types.js';
import { rankParticipants, applyRanking } from '../tie.js';
import { toMicroseconds, formatTime, MeasurementError } from '../units/measure.js';

export type StartMode = 'TimeTrial' | 'MassStart';
export type StartReference = 'OfficialActualStart' | 'ScheduledStartUnderLateStartRule';

/** One recorded crossing of a checkpoint or lap line. */
export interface CyclingPassage {
  observation_id: string;
  participant_id: string;
  /** 1-based lap or checkpoint number. */
  lap_number: number;
  /** Official crossing time in the event's timing reference. */
  crossing_time_value: string;
  crossing_time_unit: 's' | 'ms' | 'us';
  /**
   * Identity of the underlying timing event.
   * GT-020: the same device event imported twice must count once — a re-import is
   * not a second lap. Deduplication uses this, never the row's arrival order.
   */
  source_event_id: string;
  /**
   * Which clock produced this timestamp. §21: "All combined timestamps must share a
   * valid timing reference, not unrelated phones' wall clocks."
   */
  timing_reference_id: string;
}

export interface CyclingStart {
  participant_id: string;
  bib: string;
  /** Scheduled start, in the event timing reference. */
  scheduled_start_value: string;
  /** Official actual start. Absent means the rider did not start. */
  official_start_value?: string | null;
  time_unit: 's' | 'ms' | 'us';
  /** §21: equipment must be cleared; not-cleared is its own state, not a DQ. */
  equipment_cleared: boolean;
}

export interface CyclingFinish {
  participant_id: string;
  /** Official finish crossing. */
  finish_time_value?: string | null;
  time_unit: 's' | 'ms' | 'us';
  /** Mass-start only: the judge's recorded finishing order. */
  official_finish_position?: number | null;
  /** Approved time penalties, already totalled by the commissaire. */
  penalty_value?: string | null;
  penalty_unit?: 's' | 'ms' | 'us';
  status: ResultStatus;
  official_decision?: string | null;
}

export interface CyclingRuleProfile extends BaseRuleProfile {
  discipline: Extract<DisciplineCode, 'CYC'>;
  start_mode: StartMode;
  /** Which instant elapsed time is measured from (§21 — pin this policy explicitly). */
  start_reference: StartReference;
  /** Laps required to complete the distance. */
  required_laps: number;
  /** The single approved clock. Passages from any other reference are rejected. */
  timing_reference_id: string;
  /**
   * How riders who did not complete the required distance are classified.
   * 'NotClassified' is the safe default; anything else is an adopted local rule.
   */
  lapped_classification: 'NotClassified' | 'ClassifiedByLapsThenOrder';
}

export interface CyclingInput {
  profile: CyclingRuleProfile;
  participants: ParticipantRef[];
  starts: CyclingStart[];
  passages: CyclingPassage[];
  finishes: CyclingFinish[];
  /** §21: a neutralised race suspends normal calculation until an official disposes of it. */
  neutralised?: boolean;
  neutralisation_reason?: string | null;
}

export function calculateCycling(input: CyclingInput): CalculationOutput {
  const { profile, participants } = input;
  const issues: ValidationIssue[] = [];
  const unresolved: UnresolvedDecision[] = [];
  const explanation: string[] = [
    `CYC ${profile.start_mode}: ${profile.required_laps} lap(s) required, ` +
    `elapsed measured from ${profile.start_reference}.`,
  ];

  if (input.neutralised) {
    unresolved.push({
      code: 'OFFICIAL_DISPOSITION_REQUIRED',
      message:
        `The race is neutralised${input.neutralisation_reason ? `: ${input.neutralisation_reason}` : ''}. ` +
        `Normal calculation is suspended until an official records the restart or void decision.`,
      participant_ids: participants.map((p) => p.participant_id),
      required_input: 'Record the restart, carry-over or void decision for the neutralised race.',
    });
  }

  // ---- Deduplicate passages (GT-020) --------------------------------------
  const seenSourceEvents = new Set<string>();
  const seenLapPerRider = new Set<string>();
  const validPassages: CyclingPassage[] = [];
  let duplicateCount = 0;

  for (const p of input.passages) {
    if (p.timing_reference_id !== profile.timing_reference_id) {
      issues.push({
        code: 'TIMING_REFERENCE_MISMATCH',
        message:
          `A passage was recorded against timing reference "${p.timing_reference_id}" but this ` +
          `race is timed by "${profile.timing_reference_id}". Timestamps from unrelated clocks ` +
          `cannot be combined.`,
        observation_id: p.observation_id, participant_id: p.participant_id,
      });
      continue;
    }
    if (seenSourceEvents.has(p.source_event_id)) { duplicateCount += 1; continue; }
    seenSourceEvents.add(p.source_event_id);

    const lapKey = `${p.participant_id}#${p.lap_number}`;
    if (seenLapPerRider.has(lapKey)) {
      duplicateCount += 1;
      issues.push({
        code: 'DUPLICATE_LAP_CROSSING',
        message:
          `Lap ${p.lap_number} is recorded twice for the same rider from different source events. ` +
          `A re-imported crossing does not add a lap.`,
        observation_id: p.observation_id, participant_id: p.participant_id,
      });
      continue;
    }
    seenLapPerRider.add(lapKey);
    validPassages.push(p);
  }
  if (duplicateCount > 0) {
    explanation.push(`${duplicateCount} duplicate timing passage(s) discarded.`);
  }

  const lapsByRider = new Map<string, number[]>();
  for (const p of validPassages) {
    const list = lapsByRider.get(p.participant_id) ?? [];
    list.push(p.lap_number);
    lapsByRider.set(p.participant_id, list);
  }

  const startByRider = new Map(input.starts.map((s) => [s.participant_id, s]));
  const finishByRider = new Map(input.finishes.map((f) => [f.participant_id, f]));
  const results: ParticipantResult[] = [];

  for (const ref of participants) {
    const start = startByRider.get(ref.participant_id);
    const finish = finishByRider.get(ref.participant_id);
    const laps = (lapsByRider.get(ref.participant_id) ?? []).sort((a, b) => a - b);
    const obsIds = validPassages
      .filter((p) => p.participant_id === ref.participant_id)
      .map((p) => p.observation_id);

    if (!start) {
      results.push(nonScoringResult(ref.participant_id, 'DNS', 'No start record.'));
      continue;
    }
    // §21: equipment-not-cleared is its own state, distinct from a DQ.
    if (!start.equipment_cleared) {
      results.push(nonScoringResult(
        ref.participant_id, 'DNS',
        'Equipment check not cleared — rider not permitted to start. This is not a disqualification.',
        obsIds,
      ));
      continue;
    }
    if (!start.official_start_value) {
      results.push(nonScoringResult(ref.participant_id, 'DNS', 'Rider did not start.', obsIds));
      continue;
    }
    if (!finish || finish.status !== 'Completed') {
      const status: ResultStatus = finish?.status ?? 'DNF';
      if (finish && finish.status !== 'Completed' && !finish.official_decision) {
        issues.push({
          code: 'STATUS_WITHOUT_DECISION',
          message: `${ref.display_name} is recorded ${status} without an official reason.`,
          participant_id: ref.participant_id,
        });
      }
      results.push(nonScoringResult(
        ref.participant_id, status,
        `${status}${finish?.official_decision ? `: ${finish.official_decision}` : ''}.`,
        obsIds,
      ));
      continue;
    }

    // Lap sequence integrity: laps must be 1..n with no gaps.
    const expected = Array.from({ length: laps.length }, (_, i) => i + 1);
    if (laps.join(',') !== expected.join(',')) {
      issues.push({
        code: 'LAP_SEQUENCE_BROKEN',
        message:
          `${ref.display_name}'s recorded laps (${laps.join(', ') || 'none'}) are not a complete ` +
          `sequence from 1. A missing lap must be reviewed, not assumed.`,
        participant_id: ref.participant_id,
      });
    }

    const completedLaps = laps.length;
    const fullDistance = completedLaps >= profile.required_laps;

    // ---- Elapsed and final time ----
    let finalUs: number | null = null;
    const trace: string[] = [`Completed ${completedLaps}/${profile.required_laps} lap(s).`];

    if (finish.finish_time_value) {
      try {
        const startRef = profile.start_reference === 'OfficialActualStart'
          ? start.official_start_value
          : start.scheduled_start_value;
        const startUs = toMicroseconds(startRef, start.time_unit);
        const finishUs = toMicroseconds(finish.finish_time_value, finish.time_unit);
        const elapsed = finishUs - startUs;
        if (elapsed <= 0) {
          issues.push({
            code: 'ELAPSED_NOT_POSITIVE',
            message: `${ref.display_name}'s finish is not after their start reference.`,
            participant_id: ref.participant_id,
          });
        } else {
          const penaltyUs = finish.penalty_value
            ? toMicroseconds(finish.penalty_value, finish.penalty_unit ?? 's')
            : 0;
          finalUs = elapsed + penaltyUs;
          trace.push(
            `Elapsed ${elapsed} µs from ${profile.start_reference}` +
            (penaltyUs ? ` + ${penaltyUs} µs approved penalty` : '') +
            ` = final ${finalUs} µs.`,
          );
        }
      } catch (err) {
        issues.push({
          code: 'TIME_INVALID',
          message: err instanceof MeasurementError ? err.message : String(err),
          participant_id: ref.participant_id,
        });
      }
    }

    // GT-019: a rider short of the required distance is not a full-distance finisher.
    if (!fullDistance) {
      const classified = profile.lapped_classification === 'ClassifiedByLapsThenOrder';
      trace.push(
        `Did not complete the required distance. ${classified
          ? 'Classified behind all full-distance finishers under the adopted lapped-rider rule.'
          : 'Not classified — the adopted profile does not rank lapped riders.'}`,
      );
      const r = nonScoringResult(
        ref.participant_id, classified ? 'Completed' : 'DNF',
        trace.join(' '), obsIds,
      );
      r.components = { completed_laps: completedLaps, full_distance: 0 };
      if (classified) {
        // Ranked, but strictly after every full-distance rider — never on time.
        r.primary_display = `${completedLaps} lap(s)`;
      }
      results.push(r);
      continue;
    }

    const isMassStart = profile.start_mode === 'MassStart';
    if (isMassStart && finish.official_finish_position == null) {
      issues.push({
        code: 'FINISH_POSITION_MISSING',
        message:
          `${ref.display_name} has no official finishing position. A mass-start race is ` +
          `classified by finishing order, not by personal elapsed time (§21).`,
        participant_id: ref.participant_id,
      });
    }

    results.push({
      participant_id: ref.participant_id,
      status: 'Completed',
      // Mass start ranks on the judge's order; time trial ranks on final time.
      primary_value: isMassStart ? (finish.official_finish_position ?? null) : finalUs,
      primary_display: isMassStart
        ? `Position ${finish.official_finish_position ?? '—'}`
        : finalUs !== null ? formatTime(finalUs, 2, 10_000) : '—',
      secondary_values: [],
      rank: null,
      shared_rank: false,
      components: {
        completed_laps: completedLaps,
        full_distance: 1,
        ...(finalUs !== null ? { final_time_us: finalUs } : {}),
        ...(finish.official_finish_position != null
          ? { official_position: finish.official_finish_position } : {}),
      },
      reason_trace: trace,
      source_observation_ids: obsIds,
    });
  }

  // ---- Ranking -------------------------------------------------------------
  // Full-distance finishers only. Lapped riders classified by the adopted rule are
  // appended afterwards so they can never displace a full-distance rider.
  const fullDistance = results.filter((r) => r.status === 'Completed' && r.components?.full_distance === 1);
  const lappedClassified = results.filter(
    (r) => r.status === 'Completed' && r.components?.full_distance === 0,
  );

  const ranking = rankParticipants(
    fullDistance.map((r) => ({ participant_id: r.participant_id, primary_value: r.primary_value })),
    {
      // Both modes are lower-is-better: a smaller final time, or a smaller
      // official finishing position. The primary_value differs, the direction does not.
      direction: 'LowerWins',
      policy: profile.tie_procedure,
      allowSharedPlace: profile.allow_shared_place,
      resolve: () => null,
    },
  );
  applyRanking(fullDistance, ranking);

  let nextRank = fullDistance.filter((r) => r.rank !== null).length + 1;
  for (const r of lappedClassified.sort(
    (a, b) => (b.components?.completed_laps ?? 0) - (a.components?.completed_laps ?? 0),
  )) {
    r.rank = nextRank;
    r.reason_trace.push(`Rank ${nextRank}, behind all full-distance finishers.`);
    nextRank += 1;
  }

  const standings = [...fullDistance, ...lappedClassified]
    .filter((r) => r.rank !== null)
    .sort((a, b) => a.rank! - b.rank!)
    .map((r) => r.participant_id);

  const winner = input.neutralised
    ? null
    : (fullDistance.find((r) => r.rank === 1 && !r.shared_rank)?.participant_id ?? null);

  return {
    discipline: 'CYC',
    rule_version_id: profile.rule_version_id,
    participants: results,
    winner_participant_id: winner,
    standings,
    unresolved: [...unresolved, ...ranking.unresolved],
    issues,
    complete: issues.length === 0 && unresolved.length === 0 && ranking.unresolved.length === 0,
    explanation,
  };
}
