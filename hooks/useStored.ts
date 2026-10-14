'use client'

import { useCallback, useEffect, useState } from 'react'

/** The JSON value under a localStorage key, or null when there is none or it cannot be read. */
export function readStored(key: string): unknown {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') } catch { return null }
}

/** A JSON value kept in localStorage. It is read after mount, so the prerendered page hydrates unchanged. */
export function useStored<T>(key: string, parse: (saved: unknown) => T): [T, (next: T) => void] {
  const [value, setValue] = useState(() => parse(null))
  useEffect(() => { setValue(parse(readStored(key))) }, [key, parse])
  const save = useCallback((next: T) => {
    setValue(next)
    try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* private mode: kept for this page only */ }
  }, [key])
  return [value, save]
}
