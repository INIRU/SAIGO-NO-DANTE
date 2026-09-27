import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { missingThemeImages } from './theme-images'

it('REQ-DATA-SYNC-020 composes only the theme packs whose pack or boss image Storage lacks, and uploads only the missing files', () => {
  const data = mkdtempSync(join(tmpdir(), 'theme-images-'))
  const list = (entries: object[]) => '\uFEFF' + JSON.stringify({ list: entries })
  writeFileSync(join(data, 'mirrordungeon-theme-floor-t1.txt'), list([
    { id: 1001, uiConfigs: { packSpriteId: 'Old' } },
    { id: 1002, uiConfigs: { packSpriteId: 'New' } },
    { id: 1003, uiConfigs: {} },
  ]))
  writeFileSync(join(data, 'mirrordungeon-theme-floor-t4.txt'), list([
    { id: 1301, uiConfigs: { packSpriteId: 'Crimson_normal', bossSpriteId: 'Crimson_boss' } },
    { id: 1302, uiConfigs: { packSpriteId: 'Crimson_hard', bossSpriteId: 'Crimson_boss' } },
  ]))
  writeFileSync(join(data, 'mirrordungeon-theme-floor-hidden.txt'), list([{ id: 3001, uiConfigs: { packSpriteId: 'HiddenTheme' } }]))
  writeFileSync(join(data, 'mirrordungeon-theme-floor-legacy.txt'), list([{ id: 9999, uiConfigs: { packSpriteId: 'Ignored' } }]))

  const result = missingThemeImages(data, { packs: new Set(['1001.webp', '1301.webp', '1302.webp', '3001.webp']), bosses: new Set() })
  expect(result).toEqual({ ids: [1002, 1301, 1302], files: ['1002.webp', 'boss/Crimson_boss.webp'] })
  expect(missingThemeImages(data, { packs: new Set(['1001.webp', '1002.webp', '1301.webp', '1302.webp', '3001.webp']), bosses: new Set(['Crimson_boss.webp']) }))
    .toEqual({ ids: [], files: [] })
})
