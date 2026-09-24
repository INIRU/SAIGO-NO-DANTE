import Skeleton, { SkeletonGift, SkeletonLine, SkeletonPage } from '@/components/ui/Skeleton'
import { PageHeaderSkeleton } from '@/components/ui/PageHeader'

const TABS = ['7.6rem', '6.5rem', '6.2rem']
const KEYWORDS = ['2.2rem', '3.4rem', '3.4rem', '3.4rem', '3.4rem', '3.4rem', '3.4rem', '3.4rem', '3.4rem', '3.4rem', '3.4rem', '2.8rem']

/** 거울 던전 첫 화면: 제목·소개·탭 + 기프트 탭의 고정 필터 한 줄과 아이콘 격자. */
export default function MirrorDungeonSkeleton() {
  return <SkeletonPage className="mx-auto min-h-screen max-w-7xl px-4 pb-16 pt-[5.5rem] md:px-6">
    <div className="mb-2">
      <PageHeaderSkeleton titleWidth="7.5rem" />
      <div className="flex" style={{ borderBottom: '1px solid #2e2417' }}>
        {TABS.map((w, i) => <div key={i} className="flex min-h-[3rem] flex-1 items-center justify-center px-3 pt-2 sm:flex-none sm:justify-start sm:px-5" style={{ borderBottom: `3px solid ${i === 0 ? 'var(--gold)' : 'transparent'}`, marginBottom: '-1px' }}>
          <Skeleton className="h-5" style={{ width: `calc(${w} - 2.5rem)` }} />
        </div>)}
      </div>
    </div>
    <div className="-mx-4 px-4 pb-2 pt-1 md:-mx-6 md:px-6" style={{ borderBottom: '1px solid #2e2417' }}>
      <div className="flex gap-1 overflow-hidden" style={{ borderBottom: '1px solid #2e2417' }}>
        {KEYWORDS.map((w, i) => <div key={i} className="flex h-10 shrink-0 items-center px-1.5 md:px-2" style={{ borderBottom: i === 0 ? '2px solid var(--gold)' : '2px solid transparent', marginBottom: '-1px' }}><Skeleton className="h-4" style={{ width: w }} /></div>)}
      </div>
      <div className="mt-2 flex items-center gap-2 sm:gap-x-3">
        <Skeleton line className="h-9 min-w-0 flex-1 sm:w-[13rem] sm:flex-none" />
        <Skeleton line className="h-9 w-[4.5rem] sm:hidden" />
        <div className="hidden items-center gap-0.5 sm:flex">{Array.from({ length: 6 }, (_, i) => <div key={i} className="flex h-9 w-[2.125rem] items-center justify-center"><Skeleton className="h-3.5 w-3" /></div>)}</div>
        <span className="hidden h-5 w-px bg-[#2e2417] sm:block" />
        {['4rem', '5rem', '4rem'].map((w, i) => <Skeleton key={i} line className="hidden h-9 sm:block" style={{ width: w }} />)}
        <SkeletonLine w="2.5rem" h="0.8125rem" className="shrink-0 sm:ml-auto" />
        <SkeletonLine w="4rem" h="0.8125rem" className="hidden sm:block" />
      </div>
    </div>
    <div className="mt-4">
      <div className="mb-2 flex items-center gap-2 pb-1.5" style={{ borderBottom: '1px solid #2e2417' }}>
        <SkeletonLine w="2.25rem" h="1.1rem" />
        <SkeletonLine w="1.5rem" h="1rem" />
      </div>
      <div className="grid overflow-hidden" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(3.625rem, 1fr))', gap: '0.5rem 0.375rem' }}>
        {Array.from({ length: 57 }, (_, i) => <SkeletonGift key={i} />)}
      </div>
    </div>
  </SkeletonPage>
}
