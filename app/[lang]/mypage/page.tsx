import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getCommunityCopy } from '@/lib/community/copy'
import MypageClient from './MypageClient'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return { title: getCommunityCopy(lang).mypage }
}

export default function MyPage() {
  return (
    <Suspense fallback={null}>
      <MypageClient />
    </Suspense>
  )
}
