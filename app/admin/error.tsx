'use client'

import PageError from '@/components/ui/PageError'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError quote="관리 시스템에 문제가 있어." subQuote="메피한테 말할까?" reset={reset} />
}
