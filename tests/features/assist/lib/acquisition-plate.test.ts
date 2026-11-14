import { describe, expect, it } from 'vitest'
import { acquisitionPlate } from '@/features/assist/lib/popup-detect'

describe('acquisition plate layout', () => {
  it('keeps plates at the acquisition popup place at any capture size', () => {
    // Measured plates (full-frame pixels): 1920x1080, a 1084x584 window with a title bar, 2560x1440.
    expect(acquisitionPlate({ x: 480, y: 604, width: 268, height: 128 }, 1920, 1080)).toBe(true)
    expect(acquisitionPlate({ x: 279, y: 342, width: 146, height: 70 }, 1084, 584)).toBe(true)
    expect(acquisitionPlate({ x: 650, y: 815, width: 350, height: 165 }, 2560, 1440)).toBe(true)
    // The same plate on an ultrawide capture: the game view is centred with bars at both sides.
    expect(acquisitionPlate({ x: 800, y: 604, width: 268, height: 128 }, 2560, 1080)).toBe(true)
  })

  it('drops plates elsewhere or of another shape', () => {
    // A skill-exchange card in the right third, a boss banner across the top, a tiny card label, a square badge.
    expect(acquisitionPlate({ x: 1300, y: 500, width: 260, height: 124 }, 1920, 1080)).toBe(false)
    expect(acquisitionPlate({ x: 0, y: 80, width: 700, height: 180 }, 1920, 1080)).toBe(false)
    expect(acquisitionPlate({ x: 560, y: 650, width: 90, height: 42 }, 1920, 1080)).toBe(false)
    expect(acquisitionPlate({ x: 520, y: 600, width: 180, height: 170 }, 1920, 1080)).toBe(false)
  })
})
