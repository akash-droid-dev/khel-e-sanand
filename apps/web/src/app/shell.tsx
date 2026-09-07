/**
 * Application shell.
 *
 * Implements the universal interface rules in §1:
 *   - the header always shows event, role, scope, connection state and last refresh;
 *   - navigation is the workspace's own, driven by the resolved role;
 *   - status is carried by text as well as colour, and every control has a label.
 */
import { NavLink, Outlet } from 'react-router-dom';
import { useSession } from './session.js';
import { LOCALE_LABEL, LOCALES, formatTime, type Locale } from '../i18n/index.js';

/** Navigation per workspace, from §1's table. */
const NAV: Record<'ED' | 'CH' | 'VOL', { to: string; key: string }[]> = {
  ED: [
    { to: '/', key: 'nav.overview' },
    { to: '/schools', key: 'nav.schools' },
    { to: '/people', key: 'nav.people' },
    { to: '/deployment', key: 'nav.deployment' },
    { to: '/athletes', key: 'nav.athletes' },
    { to: '/rules', key: 'nav.rules' },
    { to: '/schedule', key: 'nav.schedule' },
    { to: '/attendance', key: 'nav.attendance' },
    { to: '/kits', key: 'nav.kits' },
    { to: '/review', key: 'nav.review' },
    { to: '/reports', key: 'nav.reports' },
    { to: '/admin', key: 'nav.admin' },
  ],
  CH: [
    { to: '/', key: 'nav.overview' },
    { to: '/schools', key: 'nav.schools' },
    { to: '/deployment', key: 'nav.deployment' },
    { to: '/athletes', key: 'nav.athletes' },
    { to: '/schedule', key: 'nav.schedule' },
    { to: '/attendance', key: 'nav.attendance' },
    { to: '/kits', key: 'nav.kits' },
    { to: '/review', key: 'nav.review' },
    { to: '/reports', key: 'nav.reports' },
  ],
  VOL: [
    { to: '/', key: 'nav.today' },
    { to: '/schedule', key: 'nav.myMatches' },
    { to: '/schools', key: 'nav.mySchools' },
    { to: '/attendance', key: 'nav.attendance' },
    { to: '/kits', key: 'nav.myKit' },
    { to: '/notifications', key: 'nav.notifications' },
    { to: '/profile', key: 'nav.profile' },
  ],
};

export function Shell() {
  const { t, access, online, lastRefresh, refresh, locale, setLocale } = useSession();
  const role = access?.role ?? 'VOL';
  const items = NAV[role];

  return (
    <div className="shell">
      <header className="shell__header">
        <div className="shell__identity">
          <span className="shell__title">{t('app.title')}</span>
          <span className="shell__role" data-role={role}>{t(`role.${role}`)}</span>
        </div>

        <div className="shell__status">
          {/* §1: status uses text plus colour, never colour alone. */}
          <span
            className="chip"
            data-tone={online ? 'ok' : 'warn'}
            role="status"
            aria-live="polite"
          >
            {online ? '●' : '○'} {online ? t('app.connection.online') : t('app.connection.offline')}
          </span>

          {access && (
            <span className="chip" data-tone="neutral" title={access.derivation.join('\n')}>
              {t('app.scope')}: {access.school_count} · {access.cluster_count} · {access.fixture_duty_count}
            </span>
          )}

          {lastRefresh && (
            <span className="chip chip--quiet">
              {t('app.lastRefresh')} {formatTime(lastRefresh, locale)}
            </span>
          )}

          <button type="button" className="button button--quiet" onClick={refresh}>
            {t('app.refresh')}
          </button>

          <label className="shell__lang">
            <span className="visually-hidden">{t('app.language')}</span>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
              aria-label={t('app.language')}
            >
              {LOCALES.map((l) => (
                <option key={l} value={l}>{LOCALE_LABEL[l]}</option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <nav className="shell__nav" aria-label={t('app.title')}>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `shell__navlink${isActive ? ' is-active' : ''}`}
          >
            {t(item.key)}
          </NavLink>
        ))}
      </nav>

      <main className="shell__main">
        <Outlet />
      </main>
    </div>
  );
}
