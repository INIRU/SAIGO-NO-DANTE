'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Check, Shrink } from 'lucide-react'
import GiftArtwork, { type GiftArtworkGift } from '@/components/ui/GiftArtwork'

/**
 * One confirmed acquisition (emitted by the shared acquire handler), or the materials a recognized fusion took out of the
 * inventory (`consumed`, emitted only by the automatic fusion step from that step's own inventory delta).
 */
export type AcquisitionOverlayEvent = {
  kind?: 'acquired'
  token: string
  /** Date.now() when the step was recorded. */
  at: number
  gift: GiftArtworkGift
  name: string
} | {
  kind: 'consumed'
  token: string
  at: number
  materials: { gift: GiftArtworkGift; name: string }[]
}

/** Gift ids an inventory step removed and added (as multisets), in inventory order. */
export function inventoryDelta(before: readonly string[], after: readonly string[]) {
  const diff = (from: readonly string[], minus: readonly string[]) => {
    const rest = [...minus]
    return from.filter(id => { const index = rest.indexOf(id); if (index < 0) return true; rest.splice(index, 1); return false })
  }
  return { removed: diff(before, after), added: diff(after, before) }
}

/**
 * Feedback for one automatic fusion step, from what it actually changed: the removed materials as one consumption
 * notice, then the result only if it was really added (a result already listed, or one shown when its popup was
 * recorded before the fusion was confirmed, is not announced again). `token` is the fusion's own stable id.
 */
export function fusionFeedback(token: string, at: number, before: readonly string[], after: readonly string[], resultId: string,
  describe: (id: string) => { gift: GiftArtworkGift; name: string } | null): AcquisitionOverlayEvent[] {
  const { removed, added } = inventoryDelta(before, after)
  const materials = removed.map(describe).filter((item): item is { gift: GiftArtworkGift; name: string } => item !== null)
  const events: AcquisitionOverlayEvent[] = []
  if (materials.length) events.push({ kind: 'consumed', token: `${token}:consumed`, at, materials })
  const result = added.includes(resultId) ? describe(resultId) : null
  if (result) events.push({ token: `${token}:result`, at, ...result })
  return events
}

export const ACQUISITION_MAX_AGE_MS = 4000

/**
 * Returns events not yet in `seen` and recorded within `maxAgeMs`, marking every event it looks at as seen.
 * Stale or repeated tokens are consumed silently so re-renders and restored lists never replay a reward.
 */
export function takeNewAcquisitions(events: readonly AcquisitionOverlayEvent[], seen: Set<string>, now: number, maxAgeMs = ACQUISITION_MAX_AGE_MS) {
  const fresh: AcquisitionOverlayEvent[] = []
  for (const event of events) {
    if (seen.has(event.token)) continue
    seen.add(event.token)
    if (now - event.at <= maxAgeMs) fresh.push(event)
  }
  return fresh
}

/** Shortens each plate while others wait, so a burst drains quickly without skipping any gift. */
export function acquisitionDwellMs(waiting: number) {
  return waiting === 0 ? 1700 : waiting < 3 ? 1100 : 800
}

interface Props {
  events: readonly AcquisitionOverlayEvent[]
  /** Short localized word shown above the name, e.g. t('acquired'). */
  label: string
  /** Heading of a fusion's consumed-materials notice, e.g. t('fusionConsumed'). */
  consumedLabel?: string
}

/** Fixed to the viewport of the document it is portaled into; render it inside the PiP portal root. */
export default function CompanionAcquisitionOverlay({ events, label, consumedLabel = '' }: Props) {
  const reducedMotion = useReducedMotion()
  const seen = useRef<Set<string> | null>(null)
  const shownAt = useRef<{ token: string; at: number } | null>(null)
  const [queue, setQueue] = useState<AcquisitionOverlayEvent[]>([])
  const current = queue[0]
  const waiting = queue.length - 1

  useEffect(() => {
    // Events already present at mount (a reopened window, a restored run) are history, not new rewards.
    if (!seen.current) { seen.current = new Set(events.map(event => event.token)); return }
    const fresh = takeNewAcquisitions(events, seen.current, Date.now())
    if (fresh.length) setQueue(items => [...items, ...fresh])
  }, [events])
  useEffect(() => {
    if (!current) return
    // A burst arriving mid-display shortens the remaining time instead of restarting it.
    const shown = shownAt.current?.token === current.token ? shownAt.current : { token: current.token, at: Date.now() }
    shownAt.current = shown
    const remaining = acquisitionDwellMs(waiting) - (Date.now() - shown.at)
    const timeout = setTimeout(() => setQueue(items => items[0]?.token === current.token ? items.slice(1) : items), Math.max(0, remaining))
    return () => clearTimeout(timeout)
  }, [current, waiting])

  const still = !!reducedMotion
  return <div role="status" aria-live="polite" aria-atomic="true" className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex justify-center px-2 pt-2">
    <AnimatePresence mode="wait">
      {current?.kind === 'consumed' ? <motion.div key={current.token} data-consumed-overlay={current.token}
        initial={{ opacity: 0, y: still ? 0 : '-0.375rem' }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: still ? 1 : 0.97 }}
        transition={{ duration: still ? 0.12 : 0.2, ease: 'easeOut' }}
        className="flex w-full max-w-[21rem] items-center gap-2.5 rounded-sm border border-[var(--border)] bg-[var(--bg-panel)] py-2 pl-2.5 pr-3 shadow-[var(--shadow-lg)]">
        {/* The materials are drawn in: each icon dims and contracts toward the middle of the row, one after another. */}
        <span className="flex min-w-0 shrink-0 items-center" data-consumed-materials>
          {current.materials.map((material, index) => {
            const toward = (current.materials.length - 1) / 2 - index
            return <motion.span key={`${index}-${material.name}`} className="-ml-1.5 block w-9 first:ml-0"
              initial={still ? false : { opacity: 1, scale: 1, x: 0, filter: 'saturate(1) brightness(1)' }}
              animate={{ opacity: 0.55, scale: 0.8, x: still ? 0 : toward * 4, filter: 'saturate(0.35) brightness(0.8)' }}
              transition={{ duration: still ? 0 : 0.5, delay: still ? 0 : 0.12 + index * 0.07, ease: [0.4, 0, 0.6, 1] }}>
              <GiftArtwork gift={material.gift} displayName="" sizes="36px" />
            </motion.span>
          })}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 text-[0.6875rem] font-semibold leading-4 text-[var(--text-secondary)]"><Shrink size={12} strokeWidth={2.5} aria-hidden="true" />{consumedLabel}</span>
          <span className="mt-0.5 block line-clamp-2 break-keep text-[0.8125rem] leading-[1.125rem] text-[var(--text-primary)]">{current.materials.map(material => material.name).join(' · ')}</span>
        </span>
        {waiting > 0 && <span aria-hidden="true" className="shrink-0 self-start font-[family-name:var(--font-title)] text-sm leading-4 text-[var(--text-secondary)]">+{waiting}</span>}
      </motion.div> : current && <motion.div key={current.token} data-acquisition-overlay={current.token}
        initial={{ opacity: 0, y: still ? 0 : '-0.375rem' }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: still ? 0 : '-0.25rem' }}
        transition={{ duration: still ? 0.12 : 0.18, ease: 'easeOut' }}
        className="flex w-full max-w-[21rem] items-center gap-3 rounded-sm border border-[var(--border-gold)] bg-[var(--bg-panel)] py-2 pl-2 pr-3 shadow-[var(--shadow-lg)]">
        {/* The confirmation: the gift presses into place while an outline of its own frame closes onto it. */}
        <span className="relative block w-[3.25rem] shrink-0">
          <motion.span className="block" initial={still ? false : { scale: 1.14, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, ease: [0.2, 0.9, 0.3, 1] }}>
            <GiftArtwork gift={current.gift} displayName="" sizes="52px" />
          </motion.span>
          {!still && <motion.svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" data-acquisition-lock
            className="absolute inset-0 h-full w-full overflow-visible"
            initial={{ scale: 1.4, opacity: 0 }} animate={{ scale: 1, opacity: [0, 1, 0] }}
            transition={{ scale: { duration: 0.34, ease: [0.3, 0.8, 0.3, 1] }, opacity: { duration: 0.6, times: [0, 0.4, 1] } }}>
            <polygon points="12,0 88,0 100,12 100,88 88,100 12,100 0,88 0,12" fill="none" stroke="var(--gold-light)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          </motion.svg>}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 text-[0.6875rem] font-semibold leading-4 text-[var(--gold-light)]"><Check size={12} strokeWidth={3} aria-hidden="true" />{label}</span>
          <span className="mt-0.5 block line-clamp-2 break-keep font-[family-name:var(--font-heading)] text-[0.9375rem] leading-5 text-[var(--text-primary)]">{current.name}</span>
        </span>
        {waiting > 0 && <span aria-hidden="true" className="shrink-0 self-start font-[family-name:var(--font-title)] text-sm leading-4 text-[var(--text-secondary)]">+{waiting}</span>}
      </motion.div>}
    </AnimatePresence>
  </div>
}
