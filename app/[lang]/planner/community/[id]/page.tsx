import type { Metadata } from 'next'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import PlanDetailClient from './PlanDetailClient'

interface Props {
  params: Promise<{ lang: string; id: string }>
}

/**
 * Fetch the full plan row. Both generateMetadata and PlanDetailPage call this
 * function — the Supabase server client is created fresh each time, but the
 * query selects the full set of columns needed by the page so there is only
 * one plan DB round-trip per request (metadata reuses the same data shape).
 */
async function fetchFullPlan(id: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .schema('limbus')
    .from('md_plans')
    .select('id, title, description, difficulty, tags, deck, egos, floor_plan, gift_inventory, vote_count, view_count, comment_count, created_at, user_id, profiles:user_id(username, avatar_url)')
    .eq('id', id)
    .maybeSingle()
  return data
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, id } = await params
  const tDetail = await getTranslations({ locale: lang, namespace: 'planner.detail' })
  const tDifficulty = await getTranslations({ locale: lang, namespace: 'planner.communityBoard.difficulty' })
  const plan = await fetchFullPlan(id)
  if (!plan) return { title: tDetail('notFoundTitle') }

  const diff = tDifficulty(plan.difficulty)

  return {
    title: tDetail('metaTitle', { title: plan.title }),
    description: plan.description
      ? tDetail('metaDescriptionWithDescription', { difficulty: diff, description: plan.description })
      : tDetail('metaDescription', { difficulty: diff }),
  }
}

export default async function PlanDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  // 그룹 1: 플랜 + 거던 데이터
  // fetchFullPlan selects the full row — no separate metadata-only query needed
  const [plan, { data: themes, error: themesError }, { data: gifts, error: giftsError }, { data: recipes, error: recipesError }] = await Promise.all([
    fetchFullPlan(id),
    supabase.schema('limbus').from('ego_gift_themes')
      .select('id, name, name_en, name_jp, dungeon_id, ego_gift_ids, specific_ego_gift_ids, image_url, difficulty, floor_info'),
    supabase.schema('limbus').from('ego_gifts').select('*').order('keyword').order('grade'),
    supabase.schema('limbus').from('ego_gift_recipes').select('*'),
  ])
  if (!plan) notFound()
  if (themesError) console.error('Failed to fetch themes:', themesError)
  if (giftsError) console.error('Failed to fetch gifts:', giftsError)
  if (recipesError) console.error('Failed to fetch recipes:', recipesError)

  // 그룹 2: 인격/수감자/스킬/패시브
  const [{ data: identities, error: identitiesError }, { data: sinners, error: sinnersError }, { data: skills, error: skillsError }, { data: passives, error: passivesError }] = await Promise.all([
    supabase.schema('limbus').from('identities')
      .select('id, sinner_id, name_kr, name_en, name_jp, rarity, keywords, skill_keyword_list, game_id, folder_name')
      .order('rarity', { ascending: false }),
    supabase.schema('limbus').from('sinners').select('id, name_kr, order_num').order('order_num'),
    supabase.schema('limbus').from('skills')
      .select('identity_id, name, sin_affinity, skill_type, skill_order, uptie_level')
      .eq('uptie_level', 4),
    supabase.schema('limbus').from('passives')
      .select('identity_id, name, name_en, name_jp, passive_type, sin_affinity, sin_count, active_cond, description, description_en, description_jp, uptie_level')
      .eq('uptie_level', 4),
  ])
  if (identitiesError) console.error('Failed to fetch identities:', identitiesError)
  if (sinnersError) console.error('Failed to fetch sinners:', sinnersError)
  if (skillsError) console.error('Failed to fetch skills:', skillsError)
  if (passivesError) console.error('Failed to fetch passives:', passivesError)

  // 그룹 3: EGO (cost 포함 — DeckStatsPanel에서 EGO 코스트 계산용)
  const { data: egos, error: egosError } = await supabase.schema('limbus').from('ego')
    .select('id, sinner_id, name, name_kr, name_en, name_jp, grade, sin_affinity, image_url, cost, game_id')
  if (egosError) console.error('Failed to fetch egos:', egosError)

  return (
    <Suspense fallback={null}>
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
    </Suspense>
  )
}
