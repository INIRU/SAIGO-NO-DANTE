'use client'

import { useEffect, type RefObject } from 'react'
import { nextWheelGesture, wheelPixels, type WheelGesture } from '@/lib/utils/wheel-intent'

/**
 * A scrolling panel inside the page that a page scroll passes through: a wheel gesture that started on the page keeps
 * scrolling the page over the panel; one started over the panel scrolls the panel, and at its end the page (native chaining).
 * Touch scrolling is left alone.
 */
export function useWheelIntent(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const panel = ref.current
    if (!panel) return
    let gesture: WheelGesture | null = null
    // the page's own wheel events only mark who owns the gesture; passive, so page scrolling is never held up
    const onPageWheel = (event: WheelEvent) => {
      if (!panel.contains(event.target as Node)) gesture = nextWheelGesture(gesture, event.timeStamp, false)
    }
    const onPanelWheel = (event: WheelEvent) => {
      gesture = nextWheelGesture(gesture, event.timeStamp, true)
      if (gesture.owner === 'panel' || event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
      event.preventDefault()
      scrollBy({ top: wheelPixels(event.deltaY, event.deltaMode, innerHeight), behavior: 'instant' })
    }
    addEventListener('wheel', onPageWheel, { passive: true, capture: true })
    panel.addEventListener('wheel', onPanelWheel, { passive: false })
    return () => {
      removeEventListener('wheel', onPageWheel, { capture: true })
      panel.removeEventListener('wheel', onPanelWheel)
    }
  }, [ref])
}
