import { Suspense } from 'react'
import SupportDesk from '@/components/support/SupportDesk'
import SupportSkeleton from '@/components/support/SupportSkeleton'
type Props = { searchParams: Promise<{ topic?: string }> }
async function SupportContent({ searchParams }: Props) {
  const { topic } = await searchParams
  const initialTopic = topic === 'api-limit' ? topic : undefined
  return <SupportDesk key={initialTopic ?? 'default'} initialTopic={initialTopic} />
}
export default function SupportPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<SupportSkeleton />}>
      <SupportContent searchParams={searchParams} />
    </Suspense>
  )
}
