/**
 * Static demonstration.
 *
 * Runs on GitHub Pages with no server and no database. That is possible because
 * `@khel/rules` is pure — thirteen calculators with no I/O, no clock and no
 * randomness — so the arithmetic here is byte-for-byte the arithmetic the API runs.
 *
 * What this demo is NOT: it has no permission chain, no idempotency, no audit trail
 * and no persistence. Those are the parts that need a server, and the banner says so
 * rather than letting a viewer assume otherwise.
 */
import { useMemo, useState } from 'react';
import type { CalculationOutput } from '@khel/rules';
import {
  AttemptsForm, SprintForm, MatchForm, KabaddiForm, KhoKhoForm,
  ChessForm, TugOfWarForm, CyclingForm,
} from '../games/forms.js';
import { ScoreEntryFrame } from '../games/frame.js';
import { LOCALE_LABEL, LOCALES, translate, type Locale } from '../i18n/index.js';
import { LocaleProvider, useLocaleControl } from '../app/locale.js';
import { VectorPanel } from './vectors.js';
import * as P from './profiles.js';

type Tab = 'score' | 'vectors';

export function DemoApp() {
  // The locale context is the single source of truth: the header, the score-entry
  // frame and the discipline forms must never disagree about the language.
  return (
    <LocaleProvider>
      <DemoInner />
    </LocaleProvider>
  );
}

function DemoInner() {
  const { locale, setLocale, t } = useLocaleControl();
  const [tab, setTab] = useState<Tab>('score');
  const [selected, setSelected] = useState(P.DEMO_DISCIPLINES[0]!);
  const [result, setResult] = useState<CalculationOutput | null>(null);

  return (
    <div className="shell">
      <header className="shell__header">
        <div className="shell__identity">
          <span className="shell__title">{t('app.title')}</span>
          <span className="shell__role" data-role="DEMO">Live demo</span>
        </div>
        <div className="shell__status">
          <a className="chip" data-tone="neutral"
             href="https://github.com/akash-droid-dev/khel-e-sanand"
             target="_blank" rel="noreferrer">Source</a>
          <label className="shell__lang">
            <span className="visually-hidden">{t('app.language')}</span>
            <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)}
                    aria-label={t('app.language')}>
              {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_LABEL[l]}</option>)}
            </select>
          </label>
        </div>
      </header>

      {/* An honest banner, not a marketing one. */}
      <div className="demo-banner" role="note">
        <strong>Demo mode.</strong> The thirteen discipline calculators are the real
        ones, running in your browser. There is no server here, so there is no
        permission chain, no audit trail and nothing is saved. Rule values below are
        <em> illustrative and unapproved</em> — real ones are an organiser decision.
      </div>

      <nav className="shell__nav" aria-label="Demo sections">
        <button type="button"
                className={`shell__navlink${tab === 'score' ? ' is-active' : ''}`}
                onClick={() => setTab('score')}>Score entry</button>
        <button type="button"
                className={`shell__navlink${tab === 'vectors' ? ' is-active' : ''}`}
                onClick={() => setTab('vectors')}>Specification test vectors</button>
      </nav>

      <main className="shell__main">
        {tab === 'vectors' ? <VectorPanel /> : (
          <>
            <div className="demo-picker" role="tablist" aria-label="Discipline">
              {P.DEMO_DISCIPLINES.map((d) => (
                <button key={d.code} type="button" role="tab"
                        aria-selected={selected.code === d.code}
                        className={`chip chip--pick${selected.code === d.code ? ' is-on' : ''}`}
                        onClick={() => { setSelected(d); setResult(null); }}>
                  {d.label}
                </button>
              ))}
            </div>

            <p className="demo-note">
              <strong>{selected.family} calculator.</strong> {selected.note}
            </p>

            <ScoreEntryFrame
              fixtureCode="DEMO-F001"
              disciplineLabel={selected.label}
              categoryLabel="Illustrative category (Draft)"
              venueLabel="Demo Venue"
              ruleVersionLabel="RV-DEMO-DRAFT-1 · unapproved"
              result={result}
              syncState="LocalOnly"
              savedLocallyAt={null}
              savedOnServerAt={null}
              onSaveDraft={() => { /* no persistence in demo mode */ }}
              onSubmit={() => { /* submission needs the server */ }}
              submitting={false}
            >
              <DisciplineBody code={selected.code} onResult={setResult} />
            </ScoreEntryFrame>

            {result && <ResultPanel result={result} locale={locale} />}
          </>
        )}
      </main>
    </div>
  );
}

/** Route a discipline to its form body and an illustrative profile. */
function DisciplineBody(
  { code, onResult }: { code: string; onResult: (r: CalculationOutput) => void },
) {
  const emit = (r: CalculationOutput) => onResult(r);

  switch (code) {
    case 'SBT':
    case 'SBJ':
      return <AttemptsForm profile={P.attemptsProfile(code as 'SBT' | 'SBJ')}
                           participants={P.individuals(4)} onResult={emit} />;
    case 'KJT':
      return <AttemptsForm profile={P.attemptsProfile('KJT')}
                           participants={P.individuals(4)} onResult={emit} />;
    case 'KJT-TARGET':
      return <AttemptsForm profile={P.javelinTargetProfile()}
                           participants={P.individuals(4)} onResult={emit} />;
    case 'SP30': case 'SP50': case 'SP60':
      return <SprintForm profile={P.sprintProfile(code as 'SP30' | 'SP50' | 'SP60')}
                         participants={P.individuals(6)} onResult={emit} />;
    case 'BAD':
      return <MatchForm profile={P.badmintonProfile()}
                        participants={P.individuals(2, 'P')} onResult={emit} />;
    case 'BAD-3X15':
      return <MatchForm profile={P.badminton3x15Profile()}
                        participants={P.individuals(2, 'P')} onResult={emit} />;
    case 'VOL':
      return <MatchForm profile={P.volleyballProfile()}
                        participants={P.teams()} onResult={emit} />;
    case 'KAB':
      return <KabaddiForm profile={P.kabaddiProfile()} participants={P.teams()}
                          roster={P.kabaddiRoster()} onResult={emit} />;
    case 'KHO':
      return <KhoKhoForm input={demoKho()} onResult={emit} />;
    case 'CHE':
      return <ChessForm profile={P.chessProfile()} participants={P.individuals(4, 'C')}
                        pairings={demoChessPairings()} results={demoChessResults()}
                        onResult={emit} />;
    case 'TOW':
      return <TugOfWarForm profile={P.tugProfile()} participants={P.teams()}
                           pulls={demoPulls()} onResult={emit} />;
    case 'CYC':
      return <CyclingForm input={demoCycling()} onResult={emit} />;
    default:
      return <p className="muted">No demo body for {code}.</p>;
  }
}

/** The calculation output, shown in full — including how it got there. */
function ResultPanel({ result, locale }: { result: CalculationOutput; locale: Locale }) {
  const t = (k: string) => translate(locale, k);
  return (
    <section className="panel">
      <h2>Calculated result</h2>
      <table className="table">
        <thead>
          <tr><th>Participant</th><th>Status</th><th>Result</th><th>Rank</th><th>Why</th></tr>
        </thead>
        <tbody>
          {result.participants.map((p) => (
            <tr key={p.participant_id}>
              <td>{p.participant_id}</td>
              <td>{t(`status.${p.status}`)}</td>
              <td><strong>{p.primary_display}</strong></td>
              {/* A non-Completed status is never blank — blank could read as zero. */}
              <td>{p.rank ?? t('score.noRank')}{p.shared_rank ? ' (shared)' : ''}</td>
              <td className="muted">{p.reason_trace.join(' ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {result.winner_participant_id && (
        <p>Winner: <strong>{result.winner_participant_id}</strong></p>
      )}
    </section>
  );
}

/* --- Small fixed inputs for the disciplines whose forms are read-only here --- */

function demoKho() {
  const t = (inn: number, turn: number, side: 'A' | 'B') => ({
    observation_id: `t${inn}${turn}`, inning_no: inn, turn_no: turn,
    chasing_side: side, closed: true, planned_seconds: 420,
  });
  const batch = (turn: number, seq: number, ids: string[]) => ({
    observation_id: `b${turn}${seq}`, inning_no: 1, turn_no: turn,
    batch_sequence: seq, defender_ids: ids,
  });
  const out = (turn: number, seq: number, id: string) => ({
    observation_id: `o${turn}${seq}${id}`, inning_no: 1, turn_no: turn,
    batch_sequence: seq, defender_id: id, out_reason: 'Touched by chaser',
    points_awarded: 1, official_confirmed: true,
  });
  return {
    profile: P.khoProfile(), participants: P.teams(),
    turns: [t(1, 1, 'A'), t(1, 2, 'B')],
    batches: [batch(1, 1, ['B1', 'B2', 'B3']), batch(1, 2, ['B4', 'B5', 'B6']),
              batch(2, 1, ['A1', 'A2', 'A3'])],
    outs: [out(1, 1, 'B1'), out(1, 1, 'B2'), out(1, 2, 'B4'), out(2, 1, 'A1')],
  };
}

function demoChessPairings() {
  return [
    { observation_id: 'p1', round_no: 1, board_no: 1,
      white_participant_id: 'C1', black_participant_id: 'C2' },
    { observation_id: 'p2', round_no: 1, board_no: 2,
      white_participant_id: 'C3', black_participant_id: 'C4' },
  ];
}

function demoChessResults() {
  return [
    { observation_id: 'r1', round_no: 1, board_no: 1,
      result_code: 'WhiteWin' as const, played: true, arbiter_membership_id: 'arb' },
    { observation_id: 'r2', round_no: 1, board_no: 2,
      result_code: 'Draw' as const, played: true, arbiter_membership_id: 'arb' },
  ];
}

function demoPulls() {
  return [
    { observation_id: 'u1', pull_no: 1, replay_sequence: 1,
      side_a_end: 'North' as const, outcome: 'TeamAWin' as const, roster_confirmed: true },
    { observation_id: 'u2', pull_no: 2, replay_sequence: 1,
      side_a_end: 'South' as const, outcome: 'NoPull' as const,
      official_reason: 'Rope slipped from the marker', roster_confirmed: true },
    { observation_id: 'u3', pull_no: 2, replay_sequence: 2,
      side_a_end: 'South' as const, outcome: 'TeamAWin' as const, roster_confirmed: true },
  ];
}

function demoCycling() {
  const riders = P.individuals(3, 'R');
  const CLOCK = 'demo-chip-timer';
  return {
    profile: P.cyclingProfile(),
    participants: riders,
    starts: riders.map((r) => ({
      participant_id: r.participant_id, bib: r.participant_id,
      scheduled_start_value: '0', official_start_value: '0',
      time_unit: 's' as const, equipment_cleared: true,
    })),
    passages: riders.flatMap((r, i) =>
      [1, 2, 3].map((lap) => ({
        observation_id: `${r.participant_id}-${lap}`,
        participant_id: r.participant_id, lap_number: lap,
        crossing_time_value: String(40 * lap + i), crossing_time_unit: 's' as const,
        source_event_id: `evt-${r.participant_id}-${lap}`, timing_reference_id: CLOCK,
      }))),
    finishes: riders.map((r, i) => ({
      participant_id: r.participant_id,
      finish_time_value: String(120 + i), time_unit: 's' as const,
      status: 'Completed' as const,
      ...(i === 1 ? { penalty_value: '5.00', penalty_unit: 's' as const } : {}),
    })),
  };
}
