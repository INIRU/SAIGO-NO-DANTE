'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

type NavigatorConnection = {
  effectiveType?: string
  saveData?: boolean
}

type NavigatorWithNetworkHints = Navigator & {
  connection?: NavigatorConnection
  deviceMemory?: number
}

function shouldSkip(): boolean {
  if (typeof window === 'undefined') return true
  if (window.matchMedia('(prefers-reduced-data)').matches) return true
  const nav = navigator as NavigatorWithNetworkHints
  const conn = nav.connection
  if (conn?.saveData) return true
  if (conn?.effectiveType && ['slow-2g', '2g', '3g'].includes(conn.effectiveType)) return true
  const mem = nav.deviceMemory
  if (mem && mem < 4) return true
  return false
}

export function useRoutePrefetch(routes: string[], delay = 2000, enabled = false): void {
  const router = useRouter()
  const routesKey = routes.join('\0')

  useEffect(() => {
    if (!enabled || shouldSkip()) return
    const routeList = routesKey ? routesKey.split('\0') : []
    if (routeList.length === 0) return

    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let idleId: number | undefined

    const prefetchOne = (index: number) => {
      if (cancelled || index >= routeList.length) return

      const run = () => {
        if (cancelled) return
        const route = routeList[index]
        try {
          router.prefetch(route)
        } catch {
          if (process.env.NODE_ENV === 'development') {
            console.debug(`[useRoutePrefetch] prefetch failed: ${route}`)
          }
        }
        prefetchOne(index + 1)
      }

      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        idleId = window.requestIdleCallback(run, { timeout: 5000 })
      } else {
        timeoutId = setTimeout(run, 4000)
      }
    }

    timeoutId = setTimeout(() => {
      prefetchOne(0)
    }, delay)

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
      if (idleId !== undefined && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId)
      }
    }
  }, [router, routesKey, delay, enabled])
}
