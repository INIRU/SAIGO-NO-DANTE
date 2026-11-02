import { MotionWatchSkeleton } from '@/components/motion/SkillMotionSkeleton'

export default function Loading() {
  return <div className="mx-auto flex min-h-[100dvh] w-full max-w-[90rem] flex-col gap-3 px-4 pb-24 pt-3 md:pb-6 lg:h-[100dvh] lg:pb-4"><MotionWatchSkeleton /></div>
}
