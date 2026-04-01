'use client'

import PageError from '@/components/ui/PageError'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError quote="티어표가 고장났어." subQuote="순위가 뒤죽박죽이야." reset={reset} />
}
