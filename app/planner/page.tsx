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
  const s = supabase.schema('limbus')

  // 7개까지 Promise.all 튜플 추론 가능
  const [themesRes, giftsRes, recipesRes, identitiesRes, sinnersRes, passivesRes, skillsRes] = await Promise.all([
    s.from('ego_gift_themes').select('id, name, dungeon_id, ego_gift_ids, specific_ego_gift_ids, image_url, boss_image_url, difficulty, floor_info'),
    s.from('ego_gifts').select('id, game_id, name, keyword, grade, image_url, effect_base, theme_ids'),
    s.from('ego_gift_recipes').select('*'),
    s.from('identities').select('id, sinner_id, name_kr, rarity, keywords, game_id, folder_name').order('rarity', { ascending: false }),
    s.from('sinners').select('id, name_kr, order_num').order('order_num'),
    s.from('passives').select('id, name, identity_id, passive_type, sin_affinity, sin_count, active_cond, description, uptie_level').eq('uptie_level', 4),
    s.from('skills').select('identity_id, sin_affinity, skill_type, skill_order, uptie_level').eq('uptie_level', 4),
  ])

  // 별도 쿼리 (튜플 제한 우회)
  const egosRes = await s.from('ego').select('id, sinner_id, name, name_kr, grade, sin_affinity, image_url')

  return <PlannerClient
    themes={themesRes.data ?? []}
    gifts={giftsRes.data ?? []}
    recipes={recipesRes.data ?? []}
    identities={identitiesRes.data ?? []}
    sinners={sinnersRes.data ?? []}
    passives={passivesRes.data ?? []}
    skills={skillsRes.data ?? []}
    egos={egosRes.data ?? []}
  />
}
