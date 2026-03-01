import type { Metadata } from 'next'
import { getSinners } from '@/lib/data/sinners'
import SinnersClient from './SinnersClient'

export const metadata: Metadata = {
  title: '수감자 목록',
  description: 'Limbus Company 12인 수감자 — 이상, 파우스트, 돈키호테, 료슈, 뫼르소, 홍루, 히스클리프, 이스마엘, 로쟈, 싱클레어, 오티스, 그레고르의 모든 인격과 EGO 정보.',
  openGraph: {
    title: '수감자 목록 | 최애의 관리자',
    description: '12인 수감자의 인격, EGO, 스킬 데이터를 한 곳에서 확인하세요.',
  },
}

export default async function SinnersPage() {
  const sinners = await getSinners()
  return <SinnersClient sinners={sinners} />
}
