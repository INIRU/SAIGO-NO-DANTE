import { getGiftKeywordIconUrl } from '@/lib/constants/gift'
import { describe, expect, it } from 'vitest'
import { getKeywordIndex, getLocalizedKeywordIndex, type KeywordInfo } from '@/lib/keywords/catalog'
import { STORAGE_BASE } from '@/lib/constants/game'
import { getKeywordIconUrl } from '@/lib/constants/keywords'
import { getGameUiAsset } from '@/lib/utils/game-ui'

const catalog: Record<string, KeywordInfo> = {
  '진동': { desc: '진동 설명', nameEn: 'Tremor', nameJp: '振動', iconSlug: 'Vibration', sinAffinity: 'sloth' },
  '진동 폭발': { desc: '폭발 설명', nameEn: 'Tremor Burst' },
  '관통': { desc: '공격 유형', iconSlug: 'pierce' },
}

describe('shared keyword catalog indexes', () => {
  it('draws the Storage file named exactly by icon_slug', () => {
    expect(getKeywordIconUrl('책임감', 'game-SadLamanchaland')).toBe(`${STORAGE_BASE}/icons/keywords/game-SadLamanchaland.webp`)
    expect(getKeywordIconUrl('출혈', 'bleed')).toBe(`${STORAGE_BASE}/icons/keywords/bleed.webp`)
    expect(getKeywordIconUrl('파괴 불가 코인', 'unbreakable-coin')).toBe(getGameUiAsset('coins/unbreakable'))
    expect(getKeywordIconUrl('천퇴성[天退星]', 'tiantui-star')).toBe(getGameUiAsset('keywords/tiantui-star'))
  })
  it('never swaps icon_slug for another file', () => {
    for (const slug of ['responsibility', 'prescript', 'prescript-device-i', 'nerve-strike-hong-lu', 'concussion', 'max-hp-up-2', 'when-rending-the-body-with-a-great-sword']) {
      expect(getKeywordIconUrl('name', slug)).toBe(`${STORAGE_BASE}/icons/keywords/${slug}.webp`)
    }
  })
  it('shares bronze attack icons between gift filters and the keyword catalog', () => {
    for (const slug of ['slash', 'pierce', 'blunt']) expect(getGiftKeywordIconUrl(slug)).toBe(getGameUiAsset(`stats/${slug}`))
  })
  it('uses versioned atlas crops for keywords absent from the individual sprite list', () => {
    for (const slug of ['tiantui-star', 'shin-tiantui-star', 'tremor-burst', 'shimmering-bloodfiend']) {
      expect(getKeywordIconUrl('localized name', slug)).toMatch(new RegExp(`^/assets/game-ui/keywords/${slug}\\.webp\\?v=[a-f0-9]{12}$`))
    }
  })
  it('returns no icon without icon_slug and no replacement for a missing source', () => {
    // A missing source must never silently acquire a similar-looking replacement.
    expect(getKeywordIconUrl('공격 레벨+', 'offense-level')).toContain('/offense-level.webp')
    expect(getKeywordIconUrl('unknown')).toBeNull()
  })
  it('uses the red unbreakable coin in descriptions and all localized tooltips', () => {
    for (const name of ['파괴 불가 코인', 'Unbreakable Coin', '破壊不可コイン']) {
      expect(getKeywordIconUrl(name, 'old-white-coin')).toBe(getGameUiAsset('coins/unbreakable'))
    }
    expect(getKeywordIconUrl('alias', 'unbreakable-coin')).toBe(getGameUiAsset('coins/unbreakable'))
    expect(getKeywordIconUrl('관통', 'stat:pierce')).toBe(getGameUiAsset('stats/pierce'))
  })
  it('shares derived maps and callbacks across consumers of one catalog', () => {
    const first = getKeywordIndex(catalog)
    expect(getKeywordIndex(catalog)).toBe(first)
    expect(first.sinMap).toEqual({ '진동': 'sloth' })
    expect(first.getIconUrl('관통')).toBe(getGameUiAsset('stats/pierce'))
    expect(first.getIconUrl('진동')).toContain('Vibration')
  })

  it('keeps longest-first matching, mixed-language fallbacks and game tag aliases', () => {
    const en = getLocalizedKeywordIndex(catalog, 'en')
    expect(en.localKeywords.indexOf('Tremor Burst')).toBeLessThan(en.localKeywords.indexOf('Tremor'))
    expect(en.localToKr).toMatchObject({ Tremor: '진동', '진동': '진동', Vibration: '진동' })
    expect(new Set(en.localKeywords).size).toBe(en.localKeywords.length)
  })

  it('shares same-language indexes while keeping locale changes independent', () => {
    expect(getLocalizedKeywordIndex(catalog, 'en')).toBe(getLocalizedKeywordIndex(catalog, 'en'))
    expect(getLocalizedKeywordIndex(catalog, 'ko').localKeywords).toEqual(['진동 폭발', '진동', '관통'])
    expect(getLocalizedKeywordIndex(catalog, 'ja').localToKr['振動']).toBe('진동')
    expect(getLocalizedKeywordIndex(catalog, 'ja').localKeywords).not.toContain('Tremor')
  })

  it('rebuilds indexes when a refreshed catalog arrives', () => {
    const refreshed = { ...catalog, '진동': { ...catalog['진동'], nameEn: 'Updated Tremor', sinAffinity: 'gloom' } }
    expect(getKeywordIndex(refreshed).sinMap['진동']).toBe('gloom')
    expect(getLocalizedKeywordIndex(refreshed, 'en').localToKr['Updated Tremor']).toBe('진동')
    expect(getKeywordIndex(catalog).sinMap['진동']).toBe('sloth')
    expect(getLocalizedKeywordIndex(catalog, 'en').localToKr['Tremor']).toBe('진동')
  })
})


it('legacy gift filter breath shares the verified Poise icon URL', () => {
  expect(getGiftKeywordIconUrl('breath')).toBe(getKeywordIconUrl('호흡', 'poise'))
  expect(getGiftKeywordIconUrl('burn')).toBe(getKeywordIconUrl('화상', 'burn'))
  expect(getGiftKeywordIconUrl('general')).toBeNull()
})


describe('game tag aliases', () => {
  it('reads a game tag from keyword_meta.game_id before the static aliases', () => {
    const withIds: Record<string, KeywordInfo> = {
      '화상': { desc: '', nameEn: 'Burn', gameId: 'Combustion' },
      '새 키워드': { desc: '', nameEn: 'New', gameId: 'NewTag' },
    }
    const { localToKr, localKeywords } = getLocalizedKeywordIndex(withIds, 'en')
    expect(localToKr.NewTag).toBe('새 키워드')
    expect(localToKr.Combustion).toBe('화상')
    expect(localKeywords).toContain('NewTag')
    expect(getLocalizedKeywordIndex(catalog, 'en').localToKr.Sinking).toBe('침잠')
  })
})
