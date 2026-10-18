import { SkeletonLine, SkeletonPage, SkeletonPoster } from '@/components/ui/Skeleton'

/** 시리즈 페이지: 제목 줄, 작성자 줄, 카드 격자. page.tsx와 같은 컨테이너·격자를 쓴다. */
export default function SeriesPageSkeleton() {
  return (
    <SkeletonPage className="min-h-screen bg-[#0d0b08] pb-20 pt-24">
      <div className="mx-auto grid w-full max-w-7xl gap-5 px-3 sm:px-6">
        <header>
          <div className="flex h-[1.71875rem] items-center md:h-[2.1875rem]"><SkeletonLine w="14rem" h="75%" /></div>
          <div className="mt-1 flex h-[1.4rem] items-center"><SkeletonLine w="8rem" h="0.9375rem" /></div>
        </header>
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(17rem,1fr))]">
          {Array.from({ length: 6 }, (_, index) => <SkeletonPoster key={index} ratio="17 / 12" line />)}
        </div>
      </div>
    </SkeletonPage>
  )
}
