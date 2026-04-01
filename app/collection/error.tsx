'use client'

import PageError from '@/components/ui/PageError'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError quote="보유 현황을 불러오다 엎질렀어." subQuote="카론 실수야, 미안." reset={reset} />
}
