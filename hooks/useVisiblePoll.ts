'use client'
import { useEffect, useRef } from 'react'

const MIN_GAP_MS = 30_000

/**
 * Runs `check` on mount, when the tab comes back (at most once per 30 s), whenever `event` (if given) fires on window, and
 * every `everyMs` (if given) while the tab is visible. `check` receives `alive()`, false once the hook is disabled or unmounted.
 */
export function useVisiblePoll(enabled: boolean, check: (alive: () => boolean) => void, event?: string, everyMs?: number) {
  const latest = useRef(check)
  latest.current = check
  useEffect(() => {
    if (!enabled) return
    let alive = true
    let last = 0
    const run = (force = false) => {
      if (document.visibilityState !== 'visible' || (!force && Date.now() - last < MIN_GAP_MS)) return
      last = Date.now()
      latest.current(() => alive)
    }
    const onReturn = () => run()
    const onEvent = () => run(true)
    run(true)
    document.addEventListener('visibilitychange', onReturn)
    window.addEventListener('focus', onReturn)
    if (event) window.addEventListener(event, onEvent)
    const timer = everyMs ? setInterval(onReturn, everyMs) : undefined
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onReturn)
      window.removeEventListener('focus', onReturn)
      if (event) window.removeEventListener(event, onEvent)
      clearInterval(timer)
    }
  }, [enabled, event, everyMs])
}
