import { withoutOtherLocales } from '@/lib/i18n/strip-locales'
import * as Sentry from '@sentry/nextjs'
import type { Metadata } from 'next'
import { localeAlternates } from '@/lib/seo/metadata'
import { Suspense } from 'react'
import { cacheLife, cacheTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { translations } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import MirrorDungeonClient from './MirrorDungeonClient'
import MirrorDungeonSkeleton from '@/components/mirror-dungeon/MirrorDungeonSkeleton'
import type { MdEvent, MdEventChoice } from '@/components/mirror-dungeon/types'
import JsonLd, { faqJsonLd } from '@/components/seo/JsonLd'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = (key: string) => {
    const entry = translations[key as keyof typeof translations]
    if (!entry) return key
    return entry[lang as SupportedLang] ?? entry['ko'] ?? key
  }
  return {
    title: t('mirrorDungeon.meta.title'),
    description: t('mirrorDungeon.meta.description'),
    alternates: localeAlternates(lang, '/mirror-dungeon'),
    openGraph: {
      title: t('mirrorDungeon.meta.title'),
      description: t('mirrorDungeon.meta.description'),
    },
  }
}

const MIRROR_FAQ = [
  {
    question: '림버스 거울 던전 기프트 조합식은 어떻게 확인하나요?',
    answer: '거울 던전 도감에서 각 기프트 카드를 클릭하면 조합 레시피(필요 재료 기프트)를 확인할 수 있습니다. 키워드 필터와 등급 필터로 원하는 기프트를 빠르게 찾을 수 있습니다.',
  },
  {
    question: '거울 던전 테마팩이란 무엇인가요?',
    answer: '테마팩은 거울 던전의 각 층에서 선택할 수 있는 기프트 세트입니다. 각 테마팩에는 전용 기프트와 공용 기프트가 포함되며, 노말/하드/익스트림 난이도에 따라 출현 층이 다릅니다.',
  },
  {
    question: '거울 던전 이벤트에서 얻을 수 있는 기프트는?',
    answer: '거울 던전 진행 중 랜덤 이벤트에서 특정 기프트를 획득할 수 있습니다. 이벤트 탭에서 각 이벤트의 선택지와 보상 기프트를 미리 확인할 수 있습니다.',
  },
]

export default async function MirrorDungeonPage({ params }: { params: Promise<{ lang: string }> }) {
  'use cache'
  const { lang } = await params
  cacheLife('max')
  cacheTag(CACHE_TAGS.mirrorDungeon, CACHE_TAGS.gameData)
  const supabase = createAdminClient()

  const [
    { data: gifts, error: giftsError },
    { data: recipes, error: recipesError },
    { data: themes, error: themesError },
    { data: events, error: eventsError },
    { data: choices, error: choicesError },
  ] = await Promise.all([
    supabase.schema('limbus').from('ego_gifts').select('id, game_id, name, name_en, name_jp, keyword, grade, enhancement, price, sell_price, buy_disabled, effect_base, effect_base_en, effect_base_jp, effect_plus, effect_plus_en, effect_plus_jp, effect_plusplus, effect_plusplus_en, effect_plusplus_jp, activation_condition, is_synthesis, related, image_url, acquisition, difficulty, convert_to').order('keyword').order('grade'),
    supabase.schema('limbus').from('ego_gift_recipes').select('id, result_name, keyword, ingredients, final_result'),
    supabase.schema('limbus').from('ego_gift_themes').select('id, name, name_en, name_jp, dungeon_id, ego_gift_ids, specific_ego_gift_ids, image_url, difficulty, floor_info, is_hidden, hidden_rate, fixed_reward_gift_ids').order('id'),
    supabase
      .schema('limbus')
      .from('md_events')
      .select('id, name, name_en, name_jp, desc_text, desc_text_en, desc_text_jp, event_type, source, image_url, theme_ids, gift_ids, variant_of, category, judgment')
      .order('id'),
    supabase.schema('limbus').from('md_event_choices').select('*').order('event_id').order('sort_order'),
  ])
  if (giftsError) Sentry.captureException(giftsError, { tags: { location: 'mirror-dungeon/page:MirrorDungeonPage' }, extra: { msg: 'Failed to fetch gifts' } })
  if (recipesError) Sentry.captureException(recipesError, { tags: { location: 'mirror-dungeon/page:MirrorDungeonPage' }, extra: { msg: 'Failed to fetch recipes' } })
  if (themesError) Sentry.captureException(themesError, { tags: { location: 'mirror-dungeon/page:MirrorDungeonPage' }, extra: { msg: 'Failed to fetch themes' } })
  if (eventsError) Sentry.captureException(eventsError, { tags: { location: 'mirror-dungeon/page:MirrorDungeonPage' }, extra: { msg: 'Failed to fetch events' } })
  if (choicesError) Sentry.captureException(choicesError, { tags: { location: 'mirror-dungeon/page:MirrorDungeonPage' }, extra: { msg: 'Failed to fetch event choices' } })

  return (
    <>
      <JsonLd data={faqJsonLd(MIRROR_FAQ)} />
      {/* MirrorDungeonClient uses nuqs (useSearchParams internally), requiring Suspense
          to prevent CSR bailout from de-opting the entire page to client rendering. */}
      <Suspense fallback={<MirrorDungeonSkeleton />}>
        <MirrorDungeonClient
          lang={lang as SupportedLang}
          gifts={(gifts ?? []).map(gift => withoutOtherLocales(gift, lang, ['effect_base', 'effect_plus', 'effect_plusplus']))}
          recipes={recipes ?? []}
          themes={themes ?? []}
          events={(events ?? []).map(event => withoutOtherLocales(event, lang, ['desc_text'], ['judgment'])) as MdEvent[]}
          choices={(choices ?? []).map(choice => withoutOtherLocales(choice, lang, ['result_text', 'message', 'message_desc'], ['effects'])) as MdEventChoice[]}
        />
      </Suspense>
    </>
  )
}
