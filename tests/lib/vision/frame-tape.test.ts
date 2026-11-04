import { describe, expect, it } from 'vitest'
import { TAPE_MS, keptEntries, pickFrames, sharpness } from '../../../lib/vision/frame-tape'

describe('the capture’s last seconds', () => {
  it('scores a sharp frame above a blurred one', () => {
    const edge = Float32Array.from({ length: 32 * 18 }, (_, i) => (i % 32 < 16 ? 30 : 220))
    const soft = Float32Array.from({ length: 32 * 18 }, (_, i) => 30 + (190 * (i % 32)) / 31)
    expect(sharpness(edge, 32, 18)).toBeGreaterThan(sharpness(soft, 32, 18) * 10)
    expect(sharpness(new Float32Array(32 * 18).fill(80), 32, 18)).toBe(0)
  })

  it('takes the sharpest frame of each slice of the span, the sharpest slices first, in time order', () => {
    const entries = [
      { at: 0, sharpness: 5 }, { at: 100, sharpness: 9 }, { at: 200, sharpness: 1 }, // slice 0: 100
      { at: 300, sharpness: 2 }, { at: 400, sharpness: 3 },                              // slice 1: 400
      { at: 600, sharpness: 50 },                                                        // slice 2: 600
      { at: 2000, sharpness: 99 },                                                       // outside
    ]
    expect(pickFrames(entries, 0, 899, 3).map(entry => entry.at)).toEqual([100, 400, 600])
    expect(pickFrames(entries, 0, 899, 2).map(entry => entry.at)).toEqual([100, 600])
    expect(pickFrames(entries, 0, 899, 0)).toEqual([])
  })

  it('keeps the last 15 s only', () => {
    expect(keptEntries([{ at: 0, sharpness: 1 }, { at: TAPE_MS, sharpness: 1 }], TAPE_MS + 1).map(entry => entry.at)).toEqual([TAPE_MS])
  })
})
