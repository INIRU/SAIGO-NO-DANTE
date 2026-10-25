'use client'

import useSWR from 'swr'
import { useLocale, useTranslations } from 'next-intl'
import { FilterSection } from '@/components/board/FilterControls'
import IdentitySkillFrameCard from '@/components/identity/IdentitySkillFrameCard'
import Switch from '@/components/ui/Switch'
import Skeleton, { SkeletonLine } from '@/components/ui/Skeleton'
import type { MotionLayerToggle } from '@/hooks/useSkillMotion'
import { useGameTextRefs } from '@/lib/hooks/useGameTextRefs'
import { formatMotionLabelKey } from '@/lib/motion/catalog'
import type { MotionSkillRow } from '@/lib/motion/feed'
import styles from './MotionDeck.module.css'

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
  // A layer's labelKey in the page language from the keyword table (loaded only when a layer has one); else its label.
  const { names } = useGameTextRefs({ lazy: !layers.some(layer => layer.labelKey) })
  const layerName = (layer: MotionLayerToggle) => (layer.labelKey && formatMotionLabelKey(layer.labelKey, names, () => undefined)) || layer.label
  return (
    <div className="flex flex-col gap-5">
      {layers.length > 0 && (
        <FilterSection label={t('effects')}>
          <div className={styles.effects}>
            {layers.map(layer => (
              <label key={layer.id} className={styles.effect}>
                <span>{layerName(layer)}{layer.offAtSkill && <small>{t('offAtSkill')}</small>}</span>
                <Switch size="sm" checked={layer.on} onChange={on => onLayer(layer.id, on)} />
              </label>
            ))}
          </div>
        </FilterSection>
      )}
      {skillId !== null && <SkillCard key={skillId} skillId={skillId} />}
    </div>
  )
}
