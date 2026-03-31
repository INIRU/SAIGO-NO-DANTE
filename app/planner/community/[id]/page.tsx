import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PlanDetailClient from './PlanDetailClient'

interface Props {
  params: Promise<{ id: string }>
}

async function fetchPlanForMeta(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .schema('limbus')
    .from('md_plans')
    .select('title, description, difficulty')
    .eq('id', id)
    .single()
  if (error) console.error('Failed to fetch plan for metadata:', error)
  return data
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const plan = await fetchPlanForMeta(id)
  if (!plan) return { title: '플랜을 찾을 수 없습니다' }

  const diffLabels: Record<string, string> = {
    normal: '노말', hard: '하드', overlap: '평행중첩', extreme: '익스트림',
  }
  const diff = diffLabels[plan.difficulty] ?? plan.difficulty

  return {
    title: `${plan.title} | 커뮤니티 플랜`,
    description: plan.description
      ? `${diff} 난이도 — ${plan.description}`
      : `림버스 컴퍼니 거울 던전 ${diff} 플랜`,
  }
}

export default async function PlanDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  // 그룹 1: 플랜 + 거던 데이터
  const [{ data: plan, error: planError }, { data: themes, error: themesError }, { data: gifts, error: giftsError }, { data: recipes, error: recipesError }] = await Promise.all([
    supabase.schema('limbus').from('md_plans')
      .select('id, title, description, difficulty, deck, egos, floor_plan, gift_inventory, vote_count, view_count, comment_count, created_at, user_id, profiles:user_id(username, avatar_url)')
      .eq('id', id)
      .single(),
    supabase.schema('limbus').from('ego_gift_themes')
      .select('id, name, dungeon_id, ego_gift_ids, specific_ego_gift_ids, image_url, boss_image_url, difficulty, floor_info'),
    supabase.schema('limbus').from('ego_gifts').select('*').order('keyword').order('grade'),
    supabase.schema('limbus').from('ego_gift_recipes').select('*'),
  ])
  if (planError) console.error('Failed to fetch plan:', planError)
  if (themesError) console.error('Failed to fetch themes:', themesError)
  if (giftsError) console.error('Failed to fetch gifts:', giftsError)
  if (recipesError) console.error('Failed to fetch recipes:', recipesError)

  // 그룹 2: 인격/수감자/스킬/패시브
  const [{ data: identities, error: identitiesError }, { data: sinners, error: sinnersError }, { data: skills, error: skillsError }, { data: passives, error: passivesError }] = await Promise.all([
    supabase.schema('limbus').from('identities')
      .select('id, sinner_id, name_kr, rarity, keywords, game_id, folder_name')
      .order('rarity', { ascending: false }),
    supabase.schema('limbus').from('sinners').select('id, name_kr, order_num').order('order_num'),
    supabase.schema('limbus').from('skills')
      .select('identity_id, name, sin_affinity, skill_type, skill_order, uptie_level')
      .eq('uptie_level', 4),
    supabase.schema('limbus').from('passives')
      .select('identity_id, name, passive_type, sin_affinity, sin_count, active_cond, description, uptie_level')
      .eq('uptie_level', 4),
  ])
  if (identitiesError) console.error('Failed to fetch identities:', identitiesError)
  if (sinnersError) console.error('Failed to fetch sinners:', sinnersError)
  if (skillsError) console.error('Failed to fetch skills:', skillsError)
  if (passivesError) console.error('Failed to fetch passives:', passivesError)

  // 그룹 3: EGO (cost 포함 — DeckStatsPanel에서 EGO 코스트 계산용)
  const { data: egos, error: egosError } = await supabase.schema('limbus').from('ego')
    .select('id, sinner_id, name, name_kr, grade, sin_affinity, image_url, cost')
  if (egosError) console.error('Failed to fetch egos:', egosError)

  if (!plan) notFound()

  return (
    <PlanDetailClient
      plan={plan as any}
      themes={themes ?? []}
      gifts={gifts ?? []}
      recipes={recipes ?? []}
      identities={identities ?? []}
      sinners={sinners ?? []}
      skills={skills ?? []}
      passives={passives ?? []}
      egos={egos ?? []}
    />
  )
}
