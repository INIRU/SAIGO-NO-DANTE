import Skeleton, { SkeletonLine, SkeletonPage } from '@/components/ui/Skeleton'
import { PageHeaderSkeleton } from '@/components/ui/PageHeader'

export default function Loading() {
  return <SkeletonPage className="mx-auto min-h-screen max-w-7xl px-4 pb-16 pt-[5.5rem] md:px-6">
    <PageHeaderSkeleton titleWidth="7rem" />
    <div className="flex gap-6">
      <aside className="hidden w-64 shrink-0 flex-col gap-4 lg:flex">
        <SkeletonLine w="3rem" h="0.625rem" />
        <div className="grid grid-cols-2 gap-1.5">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} line className="h-9" />)}</div>
        <div className="h-px bg-[#2e2417]" />
        <SkeletonLine w="2.5rem" h="0.625rem" />
        <Skeleton line className="h-9" />
      </aside>
      <div className="min-w-0 flex-1">
        <div className="mb-5 flex items-center justify-between">
          <SkeletonLine w="5rem" h="0.875rem" />
          <div className="flex gap-2"><Skeleton line className="h-8 w-[3.5rem]" /><Skeleton line className="h-8 w-[8rem]" /></div>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(18rem, 1fr))' }}>
          {Array.from({ length: 12 }, (_, i) => <div key={i} className="flex gap-3 rounded-xl border border-[#2e2417] p-3">
            <Skeleton raised className="h-10 w-10 shrink-0" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <SkeletonLine w="5rem" h="1rem" />
              <SkeletonLine w="95%" h="0.75rem" />
              <SkeletonLine w="70%" h="0.75rem" />
              <div className="flex gap-1.5 pt-1"><Skeleton className="h-5 w-16" /><Skeleton className="h-5 w-11" /><Skeleton className="h-5 w-20" /></div>
            </div>
          </div>)}
        </div>
      </div>
    </div>
  </SkeletonPage>
}
