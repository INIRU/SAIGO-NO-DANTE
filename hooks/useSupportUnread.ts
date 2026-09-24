'use client'
import { useEffect, useState } from 'react'
const MIN_GAP_MS = 30_000
/** Navbar red dot: one no-store request on mount, when the tab comes back, and right after a thread is read. */
export function useSupportUnread(enabled: boolean) {
  const [unread, setUnread] = useState(false)
  useEffect(() => {
    if (!enabled) {
      setUnread(false)
      return
    }
    let alive = true
    let last = 0
    const check = (force = false) => {
      if (document.visibilityState !== 'visible' || (!force && Date.now() - last < MIN_GAP_MS)) return
      last = Date.now()
      fetch('/api/inquiries/unread', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (alive && d) setUnread(d.unread === true)
        })
        .catch(() => {})
    }
    const onReturn = () => check()
    const onRead = () => check(true)
    check(true)
    document.addEventListener('visibilitychange', onReturn)
    window.addEventListener('focus', onReturn)
    window.addEventListener('support-read', onRead)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onReturn)
      window.removeEventListener('focus', onReturn)
      window.removeEventListener('support-read', onRead)
    }
  }, [enabled])
  return unread
}
