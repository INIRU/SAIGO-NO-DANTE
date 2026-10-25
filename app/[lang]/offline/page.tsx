import type { Metadata } from 'next'
import Link from 'next/link'
import { cacheLife } from 'next/cache'

export const metadata: Metadata = {
  title: '오프라인',
  description: '인터넷 연결을 확인해 주세요.',
  robots: { index: false, follow: false },
}

export default async function OfflinePage() {
  'use cache'
  cacheLife('page-1h')
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex flex-col items-center gap-4">
        {/* Simple decorative bar in gold accent */}
        <div className="h-1 w-16 rounded-full bg-[var(--gold)]" />
        <h1 className="font-serif text-3xl text-[var(--gold-light)]">오프라인</h1>
        <p className="max-w-sm font-sans text-base text-[#9a8a7a]">
          인터넷 연결이 끊겼습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.
        </p>
        <div className="h-1 w-16 rounded-full bg-[var(--gold)]" />
      </div>

      <Link
        href="/"
        className="mt-2 rounded border border-[var(--gold)]/40 bg-[var(--bg-card)] px-6 py-3 font-sans text-sm text-[var(--gold-light)] transition-colors hover:bg-[var(--gold)]/10"
      >
        홈으로 돌아가기
      </Link>
    </div>
  )
}
