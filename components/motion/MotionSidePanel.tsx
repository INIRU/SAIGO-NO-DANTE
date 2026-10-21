'use client'

import useSWR from 'swr'
import { useLocale, useTranslations } from 'next-intl'
import IdentitySkillFrameCard from '@/components/identity/IdentitySkillFrameCard'
import Skeleton, { SkeletonLine } from '@/components/ui/Skeleton'
import type { MotionLayerToggle } from '@/hooks/useSkillMotion'
import type { MotionSkillRow } from '@/lib/motion/feed'

const readSkill = async (url: string): Promise<MotionSkillRow | null> => {
  const response = await fetch(url)
  if (response.status === 404) return null
  if (!response.ok) throw new Error(String(response.status))
  return (await response.json()).skill
}

/** The site's card of the skill (frame, sin, coins, power, text); nothing when the site has no row for it. */
function SkillCard({ skillId }: { skillId: number }) {
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
  return <IdentitySkillFrameCard skill={data} skills={[data]} identity={data.identity} lang={lang} className="rounded-lg p-3" />
}

/** Beside the stage: one switch per buff effect the video can show, then the skill's card. */
export default function MotionSidePanel({ skillId, layers, onLayer }: { skillId: number | null; layers: MotionLayerToggle[]; onLayer: (id: string, on: boolean) => void }) {
  const t = useTranslations('motionPage')
  return (
    <div className="flex flex-col gap-4">
      {layers.length > 0 && (
        <section aria-labelledby="motion-effects" className="rounded-lg border border-[#2e2417] bg-[var(--bg-panel)] p-3">
          <h2 id="motion-effects" className="mb-2 font-[family-name:var(--font-heading)] text-[0.9375rem] text-[var(--text-primary)]">{t('effects')}</h2>
          <ul className="flex flex-col gap-0.5">
            {layers.map(layer => (
              <li key={layer.id}>
                <label className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-[rgba(200,144,10,0.08)]">
                  <input type="checkbox" checked={layer.on} onChange={event => onLayer(layer.id, event.target.checked)}
                    className="h-4 w-4 shrink-0 accent-[var(--gold)]" />
                  <span className="min-w-0 flex-1 break-keep text-[0.875rem] text-[var(--text-primary)]">{layer.label}</span>
                  {layer.offAtSkill && <span className="shrink-0 rounded border border-[#3a2a15] px-1.5 py-0.5 text-[0.6875rem] text-[var(--text-secondary)]">{t('offAtSkill')}</span>}
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}
      {skillId !== null && <SkillCard key={skillId} skillId={skillId} />}
    </div>
  )
}
