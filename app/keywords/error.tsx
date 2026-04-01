'use client'

import PageError from '@/components/ui/PageError'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError quote="키워드 정보가 말을 안 들어." subQuote="다시 한번 불러볼게." reset={reset} />
}
