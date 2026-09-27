import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { missingThemeImages, themeImageSource } from './theme-images'

it('REQ-DATA-SYNC-020 lists only the theme pack and boss images Storage lacks, and finds each in the extraction', () => {
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

  const stored = { packs: new Set(['1001.webp', '1301.webp', '1302.webp', '3001.webp']), bosses: new Set<string>() }
  expect(missingThemeImages(data, stored)).toEqual(['1002.webp', 'boss/Crimson_boss.webp'])
  expect(missingThemeImages(data, { packs: new Set([...stored.packs, '1002.webp']), bosses: new Set(['Crimson_boss.webp']) })).toEqual([])

  const images = [
    { kind: '테마팩', name: 'New', path: '거울던전/테마팩/New.png' },
    { kind: '합성 테마팩', name: '1002', path: '거울던전/합성 테마팩/1002.png' },
    { kind: '테마팩보스', name: 'Crimson_boss', path: '거울던전/테마팩보스/Crimson_boss.png' },
  ]
  expect(themeImageSource('1002.webp', images)).toBe('거울던전/합성 테마팩/1002.png')
  expect(themeImageSource('boss/Crimson_boss.webp', images)).toBe('거울던전/테마팩보스/Crimson_boss.png')
  expect(themeImageSource('1003.webp', images)).toBeNull()
})
