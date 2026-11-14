import { cacheLife, cacheTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import type { CollectionData, EGOInfo, SinnerInfo } from '@/lib/collection'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'

/** Sinners, identities and E.G.O grouped by sinner for the collection board; shared by the page and /api/collection. */
export async function fetchCollectionData(): Promise<CollectionData> {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.gameData)
  const supabase = createAdminClient()

  const [sinnersRes, identitiesRes, egosRes] = await Promise.all([
    supabase.schema('limbus').from('sinners').select('id, name_kr, name_en, name_jp, order_num').order('order_num'),
    supabase.schema('limbus').from('identities').select('id, sinner_id, name_kr, name_en, name_jp, game_id, folder_name, rarity, keywords').order('game_id'),
    supabase.schema('limbus').from('ego').select('id, sinner_id, name_kr, name_en, name_jp, grade, sin_affinity, folder_name, image_url').order('grade').order('name_kr'),
  ])

  if (sinnersRes.error || identitiesRes.error || egosRes.error) {
    throw new Error('컬렉션 데이터를 불러올 수 없습니다.')
  }

  const identities: CollectionData['identities'] = {}
  const egos: CollectionData['egos'] = {}

  for (const s of sinnersRes.data) {
    identities[s.id] = []
    egos[s.id] = []
  }
  for (const i of identitiesRes.data) {
    identities[i.sinner_id]?.push(i)
  }
  for (const e of egosRes.data) {
    egos[e.sinner_id]?.push(e as EGOInfo)
  }

  return { sinners: sinnersRes.data as SinnerInfo[], identities, egos }
}
