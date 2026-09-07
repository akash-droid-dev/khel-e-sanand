/**
 * Entry point and routing.
 *
 * The demo signs in by picking a seeded user, because §3's login is a
 * provider-enforced flow (OTP, expiry, retry limits) that a local build must not
 * fake. Substituting a real identity provider replaces `SignInPicker` and the
 * `x-user-id` header in `lib/api.ts`; nothing else changes, because scope is resolved
 * server-side from live assignments on every request.
 */
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider, useSession } from './app/session.js';
import { ErrorBoundary } from './app/error-boundary.js';
import { Shell } from './app/shell.js';
import { EventDirectorOverview, ClusterHeadOverview, VolunteerToday } from './screens/overview.js';
import { Loading, Empty } from './screens/states.js';
import { clearAllLocalData } from './lib/offline.js';
import { DemoApp } from './demo/DemoApp.js';
import './styles.css';

/**
 * Static demo build (GitHub Pages). Set at build time by
 * `VITE_DEMO_MODE=1 vite build`. There is no server in that build, so the API-backed
 * app is not rendered at all rather than being rendered and failing.
 */
const DEMO_MODE = import.meta.env['VITE_DEMO_MODE'] === '1';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Event-day data changes constantly; a stale list is worse than a refetch.
      staleTime: 15_000,
      retry: (count, error) =>
        // Never retry an authorisation or workflow failure — the answer will not change.
        count < 2 && !(error as { isTerminal?: boolean }).isTerminal,
    },
  },
});

/** Landing, chosen by resolved role rather than by route (§1's three workspaces). */
function Home() {
  const { access } = useSession();
  if (!access) return <Loading />;

  if (access.role === 'ED') {
    return <EventDirectorOverview cards={[
      { key: 'readiness.unassignedSchools', count: 0, href: '/schools' },
      { key: 'readiness.unstaffedFixtures', count: 0, href: '/schedule' },
      { key: 'readiness.unapprovedRules', count: 13, href: '/rules' },
      { key: 'readiness.pendingEligibility', count: 92, href: '/athletes' },
      { key: 'readiness.missingConsent', count: 64, href: '/athletes' },
    ]} />;
  }

  if (access.role === 'CH') {
    return <ClusterHeadOverview cards={[
      { key: 'nav.schools', count: access.school_count, href: '/schools' },
      { key: 'nav.review', count: 0, href: '/review' },
      { key: 'nav.kits', count: 0, href: '/kits' },
    ]} />;
  }

  return <VolunteerToday
    checkedIn={false}
    onCheckIn={() => { /* wired to POST /attendance/check-in */ }}
    nextFixture={null}
    returnedDrafts={0}
    quarantinedDrafts={0}
  />;
}

/** A placeholder that is honest about what is not built rather than showing a blank. */
function Placeholder({ titleKey }: { titleKey: string }) {
  const { t } = useSession();
  return (
    <>
      <h1>{t(titleKey)}</h1>
      <Empty hint="This screen is defined in the interface catalogue (docs/SCREENS.md) and is not built in this increment." />
    </>
  );
}

function SignInPicker({ onPick }: { onPick: (userId: string, eventId: string) => void }) {
  const [users, setUsers] = useState<
    { user_id: string; user_code: string; display_name: string; role: string; event_id: string }[]
  >([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/demo/users')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setUsers)
      .catch(() => setError('Could not reach the API. Is it running on port 4000?'));
  }, []);

  return (
    <main className="signin">
      <h1>Khelo Sanand BalOlympiad</h1>
      <p className="muted">
        Demonstration sign-in. A deployment replaces this with the organiser's identity
        provider; this build never handles a password or an OTP.
      </p>
      {error && <p className="state state--error">{error}</p>}
      <ul className="signin__list">
        {users.map((u) => (
          <li key={u.user_id}>
            <button type="button" className="button button--large"
                    onClick={() => onPick(u.user_id, u.event_id)}>
              {u.display_name} <span className="chip" data-tone="neutral">{u.role}</span>
            </button>
          </li>
        ))}
      </ul>
      {!users.length && !error && <Loading />}
    </main>
  );
}

function App() {
  const [identity, setIdentity] = useState<{ userId: string; eventId: string } | null>(() => {
    const raw = sessionStorage.getItem('khel.identity');
    return raw ? JSON.parse(raw) : null;
  });

  useEffect(() => {
    if (identity) sessionStorage.setItem('khel.identity', JSON.stringify(identity));
  }, [identity]);

  if (!identity) {
    return <SignInPicker onPick={(userId, eventId) => setIdentity({ userId, eventId })} />;
  }

  return (
    <SessionProvider eventId={identity.eventId} userId={identity.userId}>
      <BrowserRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<Home />} />
            <Route path="schools" element={<Placeholder titleKey="nav.schools" />} />
            <Route path="people" element={<Placeholder titleKey="nav.people" />} />
            <Route path="deployment" element={<Placeholder titleKey="nav.deployment" />} />
            <Route path="athletes" element={<Placeholder titleKey="nav.athletes" />} />
            <Route path="rules" element={<Placeholder titleKey="nav.rules" />} />
            <Route path="schedule" element={<Placeholder titleKey="nav.schedule" />} />
            <Route path="attendance" element={<Placeholder titleKey="nav.attendance" />} />
            <Route path="kits" element={<Placeholder titleKey="nav.kits" />} />
            <Route path="review" element={<Placeholder titleKey="nav.review" />} />
            <Route path="reports" element={<Placeholder titleKey="nav.reports" />} />
            <Route path="admin" element={<Placeholder titleKey="nav.admin" />} />
            <Route path="notifications" element={<Placeholder titleKey="nav.notifications" />} />
            <Route path="profile" element={<Placeholder titleKey="nav.profile" />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  );
}

// §10: "expire/clear caches on logout according to policy."
window.addEventListener('khel:signout', () => { void clearAllLocalData(); });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {DEMO_MODE ? (
        <DemoApp />
      ) : (
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      )}
    </ErrorBoundary>
  </StrictMode>,
);
