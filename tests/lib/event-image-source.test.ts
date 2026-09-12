import { expect, it } from 'vitest'
import { eventImageId, eventImageIdFromFilename } from '../../scripts/assets/event-image-source'

it('includes five-digit story art without matching truncated or unrelated filenames', () => {
  expect(eventImageIdFromFilename('ChoiceEvent_10711.png')).toBe(10711)
  expect(eventImageIdFromFilename('ChoiceEvent_10904.png')).toBe(10904)
  expect(eventImageIdFromFilename('901001_홍염나방.png')).toBe(901001)
  expect(eventImageIdFromFilename('ChoiceEvent_123456789.png')).toBeUndefined()
  expect(eventImageIdFromFilename('heal_background.png')).toBeUndefined()
})

it('reuses the verified story image URL for each MD scene', () => {
  for (const [event, source] of [[971100, 10711], [971101, 10712], [971102, 10713], [971103, 10714], [971110, 10902], [971111, 10903], [971112, 10904]]) {
    expect(eventImageId(event)).toBe(eventImageId(source))
  }
  expect(eventImageId(971100, 12345)).toBe(12345)
  expect(eventImageId(971071)).toBe(971071)
  expect(eventImageId(971072)).toBe(971072)
  expect(eventImageId(971113)).toBe(971113)
})
