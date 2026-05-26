'use client'

import IdentityCard from '@/components/sinners/IdentityCard'
import { STORAGE_BASE } from '@/lib/constants/game'
import { getSinnerLogoUrl } from '@/lib/utils/images'
import type { Identity } from '@/lib/types'
import Image from 'next/image'
import type { ReactNode } from 'react'

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
  emptySlot?: {
    sinnerId: string
    name: string
    actionLabel?: string
  }
  emptyContent?: ReactNode
  actionOverlay?: ReactNode
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
        .formation-board-button{transition:filter 220ms cubic-bezier(.22,1,.36,1)}
        .formation-board-button:not(:disabled):is(:hover,:focus-visible){filter:brightness(1.08)}
        .formation-board-button:not(:disabled):active{filter:brightness(1.02)}
        .formation-board-empty-slot{position:relative;aspect-ratio:2/3;width:100%;overflow:hidden;border-radius:.25rem;background:linear-gradient(160deg,#1e1810 0%,#120e08 60%,#1a1410 100%);border:.09375rem dashed #2a2015;transition:border-color 180ms ease,background 180ms ease,box-shadow 180ms ease}
        .formation-board-button:not(:disabled):is(:hover,:focus-visible) .formation-board-empty-slot{border-color:rgba(232,176,48,.58);background:linear-gradient(160deg,#241b0e 0%,#130f09 58%,#20160c 100%);box-shadow:inset 0 0 0 1px rgba(232,176,48,.12)}
        .formation-board-empty-slot__logo{position:absolute;inset:0;z-index:10;display:flex;align-items:center;justify-content:center}
        .formation-board-empty-slot__logo img{height:2rem;width:2rem;opacity:.35;transition:opacity 180ms ease,transform 180ms ease}
        .formation-board-button:not(:disabled):is(:hover,:focus-visible) .formation-board-empty-slot__logo img{opacity:.18;transform:scale(.96)}
        .formation-board-empty-slot__number{position:absolute;right:0;top:0;width:36%;opacity:.15;pointer-events:none}
        .formation-board-empty-slot__name{position:absolute;bottom:0;left:0;right:0;z-index:10;text-align:center;background:linear-gradient(to top,rgba(13,11,8,.95) 0%,transparent 100%);padding:1.25rem .25rem .375rem}
        .formation-board-empty-slot__name-text{margin:0;color:#3a2a10;font-family:var(--font-kotra-bold),var(--font-heading),var(--font-sans),serif;font-size:.875rem;font-weight:400;line-height:1.15;overflow-wrap:anywhere;word-break:keep-all;-webkit-text-stroke:0 transparent}
        .formation-board-empty-slot__action{position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;background:rgba(13,11,8,.5);color:#e8b030;font-family:var(--font-body),var(--font-sans);font-size:1rem;font-weight:700;opacity:0;text-shadow:0 0 .5rem rgba(200,144,10,.5),0 .125rem .375rem rgba(0,0,0,.9);transition:opacity 180ms ease,background-color 180ms ease}
        .formation-board-button:not(:disabled):is(:hover,:focus-visible) .formation-board-empty-slot__action{opacity:1;background:rgba(200,144,10,.12)}
        @media (max-width:39.9375rem){.formation-board-empty-slot__logo img{height:1.5rem;width:1.5rem}.formation-board-empty-slot__name{padding-top:1rem;padding-bottom:.3125rem}.formation-board-empty-slot__name-text{font-size:.875rem;line-height:1.12}.formation-board-empty-slot__action{font-size:.9375rem}}
        @media (prefers-reduced-motion:reduce){.formation-board-button{transition:filter 120ms ease}}
      `}</style>
      <div className="formation-board-grid">
        {slots.map(slot => {
          const disabled = slot.disabled ?? (!slot.identity && !slot.onClick)

          return (
            <div key={slot.key} className="relative min-w-0">
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
                  slot.emptySlot ? (
                    <div className="formation-board-empty-slot" aria-hidden="true">
                      <div className="formation-board-empty-slot__logo">
                        <Image
                          src={getSinnerLogoUrl(slot.emptySlot.sinnerId)}
                          alt=""
                          width={32}
                          height={32}
                        />
                      </div>
                      <div className="formation-board-empty-slot__number">
                        <Image
                          src={`${STORAGE_BASE}/sinners/${slot.emptySlot.sinnerId}/number.webp`}
                          alt=""
                          width={389}
                          height={1023}
                          className="h-auto w-full"
                          loading="eager"
                        />
                      </div>
                      <div className="formation-board-empty-slot__name">
                        <p className="formation-board-empty-slot__name-text">{slot.emptySlot.name}</p>
                      </div>
                      {slot.emptySlot.actionLabel ? (
                        <div className="formation-board-empty-slot__action">
                          {slot.emptySlot.actionLabel}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div
                      className="relative aspect-[2/3] w-full overflow-hidden rounded"
                      style={{ background: '#080604', border: '1px solid rgba(44,28,12,0.45)' }}
                      aria-hidden="true"
                    >
                      {slot.emptyContent}
                    </div>
                  )
                )}
              </button>
              {slot.actionOverlay}
            </div>
          )
        })}
      </div>
    </div>
  )
}
