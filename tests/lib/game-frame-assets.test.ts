import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getIdentityCardFrameUrl, getSkillFrameInnerUrl } from '@/lib/utils/images'

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
  it('covers seven sins and neutral in all four slots without mapping defense to S3', () => {
    for (const sin of ['wrath','lust','sloth','gluttony','gloom','pride','envy','neutral']) {
      for (const slot of [1,2,3,4]) {
        expect(existsSync(file(getSkillFrameInnerUrl(sin,slot)))).toBe(true)
        expect(existsSync(file(getSkillFrameInnerUrl(sin,slot,'base')))).toBe(true)
        expect(getSkillFrameInnerUrl(sin,slot)).toMatch(/\?v=[a-f0-9]{12}$/)
      }
      for (const layer of ['outline', 'base'] as const) {
        expect(getSkillFrameInnerUrl(sin,4,layer)).toBe(getSkillFrameInnerUrl(sin,1,layer))
        if (sin !== 'neutral') expect(getSkillFrameInnerUrl(sin,4,layer)).not.toBe(getSkillFrameInnerUrl(sin,3,layer))
        else expect(getSkillFrameInnerUrl(sin,3,layer)).toBe(getSkillFrameInnerUrl(sin,1,layer))
      }
    }
    expect(getSkillFrameInnerUrl('unknown',4)).toBe(getSkillFrameInnerUrl('neutral',4))
  })
})
