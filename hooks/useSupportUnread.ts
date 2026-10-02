'use client'
import { useEffect, useState } from 'react'
import { useVisiblePoll } from './useVisiblePoll'

/** Navbar red dot: one no-store request on mount, when the tab comes back, and right after a thread is read. */
export function useSupportUnread(enabled: boolean) {
  const [unread, setUnread] = useState(false)
  useEffect(() => { if (!enabled) setUnread(false) }, [enabled])
  useVisiblePoll(enabled, alive => {
    fetch('/api/inquiries/unread', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive() && d) setUnread(d.unread === true)
      })
      .catch(() => {})
  }, 'support-read')
  return unread
}
