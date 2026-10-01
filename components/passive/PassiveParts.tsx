import Image from 'next/image'
import type { ReactNode } from 'react'
import { getSinIconUrl } from '@/lib/constants/sin'
import type { PassiveRequirement } from '@/lib/planner/passives'
import SkillNameBanner from '@/components/skill/SkillNameBanner'
import styles from './PassiveParts.module.css'

/** The multiplication sign of counts (×3, ×0.5): drawn, so it keeps its weight and centre in every font. */
export function MultiplyMark({ className }: { className?: string }) {
  return (
    <svg className={`${styles.multiply} ${className ?? ''}`} viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path d="M3 3 9 9M9 3 3 9" />
    </svg>
  )
}

/** A count with its drawn × in front (resistance multipliers, E.G.O costs, passive requirements). */
export function MultipliedCount({ value, className, style }: { value: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={`${styles.count} ${className ?? ''}`} style={style}>
      <MultiplyMark />
      <span>{value}</span>
    </span>
  )
}

/** Every sin a passive needs, each with its own count, and the kind of condition (owned / resonance). */
export function PassiveRequirements({ requirements, condition, sinLabel }: {
  requirements: readonly PassiveRequirement[]
  condition?: string | null
  sinLabel: (sin: PassiveRequirement['sin']) => string
}) {
  if (requirements.length === 0 && !condition) return null
  return (
    <div className={styles.requirements}>
      {requirements.map(req => (
        <span key={req.sin} className={styles.requirement}>
          <Image src={getSinIconUrl(req.sin)} alt={sinLabel(req.sin)} width={32} height={32} className={styles.sinIcon} />
          <MultipliedCount value={req.count} />
        </span>
      ))}
      {condition && <span className={styles.condition}>{condition}</span>}
    </div>
  )
}

/** Passive name plates are the skill banner of the game in one colour for every passive (skills keep their sin colour). */
const PASSIVE_LABEL_COLOR = '#b07a3a'

/** Name plate of a passive: the striped skill banner, in the passive colour. */
export function PassiveNameLabel({ children, as: Tag = 'h4' }: { children: string; as?: 'h3' | 'h4' }) {
  return <Tag className={styles.nameLabel}><SkillNameBanner name={children} sinColor={PASSIVE_LABEL_COLOR} fontSize="1.0625rem" /></Tag>
}
