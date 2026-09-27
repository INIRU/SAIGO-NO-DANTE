import { useEffect, useState, type RefObject } from 'react'

/**
 * Calls loadMore while the returned ref's element is near the bottom of rootRef (or the viewport).
 * rootRef is used only while it actually clips its content (desktop workspace lists); phone layouts let the
 * page scroll, so the viewport is the root there.
 * The element is tracked through a callback ref so the observer attaches whenever it mounts, e.g. when a list
 * appears after a shelf or skeleton, not only on the first render.
 */
export function useLoadMoreSentinel(loadMore: () => void, rootRef: RefObject<HTMLElement | null>, resetKey?: unknown) {
  const [sentinel, setSentinel] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!sentinel) return
    const root = rootRef.current
    // read once per mount; resizing across the lg breakpoint keeps the old root until the list reloads.
    const clips = root && getComputedStyle(root).overflowY !== 'visible'
    const observer = new IntersectionObserver(
      entries => { if (entries[0]?.isIntersecting) loadMore() },
      { root: clips ? root : null, rootMargin: '300px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [sentinel, loadMore, rootRef, resetKey])
  return setSentinel
}
