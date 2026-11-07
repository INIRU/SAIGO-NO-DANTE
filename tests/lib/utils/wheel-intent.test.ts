import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GESTURE_GAP_MS, nextWheelGesture, wheelPixels } from '@/lib/utils/wheel-intent'

describe('wheel intent', () => {
  it('REQ-DECKS-053 a wheel gesture that started on the page keeps scrolling the page when the pointer passes over the panel', () => {
    let gesture = nextWheelGesture(null, 0, false)
    gesture = nextWheelGesture(gesture, 40, false)
    gesture = nextWheelGesture(gesture, 80, true)
    expect(gesture.owner).toBe('page')
    gesture = nextWheelGesture(gesture, 80 + GESTURE_GAP_MS - 1, true)
    expect(gesture.owner).toBe('page')
  })

  it('REQ-DECKS-053 a new gesture after a pause, started over the panel, scrolls the panel', () => {
    const page = nextWheelGesture(nextWheelGesture(null, 0, false), 50, true)
    expect(nextWheelGesture(page, 50 + GESTURE_GAP_MS, true).owner).toBe('panel')
    expect(nextWheelGesture(null, 0, true).owner).toBe('panel')
  })

  it('REQ-DECKS-053 a gesture that started over the panel stays with it while the pointer drifts out', () => {
    const panel = nextWheelGesture(null, 0, true)
    expect(nextWheelGesture(panel, 100, false).owner).toBe('panel')
  })

  it('REQ-DECKS-053 converts line and page wheel deltas to pixels', () => {
    expect(wheelPixels(120, 0, 900)).toBe(120)
    expect(wheelPixels(3, 1, 900)).toBe(48)
    expect(wheelPixels(1, 2, 900)).toBe(900)
  })
})

describe('panels a page scroll passes through', () => {
  it('REQ-DECKS-053 the blessing cards\' effect text uses the same wheel intent, without overscroll containment', () => {
    const source = readFileSync(resolve(__dirname, '../../../features/planner/components/BlessingTab.tsx'), 'utf8')
    expect(source).toMatch(/useWheelIntent\(effectsRef\)/)
    expect(source).toMatch(/ref=\{effectsRef\}\s*\n\s*className="planner-blessing-effects/)
    expect(source).not.toMatch(/overscrollBehavior: 'contain'/)
  })
})
