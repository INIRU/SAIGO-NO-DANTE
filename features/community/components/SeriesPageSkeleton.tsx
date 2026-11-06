import { SkeletonLine, SkeletonPage, SkeletonPoster } from '@/components/ui/Skeleton'
import styles from '@/styles/components/SeriesPage.module.css'

/** 시리즈 페이지: 뒤로 가기, 제목·작성자·수치 머리말, 번호가 붙은 카드 격자. page.tsx와 같은 컨테이너·격자를 쓴다. */
export default function SeriesPageSkeleton() {
  return (
    <SkeletonPage className="min-h-screen bg-[var(--bg-deep)] pb-20 pt-24">
      <div className="mx-auto w-full max-w-7xl px-3 sm:px-6">
        <div className="mb-5 flex min-h-[44px] items-center"><SkeletonLine w="5rem" h="0.9375rem" /></div>
        <div className={styles.head}>
          <div>
            <SkeletonLine w="min(20rem, 80%)" h="2.25rem" />
            <div className="mt-[0.875rem] flex h-9 items-center"><SkeletonLine w="8rem" h="0.9375rem" /></div>
          </div>
          <div className="flex h-12 items-end"><SkeletonLine w="7rem" h="2.5rem" /></div>
        </div>
        <div className={styles.list}>
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="flex flex-col gap-[0.625rem]">
              <SkeletonLine w="4rem" h="1.6rem" />
              <SkeletonPoster ratio="17 / 12" line />
            </div>
          ))}
        </div>
      </div>
    </SkeletonPage>
  )
}
