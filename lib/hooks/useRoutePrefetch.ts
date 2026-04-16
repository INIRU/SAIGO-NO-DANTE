'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

function shouldSkip(): boolean {
  if (typeof window === 'undefined') return true
  if (window.matchMedia('(prefers-reduced-data)').matches) return true
  const conn = (navigator as any).connection
  if (conn?.effectiveType && ['2g', '3g'].includes(conn.effectiveType)) return true
  const mem = (navigator as any).deviceMemory
  if (mem && mem < 4) return true
  return false
}

export function useRoutePrefetch(routes: string[], delay = 2000): void {
  const router = useRouter()

  useEffect(() => {
    if (shouldSkip()) return

    const timeoutId = setTimeout(() => {
      const run = () => {
        for (const route of routes) {
          try {
            router.prefetch(route)
          } catch {
            if (process.env.NODE_ENV === 'development') {
              console.debug(`[useRoutePrefetch] prefetch failed: ${route}`)
            }
          }
        }
      }

      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        requestIdleCallback(run, { timeout: 5000 })
      } else {
        setTimeout(run, 4000)
      }
    }, delay)

    return () => clearTimeout(timeoutId)
  }, [router, delay])
}
