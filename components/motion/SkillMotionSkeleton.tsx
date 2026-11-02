import Skeleton, { SkeletonLine } from '@/components/ui/Skeleton'

/** The picking page while its list loads: the sinners, the tabs and the search, the cards. */
export function MotionBrowserSkeleton() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-5">
      <div className="grid max-w-[46rem] grid-cols-6 gap-1 sm:grid-cols-12">{Array.from({ length: 12 }, (_, i) => <Skeleton key={i} className="aspect-square" />)}</div>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-[#2e2417] pb-2">
        <div className="flex gap-6"><SkeletonLine w="3.5rem" h="1.5rem" /><SkeletonLine w="3.5rem" h="1.5rem" /></div>
        <Skeleton className="h-10 w-full sm:w-72" />
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-x-3 gap-y-4 sm:grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))]">{Array.from({ length: 12 }, (_, i) => <Skeleton key={i} className="aspect-[3/4]" />)}</div>
    </div>
  )
}

/** The watching page while its list loads: the header, the 16:9 stage with its bar, the skill frames, the scenarios. */
export function MotionWatchSkeleton() {
  return (
    <div role="status" aria-busy="true" className="contents">
      <div className="flex shrink-0 items-center gap-2"><Skeleton className="h-10 w-10" /><Skeleton className="h-11 w-11" /><SkeletonLine w="14rem" h="1.5rem" /></div>
      <div className="grid min-h-0 flex-1 gap-x-5 gap-y-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="mx-auto w-full overflow-hidden rounded-lg border border-[#2e2417] lg:max-w-[calc((100dvh-13.5rem)*16/9)]">
            <Skeleton className="aspect-video w-full !rounded-none" />
            <div className="flex h-12 items-center gap-2 border-t border-[#2e2417] px-2"><Skeleton className="h-8 w-8" /><SkeletonLine w="100%" h="0.25rem" /><SkeletonLine w="4rem" /></div>
          </div>
          <div className="flex items-center gap-4"><div className="flex gap-1">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[3.75rem] w-[3.75rem]" />)}</div><SkeletonLine w="10rem" h="1.25rem" /></div>
        </div>
        <div className="flex flex-col gap-2 pt-1"><SkeletonLine w="5rem" h="1.25rem" />{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-11 w-full" />)}</div>
      </div>
    </div>
  )
}
