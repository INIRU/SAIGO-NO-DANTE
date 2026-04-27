'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'

const PING_INTERVAL_MS = 5 * 60 * 1000
let inFlightPing = false

export function SessionActivityPing() {
  const { status } = useSession()

  useEffect(() => {
    if (status !== 'authenticated') return

    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const ping = async () => {
      if (cancelled) return
      if (inFlightPing) {
        timeoutId = setTimeout(ping, PING_INTERVAL_MS)
        return
      }
      try {
        inFlightPing = true
        await fetch('/api/profile/activity', {
          method: 'POST',
          cache: 'no-store',
          keepalive: true,
        })
      } catch {
        // Activity metadata is best-effort and must not disrupt the session.
      } finally {
        inFlightPing = false
      }
      if (!cancelled) {
        timeoutId = setTimeout(ping, PING_INTERVAL_MS)
      }
    }

    ping()

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [status])

  return null
}
