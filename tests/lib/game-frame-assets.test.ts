import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getIdentityCardFrameUrl } from '@/lib/utils/images'

const file = (url: string) => resolve('public', '.' + url.split('?')[0])
describe('recovered game frame coverage', () => {
  it('has all 12 rarity/uptie frames and defaults to IV', () => {
    for (const rarity of [1, 2, 3]) {
      const hashes = new Set<string>()
      for (const stage of [1, 2, 3, 4]) {
        const path = file(getIdentityCardFrameUrl(rarity, stage))
        expect(existsSync(path)).toBe(true)
        hashes.add(readFileSync(path).toString('base64'))
      }
      expect(hashes.size).toBe(4)
      expect(getIdentityCardFrameUrl(rarity)).toBe(getIdentityCardFrameUrl(rarity, 4))
    }
  })
})
