import type { SupportedLang } from './types'
import { translations } from './translations'

// Apart from localize.ts so the keyword tooltips every page loads do not pull in the translation table.
/* ── Gift keyword localization ── */

const KEYWORD_TRANSLATION_KEYS: Record<string, keyof typeof translations> = {
  '화상': 'mirrorDungeon.filter.combustion',
  '출혈': 'mirrorDungeon.filter.laceration',
  '진동': 'mirrorDungeon.filter.vibration',
  '파열': 'mirrorDungeon.filter.burst',
  '침잠': 'mirrorDungeon.filter.sinking',
  '호흡': 'mirrorDungeon.filter.breath',
  '충전': 'mirrorDungeon.filter.charge',
  '참격': 'mirrorDungeon.filter.slash',
  '관통': 'mirrorDungeon.filter.pierce',
  '타격': 'mirrorDungeon.filter.blunt',
  '공통': 'mirrorDungeon.filter.common',
}

/** Gift keyword ('화상', '공통', ...) in the page language. */
export function localizeGiftKeyword(keyword: string, lang: SupportedLang): string {
  // DB rows use variants such as '공통 ' or '공통(…)'; the catalog groups them all under 공통.
  const key = KEYWORD_TRANSLATION_KEYS[keyword.startsWith('공통') ? '공통' : keyword.trim()]
  const entry = key ? (translations[key] as Record<string, string>) : null
  return entry?.[lang] ?? keyword
}
