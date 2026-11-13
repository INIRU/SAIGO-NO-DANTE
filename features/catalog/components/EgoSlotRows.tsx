import Image from 'next/image'
import { sinColorOf, normalizeSin } from '@/lib/constants/sin'
import { getEgoFormationAsset } from '@/lib/utils/images'
import type { SupportedLang } from '@/lib/i18n/types'
import EgoDisplayCard from './EgoDisplayCard'
import AttackTypeIcon from '@/components/ui/AttackTypeIcon'
import GameSkillIcon from './GameSkillIcon'
import styles from './EgoSlotRows.module.css'

export const EGO_SLOT_GRADES = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH'] as const

export type EgoSlotItem = { id: string; name: string; sin_affinity: string | null; image_url?: string | null }
export type FormationStripSkill = { iconUrl: string; sin: string | null; attackType: string | null; /** How many of this skill the deck holds (3 / 2 / 1 by default). */ count?: number }

/** A skill in the game's frame with the site's tan attack type mark on the middle of its art (not the game's badge under the frame). */
function SkillMark({ skill, tier }: { skill: FormationStripSkill; tier: number }) {
  const type = skill.attackType ? ATTACK_TYPES[skill.attackType] : undefined
  return (
    <>
      <GameSkillIcon iconUrl={skill.iconUrl} sin={normalizeSin(skill.sin)} tier={tier} size="100%" glow={false} />
      {type && <AttackTypeIcon type={type} className={styles.skillType} />}
    </>
  )
}

/** One line for any name: the size comes down with the name's length (full-width characters count 1, the rest about half). */
function fitFontSize(name: string, room: number, max: number, min: number): string {
  let units = 0
  for (const ch of name) units += /[ᄀ-ￜ]/.test(ch) ? 1 : 0.56
  return `${Math.max(min, Math.min(max, room / Math.max(1, units))).toFixed(2)}cqi`
}

const ATTACK_TYPES: Record<string, 'slash' | 'pierce' | 'blunt'> = { slash: 'slash', pierce: 'pierce', blunt: 'blunt', '참격': 'slash', '관통': 'pierce', '타격': 'blunt' }

type ByGrade = Record<string, EgoSlotItem | undefined>

const EGO_FRAME_SRC = '/assets/ego-ui/common-frame/ego-frame-outer.webp'

/** The game's class letter: lit (MainUI_Formation_7_46..50) on an equipped slot, dark (7_E*) on an empty one. */
function Letter({ grade, lit, className }: { grade: string; lit: boolean; className?: string }) {
  return <Image src={getEgoFormationAsset(`letter-${grade.toLowerCase()}-${lit ? 'on' : 'off'}`)} alt={grade} width={40} height={40} unoptimized className={className} />
}

/** An empty E.G.O place: the game's round E.G.O frame with the dark class letter. */
function EmptySlot({ grade, className }: { grade: string; className: string }) {
  return (
    <span className={className}>
      <Image src={EGO_FRAME_SRC} alt="" width={96} height={96} unoptimized className={styles.frame} />
      <Letter grade={grade} lit={false} className={styles.emptyLetter} />
    </span>
  )
}

/** One sinner's five E.G.O as game E.G.O cards (ZAYIN to ALEPH); an empty grade keeps its place with the empty frame. */
export function EgoSlotCards({ sinnerId, egos, onEgoClick, lang }: {
  sinnerId: string
  egos: ByGrade
  onEgoClick?: (egoId: string) => void
  lang?: SupportedLang
}) {
  return (
    <div className={styles.cards}>
      {EGO_SLOT_GRADES.map(grade => {
        const ego = egos[grade]
        return ego ? (
          <EgoDisplayCard
            key={grade}
            ego={{ grade, image_url: ego.image_url, sin_affinity: ego.sin_affinity }}
            name={ego.name}
            sinnerId={sinnerId}
            lang={lang}
            onClick={onEgoClick ? () => onEgoClick(ego.id) : undefined}
            displayOnly={!onEgoClick}
          />
        ) : <EmptySlot key={grade} grade={grade} className={styles.cardEmpty} />
      })}
    </div>
  )
}

/** Under a formation card: skills 1-3 in the game's skill frame with the tan attack type mark on the art, then the five E.G.O slots in the game's round E.G.O frame. */
export function FormationCardStrip({ skills, egos }: { skills?: (FormationStripSkill | null)[]; egos?: ByGrade }) {
  return (
    <span className={styles.strip} aria-hidden="true">
      {skills && skills.length > 0 && (
        <span className={styles.skills}>
          {skills.map((skill, i) => skill
            ? (
              <span key={i} className={styles.skill}><SkillMark skill={skill} tier={i + 1} /></span>
            )
            : <span key={i} />)}
        </span>
      )}
      {egos && (
        <span className={styles.slots}>
          {EGO_SLOT_GRADES.map(grade => {
            const ego = egos[grade]
            return ego ? (
              <span key={grade} className={styles.slot} title={ego.name} style={{ '--ego-sin': sinColorOf(ego.sin_affinity, 'var(--gold-light)') } as React.CSSProperties}>
                {ego.image_url && <Image src={ego.image_url} alt="" width={48} height={48} className={styles.slotArt} />}
                <Image src={EGO_FRAME_SRC} alt="" width={96} height={96} unoptimized className={styles.frame} />
                <Letter grade={grade} lit className={styles.slotLetter} />
              </span>
            ) : <EmptySlot key={grade} grade={grade} className={`${styles.slot} ${styles.slotEmpty}`} />
          })}
        </span>
      )}
    </span>
  )
}

/**
 * The back of a formation card: this sinner's five E.G.O, ZAYIN to ALEPH, as art strips. Each equipped row is the E.G.O's own art
 * (darkened by a CSS filter) with the game's class letter and the name over it and a thin line of its sin colour under it; an empty
 * grade is a quiet row with the game's dark letter. USER 2026-11-13: 등급 아이콘은 인게임처럼 (색을 바꾸지 않는다), 줄 전체 색칠·죄악 아이콘은 별로.
 */
export function EgoCardRows({ egos, onEgoClick }: { egos: ByGrade; onEgoClick?: (egoId: string) => void }) {
  return (
    <span className={styles.rows}>
      {EGO_SLOT_GRADES.map(grade => {
        const ego = egos[grade]
        if (!ego) return <span key={grade} className={`${styles.row} ${styles.rowEmpty}`}><Letter grade={grade} lit={false} className={styles.rowLetter} /></span>
        const sin = { '--ego-sin': sinColorOf(ego.sin_affinity, 'var(--border)') } as React.CSSProperties
        const body = (
          <>
            {ego.image_url && <Image src={ego.image_url} alt="" width={256} height={256} sizes="10rem" className={styles.rowArt} />}
            <Letter grade={grade} lit className={styles.rowLetter} />
            <span className={styles.rowName} style={{ fontSize: fitFontSize(ego.name, 66, 8.4, 4.6) }}>{ego.name}</span>
          </>
        )
        return onEgoClick
          ? <button key={grade} type="button" className={styles.row} style={sin} title={ego.name} onClick={() => onEgoClick(ego.id)}>{body}</button>
          : <span key={grade} className={styles.row} style={sin} title={ego.name}>{body}</span>
      })}
    </span>
  )
}

/**
 * The skill view of a formation card: skills 1-3 down the card, each in the game's skill frame with its attack type, and how many of
 * it the deck holds. Sits over the dimmed identity card (FormationBoard). USER 2026-11-13: 스킬 3개 세로로 나열한 다음에 갯수.
 */
/** Makes the skill view editable (the builders): steppers beside each count and the preset distributions under the rows. */
export type SkillCountEdit = {
  canDecrease: (index: number) => boolean
  canIncrease: (index: number) => boolean
  onAdjust: (index: number, delta: number) => void
  presets?: [number, number, number][]
  onPreset?: (preset: [number, number, number]) => void
}

export function SkillCardRows({ skills, edit }: { skills: (FormationStripSkill | null)[]; edit?: SkillCountEdit }) {
  const counts = skills.map(skill => skill?.count ?? 0)
  return (
    <span className={styles.skillRows} data-edit={edit ? '' : undefined}>
      {skills.map((skill, i) => (
        <span key={i} className={styles.skillRow} style={{ '--i': i } as React.CSSProperties}>
          {skill && (
            <>
              <span className={styles.skill}><SkillMark skill={skill} tier={i + 1} /></span>
              {edit ? (
                <span className={styles.stepper}>
                  <button type="button" disabled={!edit.canDecrease(i)} onClick={() => edit.onAdjust(i, -1)} aria-label={`S${i + 1} −`}>−</button>
                  <span className={styles.skillRowCount}>{skill.count ?? 0}</span>
                  <button type="button" disabled={!edit.canIncrease(i)} onClick={() => edit.onAdjust(i, 1)} aria-label={`S${i + 1} +`}>+</button>
                </span>
              ) : skill.count != null && <span className={styles.skillRowCount}><span>×</span>{skill.count}</span>}
            </>
          )}
        </span>
      ))}
      {edit?.presets && edit.onPreset && (
        <span className={styles.presets}>
          {edit.presets.map(preset => (
            <button key={preset.join('-')} type="button" aria-pressed={preset.every((n, i) => n === counts[i])} onClick={() => edit.onPreset?.(preset)}>{preset.join('-')}</button>
          ))}
        </span>
      )}
    </span>
  )
}
