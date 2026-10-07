import { describe, expect, it } from 'vitest'
import { FRIEND_CODE_RE, FRIEND_ERRORS, VISIBILITIES, codeForViewer, fail, newlyWanted, nextBumpedAt, parseSupportPost, parseWantPost, seenIsStale, sinnerNumber, slotAssetIds, wantExpiresAt, wantIdentityIds } from '@/lib/friends/codes'
import ko from '@/messages/ko.json'
import en from '@/messages/en.json'
import ja from '@/messages/ja.json'

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

describe('REQ-COMMUNITY-021 code exchange', () => {
  it('takes only a well-formed code from the viewer, and shows the author\'s code to those who gave one', () => {
    for (const code of ['Q111111111', 'A000000000']) expect(FRIEND_CODE_RE.test(code)).toBe(true)
    for (const code of ['q111111111', 'Q11111111', 'Q1111111111', '1111111111', 'Q11111111a', '']) expect(FRIEND_CODE_RE.test(code)).toBe(false)
    const post = { code: 'A123456789', visibility: 'exchange' }
    expect(codeForViewer(post, { signedIn: true, mine: false, exchanged: false })).toBeNull()
    expect(codeForViewer(post, { signedIn: false, mine: false, exchanged: true })).toBe('A123456789')
    // The refusals an exchange can answer with have a message key.
    for (const code of ['own_code', 'not_exchange', 'blocked'] as const) expect(fail(code)).toEqual({ code, error: FRIEND_ERRORS[code] })
  })
})

describe('REQ-COMMUNITY-023 last time on the site', () => {
  it('is written again only after ten minutes', () => {
    const now = Date.parse('2026-10-08T12:00:00Z')
    expect(seenIsStale('2026-10-08T11:49:59Z', now)).toBe(true)
    expect(seenIsStale('2026-10-08T11:50:00Z', now)).toBe(false)
    expect(seenIsStale('2026-10-08T11:59:00Z', now)).toBe(false)
  })
})

describe('REQ-COMMUNITY-024 strips and the three languages', () => {
  it('numbers a strip by its identity\'s sinner, as the game does (no 10), and has no number for an unknown one', () => {
    expect(['yi-sang', 'rodion', 'sinclair', 'outis', 'gregor'].map(sinnerNumber)).toEqual(['01', '09', '11', '12', '13'])
    expect(sinnerNumber('nobody')).toBeNull()
  })
  it('has every board text in ko, en and ja', () => {
    const keys = (node: object, prefix = ''): string[] => Object.entries(node).flatMap(([key, value]) => typeof value === 'object' ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`])
    expect(keys(en.friends)).toEqual(keys(ko.friends))
    expect(keys(ja.friends)).toEqual(keys(ko.friends))
    for (const value of VISIBILITIES) for (const messages of [ko, en, ja]) expect(messages.friends.visibility[value]).toBeTruthy()
  })
})

describe('REQ-COMMUNITY-025 warning, reports and barred authors', () => {
  it('warns about other people\'s and fake codes in the three languages, and names a report and its outcome', () => {
    for (const messages of [ko, en, ja]) for (const key of ['warning', 'report', 'reported'] as const) expect(messages.friends[key]).toBeTruthy()
    expect(ko.friends.warning).toContain('정지')
  })
  it('has a message in every language for each refusal, the bar from the board included', () => {
    for (const code of Object.keys(FRIEND_ERRORS)) for (const messages of [ko, en, ja]) expect((messages.friends.errors as Record<string, string>)[code], code).toBeTruthy()
    expect(ko.friends.errors.blocked).toBe(FRIEND_ERRORS.blocked)
    for (const action of ['remove', 'removeAndBlock', 'dismiss'] as const) expect(ko.friends.admin[action]).toBeTruthy()
  })
})
