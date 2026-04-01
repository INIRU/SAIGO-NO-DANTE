'use client'

import PageError from '@/components/ui/PageError'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError quote="플래너 데이터를 불러오는 중 문제가 발생했습니다." reset={reset} />
}
