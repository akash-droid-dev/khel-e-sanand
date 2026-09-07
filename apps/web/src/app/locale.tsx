/**
 * Locale context.
 *
 * One source of truth for the UI language, because the alternative — each hook
 * reading `localStorage` with its own fallback — produced a page rendered half in
 * English and half in Gujarati the first time it ran on an origin with no stored
 * value. Two components disagreeing about the language is not a cosmetic bug in a
 * trilingual product.
 *
 * Both the API-backed app (via SessionProvider) and the static demo provide this.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState,
         type ReactNode } from 'react';
import { translate, type Locale } from '../i18n/index.js';

const STORAGE_KEY = 'khel.locale';

/** Gujarati is the default for a Sanand deployment (docs/INDIA_DATA_MODEL.md §10). */
export const DEFAULT_LOCALE: Locale = 'gu';

interface LocaleValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
}

const LocaleContext = createContext<LocaleValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => readStored() ?? DEFAULT_LOCALE);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, locale); } catch { /* private mode */ }
  }, [locale]);

  const setLocale = useCallback((l: Locale) => setLocaleState(l), []);
  const t = useCallback((key: string) => translate(locale, key), [locale]);

  const value = useMemo<LocaleValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

function readStored(): Locale | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === 'gu' || raw === 'hi' || raw === 'en' ? raw : null;
  } catch {
    return null;   // private browsing, or storage disabled
  }
}

/**
 * These never throw. A loading, empty or error state can legitimately render before
 * any provider exists — inside an error boundary, or before sign-in — and making it
 * throw for want of a context turns a recoverable state into a blank page.
 */
export function useLocale(): Locale {
  return useContext(LocaleContext)?.locale ?? DEFAULT_LOCALE;
}

export function useTranslate(): (key: string) => string {
  const value = useContext(LocaleContext);
  if (value) return value.t;
  const fallback = readStored() ?? DEFAULT_LOCALE;
  return (key: string) => translate(fallback, key);
}

export function useLocaleControl(): LocaleValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error('useLocaleControl must be used inside a LocaleProvider');
  return value;
}
