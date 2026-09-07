/**
 * Discipline score-entry bodies.
 *
 * Eight forms cover the thirteen confirmed disciplines, one per calculation family.
 * Each calls the SAME calculator from `@khel/rules` that the server will run, so the
 * volunteer sees the real result as they enter it — §6: "Render the same form and
 * calculator used by VOL."
 *
 * Two rules recur in every form and are the reason they are hand-built rather than
 * generated from a schema:
 *   - a judge's VALIDITY DECISION is captured before any measurement (§19, §23);
 *   - a control the rule profile does not permit is shown DISABLED with the reason,
 *     not hidden (§16: "Show unavailable bonus/variant buttons with a rule
 *     explanation"), so an official can see the profile is doing something.
 */
import { useMemo, useState } from 'react';
import {
  calculateAttempts, calculateSprintHeat, calculateMatch, calculateKabaddi,
  calculateKhoKho, calculateChess, calculateTugOfWar, calculateCycling,
  type AttemptObservation, type AttemptsRuleProfile,
  type SprintObservation, type SprintRuleProfile,
  type MatchRuleProfile, type UnitObservation,
  type KabaddiRuleProfile, type KabaddiRaid,
  type KhoRuleProfile, type KhoInput,
  type ChessRuleProfile, type ChessPairing, type ChessBoardResult,
  type TugRuleProfile, type TugPull,
  type CyclingRuleProfile,
  type ParticipantRef, type CalculationOutput,
} from '@khel/rules';
import { useTranslate, useLocale } from '../app/locale.js';

export interface FormProps<TProfile> {
  profile: TProfile;
  participants: ParticipantRef[];
  onResult: (result: CalculationOutput, payload: Record<string, unknown>) => void;
}

const obsId = () => crypto.randomUUID();

/* ================================================================== *
 * Attempts — SBT, KJT, SBJ (§19, §20, §23)
 * ================================================================== */

export function AttemptsForm({ profile, participants, onResult }: FormProps<AttemptsRuleProfile>) {
  const t = useTranslate();
  const [attempts, setAttempts] = useState<AttemptObservation[]>(() =>
    participants.flatMap((p) =>
      Array.from({ length: profile.attempts }, (_, i) => ({
        observation_id: obsId(),
        participant_id: p.participant_id,
        attempt_no: i + 1,
        // Every attempt starts unrecorded. GT-027: "not taken" is a real state and
        // must never be confused with a foul or a zero mark.
        outcome: 'not_taken' as const,
        raw_value: null,
        raw_unit: profile.measurement_unit ?? 'm',
      })),
    ));

  const result = useMemo(() => {
    const out = calculateAttempts({ profile, participants, observations: attempts });
    return out;
  }, [profile, participants, attempts]);

  useMemo(() => onResult(result, { attempts }), [result]);

  const update = (id: string, patch: Partial<AttemptObservation>) =>
    setAttempts((rows) => rows.map((r) => (r.observation_id === id ? { ...r, ...patch } : r)));

  const targetMode = profile.scoring_mode === 'TargetPoints';

  return (
    <table className="table table--grid">
      <caption className="visually-hidden">
        {profile.discipline} — {profile.attempts} attempts per athlete
      </caption>
      <thead>
        <tr>
          <th scope="col">Athlete</th>
          {Array.from({ length: profile.attempts }, (_, i) => (
            <th scope="col" key={i}>{t('score.attempt')} {i + 1}</th>
          ))}
          <th scope="col">{t('score.best')}</th>
        </tr>
      </thead>
      <tbody>
        {participants.map((p) => {
          const row = result.participants.find((r) => r.participant_id === p.participant_id);
          return (
            <tr key={p.participant_id}>
              <th scope="row">
                {/* A name renders in its own script; never translated (§1). */}
                {p.display_name}
                {p.school_display && <small> · {p.school_display}</small>}
              </th>

              {attempts
                .filter((a) => a.participant_id === p.participant_id)
                .sort((a, b) => a.attempt_no - b.attempt_no)
                .map((a) => (
                  <td key={a.observation_id}>
                    {/* The judge's validity decision comes first (§19). */}
                    <div className="segmented" role="group" aria-label={`${t('score.attempt')} ${a.attempt_no}`}>
                      {(['valid', 'foul', 'pass'] as const).map((o) => (
                        <button
                          key={o}
                          type="button"
                          className={`segmented__btn${a.outcome === o ? ' is-on' : ''}`}
                          onClick={() => update(a.observation_id, {
                            outcome: o,
                            // A distance only ever belongs to a valid attempt.
                            raw_value: o === 'valid' ? a.raw_value : null,
                            zone_id: o === 'valid' ? a.zone_id : null,
                          })}
                        >
                          {t(`score.${o}`)}
                        </button>
                      ))}
                    </div>

                    {a.outcome === 'valid' && !targetMode && (
                      <input
                        className="input input--numeric"
                        // A numeric keypad on a phone (§1).
                        inputMode="decimal"
                        aria-label={`Distance for attempt ${a.attempt_no}`}
                        value={a.raw_value ?? ''}
                        onChange={(e) => update(a.observation_id, { raw_value: e.target.value })}
                        placeholder={profile.measurement_unit ?? 'm'}
                      />
                    )}

                    {a.outcome === 'valid' && targetMode && (
                      <div className="segmented" role="group" aria-label="Landing zone">
                        {Object.keys(profile.zone_mapping ?? {}).map((zone) => (
                          <button
                            key={zone}
                            type="button"
                            className={`segmented__btn${a.zone_id === zone ? ' is-on' : ''}`}
                            onClick={() => update(a.observation_id, { zone_id: zone })}
                          >
                            {zone} ({profile.zone_mapping?.[zone]})
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                ))}

              <td className="cell--result">
                <strong>{row?.primary_display ?? '—'}</strong>
                {row?.status && row.status !== 'Completed' && (
                  <span className="chip" data-tone="warn">{t(`status.${row.status}`)}</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ================================================================== *
 * Sprint heat — SP30, SP50, SP60 (§17)
 * ================================================================== */

export function SprintForm({ profile, participants, onResult }: FormProps<SprintRuleProfile>) {
  const t = useTranslate();
  const [rows, setRows] = useState<SprintObservation[]>(() =>
    participants.map((p, i) => ({
      observation_id: obsId(),
      participant_id: p.participant_id,
      lane: i + 1,
      official_finish_position: null,
      raw_time_value: null,
      raw_time_unit: 's' as const,
      status: 'Completed' as const,
    })));

  const result = useMemo(
    () => calculateSprintHeat({ profile, heat_id: 'H1', participants, observations: rows }),
    [profile, participants, rows]);
  useMemo(() => onResult(result, { rows }), [result]);

  const update = (id: string, patch: Partial<SprintObservation>) =>
    setRows((r) => r.map((x) => (x.observation_id === id ? { ...x, ...patch } : x)));

  return (
    <table className="table table--grid">
      <thead>
        <tr>
          <th scope="col">Lane</th>
          <th scope="col">Athlete</th>
          {/* Place and time are separate columns because they are separate facts (§17). */}
          <th scope="col">Finish position</th>
          <th scope="col">Time (s)</th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.sort((a, b) => a.lane - b.lane).map((row) => {
          const p = participants.find((x) => x.participant_id === row.participant_id);
          return (
            <tr key={row.observation_id}>
              <td>{row.lane}</td>
              <th scope="row">{p?.display_name}<small> · {p?.school_display}</small></th>
              <td>
                <input
                  className="input input--numeric" inputMode="numeric"
                  aria-label={`Finish position, lane ${row.lane}`}
                  value={row.official_finish_position ?? ''}
                  onChange={(e) => update(row.observation_id, {
                    official_finish_position: e.target.value ? Number(e.target.value) : null,
                  })}
                />
              </td>
              <td>
                <input
                  className="input input--numeric" inputMode="decimal"
                  aria-label={`Time, lane ${row.lane}`}
                  value={row.raw_time_value ?? ''}
                  disabled={profile.timing_method === 'ApprovedPlaceOnly'}
                  title={profile.timing_method === 'ApprovedPlaceOnly'
                    ? 'This competition is configured for place-only results.' : undefined}
                  onChange={(e) => update(row.observation_id, { raw_time_value: e.target.value })}
                />
              </td>
              <td>
                <select
                  aria-label={`Status, lane ${row.lane}`}
                  value={row.status}
                  onChange={(e) => update(row.observation_id, {
                    status: e.target.value as SprintObservation['status'],
                  })}
                >
                  {(['Completed', 'DNS', 'DNF', 'DQ'] as const).map((s) => (
                    <option key={s} value={s}>{t(`status.${s}`)}</option>
                  ))}
                </select>
                {row.status !== 'Completed' && (
                  <input
                    className="input" placeholder="Official reason (required)"
                    aria-label="Official reason"
                    value={row.official_decision ?? ''}
                    onChange={(e) => update(row.observation_id, { official_decision: e.target.value })}
                  />
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ================================================================== *
 * Games / Sets — BAD, VOL (§25, §26)
 * ================================================================== */

export function MatchForm({ profile, participants, onResult }: FormProps<MatchRuleProfile>) {
  const maxUnits = 2 * profile.units_to_win - 1;
  const [units, setUnits] = useState<UnitObservation[]>([
    { observation_id: obsId(), unit_no: 1, points_a: 0, points_b: 0, finalised: false },
  ]);

  const pair = participants.slice(0, 2) as [ParticipantRef, ParticipantRef];
  const result = useMemo(
    () => calculateMatch({ profile, participants: pair, units }),
    [profile, pair, units]);
  useMemo(() => onResult(result, { units }), [result]);

  const update = (n: number, patch: Partial<UnitObservation>) =>
    setUnits((u) => u.map((x) => (x.unit_no === n ? { ...x, ...patch } : x)));

  const word = profile.discipline === 'VOL' ? 'Set' : 'Game';

  return (
    <div>
      <table className="table table--grid">
        <thead>
          <tr>
            <th scope="col">{word}</th>
            <th scope="col">{pair[0]?.display_name}</th>
            <th scope="col">{pair[1]?.display_name}</th>
            <th scope="col">Target</th>
            <th scope="col">Complete</th>
          </tr>
        </thead>
        <tbody>
          {units.map((u) => {
            const isDeciding = u.unit_no === maxUnits;
            return (
              <tr key={u.observation_id}>
                <th scope="row">
                  {word} {u.unit_no}
                  {isDeciding && <span className="chip" data-tone="neutral">deciding</span>}
                </th>
                {(['points_a', 'points_b'] as const).map((side) => (
                  <td key={side}>
                    <input
                      className="input input--numeric" inputMode="numeric"
                      aria-label={`${word} ${u.unit_no}, ${side === 'points_a' ? 'A' : 'B'}`}
                      value={u[side]}
                      onChange={(e) => update(u.unit_no, { [side]: Number(e.target.value || 0) } as never)}
                    />
                  </td>
                ))}
                <td>
                  {/* The deciding unit's target differs — shown, not implied (§26). */}
                  {isDeciding ? profile.deciding_target : profile.ordinary_target}
                  {profile.cap !== null && <small> · cap {profile.cap}</small>}
                </td>
                <td>
                  <input
                    type="checkbox" checked={u.finalised}
                    aria-label={`${word} ${u.unit_no} complete`}
                    onChange={(e) => update(u.unit_no, { finalised: e.target.checked })}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <button
        type="button" className="button"
        disabled={units.length >= maxUnits}
        title={units.length >= maxUnits
          ? `A first-to-${profile.units_to_win} match cannot exceed ${maxUnits} ${word.toLowerCase()}s.`
          : undefined}
        onClick={() => setUnits((u) => [...u, {
          observation_id: obsId(), unit_no: u.length + 1,
          points_a: 0, points_b: 0, finalised: false,
        }])}
      >
        Add {word.toLowerCase()}
      </button>
    </div>
  );
}

/* ================================================================== *
 * Kabaddi — KAB (§16)
 * ================================================================== */

export function KabaddiForm(
  { profile, participants, roster, onResult }:
  FormProps<KabaddiRuleProfile> & { roster: Record<'A' | 'B', string[]> },
) {
  const [raids, setRaids] = useState<KabaddiRaid[]>([]);
  const [half, setHalf] = useState(1);
  const pair = participants.slice(0, 2) as [ParticipantRef, ParticipantRef];

  const result = useMemo(
    () => calculateKabaddi({ profile, participants: pair, roster, raids }),
    [profile, pair, roster, raids]);
  useMemo(() => onResult(result, { raids }), [result]);

  const addRaid = (side: 'A' | 'B', patch: Partial<KabaddiRaid>) => {
    const active = result.participants[side === 'A' ? 1 : 0]?.components?.['on_court_at_end'] ?? 0;
    setRaids((r) => [...r, {
      observation_id: obsId(), half, raid_no: r.length + 1,
      raiding_side: side, raider_id: roster[side][0] ?? 'unknown',
      defenders_before: Number(active),
      defenders_out: [], raider_out: false, bonus_awarded: false, all_out_awarded: false,
      ...patch,
    }]);
  };

  return (
    <div className="kabaddi">
      <div className="scoreline">
        {result.participants.map((p, i) => (
          <div key={p.participant_id} className="scoreline__side">
            <span className="scoreline__name">{pair[i]?.display_name}</span>
            <span className="scoreline__total">{p.primary_value}</span>
            <small>
              touch {p.components?.['touch_points'] ?? 0} ·
              bonus {p.components?.['bonus_points'] ?? 0} ·
              all-out {p.components?.['all_out_points'] ?? 0}
            </small>
          </div>
        ))}
      </div>

      <label className="field field--inline">
        <span>Half</span>
        <select value={half} onChange={(e) => setHalf(Number(e.target.value))}>
          {Array.from({ length: profile.halves }, (_, i) => (
            <option key={i} value={i + 1}>{i + 1}</option>
          ))}
        </select>
      </label>

      {(['A', 'B'] as const).map((side) => (
        <fieldset key={side} className="raidpad">
          <legend>{pair[side === 'A' ? 0 : 1]?.display_name} raiding</legend>
          <button type="button" className="button"
            onClick={() => addRaid(side, { defenders_out: [roster[side === 'A' ? 'B' : 'A'][0] ?? 'd1'] })}>
            Defender out
          </button>
          <button type="button" className="button"
            onClick={() => addRaid(side, { raider_out: true })}>
            Raider out
          </button>
          {/* §16: an unavailable variant control is shown disabled WITH its reason. */}
          <button type="button" className="button"
            disabled={!profile.bonus_enabled}
            title={profile.bonus_enabled ? undefined
              : 'This rule version does not enable bonus points.'}
            onClick={() => addRaid(side, { bonus_awarded: true })}>
            Bonus
          </button>
          <button type="button" className="button"
            disabled={!profile.super_tackle_enabled}
            title={profile.super_tackle_enabled ? undefined
              : 'Super tackle is not adopted in this rule version.'}>
            Super tackle
          </button>
          <button type="button" className="button button--strong"
            onClick={() => addRaid(side, { all_out_awarded: true })}>
            Confirm all-out
          </button>
        </fieldset>
      ))}

      <ol className="history">
        {result.explanation.slice(1).map((line, n) => <li key={n}>{line}</li>)}
      </ol>
    </div>
  );
}

/* ================================================================== *
 * Kho Kho, Chess, Tug of War, Cycling — compact operational forms
 * ================================================================== */

export function KhoKhoForm(
  { input, onResult }: { input: KhoInput; onResult: FormProps<KhoRuleProfile>['onResult'] },
) {
  const result = useMemo(() => calculateKhoKho(input), [input]);
  useMemo(() => onResult(result, { turns: input.turns, outs: input.outs }), [result]);
  return (
    <div>
      <div className="scoreline">
        {result.participants.map((p, i) => (
          <div key={p.participant_id} className="scoreline__side">
            <span className="scoreline__name">{input.participants[i]?.display_name}</span>
            <span className="scoreline__total">{p.primary_value}</span>
            <small>{p.components?.['outs_taken'] ?? 0} outs</small>
          </div>
        ))}
      </div>
      <ol className="history">
        {result.explanation.slice(1).map((line, n) => <li key={n}>{line}</li>)}
      </ol>
    </div>
  );
}

export function ChessForm(
  { profile, participants, pairings, results, onResult }:
  FormProps<ChessRuleProfile> & { pairings: ChessPairing[]; results: ChessBoardResult[] },
) {
  const out = useMemo(
    () => calculateChess({ profile, participants, pairings, results }),
    [profile, participants, pairings, results]);
  useMemo(() => onResult(out, { pairings, results }), [out]);

  return (
    <table className="table table--grid">
      <thead>
        <tr><th>Board</th><th>White</th><th>Black</th><th>Result</th></tr>
      </thead>
      <tbody>
        {pairings.map((p) => (
          <tr key={p.observation_id}>
            <th scope="row">{p.board_no}</th>
            <td>{participants.find((x) => x.participant_id === p.white_participant_id)?.display_name}</td>
            <td>
              {p.black_participant_id
                ? participants.find((x) => x.participant_id === p.black_participant_id)?.display_name
                : <em>bye</em>}
            </td>
            <td>{results.find((r) => r.board_no === p.board_no)?.result_code ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TugOfWarForm(
  { profile, participants, pulls, onResult }:
  FormProps<TugRuleProfile> & { pulls: TugPull[] },
) {
  const pair = participants.slice(0, 2) as [ParticipantRef, ParticipantRef];
  const out = useMemo(
    () => calculateTugOfWar({ profile, participants: pair, pulls }),
    [profile, pair, pulls]);
  useMemo(() => onResult(out, { pulls }), [out]);

  return (
    <div>
      <div className="scoreline">
        {out.participants.map((p, i) => (
          <div key={p.participant_id} className="scoreline__side">
            <span className="scoreline__name">{pair[i]?.display_name}</span>
            <span className="scoreline__total">{p.components?.['pull_wins'] ?? 0}</span>
            <small>{p.components?.['no_pulls'] ?? 0} no-pull(s) replayed</small>
          </div>
        ))}
      </div>
      <ol className="history">
        {out.explanation.slice(1).map((line, n) => <li key={n}>{line}</li>)}
      </ol>
    </div>
  );
}

export function CyclingForm(
  { input, onResult }: {
    input: Parameters<typeof calculateCycling>[0];
    onResult: FormProps<CyclingRuleProfile>['onResult'];
  },
) {
  const out = useMemo(() => calculateCycling(input), [input]);
  useMemo(() => onResult(out, { starts: input.starts, passages: input.passages }), [out]);

  return (
    <table className="table table--grid">
      <thead>
        <tr><th>Rider</th><th>Laps</th><th>Result</th><th>Status</th></tr>
      </thead>
      <tbody>
        {out.participants.map((p) => {
          const ref = input.participants.find((x) => x.participant_id === p.participant_id);
          return (
            <tr key={p.participant_id}>
              <th scope="row">{ref?.display_name}</th>
              <td>{p.components?.['completed_laps'] ?? 0}/{input.profile.required_laps}</td>
              <td>{p.primary_display}</td>
              <td>{p.status}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
