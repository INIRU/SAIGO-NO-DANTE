import { expect, it } from 'vitest'
import { SCENE_SIZE, sceneFrameToTensor } from '@/features/assist/lib/preprocess'

it('packs RGB pixels in NCHW order with ImageNet normalization', () => {
  const pixels = SCENE_SIZE * SCENE_SIZE
  const data = new Uint8ClampedArray(pixels * 4)
  data.set([255, 0, 128, 255, 0, 255, 0, 255])
  const tensor = sceneFrameToTensor({ data, width: SCENE_SIZE, height: SCENE_SIZE })
  expect(tensor).toHaveLength(pixels * 3)
  expect(tensor[0]).toBeCloseTo((1 - 0.485) / 0.229)
  expect(tensor[pixels]).toBeCloseTo((0 - 0.456) / 0.224)
  expect(tensor[pixels * 2]).toBeCloseTo((128 / 255 - 0.406) / 0.225)
  expect(tensor[1]).toBeCloseTo((0 - 0.485) / 0.229)
  expect(tensor[pixels + 1]).toBeCloseTo((1 - 0.456) / 0.224)
  expect(() => sceneFrameToTensor({ data, width: 1, height: SCENE_SIZE })).toThrow('Invalid scene frame size')
})
