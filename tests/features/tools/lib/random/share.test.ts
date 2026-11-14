import { describe, expect, it } from 'vitest'
import { decodeSnapshot, encodeSnapshot } from '@/features/tools/lib/random/share'
import { newRoll, rerollSinner, resolveSnapshot, type RollSnapshot } from '@/features/tools/lib/random/roll'
import { EGOS, IDENTITIES, SINNERS } from './fixture'

const data = { sinners: SINNERS, identities: IDENTITIES, egos: EGOS }
const base: RollSnapshot = {
  seed: 'k3j2h1',
  settings: { identityEnabled: true, egoEnabled: true, keywords: [], rarity: null, deploy: null },
  locks: [], rerolls: {}, marks: [], collectionCode: null,
}

describe('the share link', () => {
  it('writes only the seed when everything else is the default', () => {
    expect(encodeSnapshot(base)).toBe('s=k3j2h1')
    expect(decodeSnapshot('s=k3j2h1')).toEqual(base)
    expect(decodeSnapshot('?s=k3j2h1')).toEqual(base)
    expect(decodeSnapshot(new URLSearchParams('s=k3j2h1'))).toEqual(base)
  })

  it('round trips every setting, lock, reroll count and mark', () => {
    const full: RollSnapshot = {
      seed: 'zz9',
      settings: {
        identityEnabled: false, egoEnabled: true, keywords: [{ keyword: '화상', minCount: 4 }, { keyword: '출혈', minCount: 12 }],
        rarity: [2, 3], deploy: { min: 3, max: 9 },
      },
      locks: [
        { sinnerId: 'yi-sang', identityRef: '10103', egoRefs: ['20101', '20102'], number: 2 },
        { sinnerId: 'don-quixote', identityRef: null, egoRefs: [], number: null },
        { sinnerId: 'faust', identityRef: 'a1b2-c3', egoRefs: ['20201'], number: null },
      ],
      rerolls: { 'yi-sang': 2, faust: 1 },
      marks: ['yi-sang', 'faust', 'meursault'],
      collectionCode: 'H4sIAAAAAAAA/ab+c=',
    }
    const query = encodeSnapshot(full)
    expect(query).not.toMatch(/\s/)
    expect(decodeSnapshot(query)).toEqual(full)
  })

  it('omits marks that are exactly the locked sinners and keeps them when they differ', () => {
    const locked = { ...base, locks: [{ sinnerId: 's1', identityRef: '10101', egoRefs: [], number: null }], marks: ['s1'] }
    expect(new URLSearchParams(encodeSnapshot(locked)).has('m')).toBe(false)
    expect(decodeSnapshot(encodeSnapshot(locked))?.marks).toEqual(['s1'])
    const lifted = { ...locked, marks: ['s2'] }
    expect(decodeSnapshot(encodeSnapshot(lifted))?.marks).toEqual(['s2'])
    const none = { ...locked, marks: [] }
    expect(decodeSnapshot(encodeSnapshot(none))?.marks).toEqual([])
  })

  it('refuses a link without a usable seed', () => {
    for (const query of ['', 'x=1', 's=', 's=BAD SEED', 's=' + 'a'.repeat(20), 'code=abc']) expect(decodeSnapshot(query)).toBeNull()
  })

  it('reads wrong pieces as the defaults and never throws', () => {
    const snapshot = decodeSnapshot('s=ok1&t=zz&r=9x&k=%EA%B1%B4.99~a~b~c~d&d=9-3&l=%7E%7E..%7E&rr=s1.-4~s2.x~s3.999&m=%3Cb%3E~s4&code=')!
    expect(snapshot.settings.identityEnabled).toBe(true)
    expect(snapshot.settings.egoEnabled).toBe(true)
    expect(snapshot.settings.rarity).toBeNull()
    expect(snapshot.settings.keywords.length).toBeLessThanOrEqual(2)
    expect(snapshot.settings.keywords.every(entry => entry.minCount >= 1 && entry.minCount <= 12)).toBe(true)
    expect(snapshot.settings.deploy).toEqual({ min: 9, max: 9 })
    expect(snapshot.locks).toEqual([])
    expect(snapshot.rerolls).toEqual({ s3: 30 })
    expect(snapshot.marks).toEqual(['s4'])
    expect(snapshot.collectionCode).toBeNull()
  })

  it('reopens the link to the same rolled result, rerolls and locks included', () => {
    const first = newRoll(data, { seed: 'one', settings: { ...base.settings, deploy: { min: 1, max: 12 } }, marks: [], collectionCode: null, previous: null }, null)
    const second = newRoll(data, { seed: 'two', settings: { ...base.settings, deploy: { min: 2, max: 8 } }, marks: ['s2', 's7'], collectionCode: null, previous: first.result }, null)
    const rerolled = rerollSinner(data, second.snapshot, null, second.result, 's1')!
    const reopened = decodeSnapshot(encodeSnapshot({ ...rerolled.snapshot, marks: ['s2', 's7', 's9'] }))!
    expect(reopened.marks).toEqual(['s2', 's7', 's9'])
    expect(resolveSnapshot(data, reopened, null)).toEqual(rerolled.result)
  })
})
