'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface NavigatorWithConnection extends Navigator {
  connection?: {
    effectiveType?: string
  }
  deviceMemory?: number
}

function shouldSkip(): boolean {
  if (typeof window === 'undefined') return true
  if (window.matchMedia('(prefers-reduced-data)').matches) return true
  const nav = navigator as NavigatorWithConnection
  const conn = nav.connection
  if (conn?.effectiveType && ['2g', '3g'].includes(conn.effectiveType)) return true
  const mem = nav.deviceMemory
  if (mem && mem < 4) return true
  return false
}

export function useRoutePrefetch(routes: string[], delay = 2000, enabled = false): void {
  const router = useRouter()
  const routeKey = routes.join('\n')

  useEffect(() => {
    if (!enabled || !routeKey || shouldSkip()) return

    const routeList = routeKey.split('\n').filter(Boolean)
    let idleId: number | undefined
    let fallbackId: number | undefined

    const timeoutId = window.setTimeout(() => {
      const run = () => {
        for (const route of routeList) {
          try {
            router.prefetch(route)
          } catch {
            if (process.env.NODE_ENV === 'development') {
              console.debug(`[useRoutePrefetch] prefetch failed: ${route}`)
            }
          }
        }
      }

      const requestIdleCallback = window.requestIdleCallback
      if (typeof requestIdleCallback === 'function') {
        idleId = requestIdleCallback(run, { timeout: 5000 })
      } else {
        fallbackId = window.setTimeout(run, 4000)
      }
    }, delay)

    return () => {
      window.clearTimeout(timeoutId)
      if (idleId !== undefined) window.cancelIdleCallback(idleId)
      if (fallbackId !== undefined) window.clearTimeout(fallbackId)
    }
  }, [router, delay, enabled, routeKey])
}
