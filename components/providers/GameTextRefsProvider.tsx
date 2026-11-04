'use client'

import { useMemo } from 'react'
import { GameTextRefsContext } from '@/lib/hooks/useGameTextRefs'
import { expandGameTextRefNames, type GameTextRefNamesWire } from '@/lib/game-text/ref-names-wire'

/**
 * Hands the reference names the server read (getGameTextRefNamesWire, cached) to every game text below, so `[Id]` is drawn as
 * its name already in the server HTML and the hydration render. They arrive in the layout's smaller form and are restored
 * here to the one every reader uses. `names` null (the read failed): readers request them.
 */
export function GameTextRefsProvider({ locale, names, children }: { locale: string; names: GameTextRefNamesWire | null; children: React.ReactNode }) {
  const value = useMemo(() => (names ? { locale, names: expandGameTextRefNames(names) } : null), [locale, names])
  return <GameTextRefsContext.Provider value={value}>{children}</GameTextRefsContext.Provider>
}
