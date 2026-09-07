/**
 * Game test vectors GT-001 … GT-004 (Kabaddi). §16.
 * Rule values below are the workbook's synthetic reference figures. §16 is explicit
 * that IKF values are a reference, not automatic adoption for a school event.
 */
import { describe, it, expect } from 'vitest';
import {
  calculateKabaddi, replayWithCorrection,
  type KabaddiRuleProfile, type KabaddiRaid, type KabaddiInput,
} from './kabaddi.js';
import type { ParticipantRef } from '../types.js';

const TEAM_A: ParticipantRef = { participant_id: 'TA', kind: 'Team', display_name: 'Team A' };
const TEAM_B: ParticipantRef = { participant_id: 'TB', kind: 'Team', display_name: 'Team B' };

const profile = (over: Partial<KabaddiRuleProfile> = {}): KabaddiRuleProfile => ({
  rule_version_id: 'RV-KAB-1', discipline: 'KAB',
  on_court_players: 7, points_per_out: 1,
  bonus_enabled: true, bonus_defender_threshold: 6, bonus_points: 1,
  all_out_extra: 2,                 // the reference value quoted in §16
  revival_policy: 'OnePerOpponentOut',
  super_tackle_enabled: false, do_or_die_enabled: false, halves: 2,
  tie_procedure: [], allow_shared_place: false,
  ...over,
});

const rosterOf = (n: number) => ({
  A: Array.from({ length: n }, (_, i) => `A${i + 1}`),
  B: Array.from({ length: n }, (_, i) => `B${i + 1}`),
});

let n = 0;
const raid = (over: Partial<KabaddiRaid> & Pick<KabaddiRaid, 'raid_no' | 'raiding_side' | 'raider_id' | 'defenders_before'>): KabaddiRaid => ({
  observation_id: `r-${++n}`, half: 1,
  defenders_out: [], raider_out: false, bonus_awarded: false, all_out_awarded: false,
  ...over,
});

const base = (over: Partial<KabaddiInput> = {}): KabaddiInput => ({
  profile: profile(), participants: [TEAM_A, TEAM_B], roster: rosterOf(7), raids: [], ...over,
});

describe('GT-001 — opponent out plus all-out', () => {
  it('one final opponent out plus an all-out awards 3 points, not 2 or 5', () => {
    // The vector in isolation. A one-per-side court makes the deciding raid the
    // ONLY raid, so the recorded total is exactly what GT-001 specifies:
    //   1 opponent out (1 point) + all-out extra (2 points) = 3.
    const out = calculateKabaddi(base({
      profile: profile({ on_court_players: 1 }),
      roster: rosterOf(1),
      raids: [raid({
        raid_no: 1, raiding_side: 'A', raider_id: 'A1',
        defenders_before: 1, defenders_out: ['B1'], all_out_awarded: true,
      })],
    }));
    const a = out.participants[0]!;
    expect(a.components!.touch_points).toBe(1);
    expect(a.components!.all_out_points).toBe(2);
    expect(a.primary_value).toBe(3);          // not 2 (all-out ignored)…
    expect(a.primary_value).not.toBe(5);      // …and not 5 (extra double-counted)
    expect(out.participants[1]!.primary_value).toBe(0);
    expect(out.issues).toEqual([]);
  });

  it('scales the same rule across a full seven-a-side match', () => {
    const raids: KabaddiRaid[] = [];
    for (let i = 0; i < 6; i += 1) {
      raids.push(raid({
        raid_no: i + 1, raiding_side: 'A', raider_id: 'A1',
        defenders_before: 7 - i, defenders_out: [`B${i + 1}`],
      }));
    }
    raids.push(raid({
      raid_no: 7, raiding_side: 'A', raider_id: 'A1',
      defenders_before: 1, defenders_out: ['B7'], all_out_awarded: true,
    }));

    const out = calculateKabaddi(base({ raids }));
    const a = out.participants[0]!;
    expect(a.components!.touch_points).toBe(7);   // one point per opponent out
    expect(a.components!.all_out_points).toBe(2); // the extra, once
    expect(a.primary_value).toBe(9);
    expect(out.issues).toEqual([]);
  });

  it('adds the all-out extra once per confirmed all-out, and resets the court', () => {
    const raids: KabaddiRaid[] = [];
    for (let i = 0; i < 7; i += 1) {
      raids.push(raid({
        raid_no: i + 1, raiding_side: 'A', raider_id: 'A1',
        defenders_before: 7 - i, defenders_out: [`B${i + 1}`],
        all_out_awarded: i === 6,
      }));
    }
    const out = calculateKabaddi(base({ raids }));
    expect(out.participants[0]!.components!.all_out_points).toBe(2); // exactly once
    // Both courts are back to full strength after the reset.
    expect(out.participants[0]!.components!.on_court_at_end).toBe(7);
    expect(out.participants[1]!.components!.on_court_at_end).toBe(7);
  });

  it('refuses to award an all-out the replayed state does not support', () => {
    const out = calculateKabaddi(base({
      raids: [raid({ raid_no: 1, raiding_side: 'A', raider_id: 'A1',
                     defenders_before: 7, defenders_out: ['B1'], all_out_awarded: true })],
    }));
    expect(out.issues.some((i) => i.code === 'ALL_OUT_NOT_SUPPORTED_BY_STATE')).toBe(true);
    expect(out.participants[0]!.components!.all_out_points).toBe(0);
  });

  it('raises a decision when the court empties but no official confirmed the all-out', () => {
    const raids: KabaddiRaid[] = [];
    for (let i = 0; i < 7; i += 1) {
      raids.push(raid({
        raid_no: i + 1, raiding_side: 'A', raider_id: 'A1',
        defenders_before: 7 - i, defenders_out: [`B${i + 1}`],
      }));
    }
    const out = calculateKabaddi(base({ raids }));
    expect(out.unresolved.some((u) => u.code === 'OFFICIAL_DISPOSITION_REQUIRED')).toBe(true);
    expect(out.participants[0]!.components!.all_out_points).toBe(0);
  });
});

describe('GT-002 — duplicate raid retry', () => {
  it('the same raid command twice produces one raid and one score change', () => {
    const r = raid({ raid_no: 1, raiding_side: 'A', raider_id: 'A1',
                     defenders_before: 7, defenders_out: ['B1'] });
    const once = calculateKabaddi(base({ raids: [r] }));
    const twice = calculateKabaddi(base({ raids: [r, { ...r }] })); // identical observation_id

    expect(twice.participants[0]!.primary_value).toBe(once.participants[0]!.primary_value);
    expect(twice.participants[0]!.primary_value).toBe(1);
    expect(twice.issues).toEqual([]);
  });

  it('flags a second distinct record claiming the same raid number', () => {
    const out = calculateKabaddi(base({
      raids: [
        raid({ raid_no: 1, raiding_side: 'A', raider_id: 'A1', defenders_before: 7, defenders_out: ['B1'] }),
        raid({ raid_no: 1, raiding_side: 'A', raider_id: 'A2', defenders_before: 7, defenders_out: ['B2'] }),
      ],
    }));
    expect(out.issues.some((i) => i.code === 'DUPLICATE_RAID_NUMBER')).toBe(true);
    expect(out.participants[0]!.primary_value).toBe(1);
  });
});

describe('GT-003 — bonus only', () => {
  it('awards the bonus point and leaves the out/revival queue unchanged', () => {
    const out = calculateKabaddi(base({
      raids: [raid({ raid_no: 1, raiding_side: 'A', raider_id: 'A1',
                     defenders_before: 7, bonus_awarded: true })],
    }));
    const a = out.participants[0]!;
    expect(a.components!.bonus_points).toBe(1);
    expect(a.components!.touch_points).toBe(0);
    expect(a.primary_value).toBe(1);
    // No revival happened: both courts are untouched at full strength.
    expect(a.components!.on_court_at_end).toBe(7);
    expect(out.participants[1]!.components!.on_court_at_end).toBe(7);
  });

  it('refuses a bonus below the defender threshold', () => {
    const raids: KabaddiRaid[] = [];
    for (let i = 0; i < 2; i += 1) {
      raids.push(raid({ raid_no: i + 1, raiding_side: 'A', raider_id: 'A1',
                        defenders_before: 7 - i, defenders_out: [`B${i + 1}`] }));
    }
    raids.push(raid({ raid_no: 3, raiding_side: 'A', raider_id: 'A1',
                      defenders_before: 5, bonus_awarded: true })); // 5 < threshold 6
    const out = calculateKabaddi(base({ raids }));
    expect(out.issues.some((i) => i.code === 'BONUS_THRESHOLD_NOT_MET')).toBe(true);
    expect(out.participants[0]!.components!.bonus_points).toBe(0);
  });

  it('refuses a bonus when the rule version does not enable it', () => {
    const out = calculateKabaddi(base({
      profile: profile({ bonus_enabled: false }),
      raids: [raid({ raid_no: 1, raiding_side: 'A', raider_id: 'A1',
                     defenders_before: 7, bonus_awarded: true })],
    }));
    expect(out.issues.some((i) => i.code === 'BONUS_NOT_AVAILABLE')).toBe(true);
  });
});

describe('GT-004 — earlier raid correction', () => {
  it('replays subsequent state and exposes the dependent contradiction', () => {
    // Raid 1: A puts B1 out. Raid 2: A puts B1 out again — legal only because B1 was
    // never revived. Correcting raid 1 to a no-score makes raid 2 impossible.
    const r1 = raid({ raid_no: 1, raiding_side: 'A', raider_id: 'A1',
                      defenders_before: 7, defenders_out: ['B1'] });
    const r2 = raid({ raid_no: 2, raiding_side: 'A', raider_id: 'A1',
                      defenders_before: 6, defenders_out: ['B2'] });
    const original = base({ raids: [r1, r2] });

    const corrected = [{ ...r1, defenders_out: [] }, r2];
    const { before, after, contradictions } = replayWithCorrection(original, corrected);

    expect(before.issues).toEqual([]);
    expect(before.participants[0]!.primary_value).toBe(2);
    expect(after.participants[0]!.primary_value).toBe(1);   // total changed…
    // …and the downstream inconsistency is surfaced, not hidden.
    expect(contradictions.some((c) => c.code === 'COURT_STATE_MISMATCH')).toBe(true);
  });

  it('rejects tagging a defender who is already out and not revived', () => {
    const out = calculateKabaddi(base({
      profile: profile({ revival_policy: 'None' }),
      raids: [
        raid({ raid_no: 1, raiding_side: 'A', raider_id: 'A1', defenders_before: 7, defenders_out: ['B1'] }),
        raid({ raid_no: 2, raiding_side: 'A', raider_id: 'A1', defenders_before: 6, defenders_out: ['B1'] }),
      ],
    }));
    expect(out.issues.some((i) => i.code === 'DEFENDER_ALREADY_OUT')).toBe(true);
  });

  it('rejects the same defender counted twice within one raid', () => {
    const out = calculateKabaddi(base({
      raids: [raid({ raid_no: 1, raiding_side: 'A', raider_id: 'A1',
                     defenders_before: 7, defenders_out: ['B1', 'B1'] })],
    }));
    expect(out.issues.some((i) => i.code === 'DEFENDER_COUNTED_TWICE')).toBe(true);
    expect(out.participants[0]!.components!.touch_points).toBe(1);
  });

  it('rejects a raider who is not active for the raiding side', () => {
    const out = calculateKabaddi(base({
      profile: profile({ revival_policy: 'None' }),
      raids: [
        raid({ raid_no: 1, raiding_side: 'A', raider_id: 'A1', defenders_before: 7, raider_out: true }),
        raid({ raid_no: 2, raiding_side: 'A', raider_id: 'A1', defenders_before: 7, defenders_out: ['B1'] }),
      ],
    }));
    expect(out.issues.some((i) => i.code === 'RAIDER_NOT_ACTIVE')).toBe(true);
  });
});

describe('both sides can score in one raid (§16)', () => {
  it('records a touch for the raiders and a point for the defenders in the same raid', () => {
    const out = calculateKabaddi(base({
      raids: [raid({ raid_no: 1, raiding_side: 'A', raider_id: 'A1',
                     defenders_before: 7, defenders_out: ['B1'], raider_out: true })],
    }));
    expect(out.participants[0]!.components!.touch_points).toBe(1);      // A scores
    expect(out.participants[1]!.components!.raider_out_points).toBe(1); // B scores too
  });

  it('accepts a penalty that exists outside any raid', () => {
    const out = calculateKabaddi(base({
      raids: [],
      penalties: [{ observation_id: 'p1', half: 1, sequence: 1, awarded_to: 'B',
                    points: 1, reason: 'Technical point — coach dissent' }],
    }));
    expect(out.participants[1]!.components!.technical_points).toBe(1);
    expect(out.issues).toEqual([]);
  });
});

describe('full time and ties (§16)', () => {
  it('declares the higher total the winner at full time', () => {
    const out = calculateKabaddi(base({
      raids: [raid({ raid_no: 1, raiding_side: 'A', raider_id: 'A1',
                     defenders_before: 7, defenders_out: ['B1'] })],
      full_time: true,
    }));
    expect(out.winner_participant_id).toBe('TA');
    expect(out.complete).toBe(true);
  });

  it('fabricates no winner from a level score in a knockout', () => {
    const out = calculateKabaddi(base({ raids: [], full_time: true }));
    expect(out.winner_participant_id).toBeNull();
    expect(out.unresolved[0]!.code).toBe('TIE_REQUIRES_DECISION');
    expect(out.complete).toBe(false);
  });

  it('permits a level result where the league profile allows a shared placing', () => {
    const out = calculateKabaddi(base({
      profile: profile({ allow_shared_place: true }), raids: [], full_time: true,
    }));
    expect(out.unresolved).toEqual([]);
    expect(out.participants.every((p) => p.rank === 1 && p.shared_rank)).toBe(true);
  });
});
