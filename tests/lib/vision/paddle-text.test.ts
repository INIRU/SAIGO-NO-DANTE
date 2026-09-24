import { expect, it } from 'vitest'
import { ctcDecode, detSize, detTensor, fillRecLine, recAlphabet, recBatchWidth, recLineWidth, REC_HEIGHT, textRects } from '../../../lib/vision/paddle-text'

it('sizes the detector input to multiples of 32 within the side limit', () => {
  expect(detSize(1920, 1080, 960, 'max')).toEqual({ width: 960, height: 544 })
  expect(detSize(1280, 720, 960, 'max')).toEqual({ width: 960, height: 544 })
  expect(detSize(800, 400, 960, 'max')).toEqual({ width: 800, height: 416 })
  expect(detSize(280, 140, 64, 'min')).toEqual({ width: 288, height: 128 })
  expect(detSize(10, 10, 64, 'min')).toEqual({ width: 64, height: 64 })
})

it('normalizes pixels in BGR plane order with the ImageNet mean and std', () => {
  const tensor = detTensor(new Uint8ClampedArray([255, 0, 0, 255]), 1, 1)
  expect(tensor[0]).toBeCloseTo((0 - 0.485) / 0.229)
  expect(tensor[1]).toBeCloseTo((0 - 0.456) / 0.224)
  expect(tensor[2]).toBeCloseTo((1 - 0.406) / 0.225)
})

it('finds text regions, drops weak or tiny ones, grows them and orders rows', () => {
  const width = 40, height = 20
  const prob = new Float32Array(width * height)
  const fill = (x0: number, y0: number, x1: number, y1: number, value: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) prob[y * width + x] = value
  }
  fill(22, 2, 35, 6, 0.9) // right line of the first row
  fill(2, 3, 15, 7, 0.9) // left line, slightly lower but the same row
  fill(2, 12, 30, 16, 0.4) // weak region
  fill(36, 14, 37, 15, 0.9) // too small
  const rects = textRects(prob, width, height, 80, 40)
  expect(rects).toHaveLength(2)
  expect(rects[0].x).toBeLessThan(rects[1].x)
  // 13x4 map box grows by 13*4*1.5/34 = 2.29 on each side; x2 back to source pixels, clamped at the left edge.
  expect(rects[0]).toMatchObject({ x: 0, y: 1, width: 35, height: 18 })
  expect(textRects(prob, width, height, 80, 40, 1)).toHaveLength(1)
})

it('pads recognition batches to the widest line, at least 320 wide', () => {
  expect(recBatchWidth([{ width: 100, height: 48 }])).toBe(320)
  expect(recBatchWidth([{ width: 100, height: 48 }, { width: 480, height: 48 }])).toBe(480)
  expect(recBatchWidth([{ width: 100000, height: 10 }])).toBe(3200)
  expect(recLineWidth({ width: 100, height: 48 }, 320)).toBe(100)
  expect(recLineWidth({ width: 1000, height: 48 }, 320)).toBe(320)
  const tensor = new Float32Array(2 * 3 * REC_HEIGHT * 4)
  fillRecLine(tensor, 1, 4, new Uint8ClampedArray(REC_HEIGHT * 2 * 4).fill(255), 2)
  const base = 3 * REC_HEIGHT * 4
  expect(tensor[base]).toBe(1)
  expect(tensor[base + 2]).toBe(0)
  expect(tensor[0]).toBe(0)
})

it('decodes CTC output: merges repeats, drops blanks, keeps a blank-separated repeat', () => {
  const alphabet = recAlphabet(['가', '나'])
  expect(alphabet).toEqual(['', '가', '나', ' '])
  const steps = [1, 1, 0, 1, 2, 3, 2]
  const logits = new Float32Array(steps.length * 4)
  steps.forEach((best, step) => { logits[step * 4 + best] = 0.9 })
  expect(ctcDecode(logits, 0, steps.length, 4, alphabet)).toEqual({ text: '가가나 나', score: expect.closeTo(0.9, 5) })
  expect(() => recAlphabet([])).toThrow()
  expect(() => recAlphabet([1])).toThrow()
})
