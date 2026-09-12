'use client'
import { useLocale } from 'next-intl'
import Skeleton from '@/components/ui/Skeleton'

export default function BoardSkeleton({ kind = 'deck', shelf = false, count = 6 }: { kind?: 'deck' | 'planner'; shelf?: boolean; count?: number }) {
  const locale = useLocale()
  const label = locale === 'ko' ? (kind === 'deck' ? '덱 불러오는 중' : '플랜 불러오는 중') : locale === 'ja' ? '読み込み中' : 'Loading'
  return <div role="status" aria-label={label} aria-busy="true" data-board-skeleton className="w-full min-w-0">
    <span className="sr-only">{label}</span>
    {shelf && <Skeleton className="mb-5 h-6 w-48" />}
    <div aria-hidden="true" className={shelf ? 'grid auto-cols-[minmax(16rem,22rem)] grid-flow-col gap-4 overflow-hidden pb-4' : kind === 'planner' ? 'grid grid-cols-1 gap-4 md:grid-cols-2' : 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'}>
      {Array.from({ length: count }, (_, i) => <div key={i} className="overflow-hidden rounded-md bg-[var(--bg-card)]">
        <div className="grid grid-cols-6 gap-px">{Array.from({ length: 12 }, (_, j) => <Skeleton key={j} className="aspect-[3/4] !rounded-none" style={{ background: j % 3 === 0 ? '#292219' : '#221c15' }} />)}</div>
        <div className="space-y-4 p-4"><Skeleton className="h-5 w-3/5" style={{ background: '#30271c' }} /><div className="flex items-center gap-2"><Skeleton className="h-6 w-6 !rounded-full" style={{ background: '#292219' }} /><Skeleton className="h-3 w-20" style={{ background: '#292219' }} /><Skeleton className="ml-auto h-3 w-14" style={{ background: '#292219' }} /></div><div className="flex gap-2"><Skeleton className="h-6 w-12" style={{ background: '#292219' }} /><Skeleton className="h-6 w-16" style={{ background: '#292219' }} /></div></div>
      </div>)}
    </div>
  </div>
}
