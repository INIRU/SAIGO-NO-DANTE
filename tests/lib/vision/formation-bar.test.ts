import { describe, expect, it } from 'vitest'
import { decodePortraitIndex, formationBarRegions, matchPortrait, portraitId, shownPixels } from '../../../lib/vision/formation-bar'

const b64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes))

describe('the formation bar', () => {
  it('keeps to the bottom edge and scales with the width', () => {
    expect(formationBarRegions(1920, 1080)[0]).toEqual({ x: 149.5, y: 978.5, size: 147 })
    const [first] = formationBarRegions(1440, 1080) // 4:3: the bar stays at the bottom, not the centred UI
    expect(first.y).toBeCloseTo(1080 - 101.5 * 0.75)
    expect(formationBarRegions(1280, 720)).toHaveLength(12)
  })

  it('names the portrait whose colours run the same way, and only with a clear lead', () => {
    const index = decodePortraitIndex({ side: 2, inset: 0.1, mask: [0, 3], entries: [
      { id: '10101', art: 'normal', px: b64([200, 10, 10, 10, 10, 200]) },
      { id: '10201', art: 'normal', px: b64([10, 200, 10, 10, 200, 10]) },
    ] })!
    const rgba = new Uint8ClampedArray([180, 20, 20, 255, 0, 0, 0, 255, 0, 0, 0, 255, 20, 20, 160, 255])
    const read = matchPortrait(index, shownPixels(rgba, index.mask))!
    expect(read.id).toBe('10101')
    expect(portraitId(read)).toBe('10101')
    expect(portraitId({ ...read, margin: 0.01 })).toBeNull()
  })
})
