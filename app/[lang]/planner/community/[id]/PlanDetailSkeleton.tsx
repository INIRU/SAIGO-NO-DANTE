import Skeleton, { SkeletonLine, SkeletonPage } from '@/components/ui/Skeleton'
import DetailPageSkeleton, { DeckInsightsSkeleton, FormationBoardSkeleton, SectionHeadSkeleton } from '@/components/ui/DetailPageSkeleton'
import { HtmlFlag } from '@/hooks/useHtmlFlag'
import styles from './PlanDetailHeader.module.css'

const GiftRow = ({ n }: { n: number }) => <div className={styles.giftGrid}>{Array.from({ length: n }, (_, i) => <div key={i} className="flex flex-col items-center px-1.5 pb-1.5 pt-2"><Skeleton className="w-full max-w-[5rem]" style={{ aspectRatio: '1' }} /><SkeletonLine w="70%" h="0.6875rem" className="mt-1.5" /></div>)}</div>
const SubHead = () => <div className="mb-3 flex h-[1.6rem] items-center justify-between"><SkeletonLine w="5rem" h="1.0625rem" /><SkeletonLine w="2rem" h="0.875rem" /></div>

/**
 * Plan detail placeholder with the page's own outline (hero, section nav, deck board, blessings, gifts, floor plan,
 * final gifts), at least one screen tall, so loading never collapses the page or toggles the scrollbar.
 */
export default function PlanDetailSkeleton() {
  return <div data-plan-detail className="min-h-screen bg-[var(--bg-deep)] pb-20 pt-24">
    <HtmlFlag name="with-plan-detail" />
    <SkeletonPage>
      <DetailPageSkeleton s={styles} actions={['4.5rem', '4.2rem', '7.5rem', '4.2rem']} nav={['3.5rem', '1.8rem', '2.5rem', '3.6rem', '4.6rem', '2.4rem']}>
        <section className={styles.section}>
          <SectionHeadSkeleton w="5rem" />
          <div className="mb-4 flex items-end justify-between gap-4 shadow-[inset_0_-1px_0_#2e2417]">
            <div className="flex">{['3.2rem', '3.6rem', '3.4rem'].map((w, i) => <div key={i} className={`flex min-h-11 items-center border-b-2 px-3.5 first:pl-0.5 ${i === 0 ? 'border-[var(--gold)]' : 'border-transparent'}`}><SkeletonLine w={w} h="0.9375rem" /></div>)}</div>
            <SkeletonLine w="7rem" h="0.8125rem" className="mb-2 hidden sm:block" />
          </div>
          <FormationBoardSkeleton className="mt-2" />
          <DeckInsightsSkeleton />
        </section>
        <section className={styles.section}>
          <SectionHeadSkeleton w="5rem" meta="6rem" />
          <div className="grid grid-cols-2 justify-center gap-1.5 pt-3 lg:grid-cols-[repeat(5,minmax(0,17rem))] lg:gap-2">{Array.from({ length: 10 }, (_, i) => <Skeleton key={i} line style={{ aspectRatio: '272 / 336' }} />)}</div>
        </section>
        <section className={styles.section}>
          <SectionHeadSkeleton w="3.5rem" />
          <div className="grid gap-8 md:grid-cols-2 md:gap-0">
            <div className="min-w-0 md:pr-8"><SubHead /><GiftRow n={3} /></div>
            <div className="min-w-0 md:border-l md:border-[#2e2417] md:pl-8"><SubHead /><GiftRow n={3} /></div>
          </div>
        </section>
        <section className={styles.section}>
          <SectionHeadSkeleton w="5rem" meta="3rem" />
          <SkeletonLine w="min(20rem, 80%)" h="0.9375rem" className="-mt-4 mb-6" />
          <div className="flex items-center justify-between px-1 py-2"><SkeletonLine w="2rem" h="1rem" /><SkeletonLine w="5rem" h="0.875rem" /></div>
          <div className="mt-3 space-y-3">{Array.from({ length: 3 }, (_, i) => <div key={i} className="grid grid-cols-[5rem_minmax(0,1fr)] items-start gap-4 rounded-lg bg-[var(--bg-card)] p-4 md:grid-cols-[2rem_7rem_minmax(0,1fr)] md:gap-5 md:p-6">
            <SkeletonLine w="1.4rem" h="1rem" raised className="hidden md:block" />
            <Skeleton raised className="w-full" style={{ aspectRatio: '416 / 684' }} />
            <div className="min-w-0 space-y-2"><SkeletonLine w="6rem" h="1.5rem" raised /><SkeletonLine w="8rem" h="1.25rem" raised /><div className="flex gap-1.5 pt-2">{Array.from({ length: 3 }, (_, j) => <Skeleton key={j} raised className="h-14 w-14" />)}</div></div>
          </div>)}</div>
        </section>
        <section className={styles.section}>
          <SectionHeadSkeleton w="5rem" meta="2rem" />
          <GiftRow n={8} />
        </section>
      </DetailPageSkeleton>
    </SkeletonPage>
  </div>
}
