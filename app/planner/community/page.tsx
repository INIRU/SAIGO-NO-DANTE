import type { Metadata } from 'next'
import CommunityClient from './CommunityClient'

export const metadata: Metadata = {
  title: '커뮤니티 플랜 | 거울 던전 플래너',
  description: '림버스 컴퍼니 거울 던전 플래너 — 다른 유저들의 플랜을 둘러보고 추천하세요.',
  alternates: { canonical: 'https://saigo-no-dante.com/planner/community' },
}

export default function CommunityPage() {
  return <CommunityClient />
}
