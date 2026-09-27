import { expect, it } from 'vitest'
import { classifierKnowsHeld, classifierSlotRead, heldLabels, iconTensor, ICON_INPUT, ICON_LOGIT_SCALE } from '../../../lib/vision/icon-classifier'

const labels = ['9001', '9002', '9003', '9991', 'blank']
// Logits that give these probabilities after the classifier's scale.
const logits = (probabilities: number[]) => probabilities.map(p => Math.log(p) / ICON_LOGIT_SCALE)

it('REQ-ASSIST-048 reads a slot as the classifier\'s top gift with its lead, and leaves an empty-looking slot unknown', () => {
  const read = classifierSlotRead(logits([0.8, 0.15, 0.03, 0.01, 0.01]), labels)
  expect(read && 'id' in read && read.id).toBe('9001')
  expect(read && 'id' in read ? [read.score, read.margin] : []).toEqual([expect.closeTo(0.8, 5), expect.closeTo(0.65, 5)])
  // The luminance check decides blanks; a filled slot the classifier calls empty is fading in: unknown.
  expect(classifierSlotRead(logits([0.1, 0.05, 0.05, 0.05, 0.75]), labels)).toBeNull()
})

it('REQ-ASSIST-048 measures a held top gift only against the other held gifts, never an unheld top one', () => {
  const probabilities = logits([0.55, 0.4, 0.03, 0.01, 0.01])
  // 9002 is not held: the held 9001 leads the held gifts (9003) by 0.52.
  const held = classifierSlotRead(probabilities, labels, heldLabels(['9001', '9003']))
  expect(held && 'id' in held ? [held.id, held.margin] : []).toEqual(['9001', expect.closeTo(0.52, 5)])
  // An unheld best gift keeps the catalog lead, so a missing inventory entry never turns into a held lookalike.
  const unheld = classifierSlotRead(logits([0.4, 0.55, 0.03, 0.01, 0.01]), labels, heldLabels(['9001']))
  expect(unheld && 'id' in unheld ? [unheld.id, unheld.margin] : []).toEqual(['9002', expect.closeTo(0.15, 5)])
  // Every vestige counts as the one vestige class.
  expect([...heldLabels(['9993', '9001'])].sort()).toEqual(['9001', '9991'])
})

it('REQ-ASSIST-048 leaves a fusion to template matching when a held gift is not one of the classifier\'s classes', () => {
  expect(classifierKnowsHeld(labels, heldLabels(['9001', '9994']))).toBe(true)
  // 9500 was added to the game after the model was trained.
  expect(classifierKnowsHeld(labels, heldLabels(['9001', '9500']))).toBe(false)
})

it('normalizes RGBA crops into one NCHW batch', () => {
  const white = new Uint8ClampedArray(ICON_INPUT * ICON_INPUT * 4).fill(255)
  const tensor = iconTensor([white, new Uint8ClampedArray(ICON_INPUT * ICON_INPUT * 4)])
  expect(tensor.length).toBe(2 * 3 * ICON_INPUT * ICON_INPUT)
  expect(tensor[0]).toBeCloseTo((1 - 0.485) / 0.229, 5)
  expect(tensor[3 * ICON_INPUT * ICON_INPUT]).toBeCloseTo(-0.485 / 0.229, 5)
})
