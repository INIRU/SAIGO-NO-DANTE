import SkillMotionSkeleton from '@/components/motion/SkillMotionSkeleton'

export default function Loading() {
  return (
    <div className="mx-auto max-w-[90rem] px-4 pb-24 pt-[calc(64px+1.5rem)] md:pb-10">
      <div className="mb-5 h-[1.75rem] md:h-[2.25rem]" />
      <SkillMotionSkeleton />
    </div>
  )
}
