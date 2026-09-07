/**
 * Game test vectors GT-031 … GT-038 (Badminton and Volleyball).
 * Values are the workbook's calculator fixtures; §25 stresses that only the
 * organiser-approved profile governs an actual event.
 */
import { describe, it, expect } from 'vitest';
import { calculateMatch, type MatchRuleProfile, type UnitObservation } from './matchplay.js';
import { evaluateUnit, decidingUnitNumber } from './rally.js';
import type { ParticipantRef } from '../types.js';

const A: ParticipantRef = { participant_id: 'A', kind: 'Entry', display_name: 'Side A' };
const B: ParticipantRef = { participant_id: 'B', kind: 'Entry', display_name: 'Side B' };

/** BWF-style profile explicitly selected for the test: T=21, L=2, C=30, W=2. */
const BAD_21: MatchRuleProfile = {
  rule_version_id: 'RV-BAD-21', discipline: 'BAD',
  units_to_win: 2, ordinary_target: 21, deciding_target: 21,
  winning_margin: 2, cap: 30, rule_effective_date: '2026-12-01',
  tie_procedure: [], allow_shared_place: false,
};

/** The separately selected 3×15 profile: T=15, L=2, C=21. */
const BAD_15: MatchRuleProfile = {
  ...BAD_21, rule_version_id: 'RV-BAD-15',
  ordinary_target: 15, deciding_target: 15, cap: 21,
  units_to_win: 2, rule_effective_date: '2027-01-04',
};

/** FIVB-reference volleyball: W=3, ordinary 25, deciding 15, margin 2, no cap. */
const VOL_FIVB: MatchRuleProfile = {
  rule_version_id: 'RV-VOL-1', discipline: 'VOL',
  units_to_win: 3, ordinary_target: 25, deciding_target: 15,
  winning_margin: 2, cap: null,
  tie_procedure: [], allow_shared_place: false,
};

let n = 0;
const unit = (unit_no: number, a: number, b: number, finalised = true): UnitObservation =>
  ({ observation_id: `u-${++n}`, unit_no, points_a: a, points_b: b, finalised });

describe('GT-031 … GT-034 — Badminton calculator', () => {
  it('GT-031: 21–20 does not close a T21/L2/C30 game', () => {
    const e = evaluateUnit(21, 20, { target: 21, margin: 2, cap: 30 });
    expect(e.state).toBe('Open');
  });

  it('GT-032: 30–29 closes it at the cap', () => {
    const e = evaluateUnit(30, 29, { target: 21, margin: 2, cap: 30 });
    expect(e.state).toBe('Closed');
    expect(e.winner).toBe('A');
    expect(e.reason).toContain('cap');
  });

  it('GT-033: 31–29 is invalid', () => {
    const e = evaluateUnit(31, 29, { target: 21, margin: 2, cap: 30 });
    expect(e.state).toBe('Invalid');
    expect(e.code).toBe('ABOVE_CAP');
  });

  it('GT-034: under the separately selected T15/L2/C21 profile, 21–20 closes', () => {
    const e = evaluateUnit(21, 20, { target: 15, margin: 2, cap: 21 });
    expect(e.state).toBe('Closed');
    expect(e.winner).toBe('A');
  });

  it('2–0 in games ends the match', () => {
    const out = calculateMatch({
      profile: BAD_21, participants: [A, B],
      units: [unit(1, 21, 15), unit(2, 21, 18)],
    });
    expect(out.winner_participant_id).toBe('A');
    expect(out.complete).toBe(true);
    expect(out.participants[0]!.components!.units_won).toBe(2);
  });

  it('rejects a score that implies play continued after the game closed', () => {
    // 25–20 cannot happen at T=21/L=2: it would have ended at 22–20.
    const out = calculateMatch({
      profile: BAD_21, participants: [A, B], units: [unit(1, 25, 20)],
    });
    expect(out.issues.some((i) => i.code === 'PLAY_CONTINUED_AFTER_CLOSE')).toBe(true);
  });

  it('flags a game marked complete that has not actually closed', () => {
    const out = calculateMatch({
      profile: BAD_21, participants: [A, B], units: [unit(1, 21, 20, true)],
    });
    expect(out.issues.some((i) => i.code === 'UNIT_NOT_CLOSED')).toBe(true);
  });

  it('requires a rule effective date on a badminton profile (§25)', () => {
    const out = calculateMatch({
      profile: { ...BAD_21, rule_effective_date: null },
      participants: [A, B], units: [unit(1, 21, 15), unit(2, 21, 15)],
    });
    expect(out.issues.some((i) => i.code === 'RULE_EFFECTIVE_DATE_MISSING')).toBe(true);
  });

  it('retains completed games on a retirement without inventing rally scores', () => {
    const out = calculateMatch({
      profile: BAD_21, participants: [A, B],
      units: [unit(1, 21, 15)],
      termination: 'Retirement', termination_side: 'B', termination_reason: 'Injury; umpire confirmed',
    });
    expect(out.winner_participant_id).toBe('A');
    expect(out.participants[1]!.status).toBe('Retired');
    expect(out.participants[1]!.primary_value).toBeNull();
    expect(out.participants[0]!.components!.units_won).toBe(1); // not inflated to 2
  });

  it('demands a reason and a side for a non-played ending', () => {
    const out = calculateMatch({
      profile: BAD_21, participants: [A, B], units: [], termination: 'Walkover',
    });
    expect(out.issues.some((i) => i.code === 'TERMINATION_REASON_REQUIRED')).toBe(true);
    expect(out.issues.some((i) => i.code === 'TERMINATION_SIDE_REQUIRED')).toBe(true);
  });
});

describe('GT-035 … GT-038 — Volleyball calculator', () => {
  it('GT-035: 25–24 leaves an ordinary set open (no badminton cap applies)', () => {
    const e = evaluateUnit(25, 24, { target: 25, margin: 2, cap: null });
    expect(e.state).toBe('Open');
    // §26 explicitly: "Do not apply badminton's 30-point cap."
    expect(evaluateUnit(26, 24, { target: 25, margin: 2, cap: null }).state).toBe('Closed');
  });

  it('GT-036: with W=3 the fifth set uses the deciding target; 16–14 closes set and match', () => {
    expect(decidingUnitNumber(3)).toBe(5);
    const out = calculateMatch({
      profile: VOL_FIVB, participants: [A, B],
      units: [
        unit(1, 25, 20), unit(2, 20, 25), unit(3, 25, 22), unit(4, 18, 25),
        unit(5, 16, 14), // deciding set, target 15
      ],
    });
    expect(out.winner_participant_id).toBe('A');
    expect(out.participants[0]!.components!.units_won).toBe(3);
    expect(out.complete).toBe(true);
  });

  it('GT-037: under a local W=2 profile the third set is the decider', () => {
    const local: MatchRuleProfile = {
      ...VOL_FIVB, rule_version_id: 'RV-VOL-LOCAL',
      units_to_win: 2, ordinary_target: 21, deciding_target: 15,
    };
    expect(decidingUnitNumber(2)).toBe(3);
    const out = calculateMatch({
      profile: local, participants: [A, B],
      units: [unit(1, 21, 18), unit(2, 19, 21), unit(3, 15, 13)],
    });
    expect(out.winner_participant_id).toBe('A');
    // 15–13 would be Open under the 21-point ordinary target; it closes only because
    // set 3 is the decider and uses its own configured target.
    expect(out.issues).toEqual([]);
  });

  it('GT-038: a 3–0 match cannot contain a fourth set', () => {
    const out = calculateMatch({
      profile: VOL_FIVB, participants: [A, B],
      units: [unit(1, 25, 20), unit(2, 25, 21), unit(3, 25, 22), unit(4, 25, 20)],
    });
    expect(out.issues.some((i) => i.code === 'UNIT_AFTER_MATCH_DECIDED')).toBe(true);
    expect(out.complete).toBe(false);
  });

  it('a side winning fewer total rally points can still win the match (§26)', () => {
    const out = calculateMatch({
      profile: VOL_FIVB, participants: [A, B],
      units: [unit(1, 25, 23), unit(2, 10, 25), unit(3, 25, 23), unit(4, 12, 25), unit(5, 15, 13)],
    });
    const totalA = 25 + 10 + 25 + 12 + 15; // 87
    const totalB = 23 + 25 + 23 + 25 + 13; // 109
    expect(totalA).toBeLessThan(totalB);
    expect(out.winner_participant_id).toBe('A'); // 3 sets to 2
  });

  it('rejects a rule profile whose cap is below its target', () => {
    const bad = evaluateUnit(10, 5, { target: 25, margin: 2, cap: 20 });
    expect(bad.state).toBe('Invalid');
    expect(bad.code).toBe('CAP_BELOW_TARGET');
  });
});
