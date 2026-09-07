/**
 * Game test vectors GT-012 … GT-017 and GT-025 … GT-027.
 * Transcribed from Khelo_Sanand_Data_and_Functions.xlsx → Game_Cases.
 * All inputs are the workbook's synthetic values; none prescribe real event rules.
 */
import { describe, it, expect } from 'vitest';
import { calculateAttempts, nextBestTieChain, type AttemptObservation, type AttemptsRuleProfile } from './attempts.js';
import type { ParticipantRef } from '../types.js';

const P = (id: string): ParticipantRef => ({
  participant_id: id, kind: 'Entry', display_name: `Athlete ${id}`,
});

function distanceProfile(over: Partial<AttemptsRuleProfile> = {}): AttemptsRuleProfile {
  return {
    rule_version_id: 'RV-TEST-1',
    discipline: 'SBT',
    scoring_mode: 'Distance',
    attempts: 3,
    measurement_unit: 'm',
    tie_procedure: [],
    allow_shared_place: false,
    ...over,
  };
}

let n = 0;
const att = (
  participant_id: string, attempt_no: number, outcome: AttemptObservation['outcome'],
  raw_value?: string, extra: Partial<AttemptObservation> = {},
): AttemptObservation => ({
  observation_id: `obs-${++n}`, participant_id, attempt_no, outcome,
  raw_value: raw_value ?? null, raw_unit: 'm', ...extra,
});

describe('GT-012 — SBT best distance', () => {
  it('12.40 m, foul, 13.10 m yields 13.10 m', () => {
    const out = calculateAttempts({
      profile: distanceProfile(),
      participants: [P('a1')],
      observations: [
        att('a1', 1, 'valid', '12.40'),
        att('a1', 2, 'foul'),
        att('a1', 3, 'valid', '13.10'),
      ],
    });
    const r = out.participants[0]!;
    expect(r.status).toBe('Completed');
    expect(r.primary_value).toBe(13100);          // exact millimetres
    expect(r.primary_display).toBe('13.100 m');
    expect(r.rank).toBe(1);
    expect(out.issues).toEqual([]);
    expect(out.complete).toBe(true);
  });
});

describe('GT-013 — SBT no valid mark', () => {
  it('three fouls yield NM with no numeric rank', () => {
    const out = calculateAttempts({
      profile: distanceProfile(),
      participants: [P('a1')],
      observations: [
        att('a1', 1, 'foul'), att('a1', 2, 'foul'), att('a1', 3, 'foul'),
      ],
    });
    const r = out.participants[0]!;
    expect(r.status).toBe('NM');
    expect(r.primary_value).toBeNull();   // not zero — the distinction §15 insists on
    expect(r.rank).toBeNull();
    expect(out.standings).toEqual([]);
  });

  it('NM never outranks a real mark', () => {
    const out = calculateAttempts({
      profile: distanceProfile(),
      participants: [P('a1'), P('a2')],
      observations: [
        att('a1', 1, 'foul'), att('a1', 2, 'foul'), att('a1', 3, 'foul'),
        att('a2', 1, 'valid', '4.50'), att('a2', 2, 'pass'), att('a2', 3, 'pass'),
      ],
    });
    const nm = out.participants.find((p) => p.participant_id === 'a1')!;
    const scored = out.participants.find((p) => p.participant_id === 'a2')!;
    expect(nm.rank).toBeNull();
    expect(scored.rank).toBe(1);
    expect(out.winner_participant_id).toBe('a2');
  });
});

describe('GT-014 — SBT best-mark tie', () => {
  const obs = [
    att('A', 1, 'valid', '13.10'), att('A', 2, 'valid', '12.40'), att('A', 3, 'foul'),
    att('B', 1, 'valid', '13.10'), att('B', 2, 'valid', '12.30'), att('B', 3, 'foul'),
  ];

  it('A goes ahead when the next-best rule IS adopted', () => {
    const out = calculateAttempts({
      profile: distanceProfile({ tie_procedure: nextBestTieChain(3) }),
      participants: [P('A'), P('B')],
      observations: obs,
    });
    const a = out.participants.find((p) => p.participant_id === 'A')!;
    const b = out.participants.find((p) => p.participant_id === 'B')!;
    expect(a.rank).toBe(1);
    expect(b.rank).toBe(2);
    expect(a.secondary_values).toEqual([12400]);
    expect(out.unresolved).toEqual([]);
  });

  it('stays an unresolved tie when no tie rule was approved', () => {
    // The "if that tie method was approved" clause in §19 is load-bearing:
    // with an empty policy the software must NOT invent a separation.
    const out = calculateAttempts({
      profile: distanceProfile({ tie_procedure: [] }),
      participants: [P('A'), P('B')],
      observations: obs,
    });
    expect(out.unresolved).toHaveLength(1);
    expect(out.unresolved[0]!.code).toBe('TIE_REQUIRES_DECISION');
    expect(out.unresolved[0]!.participant_ids.sort()).toEqual(['A', 'B']);
    expect(out.participants.every((p) => p.rank === null)).toBe(true);
    expect(out.complete).toBe(false);
  });

  it('awards a shared place only when the profile permits it', () => {
    const out = calculateAttempts({
      profile: distanceProfile({ tie_procedure: [], allow_shared_place: true }),
      participants: [P('A'), P('B')],
      observations: obs,
    });
    expect(out.unresolved).toEqual([]);
    expect(out.participants.every((p) => p.rank === 1 && p.shared_rank)).toBe(true);
    expect(out.winner_participant_id).toBeNull(); // a shared first place has no sole winner
  });
});

describe('GT-015 / GT-016 / GT-017 — Kids Javelin', () => {
  it('GT-015: distance profile 8.20 m, 9.00 m, foul yields 9.00 m', () => {
    const out = calculateAttempts({
      profile: distanceProfile({ discipline: 'KJT' }),
      participants: [P('a1')],
      observations: [
        att('a1', 1, 'valid', '8.20'), att('a1', 2, 'valid', '9.00'), att('a1', 3, 'foul'),
      ],
    });
    expect(out.participants[0]!.primary_value).toBe(9000);
    expect(out.participants[0]!.primary_display).toBe('9.000 m');
  });

  it('GT-016: target-sum profile with zones worth 3, 5 and 1 totals 9 points', () => {
    const profile = distanceProfile({
      discipline: 'KJT',
      scoring_mode: 'TargetPoints',
      zone_mapping: { Z1: 1, Z3: 3, Z5: 5 },
      aggregation: 'Sum',
    });
    const out = calculateAttempts({
      profile,
      participants: [P('a1')],
      observations: [
        att('a1', 1, 'valid', undefined, { zone_id: 'Z3' }),
        att('a1', 2, 'valid', undefined, { zone_id: 'Z5' }),
        att('a1', 3, 'valid', undefined, { zone_id: 'Z1' }),
      ],
    });
    expect(out.participants[0]!.primary_value).toBe(9);
    expect(out.participants[0]!.primary_display).toBe('9 pts');
    expect(out.issues).toEqual([]);
  });

  it('GT-017: metres entered into a zone-points field fails validation', () => {
    const profile = distanceProfile({
      discipline: 'KJT',
      scoring_mode: 'TargetPoints',
      zone_mapping: { Z1: 1, Z3: 3, Z5: 5 },
      aggregation: 'Sum',
    });
    const out = calculateAttempts({
      profile,
      participants: [P('a1')],
      observations: [att('a1', 1, 'valid', '9.00', { zone_id: null }),
                     att('a1', 2, 'pass'), att('a1', 3, 'pass')],
    });
    expect(out.issues.some((i) => i.code === 'DISTANCE_IN_TARGET_MODE')).toBe(true);
    expect(out.complete).toBe(false);
  });

  it('rejects a zone that is not in the approved mapping', () => {
    const profile = distanceProfile({
      discipline: 'KJT', scoring_mode: 'TargetPoints',
      zone_mapping: { Z1: 1 }, aggregation: 'Sum',
    });
    const out = calculateAttempts({
      profile, participants: [P('a1')],
      observations: [att('a1', 1, 'valid', undefined, { zone_id: 'Z9' }),
                     att('a1', 2, 'pass'), att('a1', 3, 'pass')],
    });
    expect(out.issues.some((i) => i.code === 'ZONE_NOT_IN_MAPPING')).toBe(true);
  });
});

describe('GT-025 / GT-026 / GT-027 — Standing Broad Jump', () => {
  it('GT-025: 1.20 m, 1.32 m, foul produce 1.32 m', () => {
    const out = calculateAttempts({
      profile: distanceProfile({ discipline: 'SBJ' }),
      participants: [P('a1')],
      observations: [
        att('a1', 1, 'valid', '1.20'), att('a1', 2, 'valid', '1.32'), att('a1', 3, 'foul'),
      ],
    });
    expect(out.participants[0]!.primary_value).toBe(1320);
  });

  it('GT-026: 132 cm and 1.32 m normalise to the same 1320 mm', () => {
    const out = calculateAttempts({
      profile: distanceProfile({ discipline: 'SBJ', tie_procedure: [], allow_shared_place: true }),
      participants: [P('cm'), P('m')],
      observations: [
        att('cm', 1, 'valid', '132', { raw_unit: 'cm' }), att('cm', 2, 'pass'), att('cm', 3, 'pass'),
        att('m', 1, 'valid', '1.32', { raw_unit: 'm' }),  att('m', 2, 'pass'),  att('m', 3, 'pass'),
      ],
    });
    const marks = out.participants.map((p) => p.primary_value);
    expect(marks).toEqual([1320, 1320]);
    expect(out.participants.every((p) => p.shared_rank)).toBe(true);
  });

  it('GT-027: attempts not taken leave the round Incomplete, not NM', () => {
    const out = calculateAttempts({
      profile: distanceProfile({ discipline: 'SBJ' }),
      participants: [P('a1')],
      observations: [
        att('a1', 1, 'valid', '1.20'),
        att('a1', 2, 'not_taken'),
        att('a1', 3, 'not_taken'),
      ],
    });
    const r = out.participants[0]!;
    expect(r.status).not.toBe('NM');
    expect(r.primary_display).toBe('Incomplete');
    expect(r.rank).toBeNull();
    expect(out.issues.some((i) => i.code === 'ATTEMPT_ROUND_INCOMPLETE')).toBe(true);
  });

  it('treats a missing (never recorded) attempt as incomplete too', () => {
    const out = calculateAttempts({
      profile: distanceProfile({ discipline: 'SBJ' }),
      participants: [P('a1')],
      observations: [att('a1', 1, 'valid', '1.20')], // only 1 of 3 recorded
    });
    expect(out.issues.some((i) => i.code === 'ATTEMPT_ROUND_INCOMPLETE')).toBe(true);
  });
});

describe('attempt integrity rules (§19)', () => {
  it('rejects a fourth attempt under a three-attempt profile without a replacement reference', () => {
    const out = calculateAttempts({
      profile: distanceProfile(),
      participants: [P('a1')],
      observations: [
        att('a1', 1, 'valid', '10.00'), att('a1', 2, 'valid', '11.00'),
        att('a1', 3, 'valid', '12.00'), att('a1', 4, 'valid', '13.00'),
      ],
    });
    expect(out.issues.some((i) => i.code === 'ATTEMPT_CAP_EXCEEDED')).toBe(true);
  });

  it('accepts a fourth attempt that explicitly replaces a voided one', () => {
    const voided = att('a1', 2, 'foul', undefined, { reason: 'official void — implement fault' });
    const out = calculateAttempts({
      profile: distanceProfile(),
      participants: [P('a1')],
      observations: [
        att('a1', 1, 'valid', '10.00'),
        voided,
        att('a1', 3, 'valid', '12.00'),
        att('a1', 4, 'valid', '13.00', { replaces_observation_id: voided.observation_id }),
      ],
    });
    expect(out.issues).toEqual([]);
    expect(out.participants[0]!.primary_value).toBe(13000);
  });

  it('excludes practice throws from the result', () => {
    const out = calculateAttempts({
      profile: distanceProfile(),
      participants: [P('a1')],
      observations: [
        att('a1', 1, 'valid', '99.00', { is_practice: true }),
        att('a1', 1, 'valid', '10.00'), att('a1', 2, 'foul'), att('a1', 3, 'foul'),
      ],
    });
    expect(out.participants[0]!.primary_value).toBe(10000);
  });

  it('flags a distance recorded against a foul attempt', () => {
    const out = calculateAttempts({
      profile: distanceProfile(),
      participants: [P('a1')],
      observations: [
        att('a1', 1, 'foul', '14.00'), att('a1', 2, 'valid', '10.00'), att('a1', 3, 'pass'),
      ],
    });
    expect(out.issues.some((i) => i.code === 'MARK_ON_INVALID_ATTEMPT')).toBe(true);
    expect(out.participants[0]!.primary_value).toBe(10000); // the foul never contributes
  });
});
