import Skeleton, { SkeletonLine, SkeletonPage } from '@/components/ui/Skeleton'
import { DeckInsightsSkeleton, FormationBoardSkeleton } from '@/components/ui/DetailPageSkeleton'

const field = 'h-[2.53rem] sm:h-[2.24rem]'

/** 덱 작성/수정: 실제 페이지의 deck-workspace 격자 클래스를 그대로 써서 뒤로가기·제목·콘텐츠 유형·코드/액션 줄이 같은 자리에 온다. 편성 영역은 6×2 보드 + 아래에서 올라오는 편성 패널 막대 + 키워드 칩 + 통계. */
export default function DeckBuilderSkeleton() {
  return <SkeletonPage className="min-h-[100dvh] pb-20 pt-24 sm:pt-28" style={{ background: 'var(--bg-deep)' }}>
    <div className="deck-workspace mx-auto max-w-6xl px-3 sm:px-6">
      <header className="mb-6" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="deck-workspace-header py-4">
          <div className="deck-workspace-heading">
            <div className="min-w-0"><div className="mb-0.5 flex min-h-10 items-center px-1 sm:min-h-11"><SkeletonLine w="5rem" h="0.9375rem" /></div></div>
            <div className="deck-workspace-actions flex flex-wrap items-center gap-2">
              <div className="deck-workspace-code"><Skeleton line className={`min-w-0 flex-1 ${field}`} /><Skeleton line className={`w-[2.6rem] ${field}`} /></div>
              <Skeleton line className="h-[2.25rem] w-[5.1rem] sm:w-[8.8rem]" />
              <Skeleton line className="h-[2.53rem] w-[4.9rem]" />
              <Skeleton className="h-[2.53rem] w-[4.2rem]" style={{ background: 'rgba(200,144,10,0.35)' }} />
            </div>
          </div>
          <div className="deck-workspace-fields">
            <div className="flex min-w-0 flex-col gap-1.5"><div className="flex h-[1.3rem] items-center"><SkeletonLine w="3.5rem" h="0.75rem" /></div><Skeleton line className={field} /></div>
            <div className="min-w-0"><div className="mb-1.5 flex h-[1.3rem] items-center"><SkeletonLine w="6rem" h="0.75rem" /></div><Skeleton line className="h-[2.75rem]" /></div>
          </div>
        </div>
      </header>
      <div className="deck-workspace-formation">
        <div className="mb-4 flex border-b border-[#2e2417]">{['7rem', '7.5rem', '4.5rem'].map((w, i) => <div key={i} className="flex h-[2.8rem] items-center px-3" style={{ borderBottom: i === 0 ? '2px solid var(--gold)' : '2px solid transparent', marginBottom: '-1px' }}><SkeletonLine w={`calc(${w} - 1.5rem)`} h="0.9rem" /></div>)}</div>
        <div className="flex h-8 items-center justify-end"><SkeletonLine w="5.5rem" h="0.8125rem" /></div>
        <FormationBoardSkeleton className="mt-2" />
        <div className="mt-2 flex h-11 items-center justify-center rounded border border-[#5a4526]"><SkeletonLine w="6rem" h="0.9375rem" /></div>
        <div className="mt-4 flex gap-1.5 overflow-hidden">{Array.from({ length: 12 }, (_, i) => <Skeleton key={i} line className="h-7 w-[3.4rem] shrink-0" />)}</div>
        <DeckInsightsSkeleton />
      </div>
    </div>
  </SkeletonPage>
}
