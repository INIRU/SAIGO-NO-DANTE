import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { storagePath, safeStoragePath, KEYWORD_ALIASES } = require('../../scripts/assets/restore-artwork.cjs')
describe('source restoration boundaries', () => {
  it('keeps supported Storage names and encodes only rejected characters', () => {
    expect(safeStoragePath("sinners/ego/[蓮心]/it's fine.webp")).toBe("sinners/ego/_u5b__u84ee__u5fc3__u5d_/it's fine.webp")
    expect(storagePath({path:'art/Don Quixote/EGO/Wishing Cairn/20305_cg.png',name:'20305_cg.png'})).toBe('sinners/don-quixote/ego/Wishing Cairn/20305_cg.webp')
    expect(storagePath({path:'unrelated/asset.png',name:'asset.png'})).toBe(null)
    expect(KEYWORD_ALIASES['nerve-strike-don-quixote']).toBe('nerver-strike-don-quixote')
  })
})
