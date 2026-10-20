import { describe, expect, it } from 'vitest'
import { lightboxStartTransform } from '@/lib/notes/lightbox'

const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height })

describe('REQ-COMMUNITY-059 the lightbox grows out of the picture that was pressed', () => {
  it('REQ-COMMUNITY-059 starts centred on the small picture, scaled to its size', () => {
    // Small picture centred at (150, 160), big one at (500, 400): move by (-350, -240), shrink to 200/800 x 200/600.
    const t = lightboxStartTransform(rect(50, 60, 200, 200), rect(100, 100, 800, 600))
    expect(t).toBe('translate(-350px, -240px) scale(0.25, 0.3333333333333333)')
  })
  it('REQ-COMMUNITY-059 is no movement when the two pictures are the same', () => {
    expect(lightboxStartTransform(rect(10, 20, 300, 200), rect(10, 20, 300, 200))).toBe('translate(0px, 0px) scale(1, 1)')
  })
  it('REQ-COMMUNITY-059 gives nothing for a picture without size (not loaded yet)', () => {
    expect(lightboxStartTransform(rect(0, 0, 0, 0), rect(100, 100, 800, 600))).toBeNull()
    expect(lightboxStartTransform(rect(10, 10, 50, 50), rect(0, 0, 0, 0))).toBeNull()
  })
})
