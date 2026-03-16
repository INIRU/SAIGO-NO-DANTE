import type { Metadata } from 'next'
import ExtractionScene from './ExtractionScene'

export const metadata: Metadata = {
  title: '추출 시뮬레이션',
  description: '림버스 컴퍼니 추출 시뮬레이션 — 인격·EGO 뽑기 확률을 직접 체험해보세요.',
  openGraph: {
    title: '추출 시뮬레이션 | 최애의 관리자',
    description: '림버스 컴퍼니 추출 시뮬레이션 — 인격·EGO 뽑기 확률을 직접 체험해보세요.',
  },
}

export default function ExtractionPage() {
  return <ExtractionScene />
}
