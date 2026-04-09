import type { Metadata } from 'next'
import { cacheLife } from 'next/cache'
import ExtractionWrapper from './ExtractionWrapper'

export const metadata: Metadata = {
  title: '추출 시뮬레이션',
  description: '림버스 컴퍼니 추출 시뮬레이션 — 인격·EGO 뽑기 확률을 직접 체험해보세요.',
  openGraph: {
    title: '추출 시뮬레이션 | 최애의 관리자',
    description: '림버스 컴퍼니 추출 시뮬레이션 — 인격·EGO 뽑기 확률을 직접 체험해보세요.',
  },
}

export default async function ExtractionPage() {
  'use cache'
  cacheLife('page-1h')
  return <ExtractionWrapper />
}
