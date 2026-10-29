'use client'

import Image from 'next/image'
import IdentityFrameCard, { type IdentityFrameCardIdentity } from '@/components/ui/IdentityFrameCard'
import { getSinnerLogoUrl } from '@/lib/utils/images'
import styles from './FormationBoard.module.css'

export type FormationBoardSlot = {
  key: string
  identity: (IdentityFrameCardIdentity & { name?: string }) | null
  /** Shown as a quiet logo tile when the slot has no identity. */
  sinnerId?: string
  slotOrder: number | null
  /** 1–4, missing = IV. */
  uptie?: number
  selected?: boolean
  disabled?: boolean
  giftBadgeUrls?: string[]
  ariaLabel: string
  onClick?: () => void
}

/** Read-only 12-card board (3 / 4 / 6 columns) using the standard IdentityFrameCard. */
export default function FormationBoard({ slots, className }: { slots: FormationBoardSlot[]; className?: string }) {
  return (
    <ol className={[styles.grid, className].filter(Boolean).join(' ')}>
      {slots.map(slot => (
        <li key={slot.key}>
          <button
            type="button"
            className={styles.tile}
            onClick={slot.onClick}
            disabled={slot.disabled ?? !slot.onClick}
            aria-pressed={slot.identity && slot.selected != null ? slot.selected : undefined}
            aria-label={slot.ariaLabel}
          >
            {slot.identity ? (
              <IdentityFrameCard
                identity={slot.identity}
                uptie={slot.uptie}
                name={slot.identity.name ?? ''}
                order={slot.slotOrder}
                selected={slot.selected}
                giftBadgeUrls={slot.giftBadgeUrls}
                sizes="(max-width: 40rem) 30vw, 9rem"
              />
            ) : (
              <span className={styles.empty} aria-hidden="true">
                {slot.sinnerId && <Image src={getSinnerLogoUrl(slot.sinnerId)} alt="" width={32} height={32} />}
              </span>
            )}
          </button>
        </li>
      ))}
    </ol>
  )
}
