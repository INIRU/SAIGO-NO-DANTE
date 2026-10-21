'use client'

import { useTranslations } from 'next-intl'
import SkillFrame from '@/components/identity/SkillFrame'
import { SIN_COLORS, normalizeSin } from '@/lib/constants/sin'
import { getSkillIconUrl } from '@/lib/utils/images'
import type { MotionSkill } from '@/lib/motion/catalog'
import styles from './MotionDeck.module.css'

/** A game skill sprite from its skill id (the sprite's owner is read from the id; no identity row needed). */
export const motionSkillIcon = (sinnerId: string, skillId: number) => getSkillIconUrl({ sinner_id: sinnerId, game_id: '0' }, 0, { image_id: String(skillId) })

const sinColor = (sin: string) => { const key = normalizeSin(sin); return key ? SIN_COLORS[key] : '#cccccc' }

/**
 * The identity's skills under the stage, each in the game's skill frame of its sin, slot and attack type (a plain neutral
 * frame when the site has no row for it); a line before another form's skills; the chosen one pressed.
 */
export default function MotionSkillStrip({ sinnerId, skills, selectedKey, onPick }: {
  sinnerId: string; skills: readonly MotionSkill[]; selectedKey: string; onPick: (skill: MotionSkill) => void
}) {
  const t = useTranslations('motionPage')
  return (
    <div role="group" aria-label={t('skills')} className={styles.strip}>
      {skills.flatMap((skill, k) => [
        ...(k > 0 && skill.form !== skills[k - 1].form ? [<span key={`${skill.key}:form`} data-form-divider="" aria-hidden="true" className={styles.divider} />] : []),
        <button key={skill.key} type="button" aria-pressed={skill.key === selectedKey} aria-label={skill.title} title={skill.title} className={styles.skill} onClick={() => onPick(skill)}>
          <span className={styles.art}>
            <SkillFrame skillIconUrl={motionSkillIcon(sinnerId, skill.skillId)} sin={skill.frame?.sin ?? 'neutral'} skillSlot={skill.frame?.slot ?? 1}
              sinColor={sinColor(skill.frame?.sin ?? 'neutral')} attackType={skill.frame?.attack ?? null} label="" size="100%" eager />
          </span>
        </button>,
      ])}
    </div>
  )
}
