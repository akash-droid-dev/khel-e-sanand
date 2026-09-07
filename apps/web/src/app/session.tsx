/**
 * Session context.
 *
 * Holds the resolved actor, the selected event and the UI locale. §1 requires every
 * page to show "the selected event, user's role, accessible scope, connection state
 * and last refresh time", so those live here rather than being re-fetched per screen.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { watchConnection } from '../lib/offline.js';
import { get } from '../lib/api.js';
import type { Locale } from '../i18n/index.js';
import { LocaleProvider, useLocaleControl } from './locale.js';

export interface EffectiveAccess {
  user_id: string;
  role: 'ED' | 'CH' | 'VOL';
  membership_status: string;
  school_count: number;
  cluster_count: number;
  fixture_duty_count: number;
  grants: { action: string; scope: string; expires_at: string; reason: string }[];
  derivation: string[];
}

interface SessionValue {
  eventId: string;
  userId: string;
  locale: Locale;
  setLocale: (l: Locale) => void;
  access: EffectiveAccess | null;
  online: boolean;
  lastRefresh: Date | null;
  refresh: () => void;
  t: (key: string) => string;
  ctx: { eventId: string; userId: string; locale: string };
}

const SessionContext = createContext<SessionValue | null>(null);

/** Wraps the inner provider so session consumers can also read the locale context. */
export function SessionProvider(
  props: { eventId: string; userId: string; children: ReactNode },
) {
  return (
    <LocaleProvider>
      <SessionInner {...props} />
    </LocaleProvider>
  );
}

function SessionInner(
  { eventId, userId, children }: { eventId: string; userId: string; children: ReactNode },
) {
  const { locale, setLocale, t: translateFor } = useLocaleControl();
  const [access, setAccess] = useState<EffectiveAccess | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => watchConnection(setOnline), []);

  useEffect(() => {
    let cancelled = false;
    const ctx = { eventId, userId, locale };
    get<EffectiveAccess>('/access/preview', ctx)
      .then((a) => { if (!cancelled) { setAccess(a); setLastRefresh(new Date()); } })
      .catch(() => { if (!cancelled) setAccess(null); });
    return () => { cancelled = true; };
  }, [eventId, userId, locale, tick]);

  const value = useMemo<SessionValue>(() => ({
    eventId, userId, locale, setLocale, access, online, lastRefresh,
    refresh: () => setTick((n) => n + 1),
    t: translateFor,
    ctx: { eventId, userId, locale },
  }), [eventId, userId, locale, setLocale, access, online, lastRefresh, translateFor]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside a SessionProvider');
  return value;
}


// Locale accessors live in ./locale.js — re-exported so existing imports keep working.
export { useLocale, useTranslate } from './locale.js';
