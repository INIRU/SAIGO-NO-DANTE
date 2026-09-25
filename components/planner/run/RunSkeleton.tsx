import Skeleton, { SkeletonCircle, SkeletonLine, SkeletonPage } from '@/components/ui/Skeleton'

/** 어시스트 모드 준비 화면: 왼쪽 화면 연결 안내, 오른쪽 기록 설정 패널. */
export default function RunSkeleton() {
  return <SkeletonPage className="min-h-screen bg-[var(--bg-deep)]">
    <div className="mx-auto max-w-[90rem] px-4 pb-12 pt-4 sm:px-6 sm:pt-6 lg:px-8">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-[8.5rem] sm:w-[10.9rem]" />
        </div>
        <Skeleton line className="h-9 w-[7.5rem] sm:w-[8.8rem]" />
      </div>
      <div className="grid min-w-0 gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="mb-3 flex h-[2.12rem] items-center"><Skeleton className="h-7 w-[8.8rem]" /></div>
          <div className="space-y-2">
            {['17rem', '22rem', '16rem', '11rem'].map((w, i) => <div key={i} className={`grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-3 rounded-md border px-2 py-2 ${i === 1 ? 'border-[var(--border-gold)] bg-[var(--bg-elevated)]' : 'border-transparent'}`}>
              <SkeletonCircle size="2rem" raised={i === 1} />
              {i === 1
                ? <div className="flex h-14 flex-col justify-around sm:h-8 sm:justify-center"><SkeletonLine w={w} h="1rem" raised /><SkeletonLine w="4.5rem" h="1rem" raised className="sm:hidden" /></div>
                : <SkeletonLine w={w} h="1rem" />}
            </div>)}
          </div>
          <Skeleton line className="mt-4 w-full" style={{ aspectRatio: '1919 / 1079' }} />
        </div>
        <div className="min-w-0 self-start border-t-2 border-[var(--gold)] bg-[var(--bg-panel)] p-4 sm:p-6">
          <Skeleton raised className="h-9 w-[7.4rem]" />
          <div className="mt-5 space-y-6">
            <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2.5">
              <SkeletonLine w="5rem" h="0.75rem" />
              <Skeleton className="h-10 w-[5.5rem]" />
            </div>
            <div>
              <SkeletonLine w="3rem" h="1rem" raised className="mb-2" />
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} raised className="h-14" style={i === 1 ? { background: 'rgba(200,144,10,0.35)' } : undefined} />)}</div>
            </div>
            <div>
              <SkeletonLine w="3.5rem" h="1rem" raised className="mb-2" />
              <div className="flex gap-1.5">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} raised className="h-11 w-11" style={i === 0 ? { background: 'rgba(200,144,10,0.35)' } : undefined} />)}</div>
            </div>
            <Skeleton raised className="h-11 w-full" />
            <div className="border-t border-[var(--border)] pt-5"><Skeleton className="h-14 w-full" style={{ background: 'rgba(200,144,10,0.35)' }} /></div>
          </div>
        </div>
      </div>
    </div>
  </SkeletonPage>
}
