import { withoutOtherLocales } from '@/lib/i18n/strip-locales'
import { withEgoStage } from '@/lib/db/queries'
import * as Sentry from '@sentry/nextjs'
import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo/metadata'
import { Suspense } from 'react'
import { cacheLife, cacheTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { GIFT_COLUMNS, RECIPE_COLUMNS } from '@/lib/db/columns'
import { readAllRows } from '@/lib/meta/pagination'
import { getTranslations } from 'next-intl/server'
import PlannerClient from './PlannerClient'
import PlannerSkeleton from '@/features/planner/components/PlannerSkeleton'
import PageHeader from '@/components/ui/PageHeader'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import StaticQueryAdapter from '@/components/providers/StaticQueryAdapter'
import { OBSERVATION_COLUMNS, observationFrom, type ObservationRow } from '@/features/planner'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'planner' })
  return pageMetadata({ lang, path: '/planner', noindex: true, title: t('metaTitle'), description: t('metaDescription') })
}

// 조회가 실패하면 빈 결과를 캐시에 굳히지 않도록 던진다(Sentry에는 남긴다)
function failOnReadError(errors: Record<string, Error | { message: string } | null>) {
  for (const [name, error] of Object.entries(errors)) {
    if (!error) continue
    Sentry.captureException(error, { tags: { location: 'planner/page:fetchPlannerStaticData' }, extra: { msg: 'Failed to fetch ' + name } })
    throw new Error(`Failed to fetch ${name}: ${error.message}`)
  }
}

async function fetchPlannerStaticData() {
  'use cache'
  cacheLife('max')
  cacheTag(
    CACHE_TAGS.gameData,
    CACHE_TAGS.mirrorDungeon,
    CACHE_TAGS.themes,
    CACHE_TAGS.egoGifts,
    CACHE_TAGS.identities,
    CACHE_TAGS.sinners,
    CACHE_TAGS.ego
  )
  const supabase = createAdminClient()

  // 그룹 1: 거울 던전 데이터
  const [{ data: themes, error: themesError }, { data: gifts, error: giftsError }, { data: recipes, error: recipesError }, { data: observationRow, error: observationError }] = await Promise.all([
    supabase.schema('limbus').from('ego_gift_themes').select('id, name, name_en, name_jp, ego_gift_ids, specific_ego_gift_ids, fixed_reward_gift_ids, image_url, difficulty, floor_info, name_color, name_segments'),
    supabase.schema('limbus').from('ego_gifts').select(GIFT_COLUMNS).order('keyword').order('grade'),
    supabase.schema('limbus').from('ego_gift_recipes').select(RECIPE_COLUMNS),
    supabase.schema('limbus').from('md_observation').select(OBSERVATION_COLUMNS).order('mirror_dungeon_id', { ascending: false }).limit(1).maybeSingle<ObservationRow>(),
  ])
  failOnReadError({ md_observation: observationError, themes: themesError, gifts: giftsError, recipes: recipesError })

  // 그룹 2: 인격/수감자/패시브/스킬
  const [{ data: identities, error: identitiesError }, { data: sinners, error: sinnersError }, { data: passives, error: passivesError }, { data: skills, error: skillsError }] = await Promise.all([
    supabase.schema('limbus').from('identities').select('id, sinner_id, name_kr, name_en, name_jp, rarity, keywords, skill_keyword_list, affiliation, association_list, game_id, folder_name, release_date').order('rarity', { ascending: false }),
    supabase.schema('limbus').from('sinners').select('id, name_kr, name_en, name_jp, order_num').order('order_num'),
    // Every uptie level (the deck picks each slot's level); more rows than one page.
    readAllRows((from, to) => supabase.schema('limbus').from('passives').select('id, name, name_en, name_jp, identity_id, passive_type, sin_affinity, sin_count, sin_requirements, active_cond, description, description_en, description_jp, uptie_level').order('id').range(from, to)),
    readAllRows((from, to) => supabase.schema('limbus').from('skills').select('id, identity_id, name, sin_affinity, skill_type, atk_type, image_id, skill_order, variant_order, uptie_level').order('id').range(from, to)),
  ])
  failOnReadError({ identities: identitiesError, sinners: sinnersError, passives: passivesError, skills: skillsError })

  // 그룹 3: EGO
  const { data: egos, error: egosError } = await supabase.schema('limbus').from('ego').select('id, sinner_id, name_kr, name_en, name_jp, grade, sin_affinity, image_url, cost, game_id, stage_levels:ego_skills(construe_level)')
  failOnReadError({ egos: egosError })

  return { themes, gifts, recipes, identities, sinners, passives, skills, egos: egos?.map(withEgoStage), observation: observationFrom(observationRow) }
}

export default async function PlannerPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'planner' })
  const data = await fetchPlannerStaticData()
  const { themes, recipes, identities, sinners, skills, egos, observation } = data
  // 현재 언어가 아닌 긴 설명은 보내지 않는다(없으면 화면이 한국어로 되돌아간다). 초기 전송량의 절반 가까이가 여기서 줄어든다.
  const gifts = data.gifts?.map(gift => withoutOtherLocales(gift, lang, ['effect_base', 'effect_plus', 'effect_plusplus']))
  const passives = data.passives?.map(passive => withoutOtherLocales(passive, lang, ['description']))

  return (
    <>
      {/* Server-rendered page header — paints in initial HTML before JS loads */}
      <div className="pt-[5.5rem] px-3 md:px-6 max-w-[90rem] mx-auto">
        <PageHeader title={t('title')} />
      </div>
      {/* Prerendered without a query; the URL's state applies after hydration (StaticQueryAdapter). */}
      <Suspense fallback={<PlannerSkeleton />}>
        <StaticQueryAdapter fallback={<PlannerSkeleton />}>
          <PlannerClient
            themes={themes ?? []}
            gifts={gifts ?? []}
            recipes={recipes ?? []}
            identities={identities ?? []}
            sinners={sinners ?? []}
            passives={passives ?? []}
            skills={skills ?? []}
            egos={egos ?? []}
            observation={observation}
          />
        </StaticQueryAdapter>
      </Suspense>
    </>
  )
}
