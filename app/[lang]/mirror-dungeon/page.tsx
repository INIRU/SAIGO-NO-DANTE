import { withoutOtherLocales } from '@/lib/i18n/strip-locales'
import * as Sentry from '@sentry/nextjs'
import type { Metadata } from 'next'
import { metaText, pageMetadata } from '@/lib/seo/metadata'
import { Suspense } from 'react'
import { cacheLife, cacheTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { MD_EVENT_COLUMNS, MD_EVENT_CHOICE_COLUMNS } from '@/lib/db/columns'
import type { SupportedLang } from '@/lib/i18n/types'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import MirrorDungeonClient from '@/app/[lang]/mirror-dungeon/_components/MirrorDungeonClient'
import MirrorDungeonSkeleton from '@/features/mirror-dungeon/components/MirrorDungeonSkeleton'
import type { MdEvent, MdEventChoice } from '@/features/mirror-dungeon'
import { giftsQuery, recipesQuery } from '@/features/mirror-dungeon/server'
import JsonLd, { faqJsonLd } from '@/components/seo/JsonLd'
import StaticQueryAdapter from '@/components/providers/StaticQueryAdapter'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return pageMetadata({ lang, path: '/mirror-dungeon', title: metaText('mirrorDungeon.meta.title', lang), description: metaText('mirrorDungeon.meta.description', lang) })
}

const MIRROR_FAQ: Record<'ko' | 'en' | 'ja', { question: string; answer: string }[]> = { ko: [
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
], en: [
  {
    question: 'How do I check Mirror Dungeon E.G.O Gift fusion recipes?',
    answer: 'Click any gift card in the Mirror Dungeon database to see its fusion recipe and required ingredient gifts. Keyword and tier filters help you find gifts quickly.',
  },
  {
    question: 'What is a Mirror Dungeon Theme Pack?',
    answer: 'Theme Packs are the gift pools you pick on each Mirror Dungeon floor. Each pack has exclusive and shared gifts, and the floors it appears on depend on Normal, Hard or Extreme difficulty.',
  },
  {
    question: 'Which gifts can I get from Mirror Dungeon events?',
    answer: 'Random events during a Mirror Dungeon run can grant specific gifts. The Events tab shows each event’s choices and reward gifts in advance.',
  },
], ja: [
  {
    question: 'ミラーダンジョンのE.G.Oギフト合成レシピはどう確認しますか？',
    answer: 'ミラーダンジョン図鑑で各ギフトカードをクリックすると、合成レシピ（必要な素材ギフト）を確認できます。キーワードと等級のフィルターで目的のギフトをすぐに探せます。',
  },
  {
    question: 'ミラーダンジョンのテーマパックとは何ですか？',
    answer: 'テーマパックはミラーダンジョンの各階で選べるギフトのセットです。専用ギフトと共通ギフトが含まれ、ノーマル・ハード・エクストリームの難易度によって出現する階が異なります。',
  },
  {
    question: 'ミラーダンジョンのイベントで入手できるギフトは？',
    answer: 'ミラーダンジョン進行中のランダムイベントで特定のギフトを入手できます。イベントタブで各イベントの選択肢と報酬ギフトを事前に確認できます。',
  },
] }

/** One read of the game tables for all three languages; the page below only picks the language. */
async function fetchMirrorDungeonData() {
  'use cache'
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
    giftsQuery(supabase),
    recipesQuery(supabase),
    supabase.schema('limbus').from('ego_gift_themes').select('id, name, name_en, name_jp, ego_gift_ids, specific_ego_gift_ids, image_url, difficulty, floor_info, is_hidden, hidden_rate, fixed_reward_gift_ids, name_color, name_segments').order('id'),
    supabase
      .schema('limbus')
      .from('md_events')
      .select(MD_EVENT_COLUMNS)
      .order('id'),
    supabase.schema('limbus').from('md_event_choices').select(MD_EVENT_CHOICE_COLUMNS).order('event_id').order('sort_order'),
  ])
  // A failed read throws (after the report) so the empty result is not cached for good.
  const failures = [
    [giftsError, 'Failed to fetch gifts'],
    [recipesError, 'Failed to fetch recipes'],
    [themesError, 'Failed to fetch themes'],
    [eventsError, 'Failed to fetch events'],
    [choicesError, 'Failed to fetch event choices'],
  ] as const
  for (const [error, msg] of failures) {
    if (error) Sentry.captureException(error, { tags: { location: 'mirror-dungeon/page:MirrorDungeonPage' }, extra: { msg } })
  }
  const failed = failures.find(([error]) => error)?.[0]
  if (failed) throw failed

  return { gifts, recipes, themes, events, choices }
}

export default async function MirrorDungeonPage({ params }: { params: Promise<{ lang: string }> }) {
  'use cache'
  const { lang } = await params
  cacheLife('max')
  cacheTag(CACHE_TAGS.mirrorDungeon, CACHE_TAGS.gameData)
  const { gifts, recipes, themes, events, choices } = await fetchMirrorDungeonData()

  return (
    <>
      <JsonLd data={faqJsonLd(MIRROR_FAQ[lang === 'en' || lang === 'ja' ? lang : 'ko'])} />
      {/* Prerendered without filters; the URL's filters apply after hydration (StaticQueryAdapter). */}
      <Suspense fallback={<MirrorDungeonSkeleton />}>
        <StaticQueryAdapter fallback={<MirrorDungeonSkeleton />}>
          <MirrorDungeonClient
            lang={lang as SupportedLang}
            gifts={(gifts ?? []).map(gift => withoutOtherLocales(gift, lang, ['effect_base', 'effect_plus', 'effect_plusplus']))}
            recipes={recipes ?? []}
            themes={themes ?? []}
            events={(events ?? []).map(event => withoutOtherLocales(event, lang, ['desc_text'], ['judgment'])) as MdEvent[]}
            choices={(choices ?? []).map(choice => withoutOtherLocales(choice, lang, ['result_text', 'message', 'message_desc'], ['effects'])) as MdEventChoice[]}
          />
        </StaticQueryAdapter>
      </Suspense>
    </>
  )
}
