import { cacheLife, cacheTag } from 'next/cache'
import { getSinners, getIdentities, getEGOs, getAllSkills, getAllPassives, getEgoGiftsForNotes } from '@/lib/db/queries'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { withoutOtherLocales } from '@/lib/i18n/strip-locales'
import type { SupportedLang } from '@/lib/i18n/types'

/** Skill/passive rows without the flavor text (shown only on identity pages) and other languages' names and descriptions. */
export function forBuilder<T extends Record<string, unknown>>(row: T, lang: SupportedLang): T {
  const copy: Record<string, unknown> = withoutOtherLocales(row, lang, ['name', 'description'])
  delete copy.flavor
  delete copy.flavor_en
  delete copy.flavor_jp
  return copy as T
}

/**
 * Game data of the deck builder (new, fork and edit), cached per language until a game data sync. Every skill and passive
 * row is sent to the browser, so the text the builder never shows stays out of the page payload.
 */
export async function fetchDeckBuilderData(lang: SupportedLang) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.gameData, CACHE_TAGS.sinners, CACHE_TAGS.identities, CACHE_TAGS.ego, CACHE_TAGS.egoGifts)
  const [sinners, identities, egos, skills, passives, egoGifts] = await Promise.all([
    getSinners(), getIdentities(), getEGOs(), getAllSkills(), getAllPassives(), getEgoGiftsForNotes(),
  ])
  return {
    sinners, identities, egos, egoGifts,
    skills: skills.map(skill => forBuilder(skill, lang)),
    passives: passives.map(passive => forBuilder(passive, lang)),
  }
}
