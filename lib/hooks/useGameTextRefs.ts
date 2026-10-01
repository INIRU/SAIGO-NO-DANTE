'use client'

import { createContext, useContext, useSyncExternalStore } from 'react'
import { useLocale } from 'next-intl'
import useSWR, { preload } from 'swr'
import type { GameTextRefDescriptions, GameTextRefNames } from '@/lib/db/game-text-refs'

const namesUrl = (locale: string) => `/api/game-text-refs/${locale}`
const descriptionsUrl = (locale: string) => `/api/game-text-refs/${locale}?part=descriptions`
const fetchJson = <T,>(url: string): Promise<T> =>
  fetch(url).then(response => { if (!response.ok) throw new Error(`${response.status}`); return response.json() })
// The tables only change with a game data sync: one request per language and page load is enough.
const OPTIONS = { revalidateOnFocus: false, revalidateIfStale: false, revalidateOnReconnect: false } as const

/**
 * The names the server already read for the page language (GameTextRefsProvider, fed by the [lang] layout): with them the
 * first render, on the server and when hydrating, draws the final text, so nothing swaps in after a request.
 */
export const GameTextRefsContext = createContext<{ locale: string; names: GameTextRefNames } | null>(null)

// Most pages hold no raw game text: the table is requested only once a text that may hold it has been formatted.
let wanted = false
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
const isWanted = () => wanted
const isWantedOnServer = () => false // the server render and the hydration render never fetch, so they agree

/** A text that may be raw game text was formatted: from now on the lazy hooks load the table. Safe to call while rendering. */
export function wantGameTextRefs() {
  if (wanted || typeof window === 'undefined') return
  wanted = true
  queueMicrotask(() => listeners.forEach(listener => listener()))
}

/**
 * What `[Id]` references of raw game text stand for in the page language: the names handed down by the server when there
 * are any (no request at all), otherwise requested from the API (null until loaded or when the request failed); one
 * request is shared by every component using the hook. With `lazy` nothing is requested until `wantGameTextRefs()` was
 * called (GameText itself always needs the table).
 */
export function useGameTextRefs({ lazy = false }: { lazy?: boolean } = {}): { names: GameTextRefNames | null } {
  const locale = useLocale()
  const provided = useContext(GameTextRefsContext)
  const fromServer = provided?.locale === locale ? provided.names : null
  const enabled = useSyncExternalStore(subscribe, isWanted, isWantedOnServer)
  const { data } = useSWR<GameTextRefNames>(fromServer || (lazy && !enabled) ? null : namesUrl(locale), fetchJson, OPTIONS)
  return { names: fromServer ?? data ?? null }
}

/** Starts loading the game descriptions (e.g. when a keyword is hovered) so the tooltip usually opens with its text. */
export function preloadGameTextRefDescriptions(locale: string) {
  void preload(descriptionsUrl(locale), fetchJson<GameTextRefDescriptions>).catch(() => {})
}

/** A keyword's game description in the page language: loaded when `enabled` (a tooltip is open); undefined while loading, '' when none. */
export function useGameTextRefDescription(id: string, enabled: boolean): string | undefined {
  const locale = useLocale()
  const { data, error } = useSWR<GameTextRefDescriptions>(enabled ? descriptionsUrl(locale) : null, fetchJson, OPTIONS)
  if (data) return data[id] ?? ''
  return error ? '' : undefined
}
