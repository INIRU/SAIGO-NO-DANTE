import { useEffect, useState, type RefObject } from 'react'

/**
 * Calls loadMore while the returned ref's element is near the bottom of rootRef (or the viewport).
 * The element is tracked through a callback ref so the observer attaches whenever it mounts, e.g. when a list
 * appears after a shelf or skeleton, not only on the first render.
 */
export function useLoadMoreSentinel(loadMore: () => void, rootRef: RefObject<HTMLElement | null>, resetKey?: unknown) {
  const [sentinel, setSentinel] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!sentinel) return
    const observer = new IntersectionObserver(
      entries => { if (entries[0]?.isIntersecting) loadMore() },
      { root: rootRef.current, rootMargin: '300px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [sentinel, loadMore, rootRef, resetKey])
  return setSentinel
}
