import { useEffect, useCallback } from 'react'

interface UseIdlePrefetchOptions {
  /**
   * Delay before initiating prefetch (ms).
   * Use 1500-2500 to let page become interactive first.
   */
  delay?: number

  /**
   * Priority level for requestIdleCallback timeout.
   * 'high' = 2000ms timeout, 'low' = 5000ms timeout.
   */
  priority?: 'low' | 'high'

  /**
   * Optional SWR dedup key. If provided, checks SWR cache
   * before fetching to avoid duplicate requests.
   */
  dedupKey?: string

  /**
   * Skip prefetch if condition is false.
   * Use for conditional prefetch (e.g., only after scroll).
   */
  enabled?: boolean
}

/**
 * Hook for idle-time data prefetching using requestIdleCallback.
 *
 * Automatically skips prefetch on:
 * - Slow networks (2g, 3g via navigator.connection.effectiveType)
 * - Low-memory devices (<4GB via navigator.deviceMemory)
 * - User preference for reduced data (prefers-reduced-data media query)
 * - When enabled=false
 *
 * @param fetchFn Async function that returns Promise (e.g., fetch() call)
 * @param options Configuration
 *
 * @example
 * const prefetchThemes = useCallback(async () => {
 *   const res = await fetch('/api/mirror-dungeon/themes')
 *   // Data cached via SWR automatically
 * }, [])
 *
 * useIdlePrefetch(prefetchThemes, {
 *   delay: 1500,
 *   priority: 'low',
 *   dedupKey: '/api/mirror-dungeon/themes'
 * })
 */
export function useIdlePrefetch(
  fetchFn: () => Promise<any>,
  options: UseIdlePrefetchOptions = {}
): void {
  const {
    delay = 2000,
    priority = 'low',
    dedupKey,
    enabled = true,
  } = options

  // Memoize to prevent effect re-runs
  const memoizedFetch = useCallback(fetchFn, [fetchFn])

  useEffect(() => {
    // Skip if disabled
    if (!enabled) return

    // Skip if user prefers reduced data
    if (typeof window !== 'undefined') {
      const prefersReducedData = window.matchMedia('(prefers-reduced-data)').matches
      if (prefersReducedData) return

      // Skip on slow networks
      const connection = (navigator as any).connection
      if (connection?.effectiveType && ['2g', '3g'].includes(connection.effectiveType)) {
        return
      }

      // Skip on low-memory devices
      const deviceMemory = (navigator as any).deviceMemory
      if (deviceMemory && deviceMemory < 4) {
        return
      }
    }

    // Schedule prefetch after delay
    const timeoutId = setTimeout(() => {
      if ('requestIdleCallback' in window) {
        // Use requestIdleCallback for true idle scheduling
        requestIdleCallback(
          () => {
            // Execute fetch (will be cached by SWR if same URL called again)
            memoizedFetch().catch(() => {
              // Silent fail — don't disrupt user experience
              if (process.env.NODE_ENV === 'development') {
                console.debug(`[useIdlePrefetch] Prefetch failed for dedupKey: ${dedupKey}`)
              }
            })
          },
          { timeout: priority === 'high' ? 2000 : 5000 }
        )
      } else {
        // Fallback for older browsers: use setTimeout
        // Add 4s to delay to ensure page is interactive
        setTimeout(() => {
          memoizedFetch().catch(() => {})
        }, 4000)
      }
    }, delay)

    // Cleanup: cancel scheduled prefetch if component unmounts
    return () => clearTimeout(timeoutId)
  }, [memoizedFetch, delay, priority, enabled])
}
