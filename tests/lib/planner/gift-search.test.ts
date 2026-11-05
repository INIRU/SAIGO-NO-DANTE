import { describe, expect, it } from 'vitest'
import { giftSearchText } from '@/lib/planner/gift-search'

const gift = { name: '불타는 지팡이', name_en: null, name_jp: null, keyword: '화상', effect_base: '<style="highlight">[Combustion]</style> 3 부여 {{potency}}' }

describe('giftSearchText (REQ-SHARED-020)', () => {
  it('REQ-SHARED-020 searches the plain text of raw effects: names instead of [Id], no tags', () => {
    const text = giftSearchText(gift, { names: { Combustion: '화상' }, locale: 'ko' })
    expect(text).toContain('화상 3 부여')
    expect(text).not.toContain('style')
    expect(text).not.toContain('combustion')
  })

  it('REQ-SHARED-020 falls back to the ids until the names are loaded', () => {
    expect(giftSearchText(gift, { names: undefined, locale: 'ko' })).toContain('[combustion]')
  })

  it('REQ-SHARED-020 searches the older stored effect as written', () => {
    expect(giftSearchText({ ...gift, effect_base: '화상 3 부여' }, { names: undefined, locale: 'ko' })).toBe('불타는 지팡이 화상 화상 3 부여')
  })
})
