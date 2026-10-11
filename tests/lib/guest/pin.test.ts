import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: async () => null }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

import { cleanGuestPin, isGuestPin, isWeakGuestPin } from '@/lib/guest/key'
import { guestPinHash, guestPinOf, recordGuestAuthorship, type Author } from '@/lib/guest/server'
import { friendAuthorColumns } from '@/lib/friends/server'

const guest: Author = { kind: 'guest', keyHash: 'a'.repeat(64), tag: 'aaaa' }
const user: Author = { kind: 'user', userId: 'u1', isAdmin: false, email: 'a@b.c' }

beforeAll(() => { process.env.NEXTAUTH_SECRET = 'test-secret' })

describe('guest post password', () => {
  it('REQ-COMMUNITY-029 takes four to six digits only', () => {
    for (const pin of ['0000', '12345', '999999']) expect(isGuestPin(pin)).toBe(true)
    for (const pin of ['', '123', '1234567', '12a4', ' 1234', '１２３４']) expect(isGuestPin(pin)).toBe(false)
    expect(cleanGuestPin('12-34 ab5678')).toBe('123456')
  })

  it('REQ-COMMUNITY-029 passwords anyone would try first are refused on a new post', () => {
    for (const pin of ['0000', '111111', '1234', '123456', '2345', '9876', '7890', '1212', '123123', '1004', '2580', '0852']) expect(isWeakGuestPin(pin)).toBe(true)
    for (const pin of ['4821', '1357', '482159', '1213', '20261']) expect(isWeakGuestPin(pin)).toBe(false)
    for (const pin of ['1234', '0000', '121212']) expect(guestPinOf(pin)).toBe(false)
  })

  it('REQ-COMMUNITY-029 a request may leave the password out (older screens); a wrong shape is refused', () => {
    for (const absent of [undefined, null, '']) expect(guestPinOf(absent)).toBeNull()
    expect(guestPinOf('4821')).toBe('4821')
    for (const bad of ['48', '48211234', 4821, ['4821']]) expect(guestPinOf(bad)).toBe(false)
  })

  it('REQ-COMMUNITY-029 the stored value is an HMAC bound to the post', () => {
    const hash = guestPinHash('deck', 'd1', '4821')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(guestPinHash('deck', 'd1', '4821')).toBe(hash)
    expect(new Set([hash, guestPinHash('deck', 'd2', '4821'), guestPinHash('plan', 'd1', '4821'), guestPinHash('deck', 'd1', '48210')]).size).toBe(4)
  })

  it('REQ-COMMUNITY-029 a guest deck or plan keeps the hash next to its key; a signed-in post keeps nothing', async () => {
    const inserted: unknown[] = []
    const admin = { schema: () => ({ from: () => ({ insert: async (row: unknown) => { inserted.push(row); return { error: null } } }) }) } as never
    await recordGuestAuthorship(admin, guest, 'deck', 'd1', '4821')
    await recordGuestAuthorship(admin, guest, 'plan', 'p1', null)
    await recordGuestAuthorship(admin, user, 'deck', 'd2', '4821')
    expect(inserted).toEqual([
      { deck_id: 'd1', key_hash: guest.keyHash, pin_hash: guestPinHash('deck', 'd1', '4821') },
      { plan_id: 'p1', key_hash: guest.keyHash },
    ])
  })

  it('REQ-COMMUNITY-029 a new friend post of a guest carries its id and the hash made with it', () => {
    const row = friendAuthorColumns(guest, '123456')
    expect(row).toEqual({ id: expect.stringMatching(/^[0-9a-f-]{36}$/), key_hash: guest.keyHash, guest_tag: 'aaaa', pin_hash: guestPinHash('friend', (row as { id: string }).id, '123456') })
    expect(friendAuthorColumns(guest, null)).toEqual({ key_hash: guest.keyHash, guest_tag: 'aaaa' })
    expect(friendAuthorColumns(user, '123456')).toEqual({ user_id: 'u1' })
  })
})
