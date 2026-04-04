import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import type { CollectionData } from '@/lib/collection'
import CollectionClient from './CollectionClient'

export const metadata: Metadata = {
  title: '보유 현황',
  description: '림버스 컴퍼니 인격·EGO 보유 현황을 체크하고 URL로 공유하세요.',
  alternates: { canonical: 'https://saigo-no-dante.com/collection' },
}

async function fetchCollectionData(): Promise<CollectionData> {
  const supabase = await createClient()

  const [sinnersRes, identitiesRes, egosRes] = await Promise.all([
    supabase.schema('limbus').from('sinners').select('id, name_kr, order_num').order('order_num'),
    supabase.schema('limbus').from('identities').select('id, sinner_id, name_kr, game_id, folder_name, rarity, keywords').order('game_id'),
    supabase.schema('limbus').from('ego').select('id, sinner_id, name_kr, grade, sin_affinity, folder_name, image_url').order('grade').order('name_kr'),
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
    egos[e.sinner_id]?.push(e)
  }

  return { sinners: sinnersRes.data, identities, egos }
}

export default async function CollectionPage() {
  const data = await fetchCollectionData()
  return <CollectionClient initialData={data} />
}
