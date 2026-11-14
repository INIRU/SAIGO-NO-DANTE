import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo/metadata'
import { cacheLife, cacheTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { MD_EVENT_COLUMNS, MD_EVENT_CHOICE_COLUMNS } from '@/lib/db/columns'
import { readAllRows } from '@/lib/meta/pagination'
import { getTranslations } from 'next-intl/server'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { normalizePlannerThemeId, type ThemeData, type GiftData, type SinnerData, type SkillSummary, type PassiveData, type EgoData } from '@/lib/planner/types'
import RunWrapper from './RunWrapper'
import type { MdEvent, MdEventChoice } from '@/features/mirror-dungeon'
import { giftsQuery, recipesQuery, themesQuery } from '@/features/mirror-dungeon/server'
import { withoutOtherLocales } from '@/lib/i18n/strip-locales'
import { dropRepeatedTopUptie } from '@/lib/identity/skill-model'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'planner' })
  return pageMetadata({ lang, path: '/planner/run', noindex: true, title: t('run.metaTitle'), description: t('run.metaDescription') })
}

// 조회가 실패하면 빈 결과를 캐시에 굳히지 않도록 던진다
function failOnReadError(...errors: ({ message: string } | null)[]) {
  const failed = errors.find(error => error)
  if (failed) throw new Error(`[RunPage] query failed: ${failed.message}`)
}

export default async function RunPage({ params }: { params: Promise<{ lang: string }> }) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.mirrorDungeon, CACHE_TAGS.gameData)
  const { lang } = await params
  const supabase = createAdminClient()

  const [{ data: themes, error: e1 }, { data: gifts, error: e2 }, { data: recipes, error: e3 }] = await Promise.all([
    themesQuery(supabase),
    giftsQuery(supabase),
    recipesQuery(supabase),
  ])
  failOnReadError(e1, e2, e3)

  const [{ data: identities, error: e4 }, { data: sinners, error: e5 }, { data: skills, error: e6 }, { data: passives, error: e6b }] = await Promise.all([
    supabase.schema('limbus').from('identities').select('id, sinner_id, name_kr, rarity, keywords, skill_keyword_list, affiliation, association_list, game_id, folder_name').order('rarity', { ascending: false }),
    supabase.schema('limbus').from('sinners').select('id, name_kr, order_num').order('order_num'),
    // Every uptie level (the deck picks each slot's level); more rows than one page.
    readAllRows((from, to) => supabase.schema('limbus').from('skills').select('identity_id, name, sin_affinity, skill_type, skill_order, uptie_level').order('id').range(from, to)),
    readAllRows((from, to) => supabase.schema('limbus').from('passives').select('id, name, identity_id, passive_type, sin_affinity, sin_count, sin_requirements, active_cond, description, uptie_level').order('id').range(from, to)),
  ])
  failOnReadError(e4, e5, e6, e6b)

  const [{ data: egos, error: e7 }, { data: mdEvents, error: e8 }, { data: mdChoices, error: e9 }] = await Promise.all([
    supabase.schema('limbus').from('ego').select('id, sinner_id, name_kr, grade, sin_affinity, image_url, cost, game_id'),
    supabase.schema('limbus').from('md_events').select(MD_EVENT_COLUMNS).order('id'),
    supabase.schema('limbus').from('md_event_choices').select(MD_EVENT_CHOICE_COLUMNS).order('event_id').order('sort_order'),
  ])
  failOnReadError(e7, e8, e9)

  const normalizedThemes = (themes ?? []).flatMap(theme => {
    const id = normalizePlannerThemeId(theme.id)
    return id === null ? [] : [{ ...theme, id }]
  })

  return (
    <RunWrapper
      themes={normalizedThemes as ThemeData[]}
      // 이름(화면 인식용)은 모든 언어를 두고, 긴 설명·결과 문장은 현재 언어만 보낸다
      gifts={(gifts ?? []).map(gift => withoutOtherLocales(gift, lang, ['effect_base', 'effect_plus', 'effect_plusplus'])) as GiftData[]}
      recipes={recipes ?? []}
      identities={identities ?? []}
      sinners={(sinners ?? []) as SinnerData[]}
      // Rows repeated at the top uptie are dropped; selectUptieRows falls back to the identical level below.
      skills={dropRepeatedTopUptie(skills ?? [], row => row.identity_id) as SkillSummary[]}
      passives={dropRepeatedTopUptie(passives ?? [], row => row.identity_id) as PassiveData[]}
      egos={(egos ?? []) as EgoData[]}
      events={(mdEvents ?? []).map(event => withoutOtherLocales(event, lang, ['desc_text'], ['judgment'])) as MdEvent[]}
      eventChoices={(mdChoices ?? []).map(choice => withoutOtherLocales(choice, lang, ['result_text', 'message', 'message_desc'], ['effects'])) as MdEventChoice[]}
    />
  )
}
