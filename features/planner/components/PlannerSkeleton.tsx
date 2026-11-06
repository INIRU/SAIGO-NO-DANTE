import Skeleton, { SkeletonLine, SkeletonPage } from '@/components/ui/Skeleton'
import { PageHeaderSkeleton } from '@/components/ui/PageHeader'
import { FormationBoardSkeleton } from '@/components/ui/DetailPageSkeleton'

const ACTIONS = ['7.3rem', '5.9rem', '8.7rem', '4.7rem']
/** 구역 목차 라벨 폭: 플랜 소개, 덱 편성(+0/12), 가호, 기프트, 층별 계획 */
const SECTIONS = ['3.6rem', '5.6rem', '1.8rem', '2.4rem', '3.6rem']
const TOOLS = ['2.6rem', '2.6rem', '3.8rem', '3.8rem', '2.2rem', '4.6rem']

/** 플래너 본문: 액션 줄 + 구역 목차(좁은 화면 가로 탭, 넓은 화면 왼쪽 레일) + 플랜 소개(제목 입력·노트 편집기) + 덱 편성(하위 탭·키워드 칩·6×2 보드·편성 막대). header: route loading에서 서버 제목 자리까지 채운다. */
export default function PlannerSkeleton({ header = false }: { header?: boolean }) {
  return <SkeletonPage className="min-h-[100dvh] pb-16" style={{ background: 'var(--bg-deep)' }}>
    {header && <div className="mx-auto max-w-[90rem] px-3 pt-[5.5rem] md:px-6">
      <PageHeaderSkeleton titleWidth="11rem" description={false} />
    </div>}
    <div className="mx-auto max-w-[90rem] px-3 md:px-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex h-[1.6rem] items-center"><SkeletonLine w="6.5rem" h="0.875rem" /></div>
        <div className="flex flex-wrap items-center gap-2">
          {ACTIONS.map((w, i) => <Skeleton key={i} line={i > 0} className="h-[2.25rem]" style={{ width: w, background: i === 0 ? 'rgba(200,144,10,0.35)' : undefined }} />)}
        </div>
      </div>
      <div className="-mx-3 flex gap-1 overflow-hidden border-b border-[#5a4526] px-3 md:-mx-6 md:px-6 lg:hidden">
        {SECTIONS.map((w, i) => <div key={i} className="-mb-px flex h-12 shrink-0 items-center border-b-2 px-3 first:pl-0" style={{ borderColor: i === 0 ? 'var(--gold)' : 'transparent' }}>
          <Skeleton className="h-3.5" style={{ width: w }} />
        </div>)}
      </div>
      <div className="relative">
      <div className="absolute left-0 top-7 hidden w-44 border-l border-[#2e2417] lg:block">
        {SECTIONS.map((w, i) => <div key={i} className="-ml-px flex h-11 items-center border-l-2 pl-3" style={{ borderColor: i === 0 ? 'var(--gold)' : 'transparent' }}>
          <Skeleton className="h-3.5" style={{ width: w }} />
        </div>)}
      </div>
      <div className="min-w-0 lg:pl-[13.5rem]">
        <div style={{ paddingTop: '1.75rem', paddingBottom: '1rem' }}>
          <div className="mb-4 flex h-[2.06rem] items-center gap-3"><Skeleton className="h-[1.375rem] w-[5.5rem]" /><SkeletonLine w="10rem" h="0.8125rem" className="hidden sm:block" /></div>
          <div className="space-y-3">
            <div className="flex h-[3.78rem] items-center rounded-md border border-[#2e2417] px-4"><Skeleton raised className="h-[1.125rem] w-[5rem]" /></div>
            <div className="overflow-hidden rounded-md border border-[#2e2417]">
              <div className="flex h-[10.5rem] flex-wrap content-center items-center gap-x-4 gap-y-3 border-b border-[#2e2417] px-4 sm:h-[3.3rem] sm:flex-nowrap">
                {TOOLS.map((w, i) => <SkeletonLine key={i} w={w} h="0.875rem" />)}
                <SkeletonLine w="4rem" h="0.875rem" className="sm:ml-auto" />
              </div>
              <div className="flex h-[1.4rem] items-center px-3"><SkeletonLine w="9rem" h="0.625rem" /></div>
              <div className="h-[7rem] px-6 pt-5"><SkeletonLine w="16rem" h="0.9375rem" /></div>
            </div>
          </div>
        </div>
        <div style={{ marginTop: '1.5rem', paddingTop: '2.5rem', borderTop: '1px solid #2e2417' }}>
          <div className="mb-4 flex h-[2.06rem] items-center"><Skeleton className="h-[1.375rem] w-[5rem]" /></div>
          <div className="mb-3 flex items-center justify-between border-b border-[#2e2417]">
            <div className="flex">{['2.4rem', '3rem', '4rem'].map((w, i) => <div key={i} className={`-mb-px flex h-10 items-center border-b-2 px-2.5 ${i === 0 ? 'border-[var(--gold)]' : 'border-transparent'}`}><SkeletonLine w={w} h="0.875rem" /></div>)}</div>
            <SkeletonLine w="2.5rem" h="0.75rem" />
          </div>
          <div className="flex gap-1.5 overflow-hidden">{Array.from({ length: 12 }, (_, i) => <Skeleton key={i} line className="h-7 w-[3.4rem] shrink-0" />)}</div>
          <FormationBoardSkeleton className="mt-6" />
          <Skeleton line className="mt-2 h-11 w-full" />
        </div>
      </div>
      </div>
    </div>
  </SkeletonPage>
}
