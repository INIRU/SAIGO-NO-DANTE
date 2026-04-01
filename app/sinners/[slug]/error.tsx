'use client'

import PageError from '@/components/ui/PageError'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError quote="이 수감자 정보가 삐걱거려." subQuote="잠깐만 기다려 봐." reset={reset} />
}
