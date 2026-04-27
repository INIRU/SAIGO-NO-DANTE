'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

import PageError from '@/components/ui/PageError'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <PageError
      statusCode="500"
      eyebrow="route paused"
      quote="카론, 빙글빙글."
      subQuote="뭔가 고장났어. 멀미 봉투는 좌석 밑에 있어. 메피한테 토하지 마."
      reset={reset}
      retryLabel="째깍째깍 다시 해보기"
      homeHref="/"
      homeLabel="컴퍼니로 돌아가기"
      variant="critical"
    />
  )
}
