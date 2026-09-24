import { Suspense } from 'react'
import { cacheLife, cacheTag } from 'next/cache'
import { getSinners, getIdentities, getEGOs } from '@/lib/db/queries'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import RandomStatic from './RandomStatic'
import RandomInteractive from './RandomInteractive'
import PageHeader from '@/components/ui/PageHeader'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '랜덤 편성',
  description: '림버스 컴퍼니 랜덤 편성 — 키워드 필터, 컬렉션 연동으로 랜덤 덱을 즉석에서 뽑아보세요.',
  openGraph: {
    title: '랜덤 편성 | 최애의 관리자',
    description: '림버스 컴퍼니 랜덤 편성 — 키워드 필터, 컬렉션 연동으로 랜덤 덱을 즉석에서 뽑아보세요.',
  },
}

export default async function RandomPage() {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.gameData)
  const [sinners, identities, egos] = await Promise.all([
    getSinners(),
    getIdentities(),
    getEGOs(),
  ])

  return (
    <div style={{ paddingTop: '64px' }}>
      <div className="mx-auto max-w-[80rem] px-[1rem] pt-[1.5rem] pb-[6rem] md:pb-[2rem]">
        <PageHeader title="랜덤 편성" description="운명의 수감자를 선택하세요" />
        {/*
          RandomStatic is a pure Server Component.
          The ghost card grid is painted in the initial HTML —
          the browser renders them before any JS executes, making them the LCP element.
        */}
        {/* SSR skeleton — hidden once interactive client mounts */}
        <div id="random-static-skeleton">
          <RandomStatic sinners={sinners} />
        </div>

        {/*
          RandomInteractive uses useSearchParams which requires a Suspense boundary.
          Suspense fallback is null: the static skeleton above is already visible,
          so there is no layout shift or blank flash during hydration.
          Once hydrated, RandomClient hides the skeleton and renders the interactive UI.
        */}
        <Suspense fallback={null}>
          <RandomInteractive sinners={sinners} identities={identities} egos={egos} />
        </Suspense>
      </div>
    </div>
  )
}
