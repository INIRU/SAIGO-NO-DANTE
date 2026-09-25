import Skeleton, { SkeletonPage } from '@/components/ui/Skeleton'

export default function Loading() {
  return <SkeletonPage className="mx-auto max-w-[80rem] px-4 pb-16 pt-[calc(64px+1.5rem)] md:px-6">
    <div className="mb-4 flex min-h-11 items-center justify-between gap-6"><Skeleton className="h-8 w-32" /><div className="flex gap-6"><Skeleton className="h-8 w-32" /><Skeleton className="h-8 w-32" /></div></div>
    <div className="grid gap-4">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(4.75rem,1fr))] gap-1.5">{Array.from({ length: 13 }, (_, i) => <Skeleton key={i} line className="h-[6.25rem] rounded-[0.625rem]" />)}</div>
      <div className="flex flex-wrap gap-1.5">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-9 w-[4.5rem] !rounded-full" />)}</div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">{Array.from({ length: 12 }, (_, i) => <Skeleton key={i} line style={{ aspectRatio: '290 / 428' }} />)}</div>
    </div>
  </SkeletonPage>
}
