import Skeleton, { SkeletonLine, SkeletonPage } from '@/components/ui/Skeleton'

export default function Loading() {
  return <SkeletonPage className="min-h-[100dvh] pb-16 pt-[4.75rem] sm:pt-24">
    <div className="mx-auto max-w-[90rem] px-5 sm:px-8">
      <div className="mb-2 flex min-h-11 items-center gap-2 sm:mb-8"><Skeleton className="h-4 w-4" /><SkeletonLine w="4.5rem" h="0.8rem" /><SkeletonLine w="2.5rem" h="0.8rem" /></div>
      <div className="grid grid-cols-1 gap-5 sm:gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="self-start rounded-md border-t border-[rgba(200,144,10,0.22)] bg-[#14120e] p-3 sm:p-6">
          <div className="flex gap-4 lg:block">
            <Skeleton raised className="w-16 shrink-0 sm:w-24 lg:mb-6 lg:w-full" style={{ aspectRatio: '3 / 4' }} />
            <div className="min-w-0 flex-1 space-y-1.5 sm:space-y-2">
              <div className="flex items-center gap-2"><Skeleton raised className="h-[1.4rem] w-[1.4rem] sm:h-9 sm:w-9" /><Skeleton raised className="h-[1.4rem] w-[5rem] sm:h-8" /></div>
              <SkeletonLine w="6rem" h="0.75rem" raised />
              <SkeletonLine w="100%" h="0.8rem" raised />
              <SkeletonLine w="60%" h="0.8rem" raised className="hidden sm:block" />
              <div className="!mt-2 border-l-2 border-[var(--gold-dim)] py-1.5 pl-3 sm:!mt-4 sm:py-2"><SkeletonLine w="80%" h="0.7rem" raised /></div>
            </div>
          </div>
        </div>
        <div className="min-w-0">
          <div className="mb-4 flex gap-7 border-b border-[#2e2417]">{['2.6rem', '3.2rem'].map((w, i) => <div key={i} className={`-mb-px flex min-h-11 items-center border-b-2 ${i === 0 ? 'border-[var(--gold)]' : 'border-transparent'}`}><SkeletonLine w={w} h="1rem" /></div>)}</div>
          <Skeleton line className="mb-3 h-11 w-full" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Skeleton line className="h-9 w-[7.5rem]" />
            <div className="flex gap-2"><Skeleton line className="h-9 w-[3.5rem]" /><Skeleton line className="h-9 w-[3.5rem]" /><Skeleton line className="h-9 w-[4.5rem]" /></div>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-x-3 gap-y-6 md:grid-cols-4 xl:grid-cols-6">{Array.from({ length: 12 }, (_, i) => <Skeleton key={i} line style={{ aspectRatio: '290 / 428' }} />)}</div>
        </div>
      </div>
    </div>
  </SkeletonPage>
}
