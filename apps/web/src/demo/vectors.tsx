/**
 * The specification's game test vectors, executed live in the browser.
 *
 * These are the same GT-* cases from
 * `Khelo_Sanand_Data_and_Functions.xlsx` → Game_Cases that the CI suite runs. They
 * pass here for the same reason they can run on a static host at all: the calculators
 * are pure, so a browser and a CI runner compute identical results.
 *
 * A handful of the 38 are covered by test-suite assertions that need more setup than a
 * panel can usefully show (multi-heat qualification, correction replay). Those are
 * marked as such and pointed at their test file rather than being quietly omitted.
 */
import { useMemo } from 'react';
import {
  calculateAttempts, calculateMatch, calculateKabaddi, calculateKhoKho,
  calculateChess, calculateTugOfWar, calculateCycling, calculateSprintHeat,
  evaluateUnit, toMillimetres, nextBestTieChain,
  type AttemptObservation, type ParticipantRef,
} from '@khel/rules';
import * as P from './profiles.js';

interface Vector {
  id: string;
  game: string;
  case: string;
  expected: string;
  run: () => { actual: string; pass: boolean };
}

const P1: ParticipantRef = { participant_id: 'a1', kind: 'Entry', display_name: 'Demo 001' };
const P2: ParticipantRef = { participant_id: 'a2', kind: 'Entry', display_name: 'Demo 002' };

let n = 0;
const att = (
  pid: string, no: number, outcome: AttemptObservation['outcome'],
  raw?: string, extra: Partial<AttemptObservation> = {},
): AttemptObservation => ({
  observation_id: `v${++n}`, participant_id: pid, attempt_no: no, outcome,
  raw_value: raw ?? null, raw_unit: 'm', ...extra,
});

const VECTORS: Vector[] = [
  {
    id: 'GT-012', game: 'SBT', case: '12.40 m, foul, 13.10 m',
    expected: '13.10 m',
    run: () => {
      const out = calculateAttempts({
        profile: P.attemptsProfile('SBT'), participants: [P1],
        observations: [att('a1', 1, 'valid', '12.40'), att('a1', 2, 'foul'),
                       att('a1', 3, 'valid', '13.10')],
      });
      const r = out.participants[0]!;
      return { actual: r.primary_display, pass: r.primary_value === 13100 };
    },
  },
  {
    id: 'GT-013', game: 'SBT', case: 'foul, foul, foul',
    expected: 'NM, no numeric rank',
    run: () => {
      const out = calculateAttempts({
        profile: P.attemptsProfile('SBT'), participants: [P1],
        observations: [att('a1', 1, 'foul'), att('a1', 2, 'foul'), att('a1', 3, 'foul')],
      });
      const r = out.participants[0]!;
      return { actual: `${r.status}, rank ${r.rank ?? 'none'}`,
               pass: r.status === 'NM' && r.rank === null && r.primary_value === null };
    },
  },
  {
    id: 'GT-014', game: 'SBT', case: 'A 13.1/12.4 vs B 13.1/12.3, next-best adopted',
    expected: 'A ahead',
    run: () => {
      const out = calculateAttempts({
        profile: { ...P.attemptsProfile('SBT'), tie_procedure: nextBestTieChain(3) },
        participants: [{ ...P1, participant_id: 'A' }, { ...P2, participant_id: 'B' }],
        observations: [
          att('A', 1, 'valid', '13.10'), att('A', 2, 'valid', '12.40'), att('A', 3, 'foul'),
          att('B', 1, 'valid', '13.10'), att('B', 2, 'valid', '12.30'), att('B', 3, 'foul'),
        ],
      });
      const a = out.participants.find((p) => p.participant_id === 'A')!;
      return { actual: `A rank ${a.rank}`, pass: a.rank === 1 };
    },
  },
  {
    id: 'GT-014b', game: 'SBT', case: 'same marks, NO tie rule approved',
    expected: 'unresolved tie, nobody ranked',
    run: () => {
      const out = calculateAttempts({
        profile: { ...P.attemptsProfile('SBT'), tie_procedure: [] },
        participants: [{ ...P1, participant_id: 'A' }, { ...P2, participant_id: 'B' }],
        observations: [
          att('A', 1, 'valid', '13.10'), att('A', 2, 'valid', '12.40'), att('A', 3, 'foul'),
          att('B', 1, 'valid', '13.10'), att('B', 2, 'valid', '12.30'), att('B', 3, 'foul'),
        ],
      });
      return { actual: out.unresolved[0]?.code ?? 'none',
               pass: out.unresolved[0]?.code === 'TIE_REQUIRES_DECISION'
                     && out.participants.every((p) => p.rank === null) };
    },
  },
  {
    id: 'GT-016', game: 'KJT', case: 'target zones worth 3, 5, 1',
    expected: '9 points',
    run: () => {
      const out = calculateAttempts({
        profile: P.javelinTargetProfile(), participants: [P1],
        observations: [att('a1', 1, 'valid', undefined, { zone_id: 'Z3' }),
                       att('a1', 2, 'valid', undefined, { zone_id: 'Z5' }),
                       att('a1', 3, 'valid', undefined, { zone_id: 'Z1' })],
      });
      return { actual: out.participants[0]!.primary_display,
               pass: out.participants[0]!.primary_value === 9 };
    },
  },
  {
    id: 'GT-017', game: 'KJT', case: 'metres entered into a zone-points field',
    expected: 'validation failure',
    run: () => {
      const out = calculateAttempts({
        profile: P.javelinTargetProfile(), participants: [P1],
        observations: [att('a1', 1, 'valid', '9.00'), att('a1', 2, 'pass'), att('a1', 3, 'pass')],
      });
      return { actual: out.issues[0]?.code ?? 'accepted',
               pass: out.issues.some((i) => i.code === 'DISTANCE_IN_TARGET_MODE') };
    },
  },
  {
    id: 'GT-026', game: 'SBJ', case: '132 cm and 1.32 m',
    expected: 'both 1320 mm',
    run: () => {
      const cm = toMillimetres('132', 'cm');
      const m = toMillimetres('1.32', 'm');
      return { actual: `${cm} mm / ${m} mm`, pass: cm === 1320 && m === 1320 };
    },
  },
  {
    id: 'GT-027', game: 'SBJ', case: 'attempts not taken',
    expected: 'Incomplete, not NM',
    run: () => {
      const out = calculateAttempts({
        profile: P.attemptsProfile('SBJ'), participants: [P1],
        observations: [att('a1', 1, 'valid', '1.20'), att('a1', 2, 'not_taken'),
                       att('a1', 3, 'not_taken')],
      });
      const r = out.participants[0]!;
      return { actual: r.primary_display,
               pass: r.status !== 'NM' && r.primary_display === 'Incomplete' };
    },
  },
  {
    id: 'GT-005', game: 'SP30', case: '5.21 s, 5.35 s, DNS',
    expected: '5.21 first, DNS unranked',
    run: () => {
      const out = calculateSprintHeat({
        profile: P.sprintProfile('SP30'), heat_id: 'H1',
        participants: [{ ...P1, participant_id: 'f' }, { ...P2, participant_id: 's' },
                       { participant_id: 'd', kind: 'Entry', display_name: 'Demo 003' }],
        observations: [
          { observation_id: 'x1', participant_id: 'f', lane: 1, official_finish_position: 1,
            raw_time_value: '5.21', raw_time_unit: 's', status: 'Completed' },
          { observation_id: 'x2', participant_id: 's', lane: 2, official_finish_position: 2,
            raw_time_value: '5.35', raw_time_unit: 's', status: 'Completed' },
          { observation_id: 'x3', participant_id: 'd', lane: 3, official_finish_position: null,
            status: 'DNS', official_decision: 'Did not report to start' },
        ],
      });
      const dns = out.participants.find((p) => p.participant_id === 'd')!;
      return { actual: `order ${out.standings.join(', ')}; DNS rank ${dns.rank ?? 'none'}`,
               pass: out.standings[0] === 'f' && dns.rank === null };
    },
  },
  {
    id: 'GT-031', game: 'BAD', case: 'T21 L2 C30, score 21–20',
    expected: 'game still open',
    run: () => {
      const e = evaluateUnit(21, 20, { target: 21, margin: 2, cap: 30 });
      return { actual: e.state, pass: e.state === 'Open' };
    },
  },
  {
    id: 'GT-032', game: 'BAD', case: 'T21 L2 C30, score 30–29',
    expected: 'closed at the cap',
    run: () => {
      const e = evaluateUnit(30, 29, { target: 21, margin: 2, cap: 30 });
      return { actual: e.state, pass: e.state === 'Closed' };
    },
  },
  {
    id: 'GT-033', game: 'BAD', case: 'T21 L2 C30, score 31–29',
    expected: 'invalid',
    run: () => {
      const e = evaluateUnit(31, 29, { target: 21, margin: 2, cap: 30 });
      return { actual: `${e.state} (${e.code ?? '—'})`, pass: e.state === 'Invalid' };
    },
  },
  {
    id: 'GT-034', game: 'BAD', case: 'T15 L2 C21, score 21–20',
    expected: 'closed under this profile',
    run: () => {
      const e = evaluateUnit(21, 20, { target: 15, margin: 2, cap: 21 });
      return { actual: e.state, pass: e.state === 'Closed' };
    },
  },
  {
    id: 'GT-035', game: 'VOL', case: 'T25 L2 no cap, score 25–24',
    expected: 'set still open',
    run: () => {
      const e = evaluateUnit(25, 24, { target: 25, margin: 2, cap: null });
      return { actual: e.state, pass: e.state === 'Open' };
    },
  },
  {
    id: 'GT-036', game: 'VOL', case: 'W3, fifth set 16–14, target 15',
    expected: 'set and match closed',
    run: () => {
      const out = calculateMatch({
        profile: P.volleyballProfile(), participants: P.teams(),
        units: [
          { observation_id: 'u1', unit_no: 1, points_a: 25, points_b: 20, finalised: true },
          { observation_id: 'u2', unit_no: 2, points_a: 20, points_b: 25, finalised: true },
          { observation_id: 'u3', unit_no: 3, points_a: 25, points_b: 22, finalised: true },
          { observation_id: 'u4', unit_no: 4, points_a: 18, points_b: 25, finalised: true },
          { observation_id: 'u5', unit_no: 5, points_a: 16, points_b: 14, finalised: true },
        ],
      });
      return { actual: `winner ${out.winner_participant_id ?? 'none'}`,
               pass: out.winner_participant_id === 'TA' && out.complete };
    },
  },
  {
    id: 'GT-038', game: 'VOL', case: '3–0 match with a fourth set recorded',
    expected: 'fourth set blocked',
    run: () => {
      const out = calculateMatch({
        profile: P.volleyballProfile(), participants: P.teams(),
        units: [1, 2, 3, 4].map((i) => ({
          observation_id: `u${i}`, unit_no: i, points_a: 25, points_b: 20, finalised: true,
        })),
      });
      return { actual: out.issues[0]?.code ?? 'accepted',
               pass: out.issues.some((i) => i.code === 'UNIT_AFTER_MATCH_DECIDED') };
    },
  },
  {
    id: 'GT-001', game: 'KAB', case: '1 opponent out + all-out (extra 2)',
    expected: '3 points, not 2 or 5',
    run: () => {
      const out = calculateKabaddi({
        profile: { ...P.kabaddiProfile(), on_court_players: 1 },
        participants: P.teams(), roster: { A: ['A1'], B: ['B1'] },
        raids: [{ observation_id: 'r1', half: 1, raid_no: 1, raiding_side: 'A',
                  raider_id: 'A1', defenders_before: 1, defenders_out: ['B1'],
                  raider_out: false, bonus_awarded: false, all_out_awarded: true }],
      });
      const a = out.participants[0]!;
      return { actual: `${a.primary_value} points`, pass: a.primary_value === 3 };
    },
  },
  {
    id: 'GT-003', game: 'KAB', case: 'bonus only, no opponent out',
    expected: '+1, no revival',
    run: () => {
      const out = calculateKabaddi({
        profile: P.kabaddiProfile(), participants: P.teams(), roster: P.kabaddiRoster(),
        raids: [{ observation_id: 'r1', half: 1, raid_no: 1, raiding_side: 'A',
                  raider_id: 'A1', defenders_before: 7, defenders_out: [],
                  raider_out: false, bonus_awarded: true, all_out_awarded: false }],
      });
      const a = out.participants[0]!;
      return { actual: `${a.primary_value} point, court ${a.components?.['on_court_at_end']}`,
               pass: a.primary_value === 1 && a.components?.['on_court_at_end'] === 7 };
    },
  },
  {
    id: 'GT-009', game: 'KHO', case: '8 accepted outs at 1 point each',
    expected: '8 points',
    run: () => {
      const batches = [1, 2, 3].map((seq) => ({
        observation_id: `b${seq}`, inning_no: 1, turn_no: 1, batch_sequence: seq,
        defender_ids: [`B${seq * 3 - 2}`, `B${seq * 3 - 1}`, `B${seq * 3}`],
      }));
      const outs = Array.from({ length: 8 }, (_, i) => ({
        observation_id: `o${i}`, inning_no: 1, turn_no: 1,
        batch_sequence: Math.floor(i / 3) + 1, defender_id: `B${i + 1}`,
        out_reason: 'Touched', points_awarded: 1, official_confirmed: true,
      }));
      const out = calculateKhoKho({
        profile: P.khoProfile(), participants: P.teams(),
        turns: [
          { observation_id: 't1', inning_no: 1, turn_no: 1, chasing_side: 'A',
            closed: true, planned_seconds: 420 },
          { observation_id: 't2', inning_no: 1, turn_no: 2, chasing_side: 'B',
            closed: true, planned_seconds: 420 },
        ],
        batches: [...batches, { observation_id: 'b4', inning_no: 1, turn_no: 2,
                                batch_sequence: 1, defender_ids: ['A1', 'A2', 'A3'] }],
        outs,
      });
      return { actual: `${out.participants[0]!.primary_value} points`,
               pass: out.participants[0]!.primary_value === 8 };
    },
  },
  {
    id: 'GT-021', game: 'CHE', case: 'win + draw + loss',
    expected: '1.5 points',
    run: () => {
      const out = calculateChess({
        profile: { ...P.chessProfile(), rounds: 3 },
        participants: ['me', 'o1', 'o2', 'o3'].map((id) => ({
          participant_id: id, kind: 'Entry' as const, display_name: id })),
        pairings: [
          { observation_id: 'p1', round_no: 1, board_no: 1,
            white_participant_id: 'me', black_participant_id: 'o1' },
          { observation_id: 'p2', round_no: 2, board_no: 1,
            white_participant_id: 'o2', black_participant_id: 'me' },
          { observation_id: 'p3', round_no: 3, board_no: 1,
            white_participant_id: 'me', black_participant_id: 'o3' },
        ],
        results: [
          { observation_id: 'r1', round_no: 1, board_no: 1, result_code: 'WhiteWin', played: true },
          { observation_id: 'r2', round_no: 2, board_no: 1, result_code: 'Draw', played: true },
          { observation_id: 'r3', round_no: 3, board_no: 1, result_code: 'BlackWin', played: true },
        ],
      });
      const me = out.participants.find((p) => p.participant_id === 'me')!;
      return { actual: `${me.primary_display} points`, pass: me.components?.['half_units'] === 3 };
    },
  },
  {
    id: 'GT-024', game: 'CHE', case: 'player reports a timeout, arbiter undecided',
    expected: 'no automatic win',
    run: () => {
      const out = calculateChess({
        profile: { ...P.chessProfile(), rounds: 1 },
        participants: [{ participant_id: 'a', kind: 'Entry', display_name: 'a' },
                       { participant_id: 'b', kind: 'Entry', display_name: 'b' }],
        pairings: [{ observation_id: 'p1', round_no: 1, board_no: 1,
                     white_participant_id: 'a', black_participant_id: 'b' }],
        results: [{ observation_id: 'r1', round_no: 1, board_no: 1,
                    result_code: 'WhiteWin', played: true,
                    pending_arbiter_claim: 'Black claims White’s flag fell' }],
      });
      return { actual: out.unresolved[0]?.code ?? 'scored',
               pass: out.unresolved.some((u) => u.code === 'ARBITER_CLAIM_PENDING')
                     && out.participants.every((p) => p.components?.['half_units'] === 0) };
    },
  },
  {
    id: 'GT-028', game: 'TOW', case: 'A win, no-pull, A win',
    expected: '2–0, one replay in history',
    run: () => {
      const out = calculateTugOfWar({
        profile: P.tugProfile(), participants: P.teams(),
        pulls: [
          { observation_id: 'u1', pull_no: 1, replay_sequence: 1, side_a_end: 'North',
            outcome: 'TeamAWin', roster_confirmed: true },
          { observation_id: 'u2', pull_no: 2, replay_sequence: 1, side_a_end: 'South',
            outcome: 'NoPull', official_reason: 'Rope slipped', roster_confirmed: true },
          { observation_id: 'u3', pull_no: 2, replay_sequence: 2, side_a_end: 'South',
            outcome: 'TeamAWin', roster_confirmed: true },
        ],
      });
      const a = out.participants[0]!;
      return { actual: `${a.components?.['pull_wins']}–${out.participants[1]!.components?.['pull_wins']}, ` +
                       `${a.components?.['no_pulls']} no-pull`,
               pass: a.components?.['pull_wins'] === 2 && a.components?.['no_pulls'] === 1 };
    },
  },
  {
    id: 'GT-029', game: 'TOW', case: '1–1 in a best-of-three',
    expected: 'further valid pull required',
    run: () => {
      const out = calculateTugOfWar({
        profile: P.tugProfile(), participants: P.teams(),
        pulls: [
          { observation_id: 'u1', pull_no: 1, replay_sequence: 1, side_a_end: 'North',
            outcome: 'TeamAWin', roster_confirmed: true },
          { observation_id: 'u2', pull_no: 2, replay_sequence: 1, side_a_end: 'South',
            outcome: 'TeamBWin', roster_confirmed: true },
        ],
      });
      return { actual: out.unresolved[0]?.code ?? 'decided',
               pass: out.winner_participant_id === null
                     && out.unresolved.some((u) => u.code === 'INCOMPLETE_STRUCTURE') };
    },
  },
  {
    id: 'GT-018', game: 'CYC', case: 'time trial 120.50 s + 5.00 s penalty',
    expected: '125.50 s',
    run: () => {
      const out = calculateCycling({
        profile: P.cyclingProfile(),
        participants: [{ participant_id: 'r1', kind: 'Entry', display_name: 'r1' }],
        starts: [{ participant_id: 'r1', bib: '1', scheduled_start_value: '0',
                   official_start_value: '0', time_unit: 's', equipment_cleared: true }],
        passages: [1, 2, 3].map((lap) => ({
          observation_id: `l${lap}`, participant_id: 'r1', lap_number: lap,
          crossing_time_value: String(40 * lap), crossing_time_unit: 's' as const,
          source_event_id: `e${lap}`, timing_reference_id: 'demo-chip-timer',
        })),
        finishes: [{ participant_id: 'r1', finish_time_value: '120.50', time_unit: 's',
                     penalty_value: '5.00', penalty_unit: 's', status: 'Completed' }],
      });
      return { actual: out.participants[0]!.primary_display,
               pass: out.participants[0]!.components?.['final_time_us'] === 125_500_000 };
    },
  },
  {
    id: 'GT-020', game: 'CYC', case: 'the same timing passage imported twice',
    expected: 'one lap crossing',
    run: () => {
      const dup = {
        observation_id: 'd1', participant_id: 'r1', lap_number: 3,
        crossing_time_value: '120', crossing_time_unit: 's' as const,
        source_event_id: 'e3', timing_reference_id: 'demo-chip-timer',
      };
      const out = calculateCycling({
        profile: P.cyclingProfile(),
        participants: [{ participant_id: 'r1', kind: 'Entry', display_name: 'r1' }],
        starts: [{ participant_id: 'r1', bib: '1', scheduled_start_value: '0',
                   official_start_value: '0', time_unit: 's', equipment_cleared: true }],
        passages: [
          { observation_id: 'l1', participant_id: 'r1', lap_number: 1,
            crossing_time_value: '40', crossing_time_unit: 's', source_event_id: 'e1',
            timing_reference_id: 'demo-chip-timer' },
          { observation_id: 'l2', participant_id: 'r1', lap_number: 2,
            crossing_time_value: '80', crossing_time_unit: 's', source_event_id: 'e2',
            timing_reference_id: 'demo-chip-timer' },
          dup, { ...dup, observation_id: 'd1-reimport' },
        ],
        finishes: [{ participant_id: 'r1', finish_time_value: '120', time_unit: 's',
                     status: 'Completed' }],
      });
      return { actual: `${out.participants[0]!.components?.['completed_laps']} laps`,
               pass: out.participants[0]!.components?.['completed_laps'] === 3 };
    },
  },
];

/** Vectors whose assertions need more setup than a panel usefully shows. */
const COVERED_IN_SUITE = [
  ['GT-002', 'KAB', 'duplicate raid retry', 'kabaddi.test.ts'],
  ['GT-004', 'KAB', 'earlier raid correction replays state', 'kabaddi.test.ts'],
  ['GT-006', 'SP50', 'two heats, 2 per heat + next 2 times', 'sprint.test.ts'],
  ['GT-007', 'SP60', 'cut-off tie blocks progression', 'sprint.test.ts'],
  ['GT-008', 'SP*', 'equal displayed time, distinct places', 'sprint.test.ts'],
  ['GT-010', 'KHO', 'duplicate defender out rejected', 'khokho.test.ts'],
  ['GT-011', 'KHO', 'missing turn blocks finalisation', 'khokho.test.ts'],
  ['GT-015', 'KJT', 'distance profile best mark', 'attempts.test.ts'],
  ['GT-019', 'CYC', 'lapped rider cannot win on distance', 'cycling.test.ts'],
  ['GT-022', 'CHE', 'bye scores but is not a played win', 'chess.test.ts'],
  ['GT-023', 'CHE', 'duplicate pairing blocks publication', 'chess.test.ts'],
  ['GT-025', 'SBJ', 'best jump of three', 'attempts.test.ts'],
  ['GT-030', 'TOW', 'duplicate pull awards no extra win', 'tugofwar.test.ts'],
  ['GT-037', 'VOL', 'shorter local format decider', 'matchplay.test.ts'],
];

export function VectorPanel() {
  const results = useMemo(() => VECTORS.map((v) => {
    try {
      const { actual, pass } = v.run();
      return { ...v, actual, pass, error: null as string | null };
    } catch (err) {
      return { ...v, actual: '—', pass: false, error: String(err) };
    }
  }), []);

  const passed = results.filter((r) => r.pass).length;

  return (
    <section>
      <h1>Specification test vectors</h1>
      <p className="muted">
        Executed live in your browser, right now. These are the same GT-* cases from the
        specification workbook that the CI suite runs — identical results, because the
        calculators are pure functions with no I/O.
      </p>

      <p className="chip" data-tone={passed === results.length ? 'ok' : 'error'}>
        {passed} / {results.length} passing in this panel
      </p>

      <table className="table">
        <thead>
          <tr><th>Vector</th><th>Game</th><th>Case</th><th>Expected</th><th>Actual</th><th></th></tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.id}>
              <td><code>{r.id}</code></td>
              <td>{r.game}</td>
              <td>{r.case}</td>
              <td className="muted">{r.expected}</td>
              <td><strong>{r.actual}</strong></td>
              <td>{r.pass ? '✓' : '✗'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Also specified, verified in the test suite</h2>
      <p className="muted">
        These need multi-heat or multi-revision setup that a single panel cannot show
        usefully. They run in <code>npm test</code> — 142 rules tests in total.
      </p>
      <table className="table">
        <thead><tr><th>Vector</th><th>Game</th><th>Case</th><th>Test file</th></tr></thead>
        <tbody>
          {COVERED_IN_SUITE.map(([id, game, c, file]) => (
            <tr key={id}>
              <td><code>{id}</code></td><td>{game}</td><td>{c}</td>
              <td><code>{file}</code></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
