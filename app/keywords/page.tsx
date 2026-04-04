import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import KeywordsClient from './KeywordsClient'
import KeywordCardStatic from './KeywordCardStatic'

export const revalidate = 300

export const metadata: Metadata = {
  title: '키워드 도감 — 상태이상·버프·디버프',
  description: '림버스 컴퍼니 키워드 도감 — 415종 키워드별 설명, 관련 인격, E.G.O 기프트 한눈에.',
  alternates: { canonical: 'https://saigo-no-dante.com/keywords' },
  openGraph: {
    title: '키워드 도감 | 최애의 관리자',
    description: '림버스 컴퍼니 키워드 도감 — 키워드별 관련 인격·기프트 모아보기.',
  },
}

const SSR_CARD_COUNT = 60

export default async function KeywordsPage() {
  const supabase = await createClient()

  const [
    { data: keywords, error: keywordsError },
    { data: identities, error: identitiesError },
    { data: sinners, error: sinnersError },
    { data: gifts, error: giftsError },
    { data: egos, error: egosError },
  ] = await Promise.all([
    supabase.schema('limbus').from('keyword_meta')
      .select('name, description, max_stack, icon_slug, sin_affinity, category')
      .order('name'),
    supabase.schema('limbus').from('identities')
      .select('id, name, name_kr, sinner_id, keywords, rarity, game_id, folder_name')
      .order('name'),
    supabase.schema('limbus').from('sinners')
      .select('id, name_kr'),
    supabase.schema('limbus').from('ego_gifts')
      .select('name, keyword, grade, image_url')
      .order('name'),
    supabase.schema('limbus').from('ego')
      .select('id, name, name_kr, sinner_id, grade, sin_affinity, keywords, folder_name, image_url')
      .order('name'),
  ])

  if (keywordsError) console.error('Failed to fetch keywords:', keywordsError)
  if (identitiesError) console.error('Failed to fetch identities:', identitiesError)
  if (sinnersError) console.error('Failed to fetch sinners:', sinnersError)
  if (giftsError) console.error('Failed to fetch gifts:', giftsError)
  if (egosError) console.error('Failed to fetch egos:', egosError)

  const safeKeywords = keywords ?? []
  const safeIdentities = identities ?? []
  const safeGifts = gifts ?? []
  const safeEgos = egos ?? []

  /* ── 빈도 카운트 맵 (서버사이드) ── */
  const identityCountMap: Record<string, number> = {}
  safeIdentities.forEach(id => {
    (id.keywords ?? []).forEach((kw: string) => {
      identityCountMap[kw] = (identityCountMap[kw] || 0) + 1
    })
  })

  const egoCountMap: Record<string, number> = {}
  safeEgos.forEach(ego => {
    (ego.keywords ?? []).forEach((kw: string) => {
      egoCountMap[kw] = (egoCountMap[kw] || 0) + 1
    })
  })

  const giftCountMap: Record<string, number> = {}
  safeGifts.forEach(g => {
    giftCountMap[g.keyword] = (giftCountMap[g.keyword] || 0) + 1
  })

  /* ── 기본 정렬: 빈도순 (클라이언트와 동일 로직) ── */
  const ssrSorted = [...safeKeywords].sort((a, b) => {
    const aCount = (identityCountMap[a.name] || 0) + (egoCountMap[a.name] || 0) + (giftCountMap[a.name] || 0)
    const bCount = (identityCountMap[b.name] || 0) + (egoCountMap[b.name] || 0) + (giftCountMap[b.name] || 0)
    return bCount - aCount
  })

  const ssrCards = ssrSorted.slice(0, SSR_CARD_COUNT)

  return (
    <>
      {/* ── SSR 그리드: JS 로드 전 LCP용 서버 렌더링 ── */}
      <div
        id="keywords-ssr-grid"
        aria-hidden="true"
        className="min-h-screen pt-24 pb-16 px-4 md:px-6 max-w-7xl mx-auto"
      >
        {/* 헤더 */}
        <div className="text-center mb-10">
          <p className="font-mono text-[0.625rem] tracking-[0.3em] mb-2" style={{ color: '#c8900a' }}>
            KEYWORD ARCHIVE
          </p>
          <h1 className="font-serif text-3xl md:text-4xl font-bold mb-2" style={{ color: '#e8dcc8' }}>
            키워드 도감
          </h1>
          <p className="text-[0.8125rem]" style={{ color: '#7a6845' }}>
            {safeKeywords.length}종의 키워드 — 카테고리별 탐색, 관련 인격·기프트 모아보기
          </p>
        </div>

        {/* 장식선 */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div style={{ width: '4rem', height: '0.0625rem', background: 'linear-gradient(90deg, transparent, rgba(200,144,10,0.3))' }} />
          <div style={{ width: '0.25rem', height: '0.25rem', background: '#c8900a', transform: 'rotate(45deg)', opacity: 0.5 }} />
          <div style={{ width: '4rem', height: '0.0625rem', background: 'linear-gradient(90deg, rgba(200,144,10,0.3), transparent)' }} />
        </div>

        {/* 카드 그리드 */}
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(18rem, 1fr))' }}
        >
          {ssrCards.map(kw => (
            <KeywordCardStatic
              key={kw.name}
              keyword={kw}
              identityCount={identityCountMap[kw.name] || 0}
              egoCount={egoCountMap[kw.name] || 0}
              giftCount={giftCountMap[kw.name] || 0}
            />
          ))}
        </div>
      </div>

      {/* ── 인터랙티브 클라이언트 (JS 로드 후 SSR 그리드를 숨기고 대체) ── */}
      <KeywordsClient
        keywords={safeKeywords}
        identities={safeIdentities}
        sinners={sinners ?? []}
        gifts={safeGifts}
        egos={safeEgos}
      />
    </>
  )
}
