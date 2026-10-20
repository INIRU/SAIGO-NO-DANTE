'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { clearAutosave, readAutosave, shouldOfferAutosave, writeAutosave } from '@/lib/drafts/autosave'

const DELAY_MS = 1500

/**
 * Saves the editor state to localStorage a moment after each change and, when an earlier draft that differs from the
 * state the editor opened with exists, offers it back. Nothing is saved until the offer is answered, so a pending draft
 * is never overwritten. `ready` is true once the editor holds its opening state (loaded plan, fork, empty form).
 * `savedAt` is when the item was last saved on the server: an older draft is dropped instead of offered.
 * `apply` returns false when the draft could not be applied; `restore` passes that on for the toast.
 */
export function useAutosaveDraft<T>({ storageKey, state, isState, ready, enabled = true, savedAt = null, apply }: {
  storageKey: string
  state: T
  isState: (state: unknown) => state is T
  ready: boolean
  enabled?: boolean
  savedAt?: number | null
  apply: (state: T) => boolean | void
}) {
  const [offer, setOffer] = useState<{ savedAt: number; state: T } | null>(null)
  const [answered, setAnswered] = useState(false)
  const baseline = useRef<string | null>(null)
  const stopped = useRef(false)
  const latest = useRef(state)
  latest.current = state

  useEffect(() => {
    if (!ready || !enabled || baseline.current !== null) return
    baseline.current = JSON.stringify(latest.current)
    const stored = readAutosave(storageKey, isState)
    if (stored && shouldOfferAutosave(stored, baseline.current, savedAt)) setOffer(stored)
    else { if (stored) clearAutosave(storageKey); setAnswered(true) }
  }, [ready, enabled, storageKey, isState, savedAt])

  useEffect(() => {
    if (!answered || stopped.current) return
    const timer = setTimeout(() => {
      if (stopped.current) return
      if (JSON.stringify(latest.current) === baseline.current) clearAutosave(storageKey)
      else writeAutosave(storageKey, latest.current)
    }, DELAY_MS)
    return () => clearTimeout(timer)
  }, [answered, state, storageKey])

  const restore = useCallback((): boolean => {
    let applied = true
    try { if (offer) applied = apply(offer.state) !== false } catch { applied = false }
    setOffer(null)
    setAnswered(true)
    return applied
  }, [offer, apply])
  const discard = useCallback(() => {
    clearAutosave(storageKey)
    setOffer(null)
    setAnswered(true)
  }, [storageKey])
  /** After a successful save: drops the draft and stops saving. */
  const clear = useCallback(() => {
    stopped.current = true
    clearAutosave(storageKey)
  }, [storageKey])

  return { offer, restore, discard, clear }
}
