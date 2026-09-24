'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import PageError from '@/components/ui/PageError'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return <PageError code="500" reset={reset} />
}
