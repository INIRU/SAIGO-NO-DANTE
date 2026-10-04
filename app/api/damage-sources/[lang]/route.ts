import { NextResponse } from 'next/server'
import { cacheLife, cacheTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { CATALOG_CACHE_CONTROL } from '@/lib/constants/http-cache'
import { routing } from '@/lib/i18n/routing'
import type { SupportedLang } from '@/lib/i18n/types'
import { getKeywordData } from '@/lib/keywords/server-data'
import { buildDamageSources, type GiftSourceRow } from '@/lib/tools/damage-sources'

async function getDamageSources(lang: SupportedLang) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.egoGifts, CACHE_TAGS.keywords, CACHE_TAGS.gameData)

  const { data, error } = await createAdminClient()
    .schema('limbus')
    .from('ego_gifts')
    .select('game_id, name, name_en, name_jp, grade, keyword, image_url, effect_base, effect_plus, effect_plusplus, effect_base_en, effect_plus_en, effect_plusplus_en, effect_base_jp, effect_plus_jp, effect_plusplus_jp')
    .order('name')
  // A failed read throws instead of caching an empty list.
  if (error) throw new Error(error.message)
  return buildDamageSources(await getKeywordData(), data as GiftSourceRow[], lang)
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
