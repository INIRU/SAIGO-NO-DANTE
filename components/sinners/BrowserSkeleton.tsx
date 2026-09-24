import Skeleton, { SkeletonLine, SkeletonPage } from '@/components/ui/Skeleton'

const Label = ({ w }: { w: string }) => <SkeletonLine w={w} h="0.6875rem" />

/** /sinners/identities, /sinners/ego: BrowserHeader(뒤로·제목, 개수·정렬) + 16rem 필터 레일 + 2/3/4/6열 카드 격자(290:428 프레임 + 수치 한 줄). */
export default function BrowserSkeleton() {
  return <SkeletonPage className="mx-auto min-h-[100dvh] max-w-7xl px-4 pb-16 pt-[5.5rem] md:px-6">
    <div className="mb-6">
      <div className="mb-3 flex h-[1.71875rem] items-center gap-3 md:h-[2.1875rem]"><Skeleton className="h-5 w-5" /><Skeleton className="h-[75%] w-[7rem]" /></div>
      <div className="flex items-center justify-between"><SkeletonLine w="5rem" h="0.8125rem" /><Skeleton line className="h-9 w-[6rem]" /></div>
    </div>
    <div className="flex gap-6">
      <aside className="hidden w-[16rem] shrink-0 flex-col gap-4 pr-3 lg:flex">
        <div className="space-y-2"><Label w="3.5rem" /><Skeleton line className="h-9" /></div>
        <div className="space-y-2"><Label w="2.5rem" /><div className="grid grid-cols-4 gap-1.5">{Array.from({ length: 12 }, (_, i) => <Skeleton key={i} line style={{ aspectRatio: '1' }} />)}</div></div>
        <div className="space-y-2"><Label w="2rem" /><div className="grid grid-cols-3 gap-1.5">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} line className="h-[2.6rem]" />)}</div></div>
        <div className="space-y-2"><Label w="2rem" /><div className="grid grid-cols-4 gap-1.5">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} line className="h-8" />)}</div></div>
        <div className="space-y-2"><Label w="3.5rem" /><div className="grid grid-cols-4 gap-1.5">{Array.from({ length: 7 }, (_, i) => <Skeleton key={i} line style={{ aspectRatio: '1' }} />)}</div></div>
      </aside>
      <div className="grid min-w-0 flex-1 grid-cols-2 content-start gap-x-3 gap-y-6 pt-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        {Array.from({ length: 18 }, (_, i) => <div key={i} className="min-w-0">
          <Skeleton line style={{ aspectRatio: '290 / 428' }} />
          <div className="mt-1.5 flex h-[1.6rem] items-center justify-around"><SkeletonLine w="1.4rem" h="0.75rem" /><SkeletonLine w="1.4rem" h="0.75rem" /><SkeletonLine w="1.4rem" h="0.75rem" /></div>
        </div>)}
      </div>
    </div>
  </SkeletonPage>
}

