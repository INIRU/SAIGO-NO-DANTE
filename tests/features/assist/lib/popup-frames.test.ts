import { describe, expect, it } from 'vitest'
import { pickReadyPopup, popupReadSummary, popupStale, staleFrames, weakestPopupFrame } from '@/features/assist/lib/popup-frames'
import { acquiredGiftFromPopup } from '@/features/assist/lib/popup-evidence'
import type { OcrReference } from '@/features/assist/lib/ocr-match'

function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Item { requestId: number; closed?: boolean }
interface Pending { capturedAt: number; readyAt: number; priority: number; quality: number }
/** The two queues and the pending map as the hook keeps them, with its dropPopup. */
class Room {
  popupQueue: { current: Item[] } = { current: [] }
  popupVisionQueue: { current: Item[] } = { current: [] }
  pending = new Map<number, Pending>()
  dropped: number[] = []
  dropPopup = (requestId: number) => {
    for (const queue of [this.popupQueue, this.popupVisionQueue]) {
      queue.current = queue.current.filter(item => {
        if (item.requestId !== requestId) return true
        this.dropped.push(requestId)
        return false
      })
    }
    this.pending.delete(requestId)
  }
  state() {
    return JSON.stringify({ text: this.popupQueue.current.map(item => item.requestId), image: this.popupVisionQueue.current.map(item => item.requestId),
      pending: [...this.pending.entries()].sort((a, b) => a[0] - b[0]), dropped: this.dropped })
  }
}

function fill(next: () => number, now: number): Room {
  const room = new Room()
  const total = Math.floor(next() * 12)
  for (let id = 1; id <= total; id++) {
    // most frames are queued for both readers; some were already taken by one of them, a few have no pending read
    if (next() < 0.85) room.popupQueue.current.push({ requestId: id })
    if (next() < 0.85) room.popupVisionQueue.current.push({ requestId: id })
    if (next() < 0.92) room.pending.set(id, { capturedAt: now - Math.floor(next() * 12000), readyAt: now + Math.floor((next() - 0.5) * 600),
      priority: Math.floor(next() * 4), quality: Math.floor(next() * 5) })
  }
  return room
}

// the hook's old takePopup and makePopupRoom, copied as they were (the clock is a plain number)
const legacyStale = (pending: Pending | undefined, now: number) => !pending || now - pending.capturedAt > 8000
function legacyTake(room: Room, queue: { current: Item[] }, now: number): Item | null {
  let best: Item | null = null
  let bestPriority = -1
  for (const item of [...queue.current]) {
    const pending = room.pending.get(item.requestId)
    if (!pending || legacyStale(pending, now)) {
      room.dropPopup(item.requestId)
      continue
    }
    if (pending.readyAt <= now && pending.priority > bestPriority) {
      best = item
      bestPriority = pending.priority
    }
  }
  if (best) queue.current = queue.current.filter(other => other !== best)
  return best
}
function legacyMakeRoom(room: Room, priority: number, quality: number, now: number) {
  for (const item of [...room.popupQueue.current, ...room.popupVisionQueue.current]) {
    if (legacyStale(room.pending.get(item.requestId), now)) room.dropPopup(item.requestId)
  }
  while (room.popupQueue.current.length >= 8 || room.popupVisionQueue.current.length >= 8) {
    const full = room.popupQueue.current.length >= 8 ? room.popupQueue.current : room.popupVisionQueue.current
    let weakest: number | null = null
    let weakestPriority = priority
    let weakestQuality = quality
    for (const item of full) {
      const pending = room.pending.get(item.requestId)
      const itemPriority = pending?.priority ?? -1
      const itemQuality = pending?.quality ?? 0
      if (itemPriority < weakestPriority || (itemPriority === weakestPriority && itemQuality < weakestQuality)) {
        weakest = item.requestId
        weakestPriority = itemPriority
        weakestQuality = itemQuality
      }
    }
    if (weakest === null) return false
    room.dropPopup(weakest)
  }
  return true
}

// the same two, written with the new functions as the hook now does
function take(room: Room, queue: { current: Item[] }, now: number): Item | null {
  const { best, stale } = pickReadyPopup(queue.current, room.pending, now)
  for (const requestId of stale) room.dropPopup(requestId)
  if (best) queue.current = queue.current.filter(other => other !== best)
  return best
}
function makeRoom(room: Room, priority: number, quality: number, now: number) {
  for (const requestId of staleFrames([...room.popupQueue.current, ...room.popupVisionQueue.current], room.pending, now)) room.dropPopup(requestId)
  while (room.popupQueue.current.length >= 8 || room.popupVisionQueue.current.length >= 8) {
    const full = room.popupQueue.current.length >= 8 ? room.popupQueue.current : room.popupVisionQueue.current
    const weakest = weakestPopupFrame(full, room.pending, priority, quality)
    if (weakest === null) return false
    room.dropPopup(weakest)
  }
  return true
}

describe('popupStale', () => {
  it('is a frame with no pending read, or captured more than 8 s ago', () => {
    expect(popupStale(undefined, 10_000)).toBe(true)
    expect(popupStale({ capturedAt: 2_000 }, 10_000)).toBe(false)
    expect(popupStale({ capturedAt: 1_999 }, 10_000)).toBe(true)
  })
})

describe('pickReadyPopup', () => {
  const pending = (priority: number, readyAt = 0, capturedAt = 9_000) => ({ capturedAt, readyAt, priority, quality: 1 })
  it('takes the ready frame with the highest priority, the earliest on a tie, and lists stale ones', () => {
    const items = [{ requestId: 1 }, { requestId: 2 }, { requestId: 3 }, { requestId: 4 }, { requestId: 5 }]
    const pendings = new Map([[1, pending(1)], [2, pending(3, 20_000)], [3, pending(2)], [4, pending(2)], [5, pending(9, 0, 100)]])
    expect(pickReadyPopup(items, pendings, 10_000)).toEqual({ best: items[2], stale: [5] })
  })
  it('gives nothing for an empty queue or frames not yet ready', () => {
    expect(pickReadyPopup([], new Map(), 1)).toEqual({ best: null, stale: [] })
    expect(pickReadyPopup([{ requestId: 1 }], new Map([[1, pending(1, 5_000)]]), 4_999).best).toBeNull()
    expect(pickReadyPopup([{ requestId: 1 }], new Map([[1, pending(1, 5_000)]]), 5_000).best).toEqual({ requestId: 1 })
  })
  it('lists a frame with no pending read as stale', () => {
    expect(pickReadyPopup([{ requestId: 7 }], new Map(), 1)).toEqual({ best: null, stale: [7] })
  })
  it('leaves the queues and the pending map as the old takePopup did, on random rooms', () => {
    const next = random(3)
    for (let run = 0; run < 400; run++) {
      const now = 100_000
      const seed = Math.floor(next() * 1e9)
      const queueName = next() < 0.5 ? 'popupQueue' : 'popupVisionQueue'
      const before = fill(random(seed), now), after = fill(random(seed), now)
      const oldTaken = legacyTake(before, before[queueName], now)
      const newTaken = take(after, after[queueName], now)
      expect(newTaken?.requestId ?? null).toBe(oldTaken?.requestId ?? null)
      expect(after.state()).toBe(before.state())
    }
  })
})

describe('staleFrames and weakestPopupFrame', () => {
  it('list the stale frames of a queue', () => {
    const pendings = new Map([[1, { capturedAt: 9_500 }], [2, { capturedAt: 100 }]])
    expect(staleFrames([{ requestId: 1 }, { requestId: 2 }, { requestId: 3 }], pendings, 10_000)).toEqual([2, 3])
  })
  it('weakest is the lowest priority below the new frame, then the lowest quality; none when all are as good', () => {
    const pendings = new Map([[1, { priority: 2, quality: 3 }], [2, { priority: 1, quality: 4 }], [3, { priority: 1, quality: 2 }]])
    const full = [{ requestId: 1 }, { requestId: 2 }, { requestId: 3 }]
    expect(weakestPopupFrame(full, pendings, 2, 3)).toBe(3)
    expect(weakestPopupFrame(full, pendings, 1, 2)).toBeNull()
    expect(weakestPopupFrame([{ requestId: 9 }], new Map(), 0, 0)).toBe(9)
  })
  it('make room as the old loop did, on random rooms', () => {
    const next = random(8)
    for (let run = 0; run < 500; run++) {
      const now = 100_000
      const seed = Math.floor(next() * 1e9)
      const priority = Math.floor(next() * 4), quality = Math.floor(next() * 5)
      // more frames so the queues fill up
      const build = () => {
        const room = fill(random(seed), now)
        const more = random(seed + 1)
        for (let id = 100; id < 100 + Math.floor(more() * 12); id++) {
          room.popupQueue.current.push({ requestId: id })
          room.popupVisionQueue.current.push({ requestId: id })
          room.pending.set(id, { capturedAt: now - Math.floor(more() * 9000), readyAt: now, priority: Math.floor(more() * 4), quality: Math.floor(more() * 5) })
        }
        return room
      }
      const before = build(), after = build()
      expect(makeRoom(after, priority, quality, now)).toBe(legacyMakeRoom(before, priority, quality, now))
      expect(after.state()).toBe(before.state())
    }
  })
})

describe('popupReadSummary', () => {
  const gifts: OcrReference[] = [{ id: '10', texts: ['Mirror Shard'] }, { id: '11', texts: ['Golden Bough'] }]
  const labels = (...texts: string[]) => texts.map(text => ({ text, words: [] }))
  it('lists each icon and effect owner once and joins the headers', () => {
    const summary = popupReadSummary({ headers: ['a', 'b'], labels: [], icons: ['10', '10'], effects: ['11', '11'] }, gifts)
    expect(summary.icons).toEqual(['10'])
    expect(summary.effects).toEqual(['11'])
    expect(summary.header).toBe('a\nb')
  })
  it('abstains when frames show two different icons', () => {
    expect(popupReadSummary({ headers: ['acquired'], labels: labels('Mirror Shard'), icons: ['10', '11'], effects: [] }, gifts).verdict).toBeNull()
  })
  it('matches the old merge on random frames', () => {
    const next = random(55)
    const headers = ['', 'Acquired', 'EGO Gift acquired', '획득', 'EGO 기프트 획득', 'Purchase']
    const names = ['Mirror Shard', 'Golden Bough', 'Nothing', '']
    for (let run = 0; run < 300; run++) {
      const reads = { headers: Array.from({ length: Math.floor(next() * 4) }, () => headers[Math.floor(next() * headers.length)]),
        labels: labels(...Array.from({ length: Math.floor(next() * 3) }, () => names[Math.floor(next() * names.length)])),
        icons: Array.from({ length: Math.floor(next() * 4) }, () => ['10', '11', '12'][Math.floor(next() * 3)]),
        effects: Array.from({ length: Math.floor(next() * 3) }, () => ['10', '11', '12'][Math.floor(next() * 3)]) }
      const icons = [...new Set(reads.icons)], effects = [...new Set(reads.effects)], header = reads.headers.join('\n')
      const verdict = icons.length > 1 ? null : acquiredGiftFromPopup({ header, labels: reads.labels, iconGiftId: icons[0] ?? null, effectGiftIds: effects, gifts })
      expect(popupReadSummary(reads, gifts)).toEqual({ icons, effects, header, verdict })
    }
  })
})
