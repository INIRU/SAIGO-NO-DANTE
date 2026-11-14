'use client'

import { useCallback, useSyncExternalStore } from 'react'

// The furthest chapter the reader has opened: one subchapter id in this browser. Nothing stored = only the first.
const KEY = 'story-progress'
const listeners = new Set<() => void>()

function read(): number | null {
  try {
    const v = Number(localStorage.getItem(KEY))
    return Number.isFinite(v) && v > 0 ? v : null
  } catch {
    return null
  }
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) fn() }
  window.addEventListener('storage', onStorage)
  return () => { listeners.delete(fn); window.removeEventListener('storage', onStorage) }
}

/** The chapter the reader has read up to, and its setter (null clears it). */
export function useStoryProgress(): [number | null, (id: number | null) => void] {
  // The server draws "nothing opened yet" (everything after the first chapter hidden); the stored chapters appear
  // right after hydration, so the page can flash ??? but never a spoiler.
  const progress = useSyncExternalStore(subscribe, read, () => null)
  const set = useCallback((id: number | null) => {
    try {
      if (id == null) localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, String(id))
    } catch { /* storage blocked: the choice lasts until reload */ }
    listeners.forEach(fn => fn())
  }, [])
  return [progress, set]
}
