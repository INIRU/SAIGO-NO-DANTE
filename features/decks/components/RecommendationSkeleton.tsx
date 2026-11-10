import Skeleton, { SkeletonLine, SkeletonPage } from '@/components/ui/Skeleton'
import { CardSkeleton } from '@/features/community/components/BoardSkeleton'

/** Loading shape of a `RecommendationLane`: the heading and its count, then the post cards on the same grid. Server-safe. */
export function RecommendationLaneSkeleton({ kind, count = 3 }: { kind: 'deck' | 'planner'; count?: number }) {
  return (
    <SkeletonPage className="min-w-0">
      <section data-recommendation-skeleton className="min-w-0">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex h-[1.4375rem] items-center"><SkeletonLine w="7rem" h="1.0625rem" /></div>
          <div className="flex h-[1.3125rem] items-center"><SkeletonLine w="2.5rem" h="0.875rem" /></div>
        </div>
        <div className="flex min-w-0 flex-wrap gap-3 [&>*]:min-w-0 [&>*]:flex-[1_1_15rem]">
          {Array.from({ length: count }, (_, index) => (
            <div key={index} className={`min-w-0 ${index >= 2 ? 'max-xl:hidden' : ''}`}><CardSkeleton kind={kind} /></div>
          ))}
        </div>
      </section>
    </SkeletonPage>
  )
}

/** Loading shape of the identity page's "함께 쓰는 인격" row and "이 인격을 쓴 인기 덱·플랜" lane. */
export function IdentityRecommendationsSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-8" data-identity-recommendations-skeleton>
      <SkeletonPage className="min-w-0">
        <div className="mb-3 flex h-[1.4375rem] items-center"><SkeletonLine w="8rem" h="1.0625rem" /></div>
        <div className="-mx-4 flex gap-3 overflow-hidden px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="w-[6.25rem] shrink-0 sm:w-[7rem]">
              <Skeleton raised className="w-full" style={{ aspectRatio: '290 / 428' }} />
              <div className="mt-1.5 flex h-5 items-center justify-center"><SkeletonLine w="1.5rem" h="1rem" /></div>
            </div>
          ))}
        </div>
      </SkeletonPage>
      <RecommendationLaneSkeleton kind="deck" />
    </div>
  )
}
