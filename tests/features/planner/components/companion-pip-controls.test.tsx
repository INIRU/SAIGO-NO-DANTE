import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import CompanionAcquisitionOverlay, { ACQUISITION_VISIBLE, AcquisitionStack, takeNewAcquisitions, type AcquisitionOverlayEvent } from '@/features/planner/components/CompanionAcquisitionOverlay'
import CompanionNextFloorButton, { NEXT_FLOOR_GUARD_MS, shouldAdvanceFloor } from '@/features/planner/components/CompanionNextFloorButton'

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

it('stacks a burst at once, newest in front, without dropping or merging any card', () => {
  const consumed: AcquisitionOverlayEvent = { kind: 'consumed', token: 'fuse', at: 0, materials: [{ gift: { name: 'm1' }, name: 'm1' }, { gift: { name: 'm2' }, name: 'm2' }] }
  const items = [event('a', 0), consumed, event('b', 0), event('c', 0), event('d', 0)]
  const html = renderToStaticMarkup(<AcquisitionStack items={items} label="획득" consumedLabel="합성 재료 소모" still={false} />)
  const depths = [...html.matchAll(/data-(?:acquisition|consumed)-overlay="([^"]+)"[^>]*data-stack-depth="(\d+)"/g)].map(match => [match[1], Number(match[2])])
  expect(depths).toEqual([['d', 0], ['c', 1], ['b', 2], ['fuse', 3], ['a', 4]])
  // Cards past the cap collapse behind and are counted on the front card.
  expect(ACQUISITION_VISIBLE).toBe(3)
  expect(html).toContain('+2')
  expect(html.match(/m1 · m2/g)).toHaveLength(1)
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
