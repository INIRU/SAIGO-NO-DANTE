import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Kind the extraction tool gives its composed theme pack cards (name: theme id, 416x684 PNG). */
export const COMPOSED_THEME_KIND = '합성 테마팩'

/** Storage paths under icons/theme-packs the extracted floor data needs but Storage lacks: `<id>.webp`, `boss/<bossSpriteId>.webp`. */
export function missingThemeImages(data: string, stored: { packs: ReadonlySet<string>; bosses: ReadonlySet<string> }) {
  const files = new Set<string>()
  for (const file of readdirSync(data).filter(name => /^mirrordungeon-theme-floor-(?:t\d+|hidden)\.txt$/.test(name)).sort()) {
    for (const entry of JSON.parse(readFileSync(join(data, file), 'utf8').replace(/^\uFEFF/, '')).list ?? []) {
      const ui = entry.uiConfigs ?? {}
      if (!ui.packSpriteId) continue
      if (!stored.packs.has(`${entry.id}.webp`)) files.add(`${entry.id}.webp`)
      if (ui.bossSpriteId && !stored.bosses.has(`${ui.bossSpriteId}.webp`)) files.add(`boss/${ui.bossSpriteId}.webp`)
    }
  }
  return [...files]
}

/** The extraction image (path under Images/) for a Storage theme file: the composed card for `<id>.webp`, the boss for `boss/<name>.webp`. */
export function themeImageSource(file: string, images: readonly { kind: string; name: string; path: string }[]) {
  const boss = file.startsWith('boss/')
  const name = file.replace(/^boss\//, '').replace(/\.webp$/, '')
  return images.find(image => image.kind === (boss ? '테마팩보스' : COMPOSED_THEME_KIND) && image.name === name)?.path ?? null
}
