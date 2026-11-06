import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { decodeCursorTemplates, findCursor } from '@/features/assist/lib/cursor'

const templates = decodeCursorTemplates(JSON.parse(readFileSync('public/models/assist-scene/cursor.json', 'utf8')))!

/** A dark frame with the picture drawn at (x, y), scaled by `scale` (nearest pixel). */
function frame(width: number, height: number, picture: Uint8Array, x: number, y: number, scale = 1) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < data.length; i += 4) { data[i] = 40; data[i + 1] = 30; data[i + 2] = 30; data[i + 3] = 255 }
  const size = templates.size, drawn = Math.round(size * scale)
  for (let v = 0; v < drawn; v++) for (let u = 0; u < drawn; u++) {
    const p = (Math.floor(v / scale) * size + Math.floor(u / scale)) * 4, a = picture[p + 3] / 255
    const f = ((y + v) * width + x + u) * 4
    for (let c = 0; c < 3; c++) data[f + c] = Math.round(picture[p + c] * a + data[f + c] * (1 - a))
  }
  return data
}

describe('the game cursor', () => {
  it('finds its hot spot and whether the button is down, at its size or smaller', () => {
    const off = findCursor(frame(320, 180, templates.off, 100, 50), 320, 180, templates)!
    expect(off.pressed).toBe(false)
    expect(Math.hypot(off.x - 114, off.y - 56)).toBeLessThan(3)
    const on = findCursor(frame(320, 180, templates.on, 30, 90, 0.5), 320, 180, templates)!
    expect(on.pressed).toBe(true)
    expect(Math.hypot(on.x - 37, on.y - 93)).toBeLessThan(3)
  })

  it('claims nothing on a frame without it', () => {
    const plain = frame(320, 180, new Uint8Array(templates.off.length), 0, 0)
    // a flat gold block of the nib's size
    for (let i = 0; i < 40 * 60; i++) { const f = ((60 + Math.floor(i / 40)) * 320 + 200 + (i % 40)) * 4; plain[f] = 230; plain[f + 1] = 160; plain[f + 2] = 30 }
    expect(findCursor(plain, 320, 180, templates)).toBeNull()
  })
})
