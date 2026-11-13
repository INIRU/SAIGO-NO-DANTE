'use client'

import Image from 'next/image'
import IdentityFrameCard, { type IdentityFrameCardIdentity } from '@/features/catalog/components/IdentityFrameCard'
import { FormationCardStrip, SkillCardRows, type EgoSlotItem, type FormationStripSkill, type SkillCountEdit } from '@/features/catalog/components/EgoSlotRows'
import { getSinnerLogoUrl } from '@/lib/utils/images'
import EgoBackPanel from '@/features/decks/components/EgoBackPanel'
import styles from '@/features/decks/components/FormationBoard.module.css'

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
  /** Skills 1-3 (icon, sin, attack type), shown under the card in the game's skill frame. */
  skills?: (FormationStripSkill | null)[]
  /** Builders: makes the skill view's counts editable on the card. */
  skillEdit?: SkillCountEdit
  /** This sinner's E.G.O by grade, shown as five slots under the card. */
  egos?: Record<string, EgoSlotItem | undefined>
  ariaLabel: string
  onClick?: () => void
}

/**
 * Read-only 12-card board (3 / 4 / 6 columns) using the standard IdentityFrameCard.
 * `view="ego"` turns every card over in its place: the back is a site panel with that sinner's five E.G.O rows.
 * `view="skill"` dims the card a little and lists skills 1-3 with their counts over it.
 */
export default function FormationBoard({ slots, className, view = 'identity', onEgoClick }: {
  slots: FormationBoardSlot[]
  className?: string
  view?: 'identity' | 'ego' | 'skill'
  onEgoClick?: (egoId: string) => void
}) {
  const egoView = view === 'ego'
  return (
    <ol className={[styles.grid, className].filter(Boolean).join(' ')} data-view={view}>
      {slots.map((slot, index) => {
        const flipped = egoView && Boolean(slot.identity)
        return (
          <li key={slot.key}>
            {/* The card turns over in its place: the identity on the front, this sinner's E.G.O on the back (USER 2026-11-13). */}
            <span className={styles.flip} data-flipped={flipped || undefined} style={{ '--i': index } as React.CSSProperties}>
              <button
                type="button"
                className={`${styles.tile} ${styles.face}`}
                onClick={slot.onClick}
                disabled={slot.disabled ?? !slot.onClick}
                aria-pressed={slot.identity && slot.selected != null ? slot.selected : undefined}
                aria-label={slot.ariaLabel}
                inert={flipped}
              >
                {slot.identity ? (
                  <>
                    <IdentityFrameCard
                      identity={slot.identity}
                      uptie={slot.uptie}
                      name={slot.identity.name ?? ''}
                      order={view === 'skill' ? null : slot.slotOrder}
                      selected={view === 'skill' ? false : slot.selected}
                      giftBadgeUrls={slot.giftBadgeUrls}
                      sizes="(max-width: 40rem) 30vw, 9rem"
                    />
                  </>
                ) : (
                  <span className={styles.empty} aria-hidden="true">
                    {slot.sinnerId && <Image src={getSinnerLogoUrl(slot.sinnerId)} alt="" width={32} height={32} />}
                  </span>
                )}
              </button>
              {slot.identity && slot.skills && (
                <span className={styles.skillView} data-edit={slot.skillEdit ? '' : undefined} aria-hidden={slot.skillEdit ? undefined : true} inert={view !== 'skill'}>
                  <SkillCardRows skills={slot.skills} edit={slot.skillEdit} />
                </span>
              )}
              {slot.identity && (
                <EgoBackPanel className={`${styles.face} ${styles.back}`} inert={!flipped} sinnerId={slot.identity.sinner_id} name={slot.identity.name ?? ''} egos={slot.egos ?? {}} onEgoClick={onEgoClick} />
              )}
            </span>
            {slot.identity && (slot.skills || slot.egos) && (
              // folds away in the E.G.O view (the card's back already lists the E.G.O) and comes back with the identity view
              <span className={styles.stripFold} aria-hidden="true"><span><FormationCardStrip skills={slot.skills} egos={slot.egos} /></span></span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
