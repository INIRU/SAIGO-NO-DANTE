import { cookies } from 'next/headers';
import { SupportedLang, SUPPORTED_LANGS } from './types';
import { translations, TranslationKey } from './translations';

const VALID_LANGS = SUPPORTED_LANGS.map(l => l.value) as string[];

export async function getServerLang(): Promise<SupportedLang> {
  const cookieStore = await cookies();
  const raw = cookieStore.get('preferred_lang')?.value;
  if (raw && VALID_LANGS.includes(raw)) return raw as SupportedLang;
  return 'ko'; // SSR default matches client initial render
}

export function serverT(key: TranslationKey, lang: SupportedLang): string {
  const entry = translations[key];
  if (!entry) return key;
  return entry[lang] || entry['ko'] || key;
}
