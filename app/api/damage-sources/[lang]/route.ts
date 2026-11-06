import { NextResponse } from 'next/server'
import { cacheLife, cacheTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { CATALOG_CACHE_CONTROL } from '@/lib/constants/http-cache'
import { routing } from '@/lib/i18n/routing'
import type { SupportedLang } from '@/lib/i18n/types'
import { getKeywordData } from '@/lib/keywords/server-data'
import { isMissingColumnError } from '@/lib/keywords/ref-text'
import { buildDamageSources, type GiftSourceRow, type KeywordAbility } from '@/features/tools'

const GIFT_COLUMNS = 'game_id, name, name_en, name_jp, grade, keyword, image_url, effect_base, effect_plus, effect_plusplus, effect_base_en, effect_plus_en, effect_plusplus_en, effect_base_jp, effect_plus_jp, effect_plusplus_jp'

/** keyword_meta.abilities and ego_gifts.modifiers are newer columns: until their migration is applied the sentences are read as before. */
async function getGameValues() {
  const db = createAdminClient().schema('limbus')
  const [abilityRows, giftRows] = await Promise.all([
    db.from('keyword_meta').select('name, abilities').not('abilities', 'is', null),
    db.from('ego_gifts').select(`${GIFT_COLUMNS}, modifiers`).order('name'),
  ])
  // A failed read throws instead of caching an empty list; a column that is not there yet is not a failure.
  if (abilityRows.error && !isMissingColumnError(abilityRows.error)) throw new Error(abilityRows.error.message)
  if (giftRows.error && !isMissingColumnError(giftRows.error)) throw new Error(giftRows.error.message)
  const abilities: Record<string, KeywordAbility[]> = {}
  for (const row of (abilityRows.error ? [] : abilityRows.data) as unknown as { name: string; abilities: KeywordAbility[] }[]) {
    if (Array.isArray(row.abilities)) abilities[row.name] = row.abilities
  }
  const gifts = giftRows.error
    ? await db.from('ego_gifts').select(GIFT_COLUMNS).order('name')
    : giftRows
  if (gifts.error) throw new Error(gifts.error.message)
  return { abilities, gifts: gifts.data as unknown as GiftSourceRow[] }
}

async function getDamageSources(lang: SupportedLang) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.egoGifts, CACHE_TAGS.keywords, CACHE_TAGS.gameData)

  const { abilities, gifts } = await getGameValues()
  return buildDamageSources(await getKeywordData(), gifts, lang, abilities)
}

/** The keywords and gifts that change skill damage, for the damage calculator's picker (loaded when it first opens). */
export async function GET(_request: Request, { params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!(routing.locales as readonly string[]).includes(lang)) return NextResponse.json({ error: 'Unknown language' }, { status: 404 })
  try {
    return NextResponse.json(await getDamageSources(lang as SupportedLang), { headers: { 'Cache-Control': CATALOG_CACHE_CONTROL } })
  } catch {
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 })
  }
}
