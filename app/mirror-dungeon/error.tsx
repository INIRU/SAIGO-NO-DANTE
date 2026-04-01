'use client'

import PageError from '@/components/ui/PageError'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError quote="거울이 깨졌나 봐." subQuote="조각을 주워볼게." reset={reset} />
}
