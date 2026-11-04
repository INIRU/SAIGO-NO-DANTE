import { describe, expect, it } from 'vitest'
import { BLESSING_CONFIGS } from '../../../components/planner/BlessingTab'
import { BLESSING_COSTS, blessingSpent, readBlessingCards } from '../../../lib/vision/blessing-screen'
import { BLESSING_STARLIGHT_MAX } from '../../../lib/fun/prescript'

// A drawn Star Blessing screen at width x height (the 1920x1080 layout scaled by min(w/1920, h/1080), centred, under
// `titleBar` white rows): black around the cards, every card's name in white, `taken` cards' left border lit, a level's
// button text orange. `shift` moves the game down inside the frame (more than the game in the capture)
function screen(width: number, height: number, cards: { taken?: boolean; level?: 2 | 3 }[], nameLight = 230, titleBar = 0, shift = 0) {
  const data = new Uint8ClampedArray(width * height * 4).fill(9)
  for (let i = 0; i < width * titleBar * 4; i++) data[i] = 240
  const s = Math.min(width / 1920, (height - titleBar) / 1080), ox = (width - 1920 * s) / 2, oy = titleBar + shift + (height - titleBar - 1080 * s) / 2
  const fill = (x0: number, y0: number, x1: number, y1: number, rgb: [number, number, number]) => {
    for (let y = Math.floor(oy + y0 * s); y < Math.min(height, Math.ceil(oy + y1 * s)); y++) for (let x = Math.floor(ox + x0 * s); x < Math.ceil(ox + x1 * s); x++) {
      const i = (y * width + x) * 4; data[i] = rgb[0]; data[i + 1] = rgb[1]; data[i + 2] = rgb[2]; data[i + 3] = 255
    }
  }
  const lefts = [210, 508, 806, 1104, 1402], rows = [[232, 552, 505], [590, 910, 864]]
  cards.forEach((card, i) => {
    const left = lefts[i % 5], [top, bottom, buttons] = rows[Math.floor(i / 5)]
    fill(left, top, left + 265, bottom, [70, 75, 95])
    fill(left + 120, top + 55, left + 200, top + 75, [nameLight, nameLight, nameLight])
    fill(left, top, left + 3, bottom, card.taken ? [210, 220, 240] : [90, 95, 110])
    if (card.level === 2) fill(left + 60, buttons + 10, left + 80, buttons + 22, [250, 170, 40])
    if (card.level === 3) fill(left + 180, buttons + 10, left + 210, buttons + 22, [250, 170, 40])
  })
  return { data, width, height }
}

describe('the Star Blessing screen', () => {
  it('costs as the planner lists them, ++ of all ten being the factor’s whole', () => {
    expect(BLESSING_COSTS).toEqual(BLESSING_CONFIGS.map(blessing => blessing.costs))
    expect(BLESSING_STARLIGHT_MAX).toBe(BLESSING_COSTS.reduce((sum, costs) => sum + costs[2], 0))
  })

  it('reads a card as taken by its lit border, at the level its orange button shows; a level set on a card not taken counts nothing', () => {
    const cards = Array.from({ length: 10 }, () => ({}) as { taken?: boolean; level?: 2 | 3 })
    cards[0] = { taken: true, level: 3 }
    cards[6] = { level: 2 }
    cards[7] = { taken: true }
    cards[9] = { taken: true, level: 2 }
    for (const [width, height] of [[1920, 1080], [1280, 720], [1440, 1080]]) {
      const levels = readBlessingCards(screen(width, height, cards))
      expect(levels, `${width}x${height}`).toEqual([3, 0, 0, 0, 0, 0, 0, 1, 0, 2])
      expect(blessingSpent(levels!)).toBe(30 + 40 + 120)
    }
  })

  it('reads nothing while a popup dims the screen, or with the cards out of place (rather than a cheaper set)', () => {
    const all = Array.from({ length: 10 }, () => ({ taken: true, level: 3 as const }))
    expect(readBlessingCards(screen(1920, 1080, all, 110))).toBeNull()
    // a whole-screen share of a window: the game 31 rows down the frame, not where a full capture has it
    expect(readBlessingCards(screen(1920, 1080, all, 230, 0, 31))).toBeNull()
    // a window share: the title bar given, the game below it
    expect(readBlessingCards(screen(1920, 1111, all, 230, 31), 31)).toEqual(Array(10).fill(3))
  })
})
