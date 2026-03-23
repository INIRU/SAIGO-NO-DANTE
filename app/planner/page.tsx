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

  // 그룹 1: 거울 던전 데이터
  const [{ data: themes }, { data: gifts }, { data: recipes }] = await Promise.all([
    supabase.schema('limbus').from('ego_gift_themes').select('id, name, dungeon_id, ego_gift_ids, specific_ego_gift_ids, image_url, boss_image_url, difficulty, floor_info'),
    supabase.schema('limbus').from('ego_gifts').select('*').order('keyword').order('grade'),
    supabase.schema('limbus').from('ego_gift_recipes').select('*'),
  ])

  // 그룹 2: 인격/수감자/패시브/스킬/EGO
  const [{ data: identities }, { data: sinners }, { data: passives }, { data: skills }] = await Promise.all([
    supabase.schema('limbus').from('identities').select('id, sinner_id, name_kr, rarity, keywords, game_id, folder_name').order('rarity', { ascending: false }),
    supabase.schema('limbus').from('sinners').select('id, name_kr, order_num').order('order_num'),
    supabase.schema('limbus').from('passives').select('id, name, identity_id, passive_type, sin_affinity, sin_count, active_cond, description, uptie_level').eq('uptie_level', 4),
    supabase.schema('limbus').from('skills').select('identity_id, name, sin_affinity, skill_type, skill_order, uptie_level').eq('uptie_level', 4),
  ])

  // 그룹 3: EGO
  const { data: egos } = await supabase.schema('limbus').from('ego').select('id, sinner_id, name, name_kr, grade, sin_affinity, image_url')

  return <PlannerClient
    themes={themes ?? []}
    gifts={gifts ?? []}
    recipes={recipes ?? []}
    identities={identities ?? []}
    sinners={sinners ?? []}
    passives={passives ?? []}
    skills={skills ?? []}
    egos={egos ?? []}
  />
}
