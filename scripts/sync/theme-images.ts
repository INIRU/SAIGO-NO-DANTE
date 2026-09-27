import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Theme pack images the extracted floor data needs that Storage lacks: `<id>.webp` and `boss/<bossSpriteId>.webp` paths
 * under icons/theme-packs (the composer writes the same paths under its output), and the theme ids to compose for them.
 */
export function missingThemeImages(data: string, stored: { packs: ReadonlySet<string>; bosses: ReadonlySet<string> }) {
  const ids = new Set<number>()
  const files = new Set<string>()
  for (const file of readdirSync(data).filter(name => /^mirrordungeon-theme-floor-(?:t\d+|hidden)\.txt$/.test(name)).sort()) {
    for (const entry of JSON.parse(readFileSync(join(data, file), 'utf8').replace(/^\uFEFF/, '')).list ?? []) {
      const ui = entry.uiConfigs ?? {}
      if (!ui.packSpriteId) continue
      const pack = `${entry.id}.webp`
      const boss = ui.bossSpriteId ? `${ui.bossSpriteId}.webp` : null
      if (!stored.packs.has(pack)) files.add(pack)
      if (boss && !stored.bosses.has(boss)) files.add(`boss/${boss}`)
      if (!stored.packs.has(pack) || (boss && !stored.bosses.has(boss))) ids.add(Number(entry.id))
    }
  }
  return { ids: [...ids], files: [...files] }
}
