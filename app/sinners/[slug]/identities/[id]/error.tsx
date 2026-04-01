'use client'

import PageError from '@/components/ui/PageError'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError quote="인격 데이터가 꼬였어." subQuote="카론이 풀어볼게." reset={reset} />
}
