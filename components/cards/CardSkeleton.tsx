import Skeleton, { SkeletonCircle, SkeletonLine } from '@/components/ui/Skeleton'

type Kind = 'deck' | 'planner'

/** DeckCard / PlanCard와 같은 뼈대: 6×2 초상 격자 + 제목·메타·태그. */
export function CardSkeleton({ kind }: { kind: Kind }) {
  return <div className="flex h-full flex-col overflow-hidden rounded-md border border-[#2e2417] bg-[var(--bg-card)]">
    <div className="grid grid-cols-6 gap-px border-b border-[#2e2417]">{Array.from({ length: 12 }, (_, j) => <Skeleton key={j} raised className="!rounded-none" style={{ aspectRatio: '3 / 4', opacity: j % 3 === 0 ? 1 : 0.75 }} />)}</div>
    {kind === 'deck'
      ? <div className="flex flex-1 flex-col" style={{ padding: '0.875rem' }}>
        <div className="mb-1.5 flex h-[1.375rem] items-center"><SkeletonLine w="45%" h="1rem" raised /></div>
        <div className="mb-2 flex min-h-6 flex-1 items-center"><SkeletonLine w="85%" h="0.8125rem" raised /></div>
        <div className="mb-2 flex h-6 gap-1"><Skeleton raised className="h-full w-16" /><Skeleton raised className="h-full w-12" /></div>
        <div className="flex h-[1.8rem] items-center gap-2 border-t border-white/[0.04] pt-2.5"><SkeletonLine w="9rem" h="0.75rem" raised /><SkeletonLine w="3.5rem" h="0.75rem" raised className="ml-auto" /></div>
      </div>
      : <>
        <div className="flex flex-1 flex-col p-4">
          <div className="mb-1.5 flex h-4 items-center"><SkeletonLine w="4.5rem" h="0.75rem" raised /></div>
          <div className="mb-1.5 flex h-[1.375rem] items-center"><SkeletonLine w="40%" h="1rem" raised /></div>
          {/* PlanCard keeps two description lines (0.8125rem at 1.6) even when a plan has none: the row is as tall as its tallest card. */}
          <div className="mb-3 flex flex-1 flex-col justify-around" style={{ minHeight: '2.6rem' }}><SkeletonLine w="92%" h="0.75rem" raised /><SkeletonLine w="64%" h="0.75rem" raised /></div>
          <div className="mb-3 flex h-6 items-center gap-2.5"><SkeletonLine w="3.5rem" h="0.75rem" raised /><SkeletonLine w="3rem" h="0.75rem" raised /></div>
          <div className="mt-auto flex items-center gap-1.5 border-t border-white/[0.04] pt-2"><SkeletonCircle size="1.125rem" raised /><SkeletonLine w="6rem" h="0.75rem" raised /><SkeletonLine w="3rem" h="0.75rem" raised className="ml-auto" /></div>
        </div>
      </>}
  </div>
}
