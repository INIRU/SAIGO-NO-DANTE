'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { freshForToast, type Notification } from '@/lib/notifications'
import { useVisiblePoll } from './useVisiblePoll'

type Feed = { items: Notification[]; unread: number }
const EMPTY: Feed = { items: [], unread: 0 }
const REFRESH_MS = 5 * 60_000
/** When the newest notification already announced with a toast was written (per browser). */
const TOASTED_KEY = 'notify-toasted-at'

const load = (): Promise<Feed | null> => fetch('/api/notifications', { cache: 'no-store' })
  .then(r => (r.ok ? r.json() : null))
  .then(d => (d ? { items: d.items ?? [], unread: d.unread ?? 0 } : null))
  .catch(() => null)

/**
 * Comment notifications for the navbar: `unread` is the bell's count, `items` the panel's list. Checked on mount, when the
 * tab comes back and every five minutes; unread ones not announced before go to `onFresh` once (newest first).
 * `open()` is for when the panel is shown: it loads the latest and marks it read; the items keep their unread marks
 * until the next check, so the reader still sees which ones were new.
 */
export function useNotifications(enabled: boolean, onFresh: (items: Notification[]) => void) {
  const [feed, setFeed] = useState(EMPTY)
  const announce = useRef(onFresh)
  announce.current = onFresh
  // Answers are applied only if nothing newer started meanwhile: a slow check must not bring back what open() just read,
  // and nothing arrives after sign-out.
  const generation = useRef(0)
  useEffect(() => {
    if (!enabled) setFeed(EMPTY)
    return () => { generation.current++ }
  }, [enabled])
  useVisiblePoll(enabled, alive => {
    const mine = generation.current
    void load().then(next => {
      if (!alive() || !next || mine !== generation.current) return
      setFeed(next)
      try {
        const fresh = freshForToast(next.items, localStorage.getItem(TOASTED_KEY))
        if (!fresh.length) return
        localStorage.setItem(TOASTED_KEY, fresh[0].at!)
        announce.current(fresh)
      } catch {
        // Storage blocked: no toast this time; the list itself is already shown.
      }
    })
  }, undefined, REFRESH_MS)
  const open = useCallback(async () => {
    const mine = ++generation.current
    const next = await load()
    if (!next || mine !== generation.current) return
    setFeed({ items: next.items, unread: 0 })
    if (!next.unread) return
    await fetch('/api/notifications', { method: 'POST' }).catch(() => {})
    // Checks sent before the server marked them read are stale now.
    generation.current++
  }, [])
  return { ...feed, open }
}
