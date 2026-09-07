/**
 * Shared score-entry frame.
 *
 * §15: "All score-entry screens share fixture identity, pinned rules, participant
 * list, official attestation, observation history, Save Draft, Review, Submit and
 * sync status."
 *
 * §10 adds two rules this frame enforces for every discipline:
 *   - "Autosave displays locally saved and server saved separately."
 *   - "submitting a scorecard has a separate confirmation showing fixture,
 *      participants and final values."
 */
import { useState, type ReactNode } from 'react';
import type { CalculationOutput } from '@khel/rules';
import { useTranslate, useLocale } from '../app/locale.js';
import { formatTime } from '../i18n/index.js';
import type { DraftSyncState } from '../lib/offline.js';

export interface FrameProps {
  fixtureCode: string;
  disciplineLabel: string;
  categoryLabel: string;
  venueLabel: string;
  ruleVersionLabel: string;
  /** Live calculation from the same @khel/rules calculator the server will run. */
  result: CalculationOutput | null;
  syncState: DraftSyncState;
  savedLocallyAt: string | null;
  savedOnServerAt: string | null;
  onSaveDraft: () => void;
  onSubmit: (attestation: string) => void;
  submitting: boolean;
  children: ReactNode;
}

export function ScoreEntryFrame(props: FrameProps) {
  const t = useTranslate();
  const locale = useLocale();
  const [reviewing, setReviewing] = useState(false);
  const [attestation, setAttestation] = useState('');

  const blocked = (props.result?.issues.length ?? 0) > 0;
  const undecided = (props.result?.unresolved.length ?? 0) > 0;
  const canSubmit = !!props.result && !blocked && !undecided && !props.submitting;

  return (
    <section className="score">
      {/* --- Header: fixture identity and the rules actually in force --- */}
      <header className="score__header">
        <div>
          <h1 className="score__title">{props.disciplineLabel}</h1>
          <p className="score__meta">
            {props.fixtureCode} · {props.categoryLabel} · {props.venueLabel}
          </p>
        </div>
        <div className="score__pinned">
          <span className="chip" data-tone="neutral">
            {t('score.rulesPinned')}: {props.ruleVersionLabel}
          </span>
          <SyncBadge
            state={props.syncState}
            savedLocallyAt={props.savedLocallyAt}
            savedOnServerAt={props.savedOnServerAt}
          />
        </div>
      </header>

      {/* --- Discipline-specific body --- */}
      <div className="score__body">{props.children}</div>

      {/* --- Blockers, stated before the buttons rather than on failure --- */}
      {blocked && (
        <div className="notice notice--error" role="alert">
          <strong>{t('score.issues')}</strong>
          <ul>
            {props.result!.issues.map((i, n) => (
              <li key={`${i.code}-${n}`}>{i.message}</li>
            ))}
          </ul>
        </div>
      )}

      {undecided && (
        <div className="notice notice--warn" role="alert">
          <strong>{t('score.unresolved')}</strong>
          <ul>
            {props.result!.unresolved.map((u, n) => (
              <li key={`${u.code}-${n}`}>
                {u.message} <em>{u.required_input}</em>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* --- Footer: Save Draft, Review, Submit (§10) --- */}
      <footer className="score__footer">
        <button type="button" className="button" onClick={props.onSaveDraft}>
          {t('score.saveDraft')}
        </button>
        <button
          type="button"
          className="button"
          onClick={() => setReviewing(true)}
          disabled={!props.result}
        >
          {t('score.review')}
        </button>
        <button
          type="button"
          className="button button--primary"
          onClick={() => setReviewing(true)}
          disabled={!canSubmit}
        >
          {t('score.submit')}
        </button>
      </footer>

      {reviewing && props.result && (
        <ReviewDialog
          result={props.result}
          fixtureCode={props.fixtureCode}
          canSubmit={canSubmit}
          attestation={attestation}
          onAttestationChange={setAttestation}
          onClose={() => setReviewing(false)}
          onConfirm={() => { props.onSubmit(attestation); setReviewing(false); }}
        />
      )}
    </section>
  );
}

/**
 * §10: local and server saves are shown SEPARATELY. "Saved" on a phone with no
 * signal must not imply the server has the result.
 */
function SyncBadge(
  { state, savedLocallyAt, savedOnServerAt }:
  { state: DraftSyncState; savedLocallyAt: string | null; savedOnServerAt: string | null },
) {
  const t = useTranslate();
  const locale = useLocale();
  if (state === 'Quarantined') {
    return (
      <span className="chip" data-tone="error">
        ⚠ {t('score.returned')} — this device's draft is held for review
      </span>
    );
  }
  return (
    <span className="score__sync">
      <span className="chip" data-tone={savedLocallyAt ? 'ok' : 'warn'}>
        {t('app.savedLocally')}: {savedLocallyAt ? formatTime(savedLocallyAt, locale) : t('app.notSaved')}
      </span>
      <span className="chip" data-tone={savedOnServerAt ? 'ok' : 'warn'}>
        {t('app.savedOnServer')}: {savedOnServerAt ? formatTime(savedOnServerAt, locale) : t('app.notSaved')}
      </span>
    </span>
  );
}

/**
 * §10: "Review Summary shows all entered values, calculated winner/rank, exceptions
 * and confirmation." §1: submission has its own confirmation showing fixture,
 * participants and final values.
 */
function ReviewDialog(props: {
  result: CalculationOutput;
  fixtureCode: string;
  canSubmit: boolean;
  attestation: string;
  onAttestationChange: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslate();
  return (
    <div className="dialog" role="dialog" aria-modal="true" aria-label={t('score.confirmTitle')}>
      <div className="dialog__panel">
        <h2>{t('score.confirmTitle')}</h2>
        <p className="dialog__lead">{t('score.confirmBody')}</p>
        <p className="dialog__fixture">{props.fixtureCode}</p>

        <table className="table">
          <thead>
            <tr>
              <th>Participant</th>
              <th>Status</th>
              <th>Result</th>
              <th>Rank</th>
            </tr>
          </thead>
          <tbody>
            {props.result.participants.map((p) => (
              <tr key={p.participant_id}>
                <td>{p.participant_id}</td>
                <td>{t(`status.${p.status}`)}</td>
                <td>{p.primary_display}</td>
                {/* A non-Completed status shows "not ranked" — never a blank that
                    could read as zero (§15). */}
                <td>{p.rank ?? t('score.noRank')}{p.shared_rank ? ' (shared)' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <details className="dialog__trace">
          <summary>How this result was calculated</summary>
          <ol>
            {props.result.explanation.map((line, n) => <li key={n}>{line}</li>)}
          </ol>
        </details>

        <label className="field">
          <span>Attestation</span>
          <input
            type="text"
            value={props.attestation}
            onChange={(e) => props.onAttestationChange(e.target.value)}
            placeholder="Confirm these values match the official record"
          />
        </label>

        <div className="dialog__actions">
          <button type="button" className="button" onClick={props.onClose}>Close</button>
          <button
            type="button"
            className="button button--primary"
            disabled={!props.canSubmit || !props.attestation.trim()}
            onClick={props.onConfirm}
          >
            {t('score.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
