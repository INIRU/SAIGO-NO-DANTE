'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { SupportedLang, DEFAULT_LANG, SUPPORTED_LANGS } from './types';
import { translations, TranslationKey } from './translations';

interface LanguageContextType {
  lang: SupportedLang;
  setLang: (lang: SupportedLang) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

const VALID_LANGS = SUPPORTED_LANGS.map(l => l.value);
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

function detectBrowserLang(): SupportedLang {
  if (typeof navigator === 'undefined') return 'en';
  const browserLang = navigator.language?.toLowerCase() ?? '';
  if (browserLang.startsWith('ko')) return 'ko';
  if (browserLang.startsWith('ja')) return 'ja';
  return 'en'; // fallback for all other languages
}

function setCookieAndAttr(lang: SupportedLang) {
  document.cookie = `preferred_lang=${lang};path=/;max-age=${COOKIE_MAX_AGE};samesite=lax`;
  document.documentElement.lang = lang;
}

interface LanguageProviderProps {
  children: ReactNode;
  /** Server-detected language from cookie. Enables SSR in the correct language (no flash). */
  initialLang?: SupportedLang;
}

export function LanguageProvider({ children, initialLang }: LanguageProviderProps) {
  // Use server-provided lang as initial state → SSR matches client first render → no flash
  const [lang, setLangState] = useState<SupportedLang>(initialLang ?? DEFAULT_LANG);

  useEffect(() => {
    // On mount: sync localStorage/cookie. If no stored pref, detect browser language.
    const stored = localStorage.getItem('preferred_lang');
    if (stored && VALID_LANGS.includes(stored as SupportedLang)) {
      const validLang = stored as SupportedLang;
      if (validLang !== lang) setLangState(validLang);
      setCookieAndAttr(validLang);
    } else if (!initialLang || initialLang === DEFAULT_LANG) {
      // First visit without cookie: detect browser language
      const detected = detectBrowserLang();
      setLangState(detected);
      localStorage.setItem('preferred_lang', detected);
      setCookieAndAttr(detected);
    } else {
      // Server already detected from Accept-Language → persist it
      localStorage.setItem('preferred_lang', lang);
      setCookieAndAttr(lang);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setLang = useCallback((newLang: SupportedLang) => {
    setLangState(newLang);
    localStorage.setItem('preferred_lang', newLang);
    setCookieAndAttr(newLang);
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => {
      const entry = translations[key];
      if (!entry) return key;
      return entry[lang] || entry['ko'] || key;
    },
    [lang],
  );

  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
