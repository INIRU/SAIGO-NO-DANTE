'use client'

import PageError from '@/components/ui/PageError'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError quote="E.G.O 정보를 못 불러왔어." subQuote="다시 시도해 볼까?" reset={reset} homeHref="/sinners" homeLabel="수감자 목록으로" />
}
