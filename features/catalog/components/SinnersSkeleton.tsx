import Skeleton, { SkeletonPage } from '@/components/ui/Skeleton'
import { PageHeaderSkeleton } from '@/components/ui/PageHeader'
import lineup from './SinnerLineup.module.css'

/** The lineup's own boxes (SinnerLineup.module.css): twelve columns on a wide screen, twelve rows on a phone. */
export function SinnersSkeleton() {
  return <SkeletonPage className="mx-auto min-h-screen max-w-7xl px-6 pb-16 pt-[5.5rem]">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <PageHeaderSkeleton titleWidth="7rem" className="!mb-0" />
      <div className="flex gap-2"><Skeleton line className="h-10 w-[8rem]" /><Skeleton line className="h-10 w-[8.5rem]" /></div>
    </div>
    <ol className={lineup.lineup}>
      {Array.from({ length: 12 }, (_, i) => <li key={i} className={lineup.slot}><div className={lineup.column}><Skeleton className="h-full w-full !rounded-none" /></div></li>)}
    </ol>
  </SkeletonPage>
}
