'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { SupportedLang, DEFAULT_LANG } from './types';
import { translations, TranslationKey } from './translations';

interface LanguageContextType {
  lang: SupportedLang;
  setLang: (lang: SupportedLang) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<SupportedLang>(DEFAULT_LANG);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Read from localStorage on mount (hydration-safe)
    const stored = localStorage.getItem('preferred_lang') as SupportedLang | null;
    if (stored && (['ko', 'en', 'ja'] as SupportedLang[]).includes(stored)) {
      setLangState(stored);
    }
    setMounted(true);
  }, []);

  const setLang = useCallback((newLang: SupportedLang) => {
    setLangState(newLang);
    localStorage.setItem('preferred_lang', newLang);
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => {
      const entry = translations[key];
      if (!entry) return key;
      return entry[lang] || entry['ko'] || key;
    },
    [lang],
  );

  // During SSR, always render 'ko' to avoid hydration mismatch
  const contextValue: LanguageContextType = {
    lang: mounted ? lang : DEFAULT_LANG,
    setLang,
    t,
  };

  return <LanguageContext.Provider value={contextValue}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
