import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import RunClient from './RunClient'

export const metadata: Metadata = {
  title: '거울 던전 트리거 모드',
  description: '림버스 컴퍼니 거울 던전 트리거 모드 — 실시간 기프트 추적, 인격/스킬/EGO 수정, 확률업 기프트 확인, 이벤트 선택지 가이드',
  alternates: { canonical: 'https://saigo-no-dante.com/planner/run' },
}

export const revalidate = 300

export default async function RunPage() {
  const supabase = await createClient()

  const [{ data: themes, error: e1 }, { data: gifts, error: e2 }, { data: recipes, error: e3 }] = await Promise.all([
    supabase.schema('limbus').from('ego_gift_themes').select('id, name, dungeon_id, ego_gift_ids, specific_ego_gift_ids, image_url, boss_image_url, difficulty, floor_info'),
    supabase.schema('limbus').from('ego_gifts').select('*').order('keyword').order('grade'),
    supabase.schema('limbus').from('ego_gift_recipes').select('*'),
  ])
  if (e1 || e2 || e3) console.error('[RunPage] query group 1:', e1?.message, e2?.message, e3?.message)

  const [{ data: identities, error: e4 }, { data: sinners, error: e5 }, { data: skills, error: e6 }, { data: passives, error: e6b }] = await Promise.all([
    supabase.schema('limbus').from('identities').select('id, sinner_id, name_kr, rarity, keywords, game_id, folder_name').order('rarity', { ascending: false }),
    supabase.schema('limbus').from('sinners').select('id, name_kr, order_num').order('order_num'),
    supabase.schema('limbus').from('skills').select('identity_id, name, sin_affinity, skill_type, skill_order, uptie_level').eq('uptie_level', 4),
    supabase.schema('limbus').from('passives').select('id, name, identity_id, passive_type, sin_affinity, sin_count, active_cond, description, uptie_level').eq('uptie_level', 4),
  ])
  if (e4 || e5 || e6 || e6b) console.error('[RunPage] query group 2:', e4?.message, e5?.message, e6?.message, e6b?.message)

  const [{ data: egos, error: e7 }, { data: events, error: e8 }] = await Promise.all([
    supabase.schema('limbus').from('ego').select('id, sinner_id, name, name_kr, grade, sin_affinity, image_url, cost'),
    supabase.schema('limbus').from('mirror_dungeon_events').select('id, name, desc_text, options, gift_ids, source, image_url, parent_id, option_gifts, option_index, theme_ids').order('id'),
  ])
  if (e7 || e8) console.error('[RunPage] query group 3:', e7?.message, e8?.message)

  return <RunClient
    themes={themes ?? []}
    gifts={gifts ?? []}
    recipes={recipes ?? []}
    identities={identities ?? []}
    sinners={sinners ?? []}
    skills={skills ?? []}
    passives={passives ?? []}
    egos={egos ?? []}
    events={events ?? []}
  />
}
