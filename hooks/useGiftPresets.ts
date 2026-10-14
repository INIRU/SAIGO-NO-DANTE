'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { readStored, useStored } from '@/hooks/useStored'
import {
  GIFT_PRESET_ACCOUNT_STORAGE, GIFT_PRESET_STORAGE, accountPresets, normalizePresets, presetRequest, presetSlot, presetSyncPlan, presetsFromRows,
  type GiftPresets,
} from '@/lib/mirror-dungeon/gift-presets'
import { showError } from '@/lib/toast'

const API = '/api/mirror-dungeon/gift-presets'
const SAVE_DELAY = 800

/**
 * Mirror Dungeon gift presets: kept in the browser for visitors and in the account for signed-in users. A change shows
 * at once and reaches the account a moment later, one request per changed slot. The browser keeps a copy of the account's
 * presets so the next visit draws them before the account answers. When the account cannot be read, the browser's own
 * presets are used and the failure is reported once.
 */
export function useGiftPresets(messages: { loadFailed: string; saveFailed: string }): [GiftPresets, (next: GiftPresets) => void] {
  const { status } = useSession()
  const [down, setDown] = useState(false)
  const account = status === 'authenticated' && !down
  const [presets, save] = useStored(account ? GIFT_PRESET_ACCOUNT_STORAGE : GIFT_PRESET_STORAGE, normalizePresets)
  // The request body last stored for each account slot; null until the account has been read.
  const synced = useRef<Map<number, string> | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [retry, setRetry] = useState(0)
  const busy = useRef(false)
  const again = useRef(false)
  const current = useRef({ list: presets.list, save, messages })
  useEffect(() => { current.current = { list: presets.list, save, messages } })

  useEffect(() => {
    if (status !== 'authenticated') { synced.current = null; return }
    let live = true
    fetch(API).then(res => res.ok ? res.json() : Promise.reject(new Error(String(res.status))))
      .then((body: { presets?: unknown }) => {
        if (!live) return
        const stored = presetsFromRows(body.presets)
        synced.current = new Map(stored.flatMap(preset => {
          const slot = presetSlot(preset.id), request = presetRequest(preset)
          return slot !== null && request !== null ? [[slot, request] as const] : []
        }))
        // The account wins over the browser's copy of it. An account without presets takes what this browser holds:
        // the first five, sent by the save below.
        current.current.save(stored.length
          ? normalizePresets({ active: normalizePresets(readStored(GIFT_PRESET_ACCOUNT_STORAGE)).active, list: stored })
          : accountPresets(normalizePresets(readStored(GIFT_PRESET_STORAGE))))
        setLoaded(true)
      })
      .catch(() => {
        if (!live) return
        synced.current = null
        setDown(true)
        showError(current.current.messages.loadFailed)
      })
    return () => { live = false }
  }, [status])

  const flush = useCallback(async () => {
    const held = synced.current
    if (!held) return
    if (busy.current) { again.current = true; return }
    busy.current = true
    let wait = 0
    try {
      const { puts, deletes } = presetSyncPlan(held, current.current.list)
      const requests = [
        ...puts.map(put => ({ url: API, init: { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: put.body }, done: () => { held.set(put.slot, put.body) } })),
        ...deletes.map(slot => ({ url: `${API}?slot=${slot}`, init: { method: 'DELETE' }, done: () => { held.delete(slot) } })),
      ]
      for (const request of requests) {
        // keepalive: the last change still goes out when the page is being left.
        const res = await fetch(request.url, { ...request.init, keepalive: true })
        // Too many requests in a minute: nothing is lost, it is sent again after the wait the server names.
        if (res.status === 429) { wait = Math.min(Number(res.headers.get('Retry-After')) || 10, 60) * 1000; break }
        if (!res.ok) throw new Error(String(res.status))
        request.done()
      }
    } catch {
      showError(current.current.messages.saveFailed)
    } finally {
      busy.current = false
      // A change made while these requests were out, or a refused one, goes out with the next delay.
      const rerun = wait > 0 || again.current
      again.current = false
      if (rerun) setTimeout(() => setRetry(count => count + 1), wait)
    }
  }, [])

  useEffect(() => {
    if (!account || !loaded) return
    const timer = setTimeout(flush, SAVE_DELAY)
    return () => clearTimeout(timer)
  }, [account, loaded, presets.list, retry, flush])

  // Leaving the tab or the page before the delay has passed must not drop the last change.
  useEffect(() => {
    const leave = () => { if (document.visibilityState === 'hidden') void flush() }
    document.addEventListener('visibilitychange', leave)
    return () => { document.removeEventListener('visibilitychange', leave); void flush() }
  }, [flush])

  return [presets, save]
}
