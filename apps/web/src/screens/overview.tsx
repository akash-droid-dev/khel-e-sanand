/**
 * Landing screens for the three workspaces (§1, §12).
 *
 * §12: "Use status tables for operational exceptions; charts answer trends or
 * comparisons." Readiness is a list of blockers with counts and a way in — not a
 * dial. Every percentage shows its counts, and a zero denominator reads N/A.
 */
import { useSession } from '../app/session.js';

export interface ReadinessCard {
  key: string;
  count: number;
  /** The denominator, where the metric is a ratio. null when it is a plain count. */
  of?: number | null;
  href: string;
}

function Metric({ card }: { card: ReadinessCard }) {
  const { t } = useSession();
  // §12: "All percentages show their counts and use N/A for a zero denominator."
  const ratio = card.of == null ? null
    : card.of === 0 ? null
    : Math.round((card.count / card.of) * 1000) / 10;

  return (
    <a className="card" href={card.href} data-tone={card.count > 0 ? 'warn' : 'ok'}>
      <span className="card__label">{t(card.key)}</span>
      <span className="card__value">
        {card.of == null ? card.count : `${card.count} / ${card.of}`}
      </span>
      <span className="card__note">
        {card.of == null
          ? (card.count > 0 ? t('readiness.blockers') : t('readiness.clear'))
          : ratio === null ? t('attendance.notApplicable') : `${ratio}%`}
      </span>
    </a>
  );
}

export function EventDirectorOverview({ cards }: { cards: ReadinessCard[] }) {
  const { t } = useSession();
  return (
    <>
      <h1>{t('readiness.title')}</h1>
      <div className="cards">
        {cards.map((c) => <Metric key={c.key} card={c} />)}
      </div>
    </>
  );
}

export function ClusterHeadOverview({ cards }: { cards: ReadinessCard[] }) {
  const { t } = useSession();
  return (
    <>
      <h1>{t('nav.overview')}</h1>
      <div className="cards">
        {cards.map((c) => <Metric key={c.key} card={c} />)}
      </div>
    </>
  );
}

/**
 * Volunteer "Today" (§12): duty check-in, next match, returned draft, notifications.
 * Ordered by reporting time, because that is the order the day actually happens in.
 */
export function VolunteerToday(props: {
  checkedIn: boolean;
  onCheckIn: () => void;
  nextFixture: { code: string; discipline: string; reportingAt: string; venue: string } | null;
  returnedDrafts: number;
  quarantinedDrafts: number;
}) {
  const { t } = useSession();
  return (
    <>
      <h1>{t('nav.today')}</h1>

      <section className="panel">
        <h2>{t('nav.attendance')}</h2>
        {props.checkedIn ? (
          <p className="chip" data-tone="ok">✓ {t('attendance.checkedIn')}</p>
        ) : (
          <button type="button" className="button button--primary button--large"
                  onClick={props.onCheckIn}>
            {t('attendance.checkIn')}
          </button>
        )}
      </section>

      <section className="panel">
        <h2>{t('nav.myMatches')}</h2>
        {props.nextFixture ? (
          <p>
            <strong>{props.nextFixture.discipline}</strong> · {props.nextFixture.code}<br />
            {props.nextFixture.venue} · report {props.nextFixture.reportingAt}
          </p>
        ) : <p className="muted">{t('app.empty')}</p>}
      </section>

      {props.returnedDrafts > 0 && (
        <section className="panel panel--warn">
          <h2>{t('score.returned')}</h2>
          <p>{props.returnedDrafts}</p>
        </section>
      )}

      {/* §10: a quarantined draft is surfaced, never silently retried or discarded. */}
      {props.quarantinedDrafts > 0 && (
        <section className="panel panel--error">
          <h2>Drafts held for review</h2>
          <p>
            {props.quarantinedDrafts} draft(s) on this device could not be sent because the
            result had already moved on. They are kept for a person to compare — nothing
            was overwritten on the server.
          </p>
        </section>
      )}
    </>
  );
}
