'use client'

import PageError from '@/components/ui/PageError'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError quote="이 덱이 말을 안 들어." subQuote="엔진이 과열된 것 같아." reset={reset} />
}
