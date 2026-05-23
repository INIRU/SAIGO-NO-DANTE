'use client'

import IdentityCard from '@/components/sinners/IdentityCard'
import { STORAGE_BASE } from '@/lib/constants/game'
import type { Identity } from '@/lib/types'

export type FormationBoardSlot = {
  key: string
  identity: Identity | null
  slotOrder: number | null
  gacksung?: boolean
  selected?: boolean
  disabled?: boolean
  giftBadgeUrls?: string[]
  ariaLabel: string
  onClick?: () => void
}

type FormationBoardProps = {
  slots: FormationBoardSlot[]
  className?: string
}

const FRONTLINE_SLOT_COUNT = 7
const SELECTED_BANNER_URL = `${STORAGE_BASE}/icons/ui/identity-selected-banner.webp`
const BACKUP_BANNER_URL = `${STORAGE_BASE}/icons/ui/identity-backup-banner.webp`

function getFormationOverlay(slotOrder: number | null) {
  if (slotOrder == null || slotOrder >= 99) return undefined

  const order = slotOrder + 1
  const isFrontline = slotOrder < FRONTLINE_SLOT_COUNT

  return {
    kind: isFrontline ? 'selected' as const : 'backup' as const,
    order,
    bannerUrl: isFrontline ? SELECTED_BANNER_URL : BACKUP_BANNER_URL,
  }
}

export default function FormationBoard({ slots, className }: FormationBoardProps) {
  return (
    <div className={className}>
      <style>{`
        .formation-board-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:start;column-gap:0.5rem;row-gap:0.75rem}
        .formation-board-grid>*{min-width:0}
        @media (min-width:40rem){.formation-board-grid{grid-template-columns:repeat(4,minmax(0,1fr));column-gap:0.75rem;row-gap:0.9rem}}
        @media (min-width:64rem){.formation-board-grid{grid-template-columns:repeat(6,minmax(0,1fr));column-gap:1.75rem;row-gap:1.25rem}}
        .formation-board-button{transform:translate3d(0,0,0);transition:transform 220ms cubic-bezier(.22,1,.36,1),filter 220ms cubic-bezier(.22,1,.36,1)}
        .formation-board-button:not(:disabled):is(:hover,:focus-visible){transform:translate3d(0,-0.25rem,0);filter:brightness(1.08) drop-shadow(0 .65rem 1.1rem rgba(200,144,10,.18))}
        .formation-board-button:not(:disabled):active{transform:translate3d(0,-0.0625rem,0);filter:brightness(1.02)}
        @media (prefers-reduced-motion:reduce){.formation-board-button{transition:filter 120ms ease}.formation-board-button:not(:disabled):is(:hover,:focus-visible),.formation-board-button:not(:disabled):active{transform:none}}
      `}</style>
      <div className="formation-board-grid">
        {slots.map(slot => {
          const disabled = slot.disabled ?? !slot.identity

          return (
            <div key={slot.key} className="min-w-0">
              <button
                type="button"
                onClick={slot.onClick}
                disabled={disabled}
                aria-pressed={slot.identity ? slot.selected : undefined}
                aria-label={slot.ariaLabel}
                className="formation-board-button relative w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0c09] disabled:cursor-default disabled:opacity-45"
              >
                {slot.identity ? (
                  <IdentityCard
                    identity={slot.identity}
                    compact
                    board
                    selected={slot.selected}
                    gacksung={slot.gacksung ?? false}
                    disableHoverEffects
                    formationOverlay={getFormationOverlay(slot.slotOrder)}
                    giftBadgeUrls={slot.giftBadgeUrls}
                  />
                ) : (
                  <div
                    className="aspect-[2/3] w-full rounded"
                    style={{ background: '#080604', border: '1px solid rgba(44,28,12,0.45)' }}
                    aria-hidden="true"
                  />
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
