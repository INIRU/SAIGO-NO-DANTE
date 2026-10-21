import Skeleton, { SkeletonLine } from '@/components/ui/Skeleton'

/** The motion page while its list loads: the same grid, the picker column, the 16:9 stage with its control bar, the skill sprites, name and conditions under it, the side panel. */
export default function SkillMotionSkeleton() {
  return (
    <div role="status" aria-busy="true" className="grid gap-5 lg:min-h-0 lg:flex-1 lg:grid-cols-[17rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden xl:grid-cols-[17rem_minmax(0,1fr)_20rem]">
      <div className="hidden flex-col gap-3 lg:flex">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-6 gap-1.5">{Array.from({ length: 12 }, (_, i) => <Skeleton key={i} className="aspect-square" />)}</div>
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 p-1.5"><Skeleton className="h-11 w-11 shrink-0" /><SkeletonLine w="70%" /></div>
        ))}
      </div>
      <div className="flex min-w-0 flex-col gap-5 xl:contents">
      <div className="flex min-w-0 flex-col gap-4">
        <Skeleton className="h-[3.75rem] w-full lg:hidden" />
        <div className="overflow-hidden rounded-lg border border-[#2e2417]">
          <Skeleton className="aspect-video w-full !rounded-none" />
          <div className="flex h-12 items-center gap-2 border-t border-[#2e2417] px-2"><Skeleton className="h-8 w-8" /><SkeletonLine w="100%" h="0.25rem" /><SkeletonLine w="4rem" /></div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex gap-1">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[3.125rem] w-[3.125rem] m-[0.1875rem] mb-2" />)}</div>
          <SkeletonLine w="14rem" h="1.25rem" />
          <div className="flex gap-5"><SkeletonLine w="2.5rem" /><SkeletonLine w="4rem" /></div>
        </div>
      </div>
      <div className="flex flex-col gap-3"><SkeletonLine w="100%" h="1.5rem" /><Skeleton className="h-48 w-full" /></div>
      </div>
    </div>
  )
}
