import Skeleton from '@/components/ui/Skeleton'
import { AdSlotSpace } from '@/components/ads/AdSlot'
import { BoardShelfSkeleton } from '@/features/community/components/BoardShelfSkeleton'

/** /decks, /planner/community 경로 로딩: BoardHeader 자리(제목과 단추들) + 첫 화면 선반. */
export default function BoardLoading({ kind }: { kind: 'deck' | 'planner' }) {
  return <div className="community-board flex min-h-screen flex-col" style={{ background: 'var(--bg-deep)' }}>
    <div aria-hidden="true" className="mx-auto w-full max-w-7xl shrink-0 px-4 pb-5 pt-[5.25rem] md:px-6 md:pb-7 md:pt-[6.5rem]">
      <div className="flex items-center gap-2 md:gap-3">
        <div className="flex min-h-11 min-w-0 flex-1 items-center"><Skeleton className="h-[1.625rem] md:h-[2.25rem]" style={{ width: kind === 'deck' ? '8rem' : '10rem' }} /></div>
        <Skeleton className="hidden h-11 w-[8.5rem] md:block" />
        {kind === 'planner' && <Skeleton line className="h-11 w-11 lg:w-[9rem]" />}
        <Skeleton line className="h-11 w-11 md:w-[8.5rem]" />
        <Skeleton className="h-11 w-11 sm:w-[8.5rem]" style={{ background: 'rgba(200,144,10,0.35)' }} />
      </div>
    </div>
    <div className="mx-auto w-full max-w-7xl shrink-0 px-4 md:px-6"><AdSlotSpace /></div>
    <BoardShelfSkeleton />
  </div>
}
