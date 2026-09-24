import { notePlainText } from '@/lib/notes/blocks'
import { resolvePlannerIdentity } from '@/lib/planner/catalog-references'
import { selectUptieRows } from '@/lib/identity/skill-model'
import type { Metadata } from 'next'
import { absoluteUrl } from '@/lib/utils/og-image'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import PlanDetailClient from './PlanDetailClient'
import PlanDetailSkeleton from './PlanDetailSkeleton'

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
    openGraph: { images: [{ url: absoluteUrl(`/${lang}/planner/community/${id}/opengraph-image`), width: 1200, height: 630, alt: plan.title }] },
    twitter: { card: 'summary_large_image', images: [absoluteUrl(`/${lang}/planner/community/${id}/opengraph-image`)] },
    description: plan.description
      ? tDetail('metaDescriptionWithDescription', { difficulty: diff, description: notePlainText(plan.description).slice(0,160) })
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
      .select('id, name, name_en, name_jp, dungeon_id, ego_gift_ids, specific_ego_gift_ids, fixed_reward_gift_ids, image_url, difficulty, floor_info'),
    supabase.schema('limbus').from('ego_gifts').select('*').order('keyword').order('grade'),
    supabase.schema('limbus').from('ego_gift_recipes').select('*'),
  ])
  if (!plan) notFound()
  if (themesError) console.error('Failed to fetch themes:', themesError)
  if (giftsError) console.error('Failed to fetch gifts:', giftsError)
  if (recipesError) console.error('Failed to fetch recipes:', recipesError)

  const { data: identityCatalog, error: catalogError } = await supabase.schema('limbus').from('identities').select('id,sinner_id,game_id')
  if (catalogError) throw catalogError
  const memberIds = [...new Set((Array.isArray(plan.deck) ? plan.deck : []).flatMap(slot => {
    const identity = resolvePlannerIdentity(slot, identityCatalog ?? [])
    return identity ? [identity.id] : []
  }))]

  // 그룹 2: 인격/수감자/스킬/패시브
  const [{ data: identities, error: identitiesError }, { data: sinners, error: sinnersError }, { data: skills, error: skillsError }, { data: passives, error: passivesError }] = await Promise.all([
    supabase.schema('limbus').from('identities')
      .select(`
        id, sinner_id, name, name_kr, name_en, name_jp, tier, rarity, keywords, skill_keyword_list,
        affiliation, association_list, game_id, folder_name,
        hp, speed_min, speed_max, def_level, slash_res, pierce_res, blunt_res
      `)
      .order('rarity', { ascending: false }),
    supabase.schema('limbus').from('sinners').select('id, name_kr, order_num').order('order_num'),
    supabase.schema('limbus').from('skills')
      .select(`
        id, identity_id, image_id, name, name_en, name_jp, skill_type, atk_type, sin_affinity, coins,
        base_power, coin_power, skill_order, variant_order, atk_weight, offense_level,
        description, description_en, description_jp, uptie_level
      `)
      .in('identity_id', memberIds).or('uptie_level.eq.3,uptie_level.eq.4,uptie_level.is.null'),
    supabase.schema('limbus').from('passives')
      .select('id, identity_id, name, name_en, name_jp, passive_type, sin_affinity, sin_count, active_cond, description, description_en, description_jp, passive_order, uptie_level')
      .in('identity_id', memberIds).or('uptie_level.eq.3,uptie_level.eq.4,uptie_level.is.null'),
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
    <Suspense fallback={<PlanDetailSkeleton />}>
      <PlanDetailClient
        plan={plan as any}
        themes={themes ?? []}
        gifts={gifts ?? []}
        recipes={recipes ?? []}
        identities={identities ?? []}
        sinners={sinners ?? []}
        skills={memberIds.flatMap(id => selectUptieRows((skills ?? []).filter(row => row.identity_id === id), 4))}
        passives={memberIds.flatMap(id => selectUptieRows((passives ?? []).filter(row => row.identity_id === id), 4))}
        egos={egos ?? []}
      />
    </Suspense>
  )
}
