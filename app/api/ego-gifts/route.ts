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

export async function GET() {
  try {
    const data = await getCachedEgoGifts()
    return NextResponse.json(data, { headers: { 'Cache-Control': CATALOG_CACHE_CONTROL } })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
