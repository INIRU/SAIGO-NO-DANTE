import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ICON_CROP, ICON_INPUT, ICON_LOGIT_SCALE } from '../../../lib/vision/icon-classifier'
import { SCENE_SIZE } from '../../../lib/vision/preprocess'
import { IMAGENET_MEAN, IMAGENET_STD, STRONG_READ } from '../../../lib/vision/strong-read'

// The training scripts' copy of what the browser gives the models: a model trained on one input and served another
// reads worse without any error
const python = readFileSync('scripts/vision/assist_common.py', 'utf8')
const value = (name: string) => {
  const match = new RegExp(String.raw`^${name} = (?:np\.array\()?([^#\n]+?)(?:, np\.float32\))?\s*(?:#.*)?$`, 'm').exec(python)
  if (!match) throw new Error(`${name} not found in assist_common.py`)
  return JSON.parse(match[1])
}

describe('the models\' input in training and in the browser', () => {
  it('normalises the same way', () => {
    expect(value('IMAGENET_MEAN')).toEqual(IMAGENET_MEAN)
    expect(value('IMAGENET_STD')).toEqual(IMAGENET_STD)
  })

  it('has the same sizes, icon crop, logit scale and strong-read bar', () => {
    expect(value('SCENE_SIZE')).toBe(SCENE_SIZE)
    expect(value('ICON_SIZE')).toBe(ICON_INPUT)
    expect(value('ICON_CROP')).toBe(ICON_CROP)
    expect(value('LOGIT_SCALE')).toBe(ICON_LOGIT_SCALE)
    expect(value('STRONG_P')).toBe(STRONG_READ.score)
    expect(value('STRONG_LEAD')).toBe(STRONG_READ.margin)
  })
})
