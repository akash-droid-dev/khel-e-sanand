/** Game test vectors GT-005 … GT-008 (Sprint 30/50/60 m). §17. */
import { describe, it, expect } from 'vitest';
import {
  calculateSprintHeat, qualifyToFinal, assertSameDiscipline,
  type SprintRuleProfile, type SprintObservation, type HeatClassification,
} from './sprint.js';
import type { ParticipantRef } from '../types.js';

const P = (id: string): ParticipantRef => ({
  participant_id: id, kind: 'Entry', display_name: `Athlete ${id}`,
});

const profile = (over: Partial<SprintRuleProfile> = {}): SprintRuleProfile => ({
  rule_version_id: 'RV-SP-1', discipline: 'SP30',
  lane_count: 6, timing_method: 'Manual',
  capture_resolution_us: 10_000,  // hand timing to hundredths
  display_precision: 2,
  place_qualifiers: 2, time_qualifiers: 2, final_capacity: 8,
  tie_procedure: [], allow_shared_place: false,
  ...over,
});

let n = 0;
const obs = (
  participant_id: string, lane: number, place: number | null,
  time?: string, over: Partial<SprintObservation> = {},
): SprintObservation => ({
  observation_id: `o-${++n}`, participant_id, lane,
  official_finish_position: place,
  raw_time_value: time ?? null, raw_time_unit: 's',
  status: 'Completed', ...over,
});

describe('GT-005 — comparable times', () => {
  it('5.21 s ranks before 5.35 s and a DNS is unranked', () => {
    const out = calculateSprintHeat({
      profile: profile(), heat_id: 'H1',
      participants: [P('fast'), P('slow'), P('dns')],
      observations: [
        obs('fast', 1, 1, '5.21'),
        obs('slow', 2, 2, '5.35'),
        obs('dns', 3, null, undefined, { status: 'DNS', official_decision: 'Did not report to start' }),
      ],
    });
    const fast = out.participants.find((p) => p.participant_id === 'fast')!;
    const slow = out.participants.find((p) => p.participant_id === 'slow')!;
    const dns = out.participants.find((p) => p.participant_id === 'dns')!;

    expect(fast.primary_value).toBe(5_210_000);
    expect(slow.primary_value).toBe(5_350_000);
    expect(fast.primary_value! < slow.primary_value!).toBe(true);
    expect(fast.rank).toBe(1);
    expect(slow.rank).toBe(2);

    expect(dns.status).toBe('DNS');
    expect(dns.rank).toBeNull();
    expect(dns.primary_value).toBeNull();
    expect(out.standings).toEqual(['fast', 'slow']);
    expect(out.issues).toEqual([]);
  });

  it('displays at the captured precision only', () => {
    const out = calculateSprintHeat({
      profile: profile(), heat_id: 'H1',
      participants: [P('a')], observations: [obs('a', 1, 1, '5.21')],
    });
    expect(out.participants[0]!.primary_display).toBe('5.21 s');
  });

  it('requires an official reason for a non-Completed status', () => {
    const out = calculateSprintHeat({
      profile: profile(), heat_id: 'H1',
      participants: [P('a')],
      observations: [obs('a', 1, null, undefined, { status: 'DQ' })],
    });
    expect(out.issues.some((i) => i.code === 'STATUS_WITHOUT_DECISION')).toBe(true);
  });

  it('rejects a completed run with no recorded time when not in place-only mode', () => {
    const out = calculateSprintHeat({
      profile: profile(), heat_id: 'H1',
      participants: [P('a')], observations: [obs('a', 1, 1)],
    });
    expect(out.issues.some((i) => i.code === 'TIME_REQUIRED')).toBe(true);
  });

  it('rejects a zero-duration completed run (§17)', () => {
    const out = calculateSprintHeat({
      profile: profile(), heat_id: 'H1',
      participants: [P('a')], observations: [obs('a', 1, 1, '0')],
    });
    expect(out.issues.some((i) => i.code === 'TIME_INVALID')).toBe(true);
  });
});

describe('GT-008 — equal displayed time, distinct official places', () => {
  it('preserves the judge order and raises no conflict', () => {
    const out = calculateSprintHeat({
      profile: profile(), heat_id: 'H1',
      participants: [P('a'), P('b')],
      observations: [obs('a', 1, 1, '5.30'), obs('b', 2, 2, '5.30')],
    });
    expect(out.participants[0]!.rank).toBe(1);
    expect(out.participants[1]!.rank).toBe(2);
    expect(out.unresolved).toEqual([]);      // equal times + distinct places is NOT a conflict
    expect(out.standings).toEqual(['a', 'b']);
  });

  it('opens a review case when a faster time is placed behind a slower one', () => {
    const out = calculateSprintHeat({
      profile: profile(), heat_id: 'H1',
      participants: [P('a'), P('b')],
      observations: [obs('a', 1, 2, '5.10'), obs('b', 2, 1, '5.40')],
    });
    expect(out.unresolved).toHaveLength(1);
    expect(out.unresolved[0]!.code).toBe('ORDER_TIME_CONFLICT');
    expect(out.complete).toBe(false);
  });

  it('flags a duplicated finish position', () => {
    const out = calculateSprintHeat({
      profile: profile(), heat_id: 'H1',
      participants: [P('a'), P('b')],
      observations: [obs('a', 1, 1, '5.30'), obs('b', 2, 1, '5.31')],
    });
    expect(out.issues.some((i) => i.code === 'FINISH_POSITION_DUPLICATED')).toBe(true);
  });

  it('flags a duplicated lane', () => {
    const out = calculateSprintHeat({
      profile: profile(), heat_id: 'H1',
      participants: [P('a'), P('b')],
      observations: [obs('a', 3, 1, '5.30'), obs('b', 3, 2, '5.40')],
    });
    expect(out.issues.some((i) => i.code === 'LANE_DUPLICATED')).toBe(true);
  });
});

/** Build a classified heat from plain (id, place, time) triples. */
function heat(id: string, rows: [string, number, string][]): HeatClassification {
  const out = calculateSprintHeat({
    profile: profile(), heat_id: id,
    participants: rows.map(([pid]) => P(pid)),
    observations: rows.map(([pid, place, time], i) => obs(pid, i + 1, place, time)),
  });
  return {
    heat_id: id, results: out.participants,
    timing_method: 'Manual', capture_resolution_us: 10_000,
  };
}

describe('GT-006 — qualification', () => {
  it('two heats, top two per heat plus next two times gives six distinct qualifiers', () => {
    const h1 = heat('H1', [['a1', 1, '5.10'], ['a2', 2, '5.20'], ['a3', 3, '5.40'], ['a4', 4, '5.60']]);
    const h2 = heat('H2', [['b1', 1, '5.15'], ['b2', 2, '5.25'], ['b3', 3, '5.30'], ['b4', 4, '5.70']]);

    const q = qualifyToFinal([h1, h2], profile({ place_qualifiers: 2, time_qualifiers: 2 }));

    expect(q.by_place.map((x) => x.participant_id).sort()).toEqual(['a1', 'a2', 'b1', 'b2']);
    // Fastest non-qualifiers across both heats: b3 (5.30) then a3 (5.40).
    expect(q.by_time.map((x) => x.participant_id)).toEqual(['b3', 'a3']);

    const all = [...q.by_place, ...q.by_time].map((x) => x.participant_id);
    expect(all).toHaveLength(6);
    expect(new Set(all).size).toBe(6);   // distinct — no double-counting
    expect(q.unresolved).toEqual([]);
  });

  it('refuses to compare times across heats timed by different methods', () => {
    const h1 = heat('H1', [['a1', 1, '5.10'], ['a2', 2, '5.20'], ['a3', 3, '5.40']]);
    const h2 = { ...heat('H2', [['b1', 1, '5.15'], ['b2', 2, '5.25'], ['b3', 3, '5.30']]),
                 timing_method: 'FullyAutomatic' as const, capture_resolution_us: 1_000 };
    const q = qualifyToFinal([h1, h2], profile());
    expect(q.issues.some((i) => i.code === 'HEATS_NOT_COMPARABLE')).toBe(true);
  });

  it('reports when accepted qualifiers exceed final capacity rather than dropping athletes', () => {
    const h1 = heat('H1', [['a1', 1, '5.10'], ['a2', 2, '5.20'], ['a3', 3, '5.40']]);
    const h2 = heat('H2', [['b1', 1, '5.15'], ['b2', 2, '5.25'], ['b3', 3, '5.31']]);
    const q = qualifyToFinal([h1, h2], profile({ place_qualifiers: 2, time_qualifiers: 2, final_capacity: 4 }));
    expect(q.issues.some((i) => i.code === 'FINAL_CAPACITY_EXCEEDED')).toBe(true);
  });
});

describe('GT-007 — cut-off tie blocks progression', () => {
  it('does not pick between athletes sharing the last qualifying time', () => {
    // One time slot remains and two athletes share 5.40.
    const h1 = heat('H1', [['a1', 1, '5.10'], ['a2', 2, '5.20'], ['a3', 3, '5.40']]);
    const h2 = heat('H2', [['b1', 1, '5.15'], ['b2', 2, '5.25'], ['b3', 3, '5.40']]);

    const q = qualifyToFinal([h1, h2], profile({ place_qualifiers: 2, time_qualifiers: 1 }));

    expect(q.by_time).toEqual([]);
    expect(q.unresolved).toHaveLength(1);
    expect(q.unresolved[0]!.code).toBe('TIE_REQUIRES_DECISION');
    expect(q.unresolved[0]!.participant_ids.sort()).toEqual(['a3', 'b3']);
  });

  it('proceeds when the tied athletes all fit inside the remaining slots', () => {
    const h1 = heat('H1', [['a1', 1, '5.10'], ['a2', 2, '5.20'], ['a3', 3, '5.40']]);
    const h2 = heat('H2', [['b1', 1, '5.15'], ['b2', 2, '5.25'], ['b3', 3, '5.40']]);
    const q = qualifyToFinal([h1, h2], profile({ place_qualifiers: 2, time_qualifiers: 2 }));
    expect(q.by_time.map((x) => x.participant_id).sort()).toEqual(['a3', 'b3']);
    expect(q.unresolved).toEqual([]);
  });
});

describe('sprint distances are independent disciplines', () => {
  it('an SP30 result cannot enter an SP50 final', () => {
    expect(() => assertSameDiscipline('SP30', 'SP50')).toThrow(/independent discipline/);
    expect(() => assertSameDiscipline('SP50', 'SP50')).not.toThrow();
  });
});
