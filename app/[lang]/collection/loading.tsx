import Skeleton, { SkeletonCircle, SkeletonLine, SkeletonPage } from '@/components/ui/Skeleton'
import { PageHeaderSkeleton } from '@/components/ui/PageHeader'

export default function Loading() {
  return <SkeletonPage className="min-h-screen px-6 pb-16 pt-[5.5rem]">
    <div className="mx-auto max-w-5xl">
      <PageHeaderSkeleton titleWidth="8rem" />
      <div className="mb-4 mt-8 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3"><SkeletonLine w="7rem" h="0.75rem" /><Skeleton className="h-5 w-[4.5rem]" /></div>
        <SkeletonLine w="9.5rem" h="0.75rem" />
      </div>
      <div className="overflow-hidden rounded-lg border border-[#2e2417] bg-[#120e09]">
        <div className="flex gap-2 overflow-hidden border-b border-[#2e2417] p-3">
          {Array.from({ length: 12 }, (_, i) => <div key={i} className={`flex h-[5.6rem] w-[3.5rem] shrink-0 flex-col items-center justify-center gap-1.5 rounded border ${i === 0 ? 'border-[var(--gold-dim)]' : 'border-transparent'}`}>
            <SkeletonCircle size="2rem" raised /><SkeletonLine w="2.6rem" h="0.7rem" raised /><SkeletonLine w="2rem" h="0.6rem" raised />
          </div>)}
        </div>
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap gap-1.5">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} raised className="h-7 w-[3.6rem]" />)}</div>
          <div className="flex flex-wrap items-center gap-2 border-t border-[#2e2417] pt-4"><Skeleton raised className="h-8 w-[5.5rem]" /><Skeleton raised className="h-8 w-[5.5rem]" /><Skeleton raised className="ml-auto h-8 w-[6rem]" /></div>
          <div className="flex gap-2"><Skeleton raised className="h-8 w-[7rem]" /><Skeleton raised className="h-8 w-[7.5rem]" /></div>
          <SkeletonLine w="3.5rem" h="1rem" raised />
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">{Array.from({ length: 12 }, (_, i) => <Skeleton key={i} raised style={{ aspectRatio: '3 / 4' }} />)}</div>
        </div>
      </div>
    </div>
  </SkeletonPage>
}
