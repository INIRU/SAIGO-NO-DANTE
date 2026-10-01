'use client'

import { useMemo } from 'react'
import { GameTextRefsContext } from '@/lib/hooks/useGameTextRefs'
import type { GameTextRefNames } from '@/lib/db/game-text-refs'

/**
 * Hands the reference names the server read (getGameTextRefNames, cached) to every game text below, so `[Id]` is drawn as
 * its name already in the server HTML and the hydration render. `names` null (the read failed): readers request them.
 */
export function GameTextRefsProvider({ locale, names, children }: { locale: string; names: GameTextRefNames | null; children: React.ReactNode }) {
  const value = useMemo(() => (names ? { locale, names } : null), [locale, names])
  return <GameTextRefsContext.Provider value={value}>{children}</GameTextRefsContext.Provider>
}
