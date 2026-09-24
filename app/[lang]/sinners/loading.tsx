import Skeleton, { SkeletonLine, SkeletonPage } from '@/components/ui/Skeleton'
import { PageHeaderSkeleton } from '@/components/ui/PageHeader'

export default function Loading() {
  return <SkeletonPage className="mx-auto min-h-screen max-w-7xl px-6 pb-16 pt-[5.5rem]">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <PageHeaderSkeleton titleWidth="7rem" className="!mb-0" />
      <div className="flex gap-2"><Skeleton line className="h-10 w-[8rem]" /><Skeleton line className="h-10 w-[8.5rem]" /></div>
    </div>
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {Array.from({ length: 12 }, (_, i) => <div key={i} className="overflow-hidden rounded-lg border border-[#2e2417]">
        <Skeleton className="!rounded-none" style={{ aspectRatio: '3 / 4' }} />
        <div className="flex h-9 items-center border-t border-[#2e2417] px-3"><SkeletonLine w="70%" h="0.625rem" /></div>
      </div>)}
    </div>
  </SkeletonPage>
}
