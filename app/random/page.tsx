import { Suspense } from 'react'
import { getSinners, getIdentities, getEGOs } from '@/lib/db/queries'
import RandomStatic from './RandomStatic'
import RandomInteractive from './RandomInteractive'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '랜덤 편성',
  description: '림버스 컴퍼니 랜덤 편성 — 키워드 필터, 컬렉션 연동으로 랜덤 덱을 즉석에서 뽑아보세요.',
  openGraph: {
    title: '랜덤 편성 | 최애의 관리자',
    description: '림버스 컴퍼니 랜덤 편성 — 키워드 필터, 컬렉션 연동으로 랜덤 덱을 즉석에서 뽑아보세요.',
  },
}

export const revalidate = 300

export default async function RandomPage() {
  const [sinners, identities, egos] = await Promise.all([
    getSinners(),
    getIdentities(),
    getEGOs(),
  ])

  return (
    <div style={{ paddingTop: '64px' }}>
      <div className="mx-auto max-w-[80rem] px-[1rem] py-[2rem] pb-[6rem] md:pb-[2rem]">
        {/*
          RandomStatic is a pure Server Component.
          The header <h1> and ghost card grid are painted in the initial HTML —
          the browser renders them before any JS executes, making them the LCP element.
        */}
        <RandomStatic sinners={sinners} />

        {/*
          RandomInteractive uses useSearchParams which requires a Suspense boundary.
          Suspense fallback is null: the static skeleton above is already visible,
          so there is no layout shift or blank flash during hydration.
          Once hydrated, RandomClient overlays the ghost grid with the interactive UI.
        */}
        <Suspense fallback={null}>
          <RandomInteractive sinners={sinners} identities={identities} egos={egos} />
        </Suspense>
      </div>
    </div>
  )
}
