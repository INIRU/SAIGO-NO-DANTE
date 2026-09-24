import Skeleton, { SkeletonCircle, SkeletonLine, SkeletonPage } from '@/components/ui/Skeleton'
import { HtmlFlag } from '@/hooks/useHtmlFlag'
import './support.css'

const GOLD = { background: 'rgba(200,144,10,0.35)' }

/** 문의 목록 줄 자리 (목록을 불러오는 동안). */
export function SupportRowsSkeleton() {
  return <div aria-hidden="true">{['70%', '55%', '62%'].map((w, i) => <div key={i} className="desk-row">
    <div className="flex items-center justify-between gap-3"><SkeletonLine w={w} h="0.9375rem" raised /><Skeleton raised className="h-5 w-10 shrink-0" /></div>
    <SkeletonLine w="85%" h="0.8125rem" raised />
    <SkeletonLine w="3.5rem" h="0.75rem" raised />
  </div>)}</div>
}

/** /support 첫 화면: 실제 desk 클래스로 전체 화면 목록 패널 + 빈 상세 영역. */
export default function SupportSkeleton() {
  return <section className="support-desk is-page">
    <HtmlFlag name="with-support-page" />
    <HtmlFlag name="with-compact-footer" />
    <SkeletonPage className="desk-workspace">
      <aside className="desk-list">
        <div className="desk-list-head">
          <div className="flex min-h-8 items-center gap-2"><SkeletonCircle size="1.6rem" raised /><SkeletonLine w="3rem" h="0.875rem" raised /></div>
          <div className="flex items-center justify-between gap-3"><Skeleton raised className="h-8 w-16" /><Skeleton className="h-[2.9rem] w-[6.4rem]" style={GOLD} /></div>
        </div>
        <div className="desk-list-scroll"><SupportRowsSkeleton /></div>
      </aside>
      <div className="desk-detail">
        <div className="desk-empty"><Skeleton className="h-8 w-8" /><SkeletonLine w="14rem" h="0.9375rem" /><Skeleton className="h-[2.9rem] w-[6.4rem]" style={GOLD} /></div>
      </div>
    </SkeletonPage>
  </section>
}
