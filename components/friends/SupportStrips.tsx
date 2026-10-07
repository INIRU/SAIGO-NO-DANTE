'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { SINNER_SLUGS } from '@/lib/constants/game'
import { getIdentityImageUrl } from '@/lib/utils/images'
import styles from './SupportStrips.module.css'

/** The game's sinner numbers (there is no 10), in sinner order. */
export const SUPPORT_SLOT_NUMBERS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '11', '12', '13'] as const
export const EGO_GRADES = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH'] as const
export type EgoGrade = typeof EGO_GRADES[number]
export type SupportIdentity = { sinner_id: string; rarity: number; folder_name?: string | null; game_id?: string | null }
/** One support slot: an identity (any sinner) and the E.G.O set on it, at most one per grade. */
export type SupportSlot = { identityId: string; identity: SupportIdentity; name: string; egos: Partial<Record<EgoGrade, string>> }

/** The game's own support strip of an identity; newer identities without one show their portrait in the same shape. */
export function SupportStripArt({ identity }: { identity: SupportIdentity }) {
  const [missing, setMissing] = useState(false)
  if (!identity.game_id || !identity.folder_name) return null
  if (missing) {
    const portrait = getIdentityImageUrl(identity.sinner_id, identity.folder_name, `${identity.game_id}_gacksung_info`)
    return <span className={styles.fallback} style={{ backgroundImage: `url("${portrait}")` }} />
  }
  return <span className={styles.cut}>
    {/* eslint-disable-next-line @next/next/no-img-element -- intrinsic 197x982 art, laid out by the strip's own shape */}
    <img src={getIdentityImageUrl(identity.sinner_id, identity.folder_name, `${identity.game_id}_gacksung_profile_support_personality`)} alt="" onError={() => setMissing(true)} />
  </span>
}

/** The game's number of a sinner (01 Yi Sang … 09 Rodion, 11 Sinclair, 12 Outis, 13 Gregor): the number on a filled strip. */
export const sinnerNumber = (sinnerId: string): string | null => SUPPORT_SLOT_NUMBERS[SINNER_SLUGS.indexOf(sinnerId)] ?? null

/** The strip art's own outline in its 197x982 box (measured on the game images): a line drawn on it fits the art exactly. */
const FRAME_POINTS = '0.5,49.5 196.5,0.5 196.5,932.5 0.5,981.5'

/**
 * Support strips as in the game's Company tab: the art darkens toward its top and bottom, a thin frame follows its slanted
 * outline and the sinner number sits under that frame line. A filled strip carries its identity's sinner number; an empty
 * one has no number. count: 12 for a line-up, fewer for a short row (wanted identities), which also hides the E.G.O places.
 */
export default function SupportStrips({ slots, onPick, count = 12 }: { slots: readonly (SupportSlot | null)[]; onPick?: (index: number) => void; count?: number }) {
  const t = useTranslations('friends')
  return <div className={`${styles.strips} ${count < 12 ? styles.few : ''}`}>
    {Array.from({ length: count }, (_, index) => {
      const slot = slots[index] ?? null
      const number = slot && sinnerNumber(slot.identity.sinner_id)
      const className = `${styles.strip} ${slot ? '' : styles.empty} ${!slot && onPick ? styles.add : ''}`
      const content = <>
        {slot ? <SupportStripArt identity={slot.identity} /> : <span className={styles.cut} />}
        {slot && <span className={styles.shade} />}
        {number && <span className={styles.no}>{number}</span>}
        <svg className={styles.frame} viewBox="0 0 197 982" preserveAspectRatio="none" aria-hidden="true"><polygon points={FRAME_POINTS} /></svg>
        {slot && <span className={styles.ego}>{EGO_GRADES.map(grade => <i key={grade} data-on={slot.egos[grade] ? grade : undefined} />)}</span>}
      </>
      return onPick
        ? <button type="button" key={index} className={className} onClick={() => onPick(index)} aria-label={slot ? `${number} ${slot.name}` : t('addIdentity')}>{content}</button>
        : <div key={index} className={className} title={slot?.name}>{content}</div>
    })}
  </div>
}
