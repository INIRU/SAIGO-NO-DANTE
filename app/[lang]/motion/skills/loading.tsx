import { PageHeaderSkeleton } from '@/components/ui/PageHeader'
import { MotionBrowserSkeleton } from '@/features/motion/components/SkillMotionSkeleton'

export default function Loading() {
  return (
    <div className="mx-auto min-h-[100dvh] max-w-[76rem] px-4 pb-24 pt-[5.5rem] md:px-6">
      <PageHeaderSkeleton description={false} />
      <MotionBrowserSkeleton />
    </div>
  )
}
