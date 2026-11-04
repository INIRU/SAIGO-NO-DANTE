import { describe, expect, it } from 'vitest'
import { EMPTY_PICK, choiceBands, cursorSeen, distinctBoxes, listMissing, listShown, type ChoiceBand, type PickState } from '../../../lib/vision/event-pick'

// two buttons at 1920×1080 as the game lays them out: name lines at (1101, 300) and (1101, 476)
const boxes = [{ choiceId: 'a', left: 1101, top: 300, width: 300, height: 38 }, { choiceId: 'b', left: 1101, top: 476, width: 300, height: 38 }]
const show = (state: PickState, bands: ChoiceBand[], at: number) => listShown(state, bands, at).state
const both = choiceBands(boxes, 1920, 1080)

describe('the ? room option the cursor clicked', () => {
  it('places each button from its name line, scaled with the UI', () => {
    expect(both[0]).toEqual({ choiceId: 'a', left: 1024, top: 249, right: 1757, bottom: 422 })
    const [half] = choiceBands(boxes.map(box => ({ ...box, left: box.left / 2, top: box.top / 2 })), 960, 540)
    expect(half.left).toBeCloseTo(512); expect(half.bottom).toBeCloseTo(211)
    // an OCR frame at half the capture's size
    expect(choiceBands([{ ...boxes[0], left: 550.5, top: 150 }], 1920, 1080, 0.5)[0].left).toBeCloseTo(1024)
  })

  it('takes the last button the cursor was on once the list is gone (pressed or not: small cursors are told apart badly)', () => {
    let state = show(EMPTY_PICK, both, 1000)
    state = cursorSeen(state, { at: 1100, x: 1300, y: 300, pressed: true })
    state = cursorSeen(state, { at: 1200, x: 1300, y: 500, pressed: false })
    state = cursorSeen(state, { at: 1400, x: 200, y: 300, pressed: false }) // off the buttons
    let step = listMissing(state, 1500)
    expect(step.pick).toBeNull() // one read without the list may be a bad read
    step = listMissing(step.state, 2200)
    expect(step.pick).toEqual({ choiceId: 'b', at: 2200, via: 'cursor' })
    expect(step.state).toBe(EMPTY_PICK)
    const rested = cursorSeen(show(EMPTY_PICK, both, 0), { at: 10, x: 1300, y: 300, pressed: false })
    expect(listMissing(rested, 50, true).pick).toEqual({ choiceId: 'a', at: 50, via: 'cursor' })
  })

  it('names nothing without the cursor on a button, and forgets a list not seen for 3 s', () => {
    const state = show(EMPTY_PICK, both, 0)
    expect(listMissing(state, 10, true).pick).toBeNull()
    expect(cursorSeen(state, { at: 3500, x: 1300, y: 300, pressed: true }).hits).toEqual([])
    expect(listMissing(EMPTY_PICK, 10, true)).toEqual({ state: EMPTY_PICK, pick: null })
  })

  it('a list of other choices starts over', () => {
    const other = choiceBands([{ ...boxes[0], choiceId: 'c' }], 1920, 1080)
    let state = cursorSeen(show(EMPTY_PICK, both, 0), { at: 10, x: 1300, y: 300, pressed: true })
    state = show(state, other, 20)
    expect(state.hits).toEqual([])
    state = show(cursorSeen(state, { at: 30, x: 1300, y: 300, pressed: false }), other, 40)
    expect(state.hits).toHaveLength(1)
  })

  it('the game leaving one option of the list alone (its result page) names it, read so twice in a row', () => {
    const alone = choiceBands([boxes[1]], 1920, 1080)
    let step = listShown(show(EMPTY_PICK, both, 0), alone, 700)
    expect(step.pick).toBeNull()
    step = listShown(step.state, alone, 1400)
    expect(step.pick).toEqual({ choiceId: 'b', at: 1400, via: 'list' })
    // a dropped line once, then the whole list again: nothing
    step = listShown(listShown(show(EMPTY_PICK, both, 0), alone, 700).state, both, 1400)
    expect(step.pick).toBeNull()
    expect(listShown(step.state, alone, 2100).pick).toBeNull()
  })

  it('a quick click: the result page alone names the option, the list never read (live test, 2026-11-04)', () => {
    const alone = choiceBands([boxes[1]], 1920, 1080)
    // under the result header: at once
    expect(listShown(EMPTY_PICK, alone, 700, { resultPage: true, options: 2 }).pick).toEqual({ choiceId: 'b', at: 700, via: 'list' })
    // header unread: twice in a row
    const first = listShown(EMPTY_PICK, alone, 700, { options: 2 })
    expect(first.pick).toBeNull()
    expect(listShown(first.state, alone, 1400, { options: 2 }).pick).toEqual({ choiceId: 'b', at: 1400, via: 'list' })
    // read once, then the room went on: still that option
    expect(listMissing(first.state, 1500, true).pick).toEqual({ choiceId: 'b', at: 1500, via: 'list' })
    // an event of one readable option: its list is that one line, nothing taken yet
    expect(listShown(listShown(EMPTY_PICK, alone, 700, { options: 1 }).state, alone, 1400, { options: 1 }).pick).toBeNull()
  })

  it('an option with several result rows is one line, not several buttons', () => {
    const rows = [boxes[0], { ...boxes[0], choiceId: 'a2' }, { ...boxes[0], choiceId: 'a3', left: 1101.5 }, boxes[1]]
    expect(distinctBoxes(rows).map(box => box.choiceId)).toEqual(['a', 'b'])
  })
})
