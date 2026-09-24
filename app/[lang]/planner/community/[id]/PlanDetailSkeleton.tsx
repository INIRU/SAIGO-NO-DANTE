import Skeleton from '@/components/ui/Skeleton'

/**
 * Plan detail placeholder with the page's own outline, at least one screen tall, so loading never collapses the page
 * (which toggled the page scrollbar and shifted the layout sideways).
 */
export default function PlanDetailSkeleton() {
  return <div data-plan-detail aria-busy="true" className="min-h-screen bg-[#0d0b08] pb-16 pt-24">
    <div className="mx-auto w-full max-w-7xl space-y-5 px-3 sm:px-6">
      <Skeleton className="h-11 w-40" />
      <div className="space-y-4 rounded-md border border-[#241c14] bg-[#120e09] p-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-2/3 max-w-xl" />
        <div className="flex items-center gap-3"><Skeleton className="h-12 w-12 rounded-full" /><Skeleton className="h-5 w-40" /></div>
        <Skeleton className="h-12 w-full max-w-md" />
      </div>
      {Array.from({ length: 3 }, (_, index) => <div key={index} className="space-y-3 rounded-md border border-[#241c14] bg-[#120e09] p-5">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>)}
    </div>
  </div>
}
