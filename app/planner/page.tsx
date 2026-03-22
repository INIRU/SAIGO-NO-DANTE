import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import PlannerClient from './PlannerClient'

export const metadata: Metadata = {
  title: '거울 던전 플래너',
  description: '림버스 컴퍼니 거울 던전 플래너 — 층별 테마팩 시뮬레이션, 덱 편성, 기프트 조합식, 키워드 시너지를 한번에 계획하세요.',
  alternates: { canonical: 'https://saigo-no-dante.com/planner' },
}

export default async function PlannerPage() {
  const supabase = await createClient()

  const [
    { data: themes },
    { data: gifts },
    { data: recipes },
    { data: identities },
    { data: sinners },
  ] = await Promise.all([
    supabase.schema('limbus').from('ego_gift_themes')
      .select('id, name, dungeon_id, ego_gift_ids, specific_ego_gift_ids, image_url, boss_image_url, difficulty, floor_info'),
    supabase.schema('limbus').from('ego_gifts')
      .select('id, game_id, name, keyword, grade, image_url, effect_base, theme_ids'),
    supabase.schema('limbus').from('ego_gift_recipes')
      .select('*'),
    supabase.schema('limbus').from('identities')
      .select('id, sinner_id, name_kr, rarity, keywords, game_id, folder_name')
      .order('rarity', { ascending: false }),
    supabase.schema('limbus').from('sinners')
      .select('id, name_kr, order_num').order('order_num'),
  ])

  return <PlannerClient
    themes={themes ?? []}
    gifts={gifts ?? []}
    recipes={recipes ?? []}
    identities={identities ?? []}
    sinners={sinners ?? []}
  />
}
