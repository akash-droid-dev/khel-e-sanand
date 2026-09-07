/** Game test vectors GT-009 … GT-011 (Kho Kho). §18. */
import { describe, it, expect } from 'vitest';
import {
  calculateKhoKho, type KhoRuleProfile, type KhoInput,
  type KhoTurn, type KhoBatch, type KhoOutEvent,
} from './khokho.js';
import type { ParticipantRef } from '../types.js';

const TA: ParticipantRef = { participant_id: 'TA', kind: 'Team', display_name: 'Team A' };
const TB: ParticipantRef = { participant_id: 'TB', kind: 'Team', display_name: 'Team B' };

const profile = (over: Partial<KhoRuleProfile> = {}): KhoRuleProfile => ({
  rule_version_id: 'RV-KHO-1', discipline: 'KHO',
  variant: 'Conventional school profile',
  on_court_players: 9, batch_size: 3,
  innings: 1, turns_per_inning: 2, turn_minutes: 7,
  points_per_out: 1,              // the conventional reference in §18
  dream_run_enabled: false,
  tie_procedure: [], allow_shared_place: false,
  ...over,
});

let n = 0;
const turn = (inning_no: number, turn_no: number, chasing_side: 'A' | 'B', closed = true): KhoTurn =>
  ({ observation_id: `t-${++n}`, inning_no, turn_no, chasing_side, closed, planned_seconds: 420 });

const batch = (inning_no: number, turn_no: number, seq: number, ids: string[]): KhoBatch =>
  ({ observation_id: `b-${++n}`, inning_no, turn_no, batch_sequence: seq, defender_ids: ids });

const out = (
  inning_no: number, turn_no: number, seq: number, defender_id: string,
  over: Partial<KhoOutEvent> = {},
): KhoOutEvent => ({
  observation_id: `o-${++n}`, inning_no, turn_no, batch_sequence: seq, defender_id,
  out_reason: 'Touched by chaser', points_awarded: 1, official_confirmed: true, ...over,
});

/** A complete 1-inning, 2-turn match where A takes `aOuts` and B takes `bOuts`. */
function fullMatch(aOuts: number, bOuts: number, over: Partial<KhoInput> = {}): KhoInput {
  const batches: KhoBatch[] = [];
  const outs: KhoOutEvent[] = [];

  // Turn 1: A chases, defenders are B players, in batches of 3.
  for (let i = 0; i < Math.ceil(Math.max(aOuts, 1) / 3); i += 1) {
    batches.push(batch(1, 1, i + 1, [`B${i * 3 + 1}`, `B${i * 3 + 2}`, `B${i * 3 + 3}`]));
  }
  for (let i = 0; i < aOuts; i += 1) {
    outs.push(out(1, 1, Math.floor(i / 3) + 1, `B${i + 1}`));
  }
  // Turn 2: B chases.
  for (let i = 0; i < Math.ceil(Math.max(bOuts, 1) / 3); i += 1) {
    batches.push(batch(1, 2, i + 1, [`A${i * 3 + 1}`, `A${i * 3 + 2}`, `A${i * 3 + 3}`]));
  }
  for (let i = 0; i < bOuts; i += 1) {
    outs.push(out(1, 2, Math.floor(i / 3) + 1, `A${i + 1}`));
  }

  return {
    profile: profile(), participants: [TA, TB],
    turns: [turn(1, 1, 'A'), turn(1, 2, 'B')],
    batches, outs, ...over,
  };
}

describe('GT-009 — conventional outs', () => {
  it('eight accepted outs at one point per out produce eight points', () => {
    const res = calculateKhoKho(fullMatch(8, 0));
    expect(res.participants[0]!.primary_value).toBe(8);
    expect(res.participants[0]!.components!.outs_taken).toBe(8);
    expect(res.participants[1]!.primary_value).toBe(0);
    expect(res.issues).toEqual([]);
    expect(res.winner_participant_id).toBe('TA');
  });

  it('sums a side’s chasing turns, not defender survival time', () => {
    const res = calculateKhoKho(fullMatch(5, 3));
    expect(res.participants[0]!.primary_value).toBe(5);
    expect(res.participants[1]!.primary_value).toBe(3);
    expect(res.winner_participant_id).toBe('TA');
  });

  it('contributes nothing from a disabled dream-run variant', () => {
    const res = calculateKhoKho(fullMatch(4, 2));
    expect(res.explanation.some((e) => e.includes('contributes no points'))).toBe(true);
    expect(res.participants[0]!.primary_value).toBe(4); // unchanged by the variant
  });
});

describe('GT-010 — duplicate defender out', () => {
  it('rejects a second out for the same batch appearance', () => {
    const m = fullMatch(1, 0);
    m.outs.push(out(1, 1, 1, 'B1')); // same defender, same batch appearance
    const res = calculateKhoKho(m);
    expect(res.issues.some((i) => i.code === 'DUPLICATE_OUT_FOR_APPEARANCE')).toBe(true);
    expect(res.participants[0]!.components!.outs_taken).toBe(1); // counted once
  });

  it('counts a later batch appearance by the same defender as a new out', () => {
    const m = fullMatch(0, 0);
    m.batches = [
      batch(1, 1, 1, ['B1', 'B2', 'B3']),
      batch(1, 1, 2, ['B1', 'B4', 'B5']),   // B1 re-enters — a new appearance
      batch(1, 2, 1, ['A1', 'A2', 'A3']),
    ];
    m.outs = [out(1, 1, 1, 'B1'), out(1, 1, 2, 'B1')];
    const res = calculateKhoKho(m);
    expect(res.issues).toEqual([]);
    expect(res.participants[0]!.components!.outs_taken).toBe(2);
  });

  it('rejects an out for a defender who is not in that batch', () => {
    const m = fullMatch(0, 0);
    m.batches = [batch(1, 1, 1, ['B1', 'B2', 'B3']), batch(1, 2, 1, ['A1', 'A2', 'A3'])];
    m.outs = [out(1, 1, 1, 'B9')];
    const res = calculateKhoKho(m);
    expect(res.issues.some((i) => i.code === 'DEFENDER_NOT_IN_BATCH')).toBe(true);
  });

  it('rejects an unconfirmed out', () => {
    const m = fullMatch(0, 0);
    m.batches = [batch(1, 1, 1, ['B1', 'B2', 'B3']), batch(1, 2, 1, ['A1', 'A2', 'A3'])];
    m.outs = [out(1, 1, 1, 'B1', { official_confirmed: false })];
    const res = calculateKhoKho(m);
    expect(res.issues.some((i) => i.code === 'OUT_NOT_CONFIRMED')).toBe(true);
    expect(res.participants[0]!.primary_value).toBe(0);
  });
});

describe('GT-011 — missing turn', () => {
  it('blocks finalisation when a required turn is absent', () => {
    const m = fullMatch(6, 0);
    m.turns = [turn(1, 1, 'A')];   // turn 2 never played
    const res = calculateKhoKho(m);
    expect(res.unresolved.some((u) => u.code === 'INCOMPLETE_STRUCTURE')).toBe(true);
    expect(res.winner_participant_id).toBeNull();
    expect(res.complete).toBe(false);
  });

  it('does not treat the missing turn as a completed zero-scoring turn', () => {
    const m = fullMatch(6, 0);
    m.turns = [turn(1, 1, 'A')];
    const res = calculateKhoKho(m);
    // Side B is not credited with a played turn worth nothing.
    expect(res.participants[1]!.components!.outs_taken).toBe(0);
    expect(res.unresolved[0]!.message).toContain('not a completed turn');
  });

  it('permits finalisation when an official early-finish decision is recorded', () => {
    const m = fullMatch(6, 0);
    m.turns = [turn(1, 1, 'A')];
    m.early_finish_reason = 'Match abandoned by referee — ground unfit; result awarded on turn 1';
    const res = calculateKhoKho(m);
    expect(res.unresolved.some((u) => u.code === 'INCOMPLETE_STRUCTURE')).toBe(false);
    expect(res.winner_participant_id).toBe('TA');
  });

  it('rejects an open turn', () => {
    const m = fullMatch(3, 2);
    m.turns = [turn(1, 1, 'A'), turn(1, 2, 'B', false)];
    const res = calculateKhoKho(m);
    expect(res.issues.some((i) => i.code === 'TURN_NOT_CLOSED')).toBe(true);
  });

  it('rejects a side chasing twice in succession', () => {
    const m = fullMatch(0, 0);
    m.turns = [turn(1, 1, 'A'), turn(1, 2, 'A')];
    m.batches = [batch(1, 1, 1, ['B1', 'B2', 'B3']), batch(1, 2, 1, ['B4', 'B5', 'B6'])];
    const res = calculateKhoKho(m);
    expect(res.issues.some((i) => i.code === 'TURN_ROLES_NOT_ALTERNATING')).toBe(true);
  });
});

describe('ties and reversal (§18)', () => {
  it('reversing an out recalculates the total', () => {
    const withOut = calculateKhoKho(fullMatch(8, 0));
    const reversed = calculateKhoKho(fullMatch(7, 0));
    expect(withOut.participants[0]!.primary_value).toBe(8);
    expect(reversed.participants[0]!.primary_value).toBe(7);
  });

  it('requires the configured tie procedure for a level score', () => {
    const res = calculateKhoKho(fullMatch(4, 4));
    expect(res.winner_participant_id).toBeNull();
    expect(res.unresolved[0]!.code).toBe('TIE_REQUIRES_DECISION');
  });

  it('flags a batch whose size does not match the profile', () => {
    const m = fullMatch(0, 0);
    m.batches = [batch(1, 1, 1, ['B1', 'B2']), batch(1, 2, 1, ['A1', 'A2', 'A3'])];
    const res = calculateKhoKho(m);
    expect(res.issues.some((i) => i.code === 'BATCH_SIZE_MISMATCH')).toBe(true);
  });
});
