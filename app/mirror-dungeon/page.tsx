import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import MirrorDungeonClient from './MirrorDungeonClient'

export const revalidate = 300

export const metadata: Metadata = {
  title: '거울 던전 — E.G.O 기프트',
  description: '거울 던전 E.G.O 기프트 408종 도감. 키워드별 필터, 등급별 검색, 조합 레시피까지.',
  openGraph: {
    title: '거울 던전 | 최애의 관리자',
    description: 'Limbus Company 거울 던전 E.G.O 기프트 도감 — 키워드·등급 필터, 효과, 조합 레시피.',
  },
}

export default async function MirrorDungeonPage() {
  const supabase = await createClient()

  const [{ data: gifts }, { data: recipes }, { data: themes }] = await Promise.all([
    supabase.schema('limbus').from('ego_gifts').select('*').order('keyword').order('grade'),
    supabase.schema('limbus').from('ego_gift_recipes').select('*'),
    supabase.schema('limbus').from('ego_gift_themes').select('id, name, dungeon_id, ego_gift_ids').order('id'),
  ])

  return (
    <MirrorDungeonClient
      gifts={gifts ?? []}
      recipes={recipes ?? []}
      themes={themes ?? []}
    />
  )
}
