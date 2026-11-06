import { expect, it } from 'vitest'
import { darkPopupPlate } from '@/features/assist/lib/popup-detect'

/** 480×270 frame, dark except bright text columns in the popup title band (x 160–320, y 62–76 at this scale). */
function frame(textFrom: number, textTo: number) {
  const width = 480, height = 270, data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) { data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = 20; data[i * 4 + 3] = 255 }
  for (let y = 62; y < 76; y++) for (let x = textFrom; x < textTo; x++) if (x % 3 === 0) {
    const at = (y * width + x) * 4; data[at] = data[at + 1] = data[at + 2] = 235
  }
  for (let y = 62; y < 76; y++) for (let x = textFrom; x < textTo; x++) if (x % 3 !== 0) {
    const at = (y * width + x) * 4; data[at] = data[at + 1] = data[at + 2] = 70
  }
  return { data, width, height, colorSpace: 'srgb' } as ImageData
}

// The black UI theme draws start and observation popups with a dark name plate: found from the centred title text.
it('places the popup plate from a centred title, and ignores a left-only dialog header', () => {
  expect(darkPopupPlate(frame(172, 306))).toEqual({ x: 120, y: 151, width: 67, height: 32 })
  expect(darkPopupPlate(frame(130, 236))).toBeNull()
  expect(darkPopupPlate(frame(0, 0))).toBeNull()
})
