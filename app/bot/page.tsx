import type { Metadata } from 'next'
import { Suspense } from 'react'
import BotClient from './BotClient'

export const metadata: Metadata = {
  title: '디스코드 봇',
  description: '최애의 관리자 디스코드 봇 — 림버스 컴퍼니 인격, E.G.O, 키워드, 기프트 정보를 디스코드에서 바로 확인하세요.',
  alternates: { canonical: 'https://saigo-no-dante.com/bot' },
}

export default function BotPage() {
  return (
    <Suspense fallback={null}>
      <BotClient />
    </Suspense>
  )
}
