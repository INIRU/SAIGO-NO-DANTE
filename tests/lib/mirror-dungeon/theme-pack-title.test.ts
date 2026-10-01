import { describe, expect, it } from 'vitest'
import { THEME_PACK_DEFAULT_COLOR, getThemePackNameColor, getThemePackNameSegments } from '@/lib/data/theme-pack-colors'
import { THEME_PACK_TITLE_BAND, THEME_PACK_TITLE_MEASURED, THEME_PACK_VISUALS, getThemePackTitleBoxKind, getThemePackTitleLayout, getThemePackVisualConfig } from '@/lib/data/theme-pack-visuals'

const centreY = (box: { top: number; height: number }) => box.top + box.height / 2
const centreX = (box: { left: number; right: number }) => (box.left + 100 - box.right) / 2

describe('REQ-MIRROR-DUNGEON-009 theme pack name like the game selection screen', () => {
  it('REQ-MIRROR-DUNGEON-009 centres names in the dark band the poster prints for them', () => {
    // Attack-type/sin/keyword posters: band 75.3%-84.4%; extreme posters: black panel 84.6%-91.5%.
    for (const id of [1201, 1308, 1406]) {
      const box = getThemePackTitleLayout(id)
      expect(centreY(box)).toBeCloseTo(79.85, 1)
      expect(centreX(box)).toBeCloseTo(50, 0)
      expect(box.scale).toBeCloseTo(1, 2)
    }
    const extreme = getThemePackTitleLayout(1514)
    expect(extreme.top).toBeGreaterThanOrEqual(84.6)
    expect(extreme.top + extreme.height).toBeLessThanOrEqual(91.5)
  })

  it('REQ-MIRROR-DUNGEON-009 knows the extreme family', () => {
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

  it('REQ-MIRROR-DUNGEON-013 centres story and event names in the dark band their poster leaves under the printed art', () => {
    // CANTO packs share one frame: logo and watermark end at 82%, the torn strip starts at 89%.
    for (let id = 1001; id <= 1027; id++) expect(centreY(getThemePackTitleLayout(id))).toBeCloseTo(85.5, 1)
    // Event packs differ: below 20번구의 기적's baubles, under 시간살인시간's logo, above the line packs' stripe, in 육참골단's box.
    expect(centreY(getThemePackTitleLayout(1103))).toBeCloseTo(85, 1)
    expect(centreY(getThemePackTitleLayout(1105))).toBeCloseTo(83, 1)
    expect(centreY(getThemePackTitleLayout(1110))).toBeCloseTo(80, 1)
    expect(centreY(getThemePackTitleLayout(1104))).toBeCloseTo(82, 1)
    // Every story and event pack has a band value; the band wins over a capture spot but keeps its size.
    for (let id = 1101; id <= 1128; id++) expect(THEME_PACK_TITLE_BAND[id]).toBeTypeOf('number')
    expect(getThemePackTitleLayout(1027).scale).toBeCloseTo(0.755 / THEME_PACK_TITLE_MEASURED[1027][2], 3)
  })
})
