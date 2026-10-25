import { SkeletonLine, SkeletonPage } from '@/components/ui/Skeleton'
import DetailPageSkeleton, { DeckInsightsSkeleton, FormationBoardSkeleton, SectionHeadSkeleton } from '@/components/ui/DetailPageSkeleton'
import styles from '@/app/[lang]/decks/[id]/DeckDetail.module.css'

/** 덱 상세: 히어로(키워드·제목·작성자·수치·명령 줄), 구역 목차, 편성 보드, 키워드 분포, 통계, 노트. */
export default function DeckDetailSkeleton() {
  return <SkeletonPage className="min-h-screen bg-[var(--bg-deep)] pb-20 pt-24">
    <DetailPageSkeleton s={styles} facts={5} actions={['4.2rem', '3.6rem', '3.6rem', '6.4rem']} nav={['3rem', '3rem', '3rem', '1.8rem']}>
      <section className={styles.section}>
        <SectionHeadSkeleton w="5rem" meta="13rem" />
        <FormationBoardSkeleton />
        <DeckInsightsSkeleton />
      </section>
      <section className={styles.section}>
        <SectionHeadSkeleton w="5rem" />
        <SkeletonLine w="min(30rem, 90%)" h="0.9375rem" />
        <SkeletonLine w="min(18rem, 60%)" h="0.9375rem" className="mt-2.5" />
      </section>
    </DetailPageSkeleton>
  </SkeletonPage>
}
