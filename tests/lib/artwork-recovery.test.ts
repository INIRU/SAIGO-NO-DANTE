import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { keywordVariants, storagePath, safeStoragePath, KEYWORD_ALIASES } = require('../../scripts/assets/restore-artwork.cjs')
describe('source restoration boundaries', () => {
  it('keeps supported Storage names and encodes only rejected characters', () => {
    expect(safeStoragePath("sinners/ego/[蓮心]/it's fine.webp")).toBe("sinners/ego/_u5b__u84ee__u5fc3__u5d_/it's fine.webp")
    expect(storagePath({path:'art/Don Quixote/EGO/Wishing Cairn/20305_cg.png',name:'20305_cg.png'})).toBe('sinners/don-quixote/ego/Wishing Cairn/20305_cg.webp')
    expect(storagePath({path:'unrelated/asset.png',name:'asset.png'})).toBe(null)
    expect(KEYWORD_ALIASES['nerve-strike-don-quixote']).toBe('nerver-strike-don-quixote')
  })
})

it('derives suffix-2 preference from source filenames across every status folder, excluding semantic aliases', () => {
  expect(keywordVariants([
    { key: 'icons/keywords/lance-2.webp', local: '/General/Lance 2.webp' },
    { key: 'icons/keywords/max-hp-up-2.webp', local: '/Mirror Dungeon/Max HP Up 2.webp' },
    { key: 'icons/keywords/nethersea-brand-2.webp', local: '/General/NetherseaBrand_2.webp' },
    { key: 'icons/keywords/unlock-buff-ally-2.webp', local: '/General/Unlock - II.webp' },
  ])).toEqual({ lance: 'lance-2', 'max-hp-up': 'max-hp-up-2', 'nethersea-brand': 'nethersea-brand-2' })
})
