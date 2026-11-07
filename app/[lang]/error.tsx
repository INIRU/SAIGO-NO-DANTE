'use client'

import { earlyErrors } from '@/lib/sentry/early'
import { useEffect } from 'react'
import PageError from '@/components/ui/PageError'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // sent once the browser Sentry has started (it loads after the page)
    earlyErrors.report(error)
  }, [error])

  return <PageError code="500" reset={reset} />
}
