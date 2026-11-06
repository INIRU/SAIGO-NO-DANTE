'use client'

import { useRef, type MouseEvent } from 'react'
import { ChevronRight } from 'lucide-react'

/** Clicks closer together than this are one intent; stops a double-click from skipping a floor. */
export const NEXT_FLOOR_GUARD_MS = 700

/** Whether a click should advance: never past the last floor, never twice within the guard window. */
export function shouldAdvanceFloor({ floor, maxFloors, disabled = false, clickCount = 1, now, lastAcceptedAt }: {
  floor: number; maxFloors: number; disabled?: boolean; clickCount?: number; now: number; lastAcceptedAt: number | null
}) {
  if (disabled || floor >= maxFloors || clickCount > 1) return false
  return lastAcceptedAt === null || now - lastAcceptedAt >= NEXT_FLOOR_GUARD_MS
}

interface Props {
  floor: number
  maxFloors: number
  /** Localized label, e.g. t('nextFloor'). */
  label: string
  /** Should dispatch NEXT_FLOOR through the panel's Undo history. Completing the run stays on the main page. */
  onAdvance: () => void
  disabled?: boolean
  /** Explains the disabled state, e.g. on the last floor. */
  disabledTitle?: string
}

/** Manual fallback for when floor detection misses; the last floor disables it because NEXT_FLOOR there would end the run unsaved. */
export default function CompanionNextFloorButton({ floor, maxFloors, label, onAdvance, disabled = false, disabledTitle }: Props) {
  const lastAcceptedAt = useRef<number | null>(null)
  const inactive = disabled || floor >= maxFloors
  function advance(event: MouseEvent<HTMLButtonElement>) {
    const now = event.timeStamp
    if (!shouldAdvanceFloor({ floor, maxFloors, disabled, clickCount: event.detail, now, lastAcceptedAt: lastAcceptedAt.current })) return
    lastAcceptedAt.current = now
    onAdvance()
  }
  return <button type="button" data-next-floor onClick={advance} disabled={inactive} title={inactive ? disabledTitle : label}
    className="inline-flex h-9 shrink-0 items-center gap-1 rounded border border-[var(--gold-dim)] bg-[var(--deck-filter-surface-active)] pl-2 pr-1 text-xs font-bold text-[var(--gold-light)] hover:border-[var(--gold)] hover:bg-[var(--bg-elevated)] disabled:border-[var(--border)] disabled:bg-transparent disabled:text-[var(--text-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-light)]">
    <span className="whitespace-nowrap">{label}</span>
    {!inactive && <span className="font-[family-name:var(--font-title)] text-sm font-normal leading-none text-[var(--text-primary)]">{String(floor + 1).padStart(2, '0')}</span>}
    <ChevronRight size={15} aria-hidden="true" />
  </button>
}
