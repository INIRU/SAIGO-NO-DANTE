import type { Metadata } from 'next'
import { Suspense } from 'react'
import { cacheLife } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import MirrorDungeonClient from './MirrorDungeonClient'
import JsonLd, { faqJsonLd } from '@/components/seo/JsonLd'

export const metadata: Metadata = {
  title: '거울 던전 — E.G.O 기프트 도감 | 림버스 컴퍼니',
  description: '림버스 컴퍼니 거울 던전 E.G.O 기프트 408종 도감. 키워드별 필터, 등급별 검색, 조합 레시피, 테마팩, 이벤트 정보까지 한 곳에서.',
  alternates: { canonical: 'https://saigo-no-dante.com/mirror-dungeon' },
  openGraph: {
    title: '거울 던전 E.G.O 기프트 도감 | 최애의 관리자',
    description: 'Limbus Company 거울 던전 E.G.O 기프트 도감 — 키워드·등급 필터, 효과, 조합 레시피, 테마팩.',
  },
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

export default async function MirrorDungeonPage() {
  'use cache'
  cacheLife('page-5m')
  const supabase = createAdminClient()

  const [{ data: gifts, error: giftsError }, { data: recipes, error: recipesError }, { data: themes, error: themesError }, { data: events, error: eventsError }] = await Promise.all([
    supabase.schema('limbus').from('ego_gifts').select('*').order('keyword').order('grade'),
    supabase.schema('limbus').from('ego_gift_recipes').select('*'),
    supabase.schema('limbus').from('ego_gift_themes').select('id, name, dungeon_id, ego_gift_ids, specific_ego_gift_ids, image_url, difficulty, floor_info, boss_image_url, is_hidden, hidden_rate, fixed_reward_gift_ids').order('id'),
    supabase.schema('limbus').from('mirror_dungeon_events').select('id, name, desc_text, options, gift_ids, source, image_url, theme_ids').order('id'),
  ])
  if (giftsError) console.error('Failed to fetch gifts:', giftsError)
  if (recipesError) console.error('Failed to fetch recipes:', recipesError)
  if (themesError) console.error('Failed to fetch themes:', themesError)
  if (eventsError) console.error('Failed to fetch events:', eventsError)

  return (
    <>
      <JsonLd data={faqJsonLd(MIRROR_FAQ)} />
      {/* MirrorDungeonClient uses nuqs (useSearchParams internally), requiring Suspense
          to prevent CSR bailout from de-opting the entire page to client rendering. */}
      <Suspense fallback={null}>
        <MirrorDungeonClient
          gifts={gifts ?? []}
          recipes={recipes ?? []}
          themes={themes ?? []}
          events={events ?? []}
        />
      </Suspense>
    </>
  )
}
