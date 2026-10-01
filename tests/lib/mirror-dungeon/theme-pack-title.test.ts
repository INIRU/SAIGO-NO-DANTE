import { describe, expect, it } from 'vitest'
import { THEME_PACK_DEFAULT_COLOR, getThemePackNameColor, getThemePackNameSegments } from '@/lib/data/theme-pack-colors'
import { THEME_PACK_TITLE_BOX, THEME_PACK_VISUALS, getThemePackTitleBoxKind, getThemePackVisualConfig } from '@/lib/data/theme-pack-visuals'

const centre = (box: { top: number; height: number }) => box.top + box.height / 2

describe('REQ-MIRROR-DUNGEON-009 theme pack name like the game selection screen', () => {
  it('REQ-MIRROR-DUNGEON-009 centres names on the spots measured in game captures', () => {
    expect(centre(THEME_PACK_TITLE_BOX.normal)).toBeCloseTo(80.6, 1)
    expect(centre(THEME_PACK_TITLE_BOX.boss)).toBeCloseTo(82.9, 1)
    // Longest names fill ~72% of the poster in game; the box leaves room for the fit-to-width margin.
    expect(100 - THEME_PACK_TITLE_BOX.normal.left - THEME_PACK_TITLE_BOX.normal.right).toBeGreaterThanOrEqual(78)
  })

  it('REQ-MIRROR-DUNGEON-009 keeps story packs on the shared spot instead of per-pack guesses', () => {
    const storyOverrides = Object.entries(THEME_PACK_VISUALS).filter(([id, config]) => Number(id) >= 1100 && Number(id) < 1200 && config.title)
    expect(storyOverrides).toEqual([])
    expect(getThemePackTitleBoxKind(getThemePackVisualConfig(1101))).toBe('normal')
    expect(getThemePackTitleBoxKind(getThemePackVisualConfig(1309))).toBe('boss')
    expect(getThemePackTitleBoxKind(getThemePackVisualConfig(1501))).toBe('extreme')
  })

  it('REQ-MIRROR-DUNGEON-009 puts the hidden pack name inside its printed dark band (76.3%-85.9%)', () => {
    const box = { ...THEME_PACK_TITLE_BOX.normal, ...getThemePackVisualConfig(3001)?.title }
    expect(centre(box)).toBeGreaterThan(80.5)
    expect(centre(box)).toBeLessThan(81.7)
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
