import Skeleton, { SkeletonLine } from '@/components/ui/Skeleton'

/** The motion page while its list loads: the same grid, the picker column, the 16:9 stage with its control bar, the side panel. */
export default function SkillMotionSkeleton() {
  return (
    <div role="status" aria-busy="true" className="grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)] xl:grid-cols-[17rem_minmax(0,1fr)_20rem]">
      <div className="hidden flex-col gap-3 lg:row-span-2 lg:flex xl:row-span-1">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-6 gap-1.5">{Array.from({ length: 12 }, (_, i) => <Skeleton key={i} className="aspect-square" />)}</div>
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 p-1.5"><Skeleton className="h-11 w-11 shrink-0" /><SkeletonLine w="70%" /></div>
        ))}
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        <Skeleton className="h-[3.75rem] w-full lg:hidden" />
        <div className="overflow-hidden rounded-lg border border-[#2e2417]">
          <Skeleton className="aspect-video w-full !rounded-none" />
          <div className="flex h-12 items-center gap-2 border-t border-[#2e2417] px-2"><Skeleton className="h-8 w-8" /><SkeletonLine w="100%" h="0.25rem" /><SkeletonLine w="4rem" /></div>
        </div>
        <div className="flex flex-col gap-2"><SkeletonLine w="10rem" /><SkeletonLine w="60%" h="1.25rem" /></div>
      </div>
      <div className="lg:col-start-2 xl:col-start-auto"><Skeleton className="h-48 w-full" /></div>
    </div>
  )
}
