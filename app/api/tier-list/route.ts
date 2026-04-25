import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cacheLife, cacheTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'

const TIER_LIST_CATEGORIES = ['reroll', 'overall', 'mirror_dungeon', 'goodstuff'] as const
type TierListCategory = typeof TIER_LIST_CATEGORIES[number]

function parseCategory(value: string | null): TierListCategory | null {
  if (!value) return 'reroll'
  return TIER_LIST_CATEGORIES.includes(value as TierListCategory) ? value as TierListCategory : null
}

async function getCachedTierList(category: TierListCategory) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.tierList, CACHE_TAGS.gameData)

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .schema('limbus')
    .from('tier_list')
    .select(`
      category, tier, sort_order,
      identity:identities(id, name_kr, rarity, sinner_id, game_id, folder_name, acquisition_info, release_date)
    `)
    .eq('category', category)
    .order('sort_order')

  if (error) throw new Error(error.message)
  return data
}

export async function GET(request: NextRequest) {
  try {
    const category = parseCategory(request.nextUrl.searchParams.get('category'))
    if (!category) {
      return NextResponse.json({ error: '유효하지 않은 티어 카테고리입니다.' }, { status: 400 })
    }

    const data = await getCachedTierList(category)
    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
