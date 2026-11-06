import Skeleton, { SkeletonLine, SkeletonPage } from '@/components/ui/Skeleton'

/** The shape of a BoardCard: the 6×2 portraits, the title and tag lines, and the 44px footer. `phoneRows` is 1 for the list view. */
export function BoardCardSkeleton({ phoneRows = 2 }: { phoneRows?: 1 | 2 }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#2e2417] bg-[#17120c]">
      <div className="grid grid-cols-6 gap-px border-b border-[#2e2417]">
        {Array.from({ length: 12 }, (_, tile) => <Skeleton key={tile} raised className={`!rounded-none ${phoneRows === 1 && tile >= 6 ? 'max-md:hidden' : ''}`} style={{ aspectRatio: '3 / 4' }} />)}
      </div>
      <div className="flex flex-col gap-1.5 px-3 pb-2 pt-2.5">
        <div className="flex h-[1.375rem] items-center"><SkeletonLine w="60%" h="1rem" raised /></div>
        <div className="flex h-5 items-center"><SkeletonLine w="85%" h="0.75rem" raised /></div>
        <div className="flex h-6 items-center gap-1"><Skeleton raised className="h-full w-16" /><Skeleton raised className="h-full w-12" /></div>
      </div>
      <div className="flex h-11 items-center border-t border-[#2e2417] px-3"><SkeletonLine w="6rem" h="0.8125rem" raised /></div>
    </div>
  )
}

/** The card grid of the list view while it loads. */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
      {Array.from({ length: count }, (_, index) => <BoardCardSkeleton key={index} phoneRows={1} />)}
    </div>
  )
}

/** A shelf's cards as a swipe rail on a phone, a grid from md up (the same boxes as `Rail`). */
export function RailSkeleton() {
  return (
    <div className="-mx-4 flex gap-3 overflow-hidden px-4 md:mx-0 md:grid md:grid-cols-2 md:gap-4 md:px-0 xl:grid-cols-3">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="w-[78vw] max-w-[21rem] shrink-0 md:w-auto md:max-w-none md:min-w-0"><BoardCardSkeleton /></div>
      ))}
    </div>
  )
}

/** The board's first screen while it loads: the first two shelves and the identity row, titles and cards in their final places. */
export function BoardShelfSkeleton() {
  return (
    <SkeletonPage className="pb-16">
      <div data-board-skeleton className="mx-auto max-w-7xl space-y-8 px-4 md:space-y-10 md:px-6">
        {[0, 1].map(index => (
          <section key={index}>
            <div className="mb-3 flex min-h-11 items-center gap-3"><SkeletonLine w="9rem" h="1.25rem" />{index === 0 && <SkeletonLine w="3.5rem" h="1rem" className="ml-auto" />}</div>
            <RailSkeleton />
          </section>
        ))}
        <section data-shelf-skeleton="identities">
          <div className="mb-3 flex min-h-[1.8125rem] items-center"><SkeletonLine w="10rem" h="1.25rem" /></div>
          <IdentityRowSkeleton />
        </section>
      </div>
    </SkeletonPage>
  )
}

/** The identity row (frame cards with a value under each) while it loads: one swipe row on a phone, the whole width from md. */
export function IdentityRowSkeleton({ count = 9 }: { count?: number }) {
  return (
    <ul className="-mx-4 flex gap-3 overflow-hidden px-4 pb-1 md:mx-0 md:gap-4 md:px-0" data-identity-row-skeleton>
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="w-24 shrink-0 md:w-auto md:max-w-[9.5rem] md:min-w-0 md:flex-1">
          <Skeleton raised className="w-full" style={{ aspectRatio: '290 / 428' }} />
          <div className="mt-1.5 flex h-[1.375rem] items-center justify-center"><SkeletonLine w="2.25rem" h="1.125rem" /></div>
        </li>
      ))}
    </ul>
  )
}

/** The "지금 뜨는" shelf while its feed loads: the title, three cards and the identity row. It goes away if nothing is rising. */
export function RisingShelfSkeleton() {
  return (
    <SkeletonPage>
      <section data-shelf-skeleton="rising" className="space-y-5">
        <div className="mb-3 flex min-h-[1.8125rem] items-center"><SkeletonLine w="6rem" h="1.25rem" /></div>
        <RailSkeleton />
        <IdentityRowSkeleton />
      </section>
    </SkeletonPage>
  )
}
