'use client'

import { useState, useEffect, useRef } from 'react'

/**
 * Progressively reveals items as the user scrolls toward a sentinel element. The observer is renewed after each step,
 * so a sentinel still in view (a tall screen, a short step) keeps revealing instead of waiting for a scroll.
 */
export function useProgressiveRender(total: number, step = 8) {
  const [visible, setVisible] = useState(step)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setVisible(step)
  }, [total, step])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || visible >= total) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(prev => Math.min(prev + step, total))
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [total, step, visible])

  return { visible, sentinelRef }
}
