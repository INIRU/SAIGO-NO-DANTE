'use client'

import { useState } from 'react'
import { getIdentityImageUrl } from '@/lib/utils/images'
import styles from './SupportStrips.module.css'

/** Slot numbers of the game's support line-up (there is no 10). */
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

export default function SupportStrips({ slots, onPick }: { slots: readonly (SupportSlot | null)[]; onPick?: (index: number) => void }) {
  return <div className={styles.strips}>
    {SUPPORT_SLOT_NUMBERS.map((number, index) => {
      const slot = slots[index] ?? null
      const className = `${styles.strip} ${slot ? '' : styles.empty} ${!slot && onPick ? styles.add : ''}`
      const content = <>
        {slot ? <SupportStripArt identity={slot.identity} /> : <span className={styles.cut} />}
        <span className={styles.no}>{number}</span>
        {slot && <span className={styles.ego}>{EGO_GRADES.map(grade => <i key={grade} data-on={slot.egos[grade] ? grade : undefined} />)}</span>}
      </>
      return onPick
        ? <button type="button" key={number} className={className} onClick={() => onPick(index)} aria-label={slot ? `${number} ${slot.name}` : number}>{content}</button>
        : <div key={number} className={className} title={slot?.name}>{content}</div>
    })}
  </div>
}
