import { Suspense } from 'react'
import { getSinners, getIdentities, getEGOs } from '@/lib/db/queries'
import RandomClient from './RandomClient'
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
    <Suspense>
      <RandomClient sinners={sinners} identities={identities} egos={egos} />
    </Suspense>
  )
}
