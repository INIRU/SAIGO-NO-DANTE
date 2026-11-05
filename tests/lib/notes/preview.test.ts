import { describe, expect, it } from 'vitest'
import { PREVIEW_DELAY_MS, previewPlacement, usesHover } from '@/lib/notes/preview'

const anchor = (left: number, top: number, width = 80, height = 24) => ({ left, top, right: left + width, bottom: top + height, width, height })
const view = { width: 1000, height: 800 }
const card = () => 200

describe('REQ-COMMUNITY-061 where the preview card goes', () => {
  it('REQ-COMMUNITY-061 opens after 150ms', () => {
    expect(PREVIEW_DELAY_MS).toBe(150)
  })
  it('REQ-COMMUNITY-061 sits below the name, starting at its left edge', () => {
    expect(previewPlacement(anchor(100, 100), card, view)).toMatchObject({ left: 100, top: 132, above: false, width: 336 })
  })
  it('REQ-COMMUNITY-061 moves above the name when there is no room below', () => {
    expect(previewPlacement(anchor(100, 700), card, view)).toMatchObject({ left: 100, top: 692, above: true })
  })
  it('REQ-COMMUNITY-061 stays inside the screen sideways', () => {
    expect(previewPlacement(anchor(900, 100), card, view).left).toBe(1000 - 8 - 336)
    expect(previewPlacement(anchor(-20, 100), card, view).left).toBe(8)
  })
})

describe('REQ-COMMUNITY-061 the preview card tries 21rem, 28rem, then 36rem', () => {
  it('REQ-COMMUNITY-061 widens a long gift effect text before it runs off the bottom', () => {
    const text = (width: number) => Math.ceil(336 * 520 / width)
    expect(previewPlacement(anchor(100, 100), text, view).width).toBe(448)
    // rem 20: 420 wide is already short enough
    expect(previewPlacement(anchor(100, 100), text, view, 20).width).toBe(420)
  })
})

describe('REQ-COMMUNITY-062 touch never hovers', () => {
  it('REQ-COMMUNITY-062 only a mouse or a pen opens the card by hovering', () => {
    expect(usesHover('mouse')).toBe(true)
    expect(usesHover('pen')).toBe(true)
    expect(usesHover('touch')).toBe(false)
    expect(usesHover('')).toBe(false)
  })
})
