import { cookies } from 'next/headers';
import { SupportedLang, DEFAULT_LANG, SUPPORTED_LANGS } from './types';
import { translations, TranslationKey } from './translations';

/**
 * Get user's preferred language from cookie (server component use only).
 * Import this module directly as `@/lib/i18n/server` — do NOT import via
 * the barrel `@/lib/i18n/index`, which re-exports LanguageContext ('use client').
 */
export async function getServerLang(): Promise<SupportedLang> {
  const cookieStore = await cookies();
  const raw = cookieStore.get('preferred_lang')?.value;
  const validValues = SUPPORTED_LANGS.map(l => l.value) as string[];
  if (raw && validValues.includes(raw)) {
    return raw as SupportedLang;
  }
  return DEFAULT_LANG;
}

/**
 * Server-side translation function.
 * Falls back to Korean, then to the raw key if no entry exists.
 */
export function serverT(key: TranslationKey, lang: SupportedLang): string {
  const entry = translations[key];
  if (!entry) return key;
  return entry[lang] || entry['ko'] || key;
}
