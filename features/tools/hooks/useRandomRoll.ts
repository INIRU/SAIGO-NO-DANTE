'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import type { RandomResult } from '@/features/tools/lib/random/engine'
import { REVEAL_CARD_MS, revealDuration } from '@/features/tools/lib/random/display'
import { newRoll, rerollSinner, resolveSnapshot, type RollData, type RollSettings, type RollSnapshot } from '@/features/tools/lib/random/roll'
import { createSeed } from '@/features/tools/lib/random/seed'

export type RollState = {
  snapshot: RollSnapshot
  result: RandomResult
  /** The owned-only pool the roll was drawn from (rerolls draw from the same one). */
  ownedIds: Set<string> | null
  /** Sinners drawn by the latest action: the ones that play the reveal. Locked ones that stayed are not in it. */
  fresh: ReadonlySet<string>
  /** Per sinner, the action that last drew its card; a new value makes the card come in again. */
  stamps: Record<string, number>
}

/**
 * The current roll and what can be done to it: roll again (marked sinners stay), reroll one sinner, mark/unmark a lock,
 * restore a snapshot from a link or the recent list, and the reveal that runs after each of these until it ends or is
 * skipped. With reduced motion there is no reveal. `rolling` is a whole-board reveal (it holds the roll button busy).
 */
export function useRandomRoll(data: RollData) {
  const reduceMotion = useReducedMotion()
  const [roll, setRoll] = useState<RollState | null>(null)
  const [marks, setMarks] = useState<string[]>([])
  const [reveal, setReveal] = useState<'roll' | 'reroll' | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const epoch = useRef(0)

  const play = useCallback((kind: 'roll' | 'reroll', ms: number) => {
    clearTimeout(timer.current)
    if (reduceMotion) { setReveal(null); return }
    setReveal(kind)
    timer.current = setTimeout(() => setReveal(null), ms)
  }, [reduceMotion])
  const skip = useCallback(() => {
    clearTimeout(timer.current)
    setReveal(null)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])

  const start = useCallback((input: { settings: RollSettings; collectionCode: string | null; ownedIds: Set<string> | null }) => {
    const { snapshot, result } = newRoll(data, { seed: createSeed(), settings: input.settings, marks, collectionCode: input.collectionCode, previous: roll?.result ?? null }, input.ownedIds)
    const kept = new Set(snapshot.locks.map(lock => lock.sinnerId))
    const fresh = new Set(data.sinners.map(sinner => sinner.id).filter(id => !kept.has(id)))
    const stamp = ++epoch.current
    const stamps = Object.fromEntries(data.sinners.map(sinner => [sinner.id, fresh.has(sinner.id) ? stamp : roll?.stamps[sinner.id] ?? stamp]))
    setRoll({ snapshot, result, ownedIds: input.ownedIds, fresh, stamps })
    play('roll', revealDuration(fresh.size))
  }, [data, marks, roll, play])

  /** False when the sinner has no other identity to draw. */
  const rerollOne = useCallback((sinnerId: string) => {
    if (!roll) return false
    const next = rerollSinner(data, roll.snapshot, roll.ownedIds, roll.result, sinnerId)
    if (!next) return false
    setRoll({ ...roll, snapshot: next.snapshot, result: next.result, fresh: new Set([sinnerId]), stamps: { ...roll.stamps, [sinnerId]: ++epoch.current } })
    play('reroll', REVEAL_CARD_MS)
    return true
  }, [data, roll, play])

  const toggleMark = useCallback((sinnerId: string) => {
    setMarks(current => current.includes(sinnerId) ? current.filter(id => id !== sinnerId) : [...current, sinnerId])
  }, [])

  const restore = useCallback((snapshot: RollSnapshot, ownedIds: Set<string> | null) => {
    const result = resolveSnapshot(data, snapshot, ownedIds)
    const stamp = ++epoch.current
    setMarks(snapshot.marks)
    setRoll({ snapshot, result, ownedIds, fresh: new Set(data.sinners.map(sinner => sinner.id)), stamps: Object.fromEntries(data.sinners.map(sinner => [sinner.id, stamp])) })
    play('roll', revealDuration(data.sinners.length))
  }, [data, play])

  /** The link of what is on screen: the roll's snapshot with the marks as they are now. */
  const shareSnapshot = useMemo(() => (roll ? { ...roll.snapshot, marks } : null), [roll, marks])

  return { roll, marks, revealing: reveal !== null, rolling: reveal === 'roll', shareSnapshot, start, rerollOne, toggleMark, restore, skip }
}
