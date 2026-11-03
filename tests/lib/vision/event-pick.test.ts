import { describe, expect, it } from 'vitest'
import { EMPTY_PICK, choiceBands, cursorSeen, listMissing, listShown } from '../../../lib/vision/event-pick'

// two buttons at 1920×1080 as the game lays them out: name lines at (1101, 300) and (1101, 476)
const boxes = [{ choiceId: 'a', left: 1101, top: 300, width: 300, height: 38 }, { choiceId: 'b', left: 1101, top: 476, width: 300, height: 38 }]

describe('the ? room option the cursor clicked', () => {
  it('places each button from its name line, scaled with the UI', () => {
    expect(choiceBands(boxes, 1920, 1080)[0]).toEqual({ choiceId: 'a', left: 1024, top: 249, right: 1757, bottom: 422 })
    const [half] = choiceBands(boxes.map(box => ({ ...box, left: box.left / 2, top: box.top / 2 })), 960, 540)
    expect(half.left).toBeCloseTo(512); expect(half.bottom).toBeCloseTo(211)
    // an OCR frame at half the capture's size
    expect(choiceBands([{ ...boxes[0], left: 550.5, top: 150 }], 1920, 1080, 0.5)[0].left).toBeCloseTo(1024)
  })

  it('takes the last press on a button, else the last button rested on, once the list is gone', () => {
    let state = listShown(EMPTY_PICK, choiceBands(boxes, 1920, 1080), 1000)
    state = cursorSeen(state, { at: 1100, x: 1300, y: 300, pressed: false })
    state = cursorSeen(state, { at: 1200, x: 1300, y: 500, pressed: true })
    state = cursorSeen(state, { at: 1300, x: 1300, y: 300, pressed: false })
    state = cursorSeen(state, { at: 1400, x: 200, y: 300, pressed: false }) // off the buttons
    let step = listMissing(state, 1500)
    expect(step.pick).toBeNull() // one read without the list may be a bad read
    step = listMissing(step.state, 2200)
    expect(step.pick).toEqual({ choiceId: 'b', at: 2200 })
    expect(step.state).toBe(EMPTY_PICK)
    const rested = cursorSeen(listShown(EMPTY_PICK, choiceBands(boxes, 1920, 1080), 0), { at: 10, x: 1300, y: 300, pressed: false })
    expect(listMissing(rested, 50, true).pick).toEqual({ choiceId: 'a', at: 50 })
  })

  it('names nothing without the cursor on a button, and forgets a list not seen for 3 s', () => {
    const state = listShown(EMPTY_PICK, choiceBands(boxes, 1920, 1080), 0)
    expect(listMissing(state, 10, true).pick).toBeNull()
    expect(cursorSeen(state, { at: 3500, x: 1300, y: 300, pressed: true }).hits).toEqual([])
    expect(listMissing(EMPTY_PICK, 10, true)).toEqual({ state: EMPTY_PICK, pick: null })
  })

  it('a list of other choices starts over', () => {
    let state = cursorSeen(listShown(EMPTY_PICK, choiceBands(boxes, 1920, 1080), 0), { at: 10, x: 1300, y: 300, pressed: true })
    state = listShown(state, choiceBands([{ ...boxes[0], choiceId: 'c' }], 1920, 1080), 20)
    expect(state.hits).toEqual([])
    state = listShown(cursorSeen(state, { at: 30, x: 1300, y: 300, pressed: false }), choiceBands([{ ...boxes[0], choiceId: 'c' }], 1920, 1080), 40)
    expect(state.hits).toHaveLength(1)
  })
})
