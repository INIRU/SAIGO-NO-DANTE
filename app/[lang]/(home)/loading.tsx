import Skeleton from '@/components/ui/Skeleton'

/**
 * Home loading skeleton, scoped to the (home) group so other sections keep their own boundaries.
 * Same column classes as HomeClient's hero plus the announcement bar under it, so nothing moves on first paint.
 */
export default function HomeLoading() {
  return (
    <div role="status" aria-busy="true" className="flex min-h-svh flex-col" style={{ background: 'var(--bg-deep)' }}>
      <div className="relative flex flex-1 overflow-hidden">
        <div className="absolute inset-y-0 right-0 hidden w-[62%] md:block" style={{ background: 'linear-gradient(100deg, transparent, rgba(200,144,10,0.05))' }} />
        <div className="relative z-10 flex w-full flex-col justify-end px-5 pb-8 pt-[30svh] sm:px-6 md:max-w-[40rem] md:justify-center md:px-16 md:pb-[clamp(3rem,7svh,6rem)] md:pt-[clamp(5rem,10svh,6rem)] lg:max-w-[46rem] lg:px-24">
          <div className="max-w-[32rem]">
            <div className="flex items-center gap-3 md:gap-5">
              <Skeleton className="h-[2.75rem] w-[2.75rem] shrink-0 !rounded-full md:h-[4.5rem] md:w-[4.5rem]" />
              <div className="flex h-[1.1em] items-center text-[length:clamp(2.75rem,11vw,3.5rem)] md:text-[4.75rem]"><Skeleton className="h-[0.72em] w-[5.7em]" /></div>
            </div>
            <div className="mt-3 flex h-[1.29rem] items-center md:mt-4 md:h-[1.46rem]"><Skeleton className="h-[0.9375rem] w-[10rem] md:h-[1.0625rem] md:w-[12rem]" /></div>
            <div className="mt-6 space-y-2 border-l-2 border-[rgba(200,144,10,0.55)] pl-3.5 md:mt-9 md:pl-4"><Skeleton className="h-3 w-10" /><Skeleton className="h-[1.3rem] w-[10rem]" /><Skeleton className="h-3 w-8" /></div>
            <div className="mt-6 grid grid-cols-2 gap-2 md:mt-8 md:gap-2.5">
              <Skeleton className="col-span-2 h-12 md:h-[3.25rem]" style={{ background: 'rgba(200,144,10,0.35)' }} />
              <Skeleton line className="h-12" />
              <Skeleton line className="h-12" />
            </div>
          </div>
        </div>
      </div>
      <div className="h-[2.875rem] shrink-0" style={{ borderBlock: '1px solid var(--border)', background: 'linear-gradient(100deg, rgba(200,144,10,0.09), var(--bg-deep))' }} />
    </div>
  )
}
