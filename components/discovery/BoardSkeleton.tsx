import Skeleton, { SkeletonCircle, SkeletonLine, SkeletonPage } from '@/components/ui/Skeleton'

type Kind = 'deck' | 'planner'

/** DeckCard / PlanCard와 같은 뼈대: 6×2 초상 격자 + 제목·메타·태그. */
export function CardSkeleton({ kind }: { kind: Kind }) {
  return <div className="flex h-full flex-col overflow-hidden rounded-md border border-[#2e2417] bg-[var(--bg-card)]">
    <div className="grid grid-cols-6 border-b border-[#2e2417]">{Array.from({ length: 12 }, (_, j) => <Skeleton key={j} raised className="!rounded-none" style={{ aspectRatio: '3 / 4', opacity: j % 3 === 0 ? 1 : 0.75 }} />)}</div>
    {kind === 'deck'
      ? <div className="flex flex-1 flex-col" style={{ padding: '0.875rem' }}>
        <div className="mb-1.5 flex h-[1.375rem] items-center"><SkeletonLine w="45%" h="1rem" raised /></div>
        <div className="mb-2 flex min-h-6 flex-1 items-center"><SkeletonLine w="85%" h="0.8125rem" raised /></div>
        <div className="mb-2 flex h-6 gap-1"><Skeleton raised className="h-full w-16" /><Skeleton raised className="h-full w-12" /></div>
        <div className="flex h-[1.8rem] items-center gap-2 border-t border-white/[0.04] pt-2.5"><SkeletonLine w="9rem" h="0.75rem" raised /><SkeletonLine w="3.5rem" h="0.75rem" raised className="ml-auto" /></div>
      </div>
      : <>
        <div className="flex flex-1 flex-col p-4">
          <div className="mb-1.5 flex h-[1.375rem] items-center"><SkeletonLine w="40%" h="1rem" raised /></div>
          <div className="mt-auto flex items-center gap-1.5 border-t border-white/[0.04] pt-2"><SkeletonCircle size="1.125rem" raised /><SkeletonLine w="6rem" h="0.75rem" raised /><SkeletonLine w="3rem" h="0.75rem" raised className="ml-auto" /></div>
        </div>
        <div className="flex min-h-[2.75rem] items-center px-4 pb-3"><Skeleton raised className="h-6 w-14" /></div>
      </>}
  </div>
}

/** 카드 격자만 (상태 영역 없음). shelf: 선반 제목 줄 + 1/2/3열. */
export function BoardCards({ kind = 'deck', shelf = false, count = 6 }: { kind?: Kind; shelf?: boolean; count?: number }) {
  return <div data-board-skeleton className="w-full min-w-0">
    {shelf && <div className="mb-4 flex min-h-12 items-center justify-between"><SkeletonLine w="8.5rem" h="1.25rem" /><SkeletonLine w="3.5rem" h="1rem" /></div>}
    <div className={shelf ? 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3' : kind === 'planner' ? 'grid grid-cols-1 gap-4 md:grid-cols-2' : 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'}>
      {Array.from({ length: count }, (_, i) => <CardSkeleton key={i} kind={kind} />)}
    </div>
  </div>
}

/** 목록·선반 로딩 (클라이언트 목록에서 사용). */
export default function BoardSkeleton(props: { kind?: Kind; shelf?: boolean; count?: number }) {
  return <SkeletonPage className="w-full min-w-0"><BoardCards {...props} /></SkeletonPage>
}

/** DiscoveryShelf 첫 화면: 기간 칩 + 전체보기, 흐름 두 줄, 선반 두 개. */
export function BoardShelfSkeleton({ kind }: { kind: Kind }) {
  return <SkeletonPage className="px-4 pb-16 md:px-6">
    <div className="mx-auto max-w-7xl space-y-9">
      <div className="flex items-center justify-between gap-3 py-1">
        <div className="flex gap-1">{['1.6rem', '1.6rem', '3rem'].map((w, i) => <div key={i} className="flex h-10 items-center rounded-full px-4" style={{ background: i === 0 ? 'rgba(200,144,10,0.1)' : undefined }}><SkeletonLine w={w} h="0.8rem" /></div>)}</div>
        <div className="flex min-h-12 items-center"><SkeletonLine w="7.5rem" h="1rem" /></div>
      </div>
      <div className="-mt-5 space-y-1.5 border-l border-[#2e2417] pl-3">
        <div className="flex h-12 flex-col justify-around sm:h-6 sm:justify-center"><SkeletonLine w="25rem" h="0.875rem" /><SkeletonLine w="6rem" h="0.875rem" className="sm:hidden" /></div>
        <div className="flex h-6 items-center"><SkeletonLine w="16rem" h="0.875rem" /></div>
      </div>
      {Array.from({ length: 2 }, (_, i) => <BoardCards key={i} kind={kind} shelf count={3} />)}
    </div>
  </SkeletonPage>
}
