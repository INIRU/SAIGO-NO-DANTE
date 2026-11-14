import { describe, expect, it } from 'vitest'
import { THEME_PACK_DEFAULT_COLOR, getThemePackNameColor, getThemePackNameSegments } from '@/lib/data/theme-pack-colors'
import { THEME_PACK_EXTREME_TITLE_BOX, THEME_PACK_TITLE_BOX, THEME_PACK_VISUALS, getThemePackTitleBoxKind, getThemePackTitleLayout, getThemePackVisualConfig } from '@/lib/data/theme-pack-visuals'

const centreY = (box: { top: number; height: number }) => box.top + box.height / 2
const centreX = (box: { left: number; right: number }) => (box.left + 100 - box.right) / 2

describe('theme pack name like the game selection screen', () => {
  it('draws every name in the card prefab box, whatever the poster prints', () => {
    // [Text]Name of the game card, mapped into the 416x684 composite: centre 79.75% down, 75.3% wide.
    for (const id of [1001, 1110, 1201, 1308, 1406]) {
      expect(getThemePackTitleLayout(id)).toEqual({ ...THEME_PACK_TITLE_BOX, scale: 1 })
    }
    expect(centreY(getThemePackTitleLayout(1001))).toBeCloseTo(79.75, 2)
    expect(centreX(getThemePackTitleLayout(1001))).toBeCloseTo(50.3, 1)
    const extreme = getThemePackTitleLayout(1514)
    expect(extreme).toMatchObject(THEME_PACK_EXTREME_TITLE_BOX)
    expect(centreY(extreme)).toBeCloseTo(86.15, 2)
  })

  it('knows the extreme family', () => {
    expect(getThemePackTitleBoxKind(getThemePackVisualConfig(1501))).toBe('extreme')
  })

  it('keeps story packs free of hand-tuned title boxes', () => {
    const storyOverrides = Object.entries(THEME_PACK_VISUALS).filter(([id, config]) => Number(id) >= 1100 && Number(id) < 1200 && config.title)
    expect(storyOverrides).toEqual([])
  })

  it('puts the hidden pack name inside its printed dark band (76.3%-85.9%)', () => {
    const box = getThemePackTitleLayout(3001)
    expect(centreY(box)).toBeGreaterThan(80.5)
    expect(centreY(box)).toBeLessThan(81.7)
  })

  it('uses the game textColor the sync stores for the pack', () => {
    // name_color comes from uiConfigs.textColor (limbus-asset-extractor/site-sync/scripts/sync/mirror-dungeon-rules.ts themeNameColor).
    expect(getThemePackNameColor({ name_color: '#DADCE0' })).toBe('#DADCE0')
    expect(getThemePackNameColor({ name_color: null })).toBe(THEME_PACK_DEFAULT_COLOR)
    const segments = { ko: [{ text: '증오와', color: '#ee4893' }], en: [{ text: 'Hatred', color: '#ee4893' }] }
    expect(getThemePackNameSegments({ name_segments: segments }, 'en')?.[0].text).toBe('Hatred')
    expect(getThemePackNameSegments({ name_segments: segments }, 'ja')?.[0].text).toBe('증오와')
    expect(getThemePackNameSegments({}, 'ko')).toBeNull()
  })
})
