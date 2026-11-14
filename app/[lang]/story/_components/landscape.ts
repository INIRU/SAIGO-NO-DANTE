import { useEffect } from 'react'

// Phones and tablets held upright draw the story turned to landscape (USER: 모바일은 가로 화면으로 무조건): story.css
// turns the whole body 90° clockwise. Pointer positions come in screen pixels, so they are turned back here.
const TURNED = '(orientation: portrait) and (pointer: coarse)'

/** A client point as a point on the (maybe turned) story screen, from its top-left */
export function local(cx: number, cy: number): [number, number] {
  if (typeof window === 'undefined' || !window.matchMedia(TURNED).matches) return [cx, cy]
  // turned 90° clockwise: the screen's x runs down the device, its y from the device's right edge to the left
  return [cy, document.documentElement.clientWidth - cx]
}

/** On the turned screen the browser's own touch scrolling runs along the device, not the screen: a finger on a scroll
 * box (the chapter list, the stage panel, the event window) scrolls it here along the turned axes, with a glide after.
 * The map and the dungeon take their own pointer drags (no scroll box under them). */
export function useTurnedTouchScroll() {
  useEffect(() => {
    const mq = window.matchMedia(TURNED)
    let box: HTMLElement | null = null, last: [number, number] | null = null, vel: [number, number] = [0, 0], at = 0, raf = 0
    const scrollBox = (n: Element | null): HTMLElement | null => {
      for (; n && n !== document.body; n = n.parentElement) {
        const s = getComputedStyle(n)
        if ((/auto|scroll/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 1) || (/auto|scroll/.test(s.overflowX) && n.scrollWidth > n.clientWidth + 1)) return n as HTMLElement
      }
      return null
    }
    const start = (e: TouchEvent) => {
      cancelAnimationFrame(raf)
      box = mq.matches && e.touches.length === 1 ? scrollBox(e.target as Element) : null
      if (box) { last = local(e.touches[0].clientX, e.touches[0].clientY); vel = [0, 0]; at = performance.now() }
    }
    const move = (e: TouchEvent) => {
      if (!box || !last || e.touches.length !== 1) return
      const p = local(e.touches[0].clientX, e.touches[0].clientY), dx = p[0] - last[0], dy = p[1] - last[1]
      box.scrollLeft -= dx
      box.scrollTop -= dy
      const now = performance.now(), dt = Math.max(1, now - at)
      vel = [dx / dt, dy / dt]
      at = now
      last = p
      e.preventDefault()
    }
    const end = () => {
      const b = box
      box = null
      last = null
      if (!b) return
      let [vx, vy] = vel, prev = performance.now()
      const glide = (now: number) => {
        const dt = now - prev, f = Math.pow(0.95, dt / 16)
        prev = now
        b.scrollLeft -= vx * dt
        b.scrollTop -= vy * dt
        vx *= f
        vy *= f
        if (Math.hypot(vx, vy) > 0.02) raf = requestAnimationFrame(glide)
      }
      raf = requestAnimationFrame(glide)
    }
    document.addEventListener('touchstart', start, { passive: true })
    document.addEventListener('touchmove', move, { passive: false })
    document.addEventListener('touchend', end)
    document.addEventListener('touchcancel', end)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('touchstart', start)
      document.removeEventListener('touchmove', move)
      document.removeEventListener('touchend', end)
      document.removeEventListener('touchcancel', end)
    }
  }, [])
}

/** A phone or tablet (a coarse pointer): the half-size pictures (story_map.py half_tiles) are used there */
export const isTouch = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
