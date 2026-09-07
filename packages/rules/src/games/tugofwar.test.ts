/** Game test vectors GT-028 … GT-030 (Tug of War). §24. */
import { describe, it, expect } from 'vitest';
import { calculateTugOfWar, type TugRuleProfile, type TugPull } from './tugofwar.js';
import type { ParticipantRef } from '../types.js';

const TA: ParticipantRef = { participant_id: 'TA', kind: 'Team', display_name: 'Team A' };
const TB: ParticipantRef = { participant_id: 'TB', kind: 'Team', display_name: 'Team B' };

const profile = (over: Partial<TugRuleProfile> = {}): TugRuleProfile => ({
  rule_version_id: 'RV-TOW-1', discipline: 'TOW',
  team_size: 8, pull_format: 'BestOfThree', pulls_to_win: 2,
  end_change_required: true,
  tie_procedure: [], allow_shared_place: false,
  ...over,
});

let n = 0;
const pull = (
  pull_no: number, replay_sequence: number, outcome: TugPull['outcome'],
  over: Partial<TugPull> = {},
): TugPull => ({
  observation_id: `p-${++n}`, pull_no, replay_sequence, outcome,
  side_a_end: replay_sequence % 2 === 1 ? 'North' : 'South',
  roster_confirmed: true, ...over,
});

describe('GT-028 — replay after a no-pull', () => {
  it('A win, no-pull, A win produces a 2–0 match with one replay in the history', () => {
    const out = calculateTugOfWar({
      profile: profile(),
      participants: [TA, TB],
      pulls: [
        pull(1, 1, 'TeamAWin'),
        pull(2, 1, 'NoPull', { official_reason: 'Rope slipped from the marker' }),
        pull(2, 2, 'TeamAWin'),
      ],
    });
    const a = out.participants[0]!;
    expect(a.components!.pull_wins).toBe(2);
    expect(a.components!.valid_pulls).toBe(2);   // the no-pull is NOT a valid pull
    expect(a.components!.no_pulls).toBe(1);      // …but it IS in the history
    expect(out.winner_participant_id).toBe('TA');
    expect(out.complete).toBe(true);
    expect(out.explanation.some((e) => e.includes('no pull'))).toBe(true);
  });

  it('never increments both the pull count and the win count for a no-pull', () => {
    const out = calculateTugOfWar({
      profile: profile(),
      participants: [TA, TB],
      pulls: [pull(1, 1, 'NoPull', { official_reason: 'Both sides down simultaneously' })],
    });
    expect(out.participants[0]!.components!.pull_wins).toBe(0);
    expect(out.participants[1]!.components!.pull_wins).toBe(0);
    expect(out.participants[0]!.components!.valid_pulls).toBe(0);
    expect(out.participants[0]!.components!.no_pulls).toBe(1);
  });

  it('requires a reason for a no-pull', () => {
    const out = calculateTugOfWar({
      profile: profile(), participants: [TA, TB],
      pulls: [pull(1, 1, 'NoPull')],
    });
    expect(out.issues.some((i) => i.code === 'NO_PULL_REASON_REQUIRED')).toBe(true);
  });

  it('keeps a logical pull outstanding while it has only produced no-pulls', () => {
    const out = calculateTugOfWar({
      profile: profile(), participants: [TA, TB],
      pulls: [
        pull(1, 1, 'TeamAWin'),
        pull(2, 1, 'NoPull', { official_reason: 'Rope marker slipped' }),
        pull(2, 2, 'NoPull', { official_reason: 'False start' }),
      ],
    });
    expect(out.unresolved.some((u) =>
      u.message.includes('all no-pulls'))).toBe(true);
    expect(out.winner_participant_id).toBeNull();
  });
});

describe('GT-029 — unfinished match', () => {
  it('a 1–1 best-of-three requires a further valid pull', () => {
    const out = calculateTugOfWar({
      profile: profile(), participants: [TA, TB],
      pulls: [pull(1, 1, 'TeamAWin'), pull(2, 1, 'TeamBWin')],
    });
    expect(out.winner_participant_id).toBeNull();
    expect(out.unresolved.some((u) => u.code === 'INCOMPLETE_STRUCTURE')).toBe(true);
    expect(out.unresolved[0]!.message).toContain('further valid pull');
    expect(out.complete).toBe(false);
  });

  it('rejects a pull recorded after the match was already decided', () => {
    const out = calculateTugOfWar({
      profile: profile(), participants: [TA, TB],
      pulls: [pull(1, 1, 'TeamAWin'), pull(2, 1, 'TeamAWin'), pull(3, 1, 'TeamBWin')],
    });
    expect(out.issues.some((i) => i.code === 'PULL_AFTER_MATCH_DECIDED')).toBe(true);
  });
});

describe('GT-030 — duplicate pull', () => {
  it('a repeated save of the same pull does not award an extra win', () => {
    const first = pull(1, 1, 'TeamAWin');
    const out = calculateTugOfWar({
      profile: profile(), participants: [TA, TB],
      pulls: [first, { ...first }, pull(2, 1, 'TeamAWin')],
    });
    expect(out.participants[0]!.components!.pull_wins).toBe(2); // not 3
    expect(out.winner_participant_id).toBe('TA');
    expect(out.issues).toEqual([]);
  });

  it('flags a second distinct record claiming the same pull attempt', () => {
    const out = calculateTugOfWar({
      profile: profile(), participants: [TA, TB],
      pulls: [pull(1, 1, 'TeamAWin'), pull(1, 1, 'TeamBWin')],
    });
    expect(out.issues.some((i) => i.code === 'DUPLICATE_PULL_ATTEMPT')).toBe(true);
  });
});

describe('league profile and roster checks (§24)', () => {
  it('a two-pull league draw is valid only in the league profile', () => {
    const league = calculateTugOfWar({
      profile: profile({ pull_format: 'TwoPullLeague', league_points: { win: 2, draw: 1, loss: 0 } }),
      participants: [TA, TB],
      pulls: [pull(1, 1, 'TeamAWin'), pull(2, 1, 'TeamBWin')],
    });
    expect(league.participants[0]!.components!.table_points).toBe(1);
    expect(league.participants[1]!.components!.table_points).toBe(1);
    expect(league.participants.every((p) => p.shared_rank)).toBe(true);
    expect(league.complete).toBe(true);

    // The identical score in a knockout profile is unfinished, not a draw.
    const knockout = calculateTugOfWar({
      profile: profile(), participants: [TA, TB],
      pulls: [pull(1, 1, 'TeamAWin'), pull(2, 1, 'TeamBWin')],
    });
    expect(knockout.complete).toBe(false);
  });

  it('flags a team that presented the wrong number of pullers', () => {
    const out = calculateTugOfWar({
      profile: profile(), participants: [TA, TB],
      pulls: [pull(1, 1, 'TeamAWin'), pull(2, 1, 'TeamAWin')],
      roster_sizes: { A: 8, B: 7 },
    });
    expect(out.issues.some((i) => i.code === 'TEAM_SIZE_MISMATCH')).toBe(true);
  });

  it('flags a pull begun without a confirmed roster', () => {
    const out = calculateTugOfWar({
      profile: profile(), participants: [TA, TB],
      pulls: [pull(1, 1, 'TeamAWin', { roster_confirmed: false })],
    });
    expect(out.issues.some((i) => i.code === 'ROSTER_NOT_CONFIRMED')).toBe(true);
  });

  it('leaves an abandoned pull awaiting an official disposition', () => {
    const out = calculateTugOfWar({
      profile: profile(), participants: [TA, TB],
      pulls: [pull(1, 1, 'Abandoned', { official_reason: 'Rope failure' })],
    });
    expect(out.unresolved.some((u) => u.code === 'OFFICIAL_DISPOSITION_REQUIRED')).toBe(true);
    expect(out.winner_participant_id).toBeNull();
  });
});
