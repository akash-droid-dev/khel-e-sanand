/**
 * Shared list states.
 *
 * §1: "Every list has search, filters, pagination, clear empty/error/loading states
 * and a filter reset." Building them once means no screen quietly ships without them.
 */
import type { ReactNode } from 'react';
import { useTranslate } from '../app/locale.js';
import { ApiError } from '../lib/api.js';

export function Loading() {
  const t = useTranslate();
  return <p className="state state--loading" role="status">{t('app.loading')}</p>;
}

export function Empty({ hint }: { hint?: string }) {
  const t = useTranslate();
  return (
    <div className="state state--empty">
      <p>{t('app.empty')}</p>
      {hint && <p className="muted">{hint}</p>}
    </div>
  );
}

/**
 * §1: "Errors identify the field or row and a remedy."
 * A DomainError already carries both, so they are shown rather than replaced by a
 * generic apology.
 */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const t = useTranslate();
  const api = error instanceof ApiError ? error : null;

  return (
    <div className="state state--error" role="alert">
      <p><strong>{api?.body.message ?? t('app.error')}</strong></p>

      {api?.body.details?.length ? (
        <ul className="state__details">
          {api.body.details.map((d, n) => (
            <li key={n}>
              {d.field && <code>{d.field}</code>}
              {d.row !== undefined && <code>row {d.row}</code>}
              {' '}{d.message}
            </li>
          ))}
        </ul>
      ) : null}

      {api?.body.next_action && <p className="state__remedy">{api.body.next_action}</p>}

      {onRetry && !api?.isTerminal && (
        <button type="button" className="button" onClick={onRetry}>{t('app.retry')}</button>
      )}

      {api?.body.request_id && (
        <p className="muted state__ref">Reference: {api.body.request_id}</p>
      )}
    </div>
  );
}

export function ListToolbar(
  { children, onReset }: { children: ReactNode; onReset: () => void },
) {
  const t = useTranslate();
  return (
    <div className="toolbar">
      {children}
      <button type="button" className="button button--quiet" onClick={onReset}>
        {t('app.resetFilters')}
      </button>
    </div>
  );
}
