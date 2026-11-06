'use client'
import { useEffect } from 'react'

/**
 * Locks page scroll while a board list is shown. Cache Components keeps visited
 * routes mounted but hidden, so a CSS :has() lock would leak onto the next page;
 * effect cleanup runs when the route is hidden.
 */
export default function BoardBrowseLock() {
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('board-browse')
    return () => root.classList.remove('board-browse')
  }, [])
  return null
}
