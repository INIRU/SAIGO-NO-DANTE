import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cacheLife, cacheTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { CATALOG_CACHE_CONTROL } from '@/lib/constants/http-cache'

async function getCachedEgoGifts() {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.egoGifts, CACHE_TAGS.gameData, CACHE_TAGS.mirrorDungeon)

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .schema('limbus')
    .from('ego_gifts')
    .select('name, keyword, grade, image_url, effect_base, activation_condition')
  if (error) throw new Error(error.message)
  return data
}

/** One whole gift for a note label: a uuid key is its id (note blocks), anything else its Korean name (older tokens). */
async function getCachedEgoGift(key: string) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.egoGifts, CACHE_TAGS.gameData, CACHE_TAGS.mirrorDungeon)

  const { data, error } = await createAdminClient()
    .schema('limbus')
    .from('ego_gifts')
    .select('id, game_id, name, name_en, name_jp, keyword, grade, image_url, effect_base, effect_base_en, effect_base_jp, effect_plus, effect_plus_en, effect_plus_jp, effect_plusplus, effect_plusplus_en, effect_plusplus_jp, activation_condition')
    .eq(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(key) ? 'id' : 'name', key)
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function GET(request: Request) {
  try {
    const key = new URL(request.url).searchParams.get('key')
    if (key) {
      const gift = await getCachedEgoGift(key)
      return gift
        ? NextResponse.json(gift, { headers: { 'Cache-Control': CATALOG_CACHE_CONTROL } })
        : NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const data = await getCachedEgoGifts()
    return NextResponse.json(data, { headers: { 'Cache-Control': CATALOG_CACHE_CONTROL } })
  } catch (err: unknown) {
    console.error('[api/ego-gifts]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
