import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getCommunityCopy } from '@/features/community'
import MypageClient, { MypageSkeleton } from './MypageClient'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return { title: getCommunityCopy(lang).mypage, robots: { index: false, follow: false } }
}

export default function MyPage() {
  return (
    // The page is prerendered; the session and URL tab are read in the browser, so the skeleton is the static HTML.
    <Suspense fallback={<MypageSkeleton />}>
      <MypageClient />
    </Suspense>
  )
}
