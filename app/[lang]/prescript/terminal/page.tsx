import type { Metadata } from 'next'
import { cacheLife, cacheTag } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { pageMetadata } from '@/lib/seo/metadata'
import { createAdminClient } from '@/lib/supabase/admin'
import { GIFT_COLUMNS, MD_EVENT_CHOICE_COLUMNS, MD_EVENT_COLUMNS, RECIPE_COLUMNS } from '@/lib/db/columns'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { normalizePlannerThemeId } from '@/lib/planner/types'
import { withoutOtherLocales } from '@/lib/i18n/strip-locales'
import PrescriptWrapper from './PrescriptWrapper'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'prescriptMode' })
  return pageMetadata({ lang, path: '/prescript/terminal', noindex: true, title: t('terminalTitle'), description: t('metaDescription') })
}

/** The Index prescript mode (재미): the gifts, packs and recipes the prescripts are drawn from and judged by. */
export default async function PrescriptPage({ params }: { params: Promise<{ lang: string }> }) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.mirrorDungeon, CACHE_TAGS.gameData)
  const { lang } = await params
  const supabase = createAdminClient()
  const [{ data: themes, error: e1 }, { data: gifts, error: e2 }, { data: recipes, error: e3 }] = await Promise.all([
    supabase.schema('limbus').from('ego_gift_themes').select('id, name, name_en, name_jp, ego_gift_ids, specific_ego_gift_ids, fixed_reward_gift_ids, image_url, difficulty, floor_info, name_color, name_segments'),
    supabase.schema('limbus').from('ego_gifts').select(GIFT_COLUMNS).order('keyword').order('grade'),
    supabase.schema('limbus').from('ego_gift_recipes').select(RECIPE_COLUMNS),
  ])
  // the ? rooms: a room's mandatory prescript names one of its options, judged by the result text read
  const [{ data: events, error: e4 }, { data: eventChoices, error: e5 }, { data: identities, error: e6 }, { data: sinners, error: e7 }] = await Promise.all([
    supabase.schema('limbus').from('md_events').select(MD_EVENT_COLUMNS).order('id'),
    supabase.schema('limbus').from('md_event_choices').select(MD_EVENT_CHOICE_COLUMNS).order('event_id').order('sort_order'),
    // the formation's prescripts: whose place a portrait is and its keywords
    supabase.schema('limbus').from('identities').select('id, game_id, sinner_id, keywords, name_kr, name_en, name_jp'),
    supabase.schema('limbus').from('sinners').select('id, name_kr, name_en, name_jp'),
  ])
  if (e1 || e2 || e3 || e4 || e5 || e6 || e7) console.error('[PrescriptPage]', e1?.message, e2?.message, e3?.message, e4?.message, e5?.message, e6?.message, e7?.message)
  const normalizedThemes = (themes ?? []).flatMap(theme => {
    const id = normalizePlannerThemeId(theme.id)
    return id === null ? [] : [{ ...theme, id }]
  })
  return <PrescriptWrapper themes={normalizedThemes}
    gifts={(gifts ?? []).map(gift => withoutOtherLocales(gift, lang, ['effect_base', 'effect_plus', 'effect_plusplus']))}
    recipes={recipes ?? []} events={events ?? []} eventChoices={eventChoices ?? []} identities={identities ?? []} sinners={sinners ?? []} dataError={!!(e1 || e2 || e3)} />
}
