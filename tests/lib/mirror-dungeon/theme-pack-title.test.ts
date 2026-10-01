import { describe, expect, it } from 'vitest'
import { THEME_PACK_DEFAULT_COLOR, getThemePackNameColor, getThemePackNameSegments } from '@/lib/data/theme-pack-colors'
import { THEME_PACK_TITLE_MEASURED, THEME_PACK_VISUALS, getThemePackTitleBoxKind, getThemePackTitleLayout, getThemePackVisualConfig } from '@/lib/data/theme-pack-visuals'

const centreY = (box: { top: number; height: number }) => box.top + box.height / 2
const centreX = (box: { left: number; right: number }) => (box.left + 100 - box.right) / 2

describe('REQ-MIRROR-DUNGEON-009 theme pack name like the game selection screen', () => {
  it('REQ-MIRROR-DUNGEON-009 places each captured pack at its own measured spot', () => {
    // Values from KR selection captures: names sit at one screen spot while each poster is drawn at its own size.
    expect(centreY(getThemePackTitleLayout(1027))).toBeCloseTo(79.6, 1)
    expect(centreY(getThemePackTitleLayout(1127))).toBeCloseTo(81.1, 1)
    expect(centreY(getThemePackTitleLayout(1406))).toBeCloseTo(83.1, 1)
    expect(centreX(getThemePackTitleLayout(1406))).toBeCloseTo(54.2, 1)
  })

  it('REQ-MIRROR-DUNGEON-009 sin/keyword posters are drawn smaller in game, so their names are larger on our poster', () => {
    expect(getThemePackTitleLayout(1406).scale).toBeGreaterThan(1.07)
    expect(getThemePackTitleLayout(1128).scale).toBeCloseTo(1, 1)
  })

  it('REQ-MIRROR-DUNGEON-009 packs without captures use their family default', () => {
    expect(THEME_PACK_TITLE_MEASURED[1119]).toBeUndefined()
    expect(centreY(getThemePackTitleLayout(1119))).toBeCloseTo(80.5, 1)
    expect(THEME_PACK_TITLE_MEASURED[1201]).toBeUndefined()
    expect(centreY(getThemePackTitleLayout(1201))).toBeCloseTo(82.9, 1)
    expect(getThemePackTitleBoxKind(getThemePackVisualConfig(1501))).toBe('extreme')
  })

  it('REQ-MIRROR-DUNGEON-009 keeps story packs free of hand-tuned title boxes', () => {
    const storyOverrides = Object.entries(THEME_PACK_VISUALS).filter(([id, config]) => Number(id) >= 1100 && Number(id) < 1200 && config.title)
    expect(storyOverrides).toEqual([])
  })

  it('REQ-MIRROR-DUNGEON-009 puts the hidden pack name inside its printed dark band (76.3%-85.9%)', () => {
    const box = getThemePackTitleLayout(3001)
    expect(centreY(box)).toBeGreaterThan(80.5)
    expect(centreY(box)).toBeLessThan(81.7)
  })

  it('REQ-MIRROR-DUNGEON-009 uses the game textColor the sync stores for the pack', () => {
    // name_color comes from uiConfigs.textColor (scripts/sync/mirror-dungeon-rules.ts themeNameColor).
    expect(getThemePackNameColor({ name_color: '#DADCE0' })).toBe('#DADCE0')
    expect(getThemePackNameColor({ name_color: null })).toBe(THEME_PACK_DEFAULT_COLOR)
    const segments = { ko: [{ text: '증오와', color: '#ee4893' }], en: [{ text: 'Hatred', color: '#ee4893' }] }
    expect(getThemePackNameSegments({ name_segments: segments }, 'en')?.[0].text).toBe('Hatred')
    expect(getThemePackNameSegments({ name_segments: segments }, 'ja')?.[0].text).toBe('증오와')
    expect(getThemePackNameSegments({}, 'ko')).toBeNull()
  })
})
