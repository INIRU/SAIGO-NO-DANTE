import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cacheLife, cacheTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'

async function getCachedAvatars() {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.sinners, CACHE_TAGS.gameData)

  const admin = createAdminClient()

  const [sinnersRes, identitiesRes] = await Promise.all([
    admin
      .schema('limbus')
      .from('sinners')
      .select('id, name_kr, order_num')
      .order('order_num'),
    admin
      .schema('limbus')
      .from('identities')
      .select('sinner_id, name_kr, folder_name, game_id, rarity')
      .order('sinner_id')
      .order('rarity', { ascending: false }),
  ])

  return {
    sinners: sinnersRes.data ?? [],
    identities: identitiesRes.data ?? [],
  }
}

export async function GET() {
  try {
    const data = await getCachedAvatars()
    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
