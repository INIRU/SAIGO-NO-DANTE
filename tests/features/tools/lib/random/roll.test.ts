import { describe, expect, it } from 'vitest'
import { lockRefsFromResult, newRoll, refOf, rerollSinner, resolveSnapshot, type RollSettings } from '@/features/tools/lib/random/roll'
import { EGOS, IDENTITIES, SINNERS, sinnerIds } from './fixture'

const data = { sinners: SINNERS, identities: IDENTITIES, egos: EGOS }
const settings = (patch: Partial<RollSettings> = {}): RollSettings => ({
  identityEnabled: true, egoEnabled: true, keywords: [], rarity: null, deploy: null, ...patch,
})
const start = (seed: string, patch: Partial<RollSettings> = {}, owned: Set<string> | null = null) =>
  newRoll(data, { seed, settings: settings(patch), marks: [], collectionCode: null, previous: null }, owned)
const ids = (result: ReturnType<typeof resolveSnapshot>) => sinnerIds().map(id => result.identities[id]?.id)

describe('REQ-TOOLS-017 a roll is rebuilt from its snapshot', () => {
  it('REQ-TOOLS-017 replays the snapshot to the very same result, with and without a formation order', () => {
    for (const patch of [{}, { deploy: { min: 1, max: 12 } }, { rarity: [2, 3], deploy: { min: 3, max: 6 } }]) {
      const { snapshot, result } = start('replay', patch)
      expect(resolveSnapshot(data, snapshot, null)).toEqual(result)
    }
  })

  it('REQ-TOOLS-017 replays a roll made inside an owned-only pool', () => {
    const owned = new Set(IDENTITIES.filter((_, i) => i % 2 === 0).map(identity => identity.id).concat(EGOS.map(ego => ego.id)))
    const { snapshot, result } = start('owned', {}, owned)
    expect(resolveSnapshot(data, snapshot, owned)).toEqual(result)
    expect(Object.values(result.identities).every(identity => owned.has(identity!.id))).toBe(true)
  })

  it('REQ-TOOLS-017 draws another result for another seed', () => {
    expect(ids(start('one').result)).not.toEqual(ids(start('two').result))
  })

  it('REQ-TOOLS-017 names an identity or E.G.O by its game id', () => {
    expect(refOf({ id: 'uuid-1', game_id: '10101' })).toBe('10101')
    expect(refOf({ id: 'uuid-2', game_id: null })).toBe('uuid-2')
  })
})

describe('REQ-TOOLS-015 locking across rolls', () => {
  it('REQ-TOOLS-015 keeps the marked sinners as they were and records them in the next snapshot', () => {
    const first = start('first', { deploy: { min: 1, max: 12 } })
    const second = newRoll(data, { seed: 'second', settings: settings({ deploy: { min: 1, max: 12 } }), marks: ['s2', 's5'], collectionCode: null, previous: first.result }, null)
    for (const id of ['s2', 's5']) {
      expect(second.result.identities[id]).toEqual(first.result.identities[id])
      expect(second.result.egos[id]).toEqual(first.result.egos[id])
      expect(second.result.order?.indexOf(id)).toBe(first.result.order?.indexOf(id) === -1 ? -1 : first.result.order?.indexOf(id))
    }
    expect(second.snapshot.locks.map(lock => lock.sinnerId)).toEqual(['s2', 's5'])
    expect(second.snapshot.marks).toEqual(['s2', 's5'])
    expect(second.snapshot.rerolls).toEqual({})
    // The snapshot alone rebuilds it, because the locked picks are written into it.
    expect(resolveSnapshot(data, second.snapshot, null)).toEqual(second.result)
  })

  it('REQ-TOOLS-015 writes each lock as references plus the number the slot had', () => {
    const { result } = start('refs', { deploy: { min: 12, max: 12 } })
    const refs = lockRefsFromResult(result, ['s4', 's1'], SINNERS)
    expect(refs.map(ref => ref.sinnerId)).toEqual(['s1', 's4'])
    expect(refs[0]).toEqual({
      sinnerId: 's1', identityRef: refOf(result.identities.s1!), egoRefs: result.egos.s1.map(refOf), number: result.order!.indexOf('s1') + 1,
    })
    expect(lockRefsFromResult(start('plain').result, ['s1'], SINNERS)[0].number).toBeNull()
    expect(lockRefsFromResult(start('plain').result, ['nobody'], SINNERS)).toEqual([])
  })

  it('REQ-TOOLS-015 ignores a lock whose identity is gone from the data and still rolls', () => {
    const { snapshot } = newRoll(data, { seed: 'gone', settings: settings(), marks: ['s1'], collectionCode: null, previous: start('base').result }, null)
    const stale = { ...snapshot, locks: [{ sinnerId: 's1', identityRef: 'missing', egoRefs: ['missing'], number: null }] }
    const result = resolveSnapshot(data, stale, null)
    expect(result.identities.s1?.sinner_id).toBe('s1')
    expect(result.egos.s1[0].grade).toBe('ZAYIN')
  })
})

describe('REQ-TOOLS-017 rerolling one sinner', () => {
  it('REQ-TOOLS-017 changes only that sinner identity, and the counted snapshot replays to the same result', () => {
    const { snapshot, result } = start('reroll', { deploy: { min: 1, max: 12 } })
    const once = rerollSinner(data, snapshot, null, result, 's6')!
    expect(once.result.identities.s6?.id).not.toBe(result.identities.s6?.id)
    expect(once.result.egos).toEqual(result.egos)
    expect(once.result.order).toEqual(result.order)
    expect(sinnerIds().filter(id => once.result.identities[id] !== result.identities[id])).toEqual(['s6'])
    expect(once.snapshot.rerolls).toEqual({ s6: 1 })
    expect(resolveSnapshot(data, once.snapshot, null)).toEqual(once.result)

    const twice = rerollSinner(data, once.snapshot, null, once.result, 's6')!
    expect(twice.snapshot.rerolls).toEqual({ s6: 2 })
    expect(twice.result.identities.s6?.id).not.toBe(once.result.identities.s6?.id)
    expect(resolveSnapshot(data, twice.snapshot, null)).toEqual(twice.result)
  })

  it('REQ-TOOLS-017 rerolls inside the rolled pool and gives up when the pool has no other entry', () => {
    const threeStar = start('pool', { rarity: [3] })
    for (let i = 0; i < 5; i++) {
      const next = rerollSinner(data, threeStar.snapshot, null, threeStar.result, 's1')!
      expect(next.result.identities.s1?.rarity).toBe(3)
    }
    const owned = new Set(['i-1-3'].concat(IDENTITIES.filter(i => i.sinner_id !== 's1').map(i => i.id), EGOS.map(e => e.id)))
    const narrow = start('narrow', {}, owned)
    expect(narrow.result.identities.s1?.id).toBe('i-1-3')
    expect(rerollSinner(data, narrow.snapshot, owned, narrow.result, 's1')).toBeNull()
  })

  it('REQ-TOOLS-017 can reroll a locked slot after the lock is lifted, replaying from the locked pick', () => {
    const first = start('first')
    const second = newRoll(data, { seed: 'second', settings: settings(), marks: ['s3'], collectionCode: null, previous: first.result }, null)
    const next = rerollSinner(data, second.snapshot, null, second.result, 's3')!
    expect(next.result.identities.s3?.id).not.toBe(first.result.identities.s3?.id)
    expect(resolveSnapshot(data, next.snapshot, null)).toEqual(next.result)
  })
})
