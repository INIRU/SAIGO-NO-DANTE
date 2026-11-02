'use client'

import useSWR from 'swr'
import { useLocale, useTranslations } from 'next-intl'
import IdentitySkillFrameCard from '@/components/identity/IdentitySkillFrameCard'
import Skeleton, { SkeletonLine } from '@/components/ui/Skeleton'
import type { MotionSkillRow } from '@/lib/motion/feed'

const readSkill = async (url: string): Promise<MotionSkillRow | null> => {
  const response = await fetch(url)
  if (response.status === 404) return null
  if (!response.ok) throw new Error(String(response.status))
  return (await response.json()).skill
}

/** The site's card of the skill (frame, sin, coins, power, text); nothing when the site has no row for it. */
function SkillCard({ skillId, icon }: { skillId: number; icon?: string }) {
  const lang = useLocale()
  const { data, isLoading } = useSWR(`/api/motion/skill?id=${skillId}&lang=${lang}`, readSkill, { revalidateOnFocus: false })
  if (isLoading) {
    return (
      <div className="rounded-lg border border-[#2e2417] bg-[var(--bg-panel)] p-3" aria-hidden="true">
        <div className="flex gap-3"><Skeleton raised className="h-14 w-14 shrink-0" /><div className="flex flex-1 flex-col gap-2 pt-1"><SkeletonLine w="70%" raised /><SkeletonLine w="45%" raised /></div></div>
        <div className="mt-3 flex flex-col gap-1.5"><SkeletonLine raised /><SkeletonLine w="85%" raised /><SkeletonLine w="60%" raised /></div>
      </div>
    )
  }
  if (!data) return null
  return <IdentitySkillFrameCard skill={data} skills={[data]} identity={data.identity} lang={lang} iconUrl={icon} className="rounded-lg p-3" />
}

/** Beside the stage: the skill's card. */
export default function MotionSidePanel({ skillId, icon }: { skillId: number | null; icon?: string }) {
  return skillId !== null ? <SkillCard key={skillId} skillId={skillId} icon={icon} /> : null
}
