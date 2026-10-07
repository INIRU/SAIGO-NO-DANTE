import { describe, expect, it } from 'vitest'
import { codeForViewer, newlyWanted, nextBumpedAt, parseSupportPost, parseWantPost, slotAssetIds, wantExpiresAt, wantIdentityIds } from '@/lib/friends/codes'

const I1 = '11111111-1111-4111-8111-111111111111', I2 = '22222222-2222-4222-8222-222222222222'
const E1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', E2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const identities = new Map([[I1, 'faust'], [I2, 'faust']])
const egos = new Map([[E1, { sinner: 'faust', grade: 'ZAYIN' }], [E2, { sinner: 'ryoshu', grade: 'HE' }]])
const body = (slots: unknown, extra: object = {}) => ({ code: 'A123456789', visibility: 'public', slots, ...extra })

describe('REQ-COMMUNITY-019 support post', () => {
  it('takes a code of one capital letter and nine digits, a visibility and up to 12 slots, the same sinner twice', () => {
    const parsed = parseSupportPost(body([{ slot: 0, identity: I1, egos: { ZAYIN: E1 } }, { slot: 11, identity: I2, egos: {} }]), identities, egos)
    expect(parsed).toEqual({ code: 'A123456789', visibility: 'public', identityIds: [I1, I2],
      slots: [{ slot: 0, identity: I1, egos: { ZAYIN: E1 } }, { slot: 11, identity: I2, egos: {} }] })
  })

  it('refuses a wrong code, an unknown visibility, no slot, a slot out of range or used twice', () => {
    const one = [{ slot: 0, identity: I1, egos: {} }]
    for (const code of ['a123456789', 'A12345678', 'AB23456789', 'A1234567890', '', null]) expect(parseSupportPost(body(one, { code }), identities, egos)).toHaveProperty('error')
    expect(parseSupportPost(body(one, { visibility: 'friends' }), identities, egos)).toHaveProperty('error')
    expect(parseSupportPost(body([]), identities, egos)).toHaveProperty('error')
    expect(parseSupportPost(body('x'), identities, egos)).toHaveProperty('error')
    expect(parseSupportPost(body([{ slot: 12, identity: I1, egos: {} }]), identities, egos)).toHaveProperty('error')
    expect(parseSupportPost(body([{ slot: 1, identity: I1, egos: {} }, { slot: 1, identity: I2, egos: {} }]), identities, egos)).toHaveProperty('error')
    expect(parseSupportPost(body(Array.from({ length: 13 }, (_, slot) => ({ slot, identity: I1, egos: {} }))), identities, egos)).toHaveProperty('error')
  })

  it('refuses an identity or E.G.O the catalogue lacks, an E.G.O of another sinner or under the wrong grade, and drops free text', () => {
    expect(parseSupportPost(body([{ slot: 0, identity: E1, egos: {} }]), identities, egos)).toHaveProperty('error')
    expect(parseSupportPost(body([{ slot: 0, identity: I1, egos: { HE: E2 } }]), identities, egos)).toHaveProperty('error')
    expect(parseSupportPost(body([{ slot: 0, identity: I1, egos: { TETH: E1 } }]), identities, egos)).toHaveProperty('error')
    expect(parseSupportPost(body([{ slot: 0, identity: I1, egos: { ZAYIN: 'nope' } }]), identities, egos)).toHaveProperty('error')
    const parsed = parseSupportPost(body([{ slot: 0, identity: I1, egos: {}, note: 'add me' }], { title: 'hi' }), identities, egos)
    expect(JSON.stringify(parsed)).not.toMatch(/add me|hi/)
  })

  it('lists the ids to look up, only well-formed ones', () => {
    expect(slotAssetIds({ slots: [{ identity: I1, egos: { ZAYIN: E1, HE: 'x' } }, { identity: 5 }, null] })).toEqual({ identities: [I1], egos: [E1] })
    expect(slotAssetIds({ slots: 'x' })).toEqual({ identities: [], egos: [] })
  })
})

describe('REQ-COMMUNITY-020 who sees the code', () => {
  const post = (visibility: string) => ({ code: 'A123456789', visibility })
  const nobody = { signedIn: false, mine: false, exchanged: false }
  it('public: anyone; members: signed-in viewers; exchange: those who gave their code; the author always', () => {
    expect(codeForViewer(post('public'), nobody)).toBe('A123456789')
    expect(codeForViewer(post('members'), nobody)).toBeNull()
    expect(codeForViewer(post('members'), { ...nobody, signedIn: true })).toBe('A123456789')
    expect(codeForViewer(post('exchange'), { ...nobody, signedIn: true })).toBeNull()
    expect(codeForViewer(post('exchange'), { ...nobody, exchanged: true })).toBe('A123456789')
    for (const visibility of ['members', 'exchange']) expect(codeForViewer(post(visibility), { ...nobody, mine: true })).toBe('A123456789')
  })
})

describe('REQ-COMMUNITY-022 moving a post up', () => {
  it('moves up when the last time is 12 hours or more ago, and keeps the order before that', () => {
    const now = new Date('2026-10-08T12:00:00Z')
    expect(nextBumpedAt('2026-10-08T00:00:00Z', now)).toBe(now.toISOString())
    expect(nextBumpedAt('2026-10-08T00:00:01Z', now)).toBe('2026-10-08T00:00:01Z')
  })
})

describe('REQ-COMMUNITY-019 want post', () => {
  const want = (ids: unknown, extra: object = {}) => ({ code: 'A123456789', visibility: 'public', identities: ids, ...extra })
  it('takes the author\'s own code and one to three identities of the catalogue, each once, and no free text', () => {
    expect(parseWantPost(want([I1, I2], { note: 'please' }), identities)).toEqual({ code: 'A123456789', visibility: 'public', identityIds: [I1, I2] })
    expect(parseWantPost(want([I1, I1]), identities)).toEqual({ code: 'A123456789', visibility: 'public', identityIds: [I1] })
  })
  it('refuses no identity, more than three, an unknown one, or a wrong code', () => {
    for (const ids of [[], 'x', [I1, I2, E1], [E1], [I1, I2, I1, I2].concat(I1).map((id, at) => at === 3 ? '33333333-3333-4333-8333-333333333333' : id)]) expect(parseWantPost(want(ids), identities)).toHaveProperty('error')
    expect(parseWantPost(want([I1], { code: 'a1' }), identities)).toHaveProperty('error')
    expect(parseWantPost(want([I1], { visibility: 'x' }), identities)).toHaveProperty('error')
  })
  it('lists the well-formed ids to look up', () => {
    expect(wantIdentityIds({ identities: [I1, 5, 'x', I1] })).toEqual([I1])
    expect(wantIdentityIds({ identities: 'x' })).toEqual([])
  })
})

describe('REQ-COMMUNITY-022 want post lifetime and request counts', () => {
  it('ends one day after it was written', () => {
    expect(wantExpiresAt('2026-10-08T03:00:00.000Z')).toBe('2026-10-09T03:00:00.000Z')
  })
  it('counts an identity once per post: only the ones an edit adds', () => {
    expect(newlyWanted([], [I1, I2])).toEqual([I1, I2])
    expect(newlyWanted([I1], [I1, I2])).toEqual([I2])
    expect(newlyWanted([I1, I2], [I2])).toEqual([])
  })
})
