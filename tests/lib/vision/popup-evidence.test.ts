import { expect, it } from 'vitest'
import { acquiredGiftFromPopup, acquisitionFloor, popupHeaderEvidence, popupPurchaseHeader } from '../../../lib/vision/popup-evidence'

const gifts = [
  { id: '9073', texts: ['엔도르핀 키트'] },
  { id: '9028', texts: ['편견'] },
]
const header = 'E.G.O 기프트를 획득했습니다.'
const word = (text: string, confidence = 90) => ({ text, confidence, left: 0, top: 0, width: 30, height: 20 })
const read = (text: string, words = text.split(' ').map(part => word(part))) => ({ text, words })

it('accepts an exact unique name read inside a popup', () => {
  expect(acquiredGiftFromPopup({ header, labels: [read('엔도르핀 키트')], iconGiftId: null, gifts })).toBe('9073')
  expect(acquiredGiftFromPopup({ header, labels: [read('엔도르핀 키트', [word('엔도르핀', 10), word('키트')])],
    iconGiftId: null, gifts })).toBe('9073')
  expect(acquiredGiftFromPopup({ header, labels: [read(''), read('편견')], iconGiftId: null, gifts })).toBe('9028')
})

it('accepts a high-confidence popup icon only when its acquisition header is present', () => {
  expect(acquiredGiftFromPopup({ header, labels: [read('')], iconGiftId: '9028', gifts })).toBe('9028')
  expect(acquiredGiftFromPopup({ header: '', labels: [read('엔도르핀 키트')], iconGiftId: '9073', gifts })).toBeNull()
  expect(acquiredGiftFromPopup({ header: 'EGO 기프르를 획득했습니다.', labels: [read('')], iconGiftId: '9028', gifts }))
    .toBe('9028')
  expect(acquiredGiftFromPopup({ header: '획득 E.G.O 기프트', labels: [read('')], iconGiftId: '9028', gifts })).toBeNull()
})

it('uses a single unique effect match from the popup panel as a fallback', () => {
  expect(acquiredGiftFromPopup({ header, labels: [read('')], iconGiftId: null, effectGiftIds: ['9028'], gifts })).toBe('9028')
  expect(acquiredGiftFromPopup({ header, labels: [read('편견')], iconGiftId: '9028', effectGiftIds: ['9028'], gifts }))
    .toBe('9028')
  expect(acquiredGiftFromPopup({ header: '', labels: [read('')], iconGiftId: null, effectGiftIds: ['9028'], gifts })).toBeNull()
  expect(acquiredGiftFromPopup({ header, labels: [read('')], iconGiftId: null, effectGiftIds: ['9028', '9073'], gifts }))
    .toBeNull()
  expect(acquiredGiftFromPopup({ header, labels: [read('')], iconGiftId: null, effectGiftIds: ['unknown'], gifts })).toBeNull()
})

it('abstains on conflicting, ambiguous, or weak evidence', () => {
  expect(acquiredGiftFromPopup({ header, labels: [read('엔도르핀 키트', [word('엔도르핀')])], iconGiftId: '9028', gifts }))
    .toBeNull()
  expect(acquiredGiftFromPopup({ header, labels: [read('편견', [word('편견', 60)])], iconGiftId: null, gifts })).toBeNull()
  expect(acquiredGiftFromPopup({ header, labels: [read('엔도르핀', [word('엔도르핀', 95)])], iconGiftId: null, gifts })).toBeNull()
  expect(acquiredGiftFromPopup({ header, labels: [read('엔도르핀 키트')], iconGiftId: null,
    gifts: [...gifts, { id: 'other', texts: ['엔도르핀 키트'] }] })).toBeNull()
  expect(acquiredGiftFromPopup({ header, labels: [read('엔도르핀 키트'), read('편견')], iconGiftId: null, gifts })).toBeNull()
  expect(acquiredGiftFromPopup({ header, labels: [read('엔도르핀 키트')], iconGiftId: null, effectGiftIds: ['9028'], gifts }))
    .toBeNull()
  expect(acquiredGiftFromPopup({ header, labels: [read('')], iconGiftId: '9073', effectGiftIds: ['9028'], gifts })).toBeNull()
})

it('keeps the captured floor for a confirmed gift only when the latest banner agrees', () => {
  expect(acquisitionFloor(1, null)).toBe(1)
  expect(acquisitionFloor(1, 1)).toBe(1)
  expect(acquisitionFloor(1, 2)).toBeNull()
  expect(acquisitionFloor(3, 2)).toBeNull()
})

it('accepts a one-glyph misread of a long name only when two reads agree and no other name is close', () => {
  const catalog = [...gifts, { id: '9701', texts: ['뜨거운 육즙 다리살'] }, { id: 'line-a', texts: ['제3구간 통행권'] },
    { id: 'line-b', texts: ['제4구간 통행권'] }]
  const near = (text: string) => ({ text, words: [word(text, 20)] })
  expect(acquiredGiftFromPopup({ header, labels: [near('뜨거운 육즘 다리살'), near('뜨거운 육즘 다리살')], iconGiftId: null, gifts: catalog }))
    .toBe('9701')
  expect(acquiredGiftFromPopup({ header, labels: [near('뜨거운 육즘 다리살'), read('')], iconGiftId: null, gifts: catalog })).toBeNull()
  expect(acquiredGiftFromPopup({ header, labels: [near('뜨거운 욱즘 다리살'), near('뜨거운 욱즘 다리살')], iconGiftId: null, gifts: catalog }))
    .toBeNull()
  expect(acquiredGiftFromPopup({ header, labels: [near('제5구간 통행권'), near('제5구간 통행권')], iconGiftId: null, gifts: catalog }))
    .toBeNull()
  expect(acquiredGiftFromPopup({ header: '', labels: [near('뜨거운 육즘 다리살'), near('뜨거운 육즘 다리살')], iconGiftId: null,
    gifts: catalog })).toBeNull()
  expect(acquiredGiftFromPopup({ header, labels: [near('뜨거운 육즘 다리살'), near('뜨거운 육즘 다리살')], iconGiftId: '9028',
    gifts: catalog })).toBeNull()
})

it('tells the shop purchase dialog apart from an acquisition popup', () => {
  expect(popupPurchaseHeader('E.G.O 기프트 구매')).toBe(true)
  expect(popupHeaderEvidence('E.G.O 기프트 구매')).toBe(false)
  expect(popupPurchaseHeader('E.G.O 기프트를 획득했습니다.')).toBe(false)
  expect(popupHeaderEvidence('E.G.O 기프트를 획득했습니다.')).toBe(true)
})
