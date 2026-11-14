import { describe, expect, it } from 'vitest'
import { fusionCandidateIds, knownCapacity, popupDialogCount, popupDialogMaterials, wheelCapacityChoice, type DialogReads } from '@/features/assist/lib/fusion-capture'
import { AUTO_ACQUIRE_EXCLUDED_GIFT_IDS } from '@/features/assist/lib/popup-evidence'
import { fusionMaterials, type FusionRead, type FusionSlotRead } from '@/features/assist/lib/fusion-evidence'
import { CAPACITY_KEEP_MS } from '@/features/assist/lib/capture-helpers'

// fixed-seed random numbers, so a failure can be run again
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// the hook's old closures, copied as they were
const legacyCandidates = (held: readonly string[]) => [...new Set([...held.map(key => String(parseInt(key, 10))).filter(id => id !== 'NaN'),
  ...AUTO_ACQUIRE_EXCLUDED_GIFT_IDS])]
const legacyMaterials = (dialog: DialogReads | null, capturedAt: number) =>
  dialog && dialog.firstAt <= capturedAt && capturedAt - dialog.lastSeenAt <= 4000
    ? fusionMaterials(dialog.reads, dialog.count, dialog.capacity) : []
const legacyCount = (dialog: DialogReads | null, capturedAt: number) =>
  dialog && dialog.firstAt <= capturedAt && capturedAt - dialog.lastSeenAt <= 4000 ? dialog.count : undefined
const legacyDecide = (wheel: { reads: Partial<Record<number, FusionRead>> }[], force: boolean) => {
  const named = (size: number) => fusionMaterials(wheel.flatMap(item => item.reads[size] ? [item.reads[size]!] : []), size, size).length
  const three = named(3), five = named(5)
  if (!force && Math.max(three, five) < 2) return null
  return five > three ? 5 : 3
}

const IDS = ['1', '2', '3', '4', '5', '6']
function slot(next: () => number): FusionSlotRead {
  const kind = next()
  if (kind < 0.15) return null
  if (kind < 0.3) return { blank: true }
  return { id: IDS[Math.floor(next() * IDS.length)], score: 0.5 + next() * 0.5, margin: next() * 0.4 }
}
const read = (next: () => number, size: number, view: FusionRead['view']): FusionRead =>
  ({ view, slots: Array.from({ length: size }, () => slot(next)), observedAt: Math.floor(next() * 1000) })

describe('fusionCandidateIds', () => {
  it('drops enhancement suffixes and non-numbers, keeps the vestiges, lists each once', () => {
    const ids = fusionCandidateIds(['10101', '10101', '20202+3', 'x', ''])
    expect(ids).toEqual(legacyCandidates(['10101', '10101', '20202+3', 'x', '']))
    expect(ids).toContain('10101')
    expect(ids).toContain('20202')
    expect(ids).not.toContain('NaN')
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('gives just the vestiges for nothing held', () => {
    expect(fusionCandidateIds([])).toEqual([...new Set(AUTO_ACQUIRE_EXCLUDED_GIFT_IDS)])
  })
  it('matches the old closure on random inventories', () => {
    const next = random(11)
    for (let run = 0; run < 200; run++) {
      const held = Array.from({ length: Math.floor(next() * 12) }, () => next() < 0.15 ? 'junk' : `${Math.floor(next() * 40) * 100}${next() < 0.3 ? '+2' : ''}`)
      expect(fusionCandidateIds(held)).toEqual(legacyCandidates(held))
    }
  })
})

describe('popupDialogMaterials and popupDialogCount', () => {
  it('follow no dialog, one opened later, or one not seen within 4 s of the popup', () => {
    const dialog: DialogReads = { firstAt: 1000, lastSeenAt: 2000, reads: [], count: 3, capacity: 3 }
    expect(popupDialogMaterials(null, 1500)).toEqual([])
    expect(popupDialogCount(null, 1500)).toBeUndefined()
    expect(popupDialogCount(dialog, 999)).toBeUndefined()
    expect(popupDialogCount(dialog, 1000)).toBe(3)
    expect(popupDialogCount(dialog, 6000)).toBe(3)
    expect(popupDialogCount(dialog, 6001)).toBeUndefined()
    expect(popupDialogMaterials(dialog, 6001)).toEqual([])
  })
  it('match the old closures on random dialogs and capture times, edges included', () => {
    const next = random(23)
    for (let run = 0; run < 300; run++) {
      const capacity = next() < 0.5 ? 3 : 5
      const count = 2 + Math.floor(next() * (capacity - 1))
      const reads = Array.from({ length: Math.floor(next() * 5) }, () => read(next, next() < 0.5 ? count : capacity, next() < 0.5 ? 'dialog' : 'wheel'))
      const firstAt = Math.floor(next() * 3000)
      const dialog: DialogReads | null = next() < 0.1 ? null : { firstAt, lastSeenAt: firstAt + Math.floor(next() * 3000), reads, count, capacity }
      for (const capturedAt of dialog ? [dialog.firstAt - 1, dialog.firstAt, dialog.lastSeenAt, dialog.lastSeenAt + 4000, dialog.lastSeenAt + 4001,
        Math.floor(next() * 9000)] : [500]) {
        expect(popupDialogMaterials(dialog, capturedAt)).toEqual(legacyMaterials(dialog, capturedAt))
        expect(popupDialogCount(dialog, capturedAt)).toBe(legacyCount(dialog, capturedAt))
      }
    }
  })
})

describe('wheelCapacityChoice', () => {
  it('waits while no layout names two materials, unless forced', () => {
    expect(wheelCapacityChoice([], false)).toBeNull()
    expect(wheelCapacityChoice([], true)).toBe(3)
    expect(wheelCapacityChoice([{ reads: {} }], false)).toBeNull()
  })
  it('matches the old decision on random wheel states', () => {
    const next = random(37)
    for (let run = 0; run < 400; run++) {
      const wheel = Array.from({ length: Math.floor(next() * 5) }, () => {
        const reads: Partial<Record<number, FusionRead>> = {}
        if (next() < 0.7) reads[3] = read(next, 3, 'wheel')
        if (next() < 0.7) reads[5] = read(next, 5, 'wheel')
        return { reads }
      })
      for (const force of [false, true]) expect(wheelCapacityChoice(wheel, force)).toBe(legacyDecide(wheel, force))
    }
  })
})

describe('knownCapacity', () => {
  it('is the latest dialog capacity while recent, else null', () => {
    expect(knownCapacity(null, 5000)).toBeNull()
    expect(knownCapacity({ capacity: 5, at: 1000 }, 1000 + CAPACITY_KEEP_MS - 1)).toBe(5)
    expect(knownCapacity({ capacity: 5, at: 1000 }, 1000 + CAPACITY_KEEP_MS)).toBeNull()
  })
})
