import type { GameTextRefNames } from '@/lib/game-text/ref-names'

/**
 * The reference names as the [lang] layout hands them down: every browser load carries them, so what the readers can
 * rebuild is left out. `s`: a skill tag (else a keyword); `i`: the buff's icon file, `1` when it is named after the id.
 */
export type GameTextRefNamesWire = Record<string, { n: string; s?: 1; kw?: string; i?: string | 1 }>

const gameIcon = (id: string) => `game-${id}`

export function compactGameTextRefNames(names: GameTextRefNames): GameTextRefNamesWire {
  const out: GameTextRefNamesWire = {}
  for (const [id, ref] of Object.entries(names)) {
    out[id] = {
      n: ref.n,
      ...(ref.k === 'skilltag' ? { s: 1 as const } : {}),
      ...(ref.kw ? { kw: ref.kw } : {}),
      ...(ref.i ? { i: ref.i === gameIcon(id) ? (1 as const) : ref.i } : {}),
    }
  }
  return out
}

/** The names every reader (GameText, useGameTextRefs) gets, the same as `gameTextRefNames` builds them. */
export function expandGameTextRefNames(wire: GameTextRefNamesWire): GameTextRefNames {
  const out: GameTextRefNames = {}
  for (const [id, ref] of Object.entries(wire)) {
    out[id] = {
      k: ref.s ? 'skilltag' : 'keyword',
      n: ref.n,
      ...(ref.kw ? { kw: ref.kw } : {}),
      ...(ref.i ? { i: ref.i === 1 ? gameIcon(id) : ref.i } : {}),
    }
  }
  return out
}
