import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import CompanionAcquisitionOverlay, { acquisitionDwellMs, takeNewAcquisitions, type AcquisitionOverlayEvent } from '@/components/planner/run/CompanionAcquisitionOverlay'
import CompanionNextFloorButton, { NEXT_FLOOR_GUARD_MS, shouldAdvanceFloor } from '@/components/planner/run/CompanionNextFloorButton'

vi.mock('@/components/ui/GiftArtwork', () => ({ default: () => <span data-test-artwork /> }))

const event = (token: string, at: number): AcquisitionOverlayEvent => ({ token, at, gift: { name: token }, name: token })

it('queues each confirmed token once, in order, and silently drops stale ones', () => {
  const seen = new Set<string>()
  expect(takeNewAcquisitions([event('a', 1000), event('b', 1001)], seen, 1500).map(item => item.token)).toEqual(['a', 'b'])
  // Re-renders pass the same list again; nothing replays.
  expect(takeNewAcquisitions([event('a', 1000), event('b', 1001), event('c', 1400)], seen, 1600).map(item => item.token)).toEqual(['c'])
  expect(takeNewAcquisitions([event('old', 0)], seen, 10_000)).toEqual([])
  expect(seen.has('old')).toBe(true)
})

it('drains a burst faster without skipping plates', () => {
  expect(acquisitionDwellMs(0)).toBeGreaterThan(acquisitionDwellMs(1))
  expect(acquisitionDwellMs(1)).toBeGreaterThan(acquisitionDwellMs(5))
  expect(acquisitionDwellMs(5)).toBeGreaterThan(0)
})

it('renders an empty, click-through live region before any acquisition', () => {
  const html = renderToStaticMarkup(<CompanionAcquisitionOverlay events={[event('restored', Date.now())]} label="획득" />)
  expect(html).toContain('role="status"')
  expect(html).toContain('pointer-events-none')
  expect(html).not.toContain('data-acquisition-overlay')
})

it('never advances past the last floor or twice from one double-click', () => {
  expect(shouldAdvanceFloor({ floor: 2, maxFloors: 5, now: 100, lastAcceptedAt: null })).toBe(true)
  expect(shouldAdvanceFloor({ floor: 5, maxFloors: 5, now: 100, lastAcceptedAt: null })).toBe(false)
  expect(shouldAdvanceFloor({ floor: 2, maxFloors: 5, disabled: true, now: 100, lastAcceptedAt: null })).toBe(false)
  expect(shouldAdvanceFloor({ floor: 3, maxFloors: 5, clickCount: 2, now: 150, lastAcceptedAt: null })).toBe(false)
  expect(shouldAdvanceFloor({ floor: 3, maxFloors: 5, now: 100 + NEXT_FLOOR_GUARD_MS - 1, lastAcceptedAt: 100 })).toBe(false)
  expect(shouldAdvanceFloor({ floor: 3, maxFloors: 5, clickCount: 0, now: 100 + NEXT_FLOOR_GUARD_MS, lastAcceptedAt: 100 })).toBe(true)
})

it('names the next floor visibly and disables itself on the last floor', () => {
  const next = renderToStaticMarkup(<CompanionNextFloorButton floor={2} maxFloors={5} label="다음 층" onAdvance={() => {}} />)
  expect(next).toContain('다음 층')
  expect(next).toContain('>03<')
  expect(next).not.toContain('disabled=""')
  const last = renderToStaticMarkup(<CompanionNextFloorButton floor={5} maxFloors={5} label="다음 층" disabledTitle="마지막 층" onAdvance={() => {}} />)
  expect(last).toContain('disabled=""')
  expect(last).toContain('title="마지막 층"')
  expect(last).not.toContain('>06<')
})
