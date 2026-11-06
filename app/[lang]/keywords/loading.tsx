import Skeleton, { SkeletonLine, SkeletonPage } from '@/components/ui/Skeleton'
import { PageHeaderSkeleton } from '@/components/ui/PageHeader'
import { KeywordGridSkeleton } from './_components/KeywordGrid'

/** Mirrors KeywordsClient: header, sticky toolbar (category tabs + search row), card grid. */
export default function Loading() {
  return <SkeletonPage className="mx-auto min-h-[100dvh] max-w-7xl px-4 pb-16 pt-[5.5rem] md:px-6">
    <PageHeaderSkeleton titleWidth="7rem" description={false} />
    <div className="-mx-4 mb-4 border-b border-[#2e2417] px-4 pb-2 pt-1 md:-mx-6 md:px-6">
      <div className="-mx-4 flex gap-5 overflow-hidden border-b border-[#2e2417] px-4 md:mx-0 md:px-3">
        {['3.25rem', '4.75rem', '3.5rem', '4.25rem', '3.25rem', '3.25rem'].map((w, i) => <div key={i} className="-mb-px flex h-10 shrink-0 items-center"><SkeletonLine w={w} h="0.8125rem" /></div>)}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 sm:gap-x-3">
        <Skeleton line className="h-9 basis-full sm:basis-auto sm:w-[16rem]" />
        <div className="mr-auto flex h-5 items-center sm:ml-auto sm:mr-0"><SkeletonLine w="4.5rem" h="0.8125rem" /></div>
        <Skeleton line className="h-9 w-[4.625rem]" />
        <Skeleton line className="h-9 w-[8.5rem]" />
      </div>
    </div>
    <KeywordGridSkeleton />
  </SkeletonPage>
}
