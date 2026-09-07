/** Game test vectors GT-021 … GT-024 (Chess). §22. */
import { describe, it, expect } from 'vitest';
import {
  calculateChess, formatHalfUnits, HALF_UNITS,
  type ChessRuleProfile, type ChessPairing, type ChessBoardResult,
} from './chess.js';
import type { ParticipantRef } from '../types.js';

const P = (id: string): ParticipantRef => ({
  participant_id: id, kind: 'Entry', display_name: `Player ${id}`,
});

const profile = (over: Partial<ChessRuleProfile> = {}): ChessRuleProfile => ({
  rule_version_id: 'RV-CHE-1', discipline: 'CHE',
  format: 'RoundRobin', rounds: 3, pairing_source: 'ManualApproved',
  bye_half_units: HALF_UNITS.WIN,           // a bye awards 1 point under this policy
  forfeit_win_half_units: HALF_UNITS.WIN,
  tie_break_order: [], unplayed_game_policy: 'ExcludeFromBuchholz',
  tie_procedure: [], allow_shared_place: false,
  ...over,
});

let n = 0;
const pair = (round_no: number, board_no: number, w: string, b: string | null): ChessPairing =>
  ({ observation_id: `p-${++n}`, round_no, board_no, white_participant_id: w, black_participant_id: b });

const res = (
  round_no: number, board_no: number, result_code: ChessBoardResult['result_code'],
  over: Partial<ChessBoardResult> = {},
): ChessBoardResult => ({
  observation_id: `r-${++n}`, round_no, board_no, result_code,
  played: result_code === 'WhiteWin' || result_code === 'BlackWin' || result_code === 'Draw',
  arbiter_membership_id: 'arb-1', ...over,
});

describe('GT-021 — points mapping', () => {
  it('a win, a draw and a loss produce 1.5 points', () => {
    const out = calculateChess({
      profile: profile(),
      participants: [P('me'), P('o1'), P('o2'), P('o3')],
      pairings: [
        pair(1, 1, 'me', 'o1'), pair(2, 1, 'o2', 'me'), pair(3, 1, 'me', 'o3'),
      ],
      results: [
        res(1, 1, 'WhiteWin'),  // me wins        → 2 half-units
        res(2, 1, 'Draw'),      // me draws       → 1 half-unit
        res(3, 1, 'BlackWin'),  // me (white) loses → 0
      ],
    });
    const me = out.participants.find((p) => p.participant_id === 'me')!;
    expect(me.components!.half_units).toBe(3);   // integer half-units, no float
    expect(me.primary_display).toBe('1.5');
    expect(me.components!.played_games).toBe(3);
  });

  it('renders integer half-units on the familiar 1 / 0.5 scale', () => {
    expect(formatHalfUnits(0)).toBe('0');
    expect(formatHalfUnits(1)).toBe('0.5');
    expect(formatHalfUnits(3)).toBe('1.5');
    expect(formatHalfUnits(7)).toBe('3.5');
  });

  it('expresses a non-standard award table without rescaling', () => {
    // The point of the integer domain: a school event adopting 3-1-0 is just a
    // different profile, not a change to how scores are stored or compared.
    const out = calculateChess({
      profile: profile({
        rounds: 1, bye_half_units: 3, forfeit_win_half_units: 3,
      }),
      participants: [P('solo')],
      pairings: [pair(1, 1, 'solo', null)],
      results: [res(1, 1, 'ByeWhite', { played: false })],
    });
    expect(out.participants[0]!.components!.half_units).toBe(3);
  });

  it('derives both sides’ scores from the result code, never from typed points', () => {
    const out = calculateChess({
      profile: profile(),
      participants: [P('w'), P('b')],
      pairings: [pair(1, 1, 'w', 'b')],
      results: [res(1, 1, 'Draw')],
    });
    const w = out.participants.find((p) => p.participant_id === 'w')!;
    const b = out.participants.find((p) => p.participant_id === 'b')!;
    expect(w.components!.half_units).toBe(1);
    expect(b.components!.half_units).toBe(1);   // always consistent by construction
  });
});

describe('GT-022 — bye', () => {
  it('awards the configured point but does not count as a played win', () => {
    const out = calculateChess({
      profile: profile({ rounds: 1 }),
      participants: [P('solo')],
      pairings: [pair(1, 1, 'solo', null)],
      results: [res(1, 1, 'ByeWhite', { played: false })],
    });
    const solo = out.participants[0]!;
    expect(solo.primary_display).toBe('1');
    expect(solo.components!.played_games).toBe(0);   // played = false
    expect(out.issues).toEqual([]);
  });

  it('flags a bye recorded as a played game', () => {
    const out = calculateChess({
      profile: profile({ rounds: 1 }),
      participants: [P('solo')],
      pairings: [pair(1, 1, 'solo', null)],
      results: [res(1, 1, 'ByeWhite', { played: true })],
    });
    expect(out.issues.some((i) => i.code === 'PLAYED_FLAG_INCONSISTENT')).toBe(true);
  });

  it('flags a bye result recorded on a two-player board', () => {
    const out = calculateChess({
      profile: profile({ rounds: 1 }),
      participants: [P('a'), P('b')],
      pairings: [pair(1, 1, 'a', 'b')],
      results: [res(1, 1, 'ByeWhite', { played: false })],
    });
    expect(out.issues.some((i) => i.code === 'BYE_ON_PLAYED_BOARD')).toBe(true);
  });

  it('excludes unplayed games from Buchholz under the configured policy', () => {
    const out = calculateChess({
      profile: profile({
        rounds: 2, allow_shared_place: true,
        tie_break_order: [{ comparator: 'Buchholz', direction: 'HigherWins', label: 'Buchholz' }],
      }),
      participants: [P('a'), P('b'), P('c')],
      pairings: [pair(1, 1, 'a', 'b'), pair(1, 2, 'c', null), pair(2, 1, 'a', 'c')],
      results: [res(1, 1, 'WhiteWin'), res(1, 2, 'ByeWhite', { played: false }), res(2, 1, 'WhiteWin')],
    });
    // a beat b (0 pts) and c (2 pts from the bye): Buchholz counts played opponents only.
    expect(out.issues).toEqual([]);
    const a = out.participants.find((p) => p.participant_id === 'a')!;
    expect(a.components!.played_games).toBe(2);
  });
});

describe('GT-023 — duplicate pairing', () => {
  it('blocks publication when a player appears on two boards in one round', () => {
    const out = calculateChess({
      profile: profile({ rounds: 1 }),
      participants: [P('a'), P('b'), P('c')],
      pairings: [pair(1, 1, 'a', 'b'), pair(1, 2, 'a', 'c')],
      results: [res(1, 1, 'Draw'), res(1, 2, 'Draw')],
    });
    expect(out.issues.some((i) => i.code === 'PLAYER_ON_MULTIPLE_BOARDS')).toBe(true);
    expect(out.complete).toBe(false);
  });

  it('rejects a self-pairing', () => {
    const out = calculateChess({
      profile: profile({ rounds: 1 }),
      participants: [P('a')],
      pairings: [pair(1, 1, 'a', 'a')],
      results: [res(1, 1, 'Draw')],
    });
    expect(out.issues.some((i) => i.code === 'SELF_PAIRING')).toBe(true);
  });

  it('refuses automated pairing without a named validated engine (§22)', () => {
    const out = calculateChess({
      profile: profile({ format: 'Swiss', pairing_source: 'ImportedApprovedEngine', pairing_engine_id: null }),
      participants: [P('a'), P('b')],
      pairings: [pair(1, 1, 'a', 'b')],
      results: [res(1, 1, 'Draw')],
    });
    expect(out.issues.some((i) => i.code === 'PAIRING_ENGINE_NOT_NAMED')).toBe(true);
  });
});

describe('GT-024 — unresolved claim', () => {
  it('does not award an automatic win for a reported timeout', () => {
    const out = calculateChess({
      profile: profile({ rounds: 1 }),
      participants: [P('a'), P('b')],
      pairings: [pair(1, 1, 'a', 'b')],
      results: [res(1, 1, 'WhiteWin', {
        pending_arbiter_claim: 'Black reports White’s flag fell; arbiter has not ruled',
      })],
    });
    expect(out.unresolved.some((u) => u.code === 'ARBITER_CLAIM_PENDING')).toBe(true);
    // No points were awarded from the unruled board.
    expect(out.participants.every((p) => p.components!.half_units === 0)).toBe(true);
    expect(out.complete).toBe(false);
  });

  it('blocks a round with a missing board result', () => {
    const out = calculateChess({
      profile: profile({ rounds: 1 }),
      participants: [P('a'), P('b'), P('c'), P('d')],
      pairings: [pair(1, 1, 'a', 'b'), pair(1, 2, 'c', 'd')],
      results: [res(1, 1, 'Draw')],
    });
    expect(out.issues.some((i) => i.code === 'BOARD_RESULT_MISSING')).toBe(true);
  });

  it('leaves a postponed board unresolved rather than scoring it', () => {
    const out = calculateChess({
      profile: profile({ rounds: 1 }),
      participants: [P('a'), P('b')],
      pairings: [pair(1, 1, 'a', 'b')],
      results: [res(1, 1, 'Postponed', { played: false })],
    });
    expect(out.unresolved.some((u) => u.code === 'OFFICIAL_DISPOSITION_REQUIRED')).toBe(true);
    expect(out.participants.every((p) => p.components!.half_units === 0)).toBe(true);
  });
});
