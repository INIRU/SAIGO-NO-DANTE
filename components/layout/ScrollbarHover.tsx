'use client'

import { useEffect } from 'react'

// Pointer within this many px of a scroller's bar edge counts as "on the bar" (the bar itself is 10px).
const ZONE = 14

/**
 * Scrollbar parts cannot run CSS transitions of their own, so the thumb's thickness and colour are custom properties
 * animated on the scroller (globals.css, `data-sb-hot`). This marks the one scroller whose bar the pointer is on: "1"
 * while there, "0" after it leaves (so the way back is animated too). Mouse only: touch screens draw their own bars.
 */
export default function ScrollbarHover() {
  useEffect(() => {
    let hot: Element | null = null
    let frame = 0
    let last: PointerEvent | null = null
    const find = (event: PointerEvent): Element | null => {
      const root = document.documentElement
      // The page bar: with a stable gutter clientWidth can equal the window width, so the content width is the measure.
      const bar = window.innerWidth - Math.min(root.clientWidth, root.scrollWidth)
      if (bar >= 8 && event.clientX >= window.innerWidth - bar - (ZONE - 10)) return root
      for (let el = event.target instanceof Element ? event.target : null; el && el !== root && el !== document.body; el = el.parentElement) {
        if (!(el instanceof HTMLElement)) continue
        const down = el.offsetWidth - el.clientWidth >= 8, across = el.offsetHeight - el.clientHeight >= 8
        if (!down && !across) continue
        const box = el.getBoundingClientRect()
        if ((down && event.clientX >= box.right - ZONE) || (across && event.clientY >= box.bottom - ZONE)) return el
      }
      return null
    }
    const update = () => {
      frame = 0
      const next = last && last.pointerType === 'mouse' ? find(last) : null
      if (next === hot) return
      hot?.setAttribute('data-sb-hot', '0')
      next?.setAttribute('data-sb-hot', '1')
      hot = next
    }
    const move = (event: PointerEvent) => { last = event; if (!frame) frame = requestAnimationFrame(update) }
    const leave = () => { last = null; if (!frame) frame = requestAnimationFrame(update) }
    document.addEventListener('pointermove', move, { passive: true })
    document.documentElement.addEventListener('pointerleave', leave)
    return () => {
      document.removeEventListener('pointermove', move)
      document.documentElement.removeEventListener('pointerleave', leave)
      cancelAnimationFrame(frame)
    }
  }, [])
  return null
}
