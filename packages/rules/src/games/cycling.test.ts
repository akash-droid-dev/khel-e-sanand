/** Game test vectors GT-018 … GT-020 (Cycling). §21. */
import { describe, it, expect } from 'vitest';
import {
  calculateCycling, type CyclingRuleProfile, type CyclingPassage,
  type CyclingStart, type CyclingFinish,
} from './cycling.js';
import type { ParticipantRef } from '../types.js';

const P = (id: string): ParticipantRef => ({
  participant_id: id, kind: 'Entry', display_name: `Rider ${id}`,
});

const CLOCK = 'chip-timer-1';

const profile = (over: Partial<CyclingRuleProfile> = {}): CyclingRuleProfile => ({
  rule_version_id: 'RV-CYC-1', discipline: 'CYC',
  start_mode: 'TimeTrial', start_reference: 'OfficialActualStart',
  required_laps: 3, timing_reference_id: CLOCK,
  lapped_classification: 'NotClassified',
  tie_procedure: [], allow_shared_place: false,
  ...over,
});

const start = (id: string, official = '0', cleared = true): CyclingStart => ({
  participant_id: id, bib: id, scheduled_start_value: '0',
  official_start_value: official, time_unit: 's', equipment_cleared: cleared,
});

let n = 0;
const lap = (id: string, lap_number: number, at: string, over: Partial<CyclingPassage> = {}): CyclingPassage => ({
  observation_id: `o-${++n}`, participant_id: id, lap_number,
  crossing_time_value: at, crossing_time_unit: 's',
  source_event_id: `evt-${id}-${lap_number}`, timing_reference_id: CLOCK, ...over,
});

const finish = (id: string, at: string, over: Partial<CyclingFinish> = {}): CyclingFinish => ({
  participant_id: id, finish_time_value: at, time_unit: 's',
  status: 'Completed', ...over,
});

describe('GT-018 — time trial penalty', () => {
  it('120.50 s plus a 5.00 s penalty yields 125.50 s', () => {
    const out = calculateCycling({
      profile: profile(),
      participants: [P('r1')],
      starts: [start('r1', '0')],
      passages: [lap('r1', 1, '40'), lap('r1', 2, '80'), lap('r1', 3, '120.50')],
      finishes: [finish('r1', '120.50', { penalty_value: '5.00', penalty_unit: 's' })],
    });
    const r = out.participants[0]!;
    expect(r.status).toBe('Completed');
    expect(r.components!.final_time_us).toBe(125_500_000); // 125.50 s exactly
    expect(r.primary_display).toBe('125.50 s');
    expect(r.rank).toBe(1);
    expect(out.issues).toEqual([]);
  });

  it('ranks time trial riders by final time including penalties', () => {
    const out = calculateCycling({
      profile: profile(),
      participants: [P('clean'), P('penalised')],
      starts: [start('clean', '0'), start('penalised', '0')],
      passages: [
        lap('clean', 1, '40'), lap('clean', 2, '80'), lap('clean', 3, '123.00'),
        lap('penalised', 1, '39'), lap('penalised', 2, '78'), lap('penalised', 3, '120.50'),
      ],
      finishes: [
        finish('clean', '123.00'),
        finish('penalised', '120.50', { penalty_value: '5.00', penalty_unit: 's' }),
      ],
    });
    // 123.00 beats 125.50 once the penalty is applied.
    expect(out.winner_participant_id).toBe('clean');
    expect(out.standings).toEqual(['clean', 'penalised']);
  });

  it('honours the ScheduledStartUnderLateStartRule reference', () => {
    const out = calculateCycling({
      profile: profile({ start_reference: 'ScheduledStartUnderLateStartRule' }),
      participants: [P('late')],
      // Scheduled 0, actually started 10 s late. Under this policy elapsed runs from 0.
      starts: [{ participant_id: 'late', bib: 'late', scheduled_start_value: '0',
                 official_start_value: '10', time_unit: 's', equipment_cleared: true }],
      passages: [lap('late', 1, '40'), lap('late', 2, '80'), lap('late', 3, '130')],
      finishes: [finish('late', '130')],
    });
    expect(out.participants[0]!.components!.final_time_us).toBe(130_000_000);
  });
});

describe('GT-019 — mass-start distance requirement', () => {
  it('a rider who completed 2 of 3 laps cannot be the full-distance winner', () => {
    const out = calculateCycling({
      profile: profile({ start_mode: 'MassStart', required_laps: 3 }),
      participants: [P('short'), P('full')],
      starts: [start('short'), start('full')],
      passages: [
        lap('short', 1, '40'), lap('short', 2, '82'),               // only 2 laps
        lap('full', 1, '41'), lap('full', 2, '83'), lap('full', 3, '126'),
      ],
      finishes: [
        finish('short', '82', { official_finish_position: 1 }),      // crossed first, but short
        finish('full', '126', { official_finish_position: 2 }),
      ],
    });
    const short = out.participants.find((p) => p.participant_id === 'short')!;
    const full = out.participants.find((p) => p.participant_id === 'full')!;

    expect(short.components!.full_distance).toBe(0);
    expect(short.status).toBe('DNF');           // NotClassified profile
    expect(out.winner_participant_id).toBe('full');
    expect(out.standings[0]).toBe('full');
    expect(full.rank).toBe(1);
  });

  it('classifies a lapped rider strictly behind full-distance finishers when that rule is adopted', () => {
    const out = calculateCycling({
      profile: profile({ start_mode: 'MassStart', required_laps: 3,
                         lapped_classification: 'ClassifiedByLapsThenOrder' }),
      participants: [P('short'), P('full')],
      starts: [start('short'), start('full')],
      passages: [
        lap('short', 1, '40'), lap('short', 2, '82'),
        lap('full', 1, '41'), lap('full', 2, '83'), lap('full', 3, '126'),
      ],
      finishes: [
        finish('short', '82', { official_finish_position: 1 }),
        finish('full', '126', { official_finish_position: 2 }),
      ],
    });
    expect(out.standings).toEqual(['full', 'short']);
    expect(out.participants.find((p) => p.participant_id === 'short')!.rank).toBe(2);
  });

  it('classifies a mass start by official order, not by personal elapsed time', () => {
    const out = calculateCycling({
      profile: profile({ start_mode: 'MassStart', required_laps: 1 }),
      participants: [P('a'), P('b')],
      // b's raw elapsed is smaller, but the judge placed a first.
      starts: [start('a', '0'), start('b', '5')],
      passages: [lap('a', 1, '100'), lap('b', 1, '101')],
      finishes: [
        finish('a', '100', { official_finish_position: 1 }),   // elapsed 100
        finish('b', '101', { official_finish_position: 2 }),   // elapsed  96
      ],
    });
    expect(out.standings).toEqual(['a', 'b']);
    expect(out.winner_participant_id).toBe('a');
  });

  it('flags a mass-start finisher with no official position', () => {
    const out = calculateCycling({
      profile: profile({ start_mode: 'MassStart', required_laps: 1 }),
      participants: [P('a')], starts: [start('a')],
      passages: [lap('a', 1, '100')], finishes: [finish('a', '100')],
    });
    expect(out.issues.some((i) => i.code === 'FINISH_POSITION_MISSING')).toBe(true);
  });
});

describe('GT-020 — duplicate timing passages', () => {
  it('the same device event imported twice counts as one lap crossing', () => {
    const duplicated = lap('r1', 3, '120.50');
    const out = calculateCycling({
      profile: profile(),
      participants: [P('r1')],
      starts: [start('r1')],
      passages: [
        lap('r1', 1, '40'), lap('r1', 2, '80'),
        duplicated,
        { ...duplicated, observation_id: 'o-reimport' }, // same source_event_id
      ],
      finishes: [finish('r1', '120.50')],
    });
    expect(out.participants[0]!.components!.completed_laps).toBe(3); // not 4
    expect(out.issues).toEqual([]);
    expect(out.explanation.some((e) => e.includes('duplicate timing passage'))).toBe(true);
  });

  it('rejects a passage recorded against an unrelated clock', () => {
    const out = calculateCycling({
      profile: profile(),
      participants: [P('r1')], starts: [start('r1')],
      passages: [
        lap('r1', 1, '40'), lap('r1', 2, '80'),
        lap('r1', 3, '120.50', { timing_reference_id: 'someones-phone' }),
      ],
      finishes: [finish('r1', '120.50')],
    });
    expect(out.issues.some((i) => i.code === 'TIMING_REFERENCE_MISMATCH')).toBe(true);
  });

  it('flags a broken lap sequence rather than assuming the missing lap', () => {
    const out = calculateCycling({
      profile: profile(),
      participants: [P('r1')], starts: [start('r1')],
      passages: [lap('r1', 1, '40'), lap('r1', 3, '120')], // lap 2 missing
      finishes: [finish('r1', '120')],
    });
    expect(out.issues.some((i) => i.code === 'LAP_SEQUENCE_BROKEN')).toBe(true);
  });
});

describe('cycling states and neutralisation (§21)', () => {
  it('records equipment-not-cleared as its own state, not a disqualification', () => {
    const out = calculateCycling({
      profile: profile(),
      participants: [P('r1')],
      starts: [start('r1', '0', false)],
      passages: [], finishes: [],
    });
    const r = out.participants[0]!;
    expect(r.status).toBe('DNS');
    expect(r.status).not.toBe('DQ');
    expect(r.reason_trace[0]).toContain('not a disqualification');
  });

  it('suspends calculation while the race is neutralised', () => {
    const out = calculateCycling({
      profile: profile(),
      participants: [P('r1')], starts: [start('r1')],
      passages: [lap('r1', 1, '40'), lap('r1', 2, '80'), lap('r1', 3, '120')],
      finishes: [finish('r1', '120')],
      neutralised: true, neutralisation_reason: 'Course obstruction at turn 2',
    });
    expect(out.winner_participant_id).toBeNull();
    expect(out.unresolved[0]!.code).toBe('OFFICIAL_DISPOSITION_REQUIRED');
    expect(out.complete).toBe(false);
  });

  it('does not award a restart or time credit for a mechanical without an official decision', () => {
    const out = calculateCycling({
      profile: profile(),
      participants: [P('r1')], starts: [start('r1')],
      passages: [lap('r1', 1, '40')],
      finishes: [{ participant_id: 'r1', time_unit: 's', status: 'DNF' }],
    });
    expect(out.issues.some((i) => i.code === 'STATUS_WITHOUT_DECISION')).toBe(true);
    expect(out.participants[0]!.rank).toBeNull();
  });
});
