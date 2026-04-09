import type { Metadata } from 'next'
import { Suspense } from 'react'
import MypageClient from './MypageClient'

export const metadata: Metadata = {
  title: '마이페이지',
  description: '내 덱, 북마크, 보유 현황을 관리하세요.',
}

export default function MyPage() {
  return (
    <Suspense fallback={null}>
      <MypageClient />
    </Suspense>
  )
}
