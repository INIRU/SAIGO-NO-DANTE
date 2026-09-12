import { Suspense } from 'react'
import SupportDesk from '@/components/support/SupportDesk'
type Props = { searchParams: Promise<{ topic?: string }> }
async function SupportContent({ searchParams }: Props) {
  const { topic } = await searchParams
  const initialTopic = topic === 'api-limit' ? topic : undefined
  return <SupportDesk key={initialTopic ?? 'default'} initialTopic={initialTopic} />
}
export default function SupportPage({ searchParams }: Props) {
  return (
    <div className="mx-auto max-w-6xl px-5 pb-16 pt-28">
      <Suspense fallback={<p>…</p>}>
        <SupportContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
