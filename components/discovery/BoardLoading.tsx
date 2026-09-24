import Skeleton, { SkeletonLine } from '@/components/ui/Skeleton'
import { BoardShelfSkeleton } from './BoardSkeleton'

/** /decks, /planner/community 경로 로딩: BoardHeader 자리 + 첫 화면 선반. */
export default function BoardLoading({ kind }: { kind: 'deck' | 'planner' }) {
  return <div className="community-board flex min-h-screen flex-col" style={{ background: 'var(--bg-deep)' }}>
    <div aria-hidden="true" className="board-header mx-auto w-full max-w-7xl shrink-0 px-4 md:px-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-[18rem]">
          <div className="flex h-[1.71875rem] items-center md:h-[2.1875rem]"><Skeleton className="h-[75%]" style={{ width: kind === 'deck' ? '6rem' : '8rem' }} /></div>
          <div className="mt-1 flex h-[1.289rem] items-center"><SkeletonLine w="17rem" h="0.9375rem" /></div>
        </div>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <div className="flex min-h-11 items-center px-2"><SkeletonLine w="6rem" h="1rem" /></div>
          {kind === 'planner' && <Skeleton line className="h-11 w-[7.5rem] sm:w-[9rem]" />}
          <Skeleton className="h-11 w-[6.9rem] sm:w-[8.5rem]" style={{ background: 'rgba(200,144,10,0.35)' }} />
        </div>
      </div>
    </div>
    <BoardShelfSkeleton kind={kind} />
  </div>
}
