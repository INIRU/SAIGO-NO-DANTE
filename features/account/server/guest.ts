import { createHmac } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { createAdminClient } from '@/lib/supabase/admin'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'
import { GUEST_KEY_HEADER, isGuestKey, isGuestPin, isWeakGuestPin } from '@/features/account/lib/guest-key'

type Admin = ReturnType<typeof createAdminClient>
export type GuestPostKind = 'deck' | 'plan'

/**
 * Who is writing: a signed-in user, or a guest identified by the secret key their browser keeps.
 * Only an HMAC of the key is stored (limbus.guest_authorship, not readable by public roles).
 */
export type Author =
  | { kind: 'user'; userId: string; isAdmin: boolean; email: string }
  | { kind: 'guest'; keyHash: string; tag: string }

function hmac(value: string) {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('NEXTAUTH_SECRET is not set')
  return createHmac('sha256', secret).update(value).digest('hex')
}

export const guestKeyHash = (key: string) => hmac(key)

export type GuestPinKind = GuestPostKind | 'friend'
/** What is stored of a post's password: an HMAC bound to the post, so the same digits on two posts store two values. */
export const guestPinHash = (kind: GuestPinKind, id: string, pin: string) => hmac(`pin:${kind}:${id}:${pin}`)

/** The password of a new guest post in a request body: null when absent (screens from before it existed), false when malformed or too easy to guess. */
export function guestPinOf(value: unknown): string | null | false {
  if (value === undefined || value === null || value === '') return null
  return typeof value === 'string' && isGuestPin(value) && !isWeakGuestPin(value) ? value : false
}

export function guestKeyFrom(request: Request) {
  const key = request.headers.get(GUEST_KEY_HEADER)
  return key && isGuestKey(key) ? key : null
}

/** Signed-in (and not suspended) users first; otherwise a valid guest key; otherwise 401. */
export async function resolveAuthor(request: Request, admin: Admin): Promise<{ author: Author } | { response: NextResponse }> {
  const session = await getServerSession(authOptions)
  if (session?.user?.email) {
    if (session.user.isSuspended) return { response: NextResponse.json({ error: '이용이 정지된 계정입니다.' }, { status: 403 }) }
    const userId = await findOrCreateSupabaseUser(admin, session.user.email, session.user.name, session.user.image)
    if (!userId) return { response: NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 500 }) }
    return { author: { kind: 'user', userId, isAdmin: session.user.isAdmin === true, email: session.user.email } }
  }
  const key = guestKeyFrom(request)
  if (!key) return { response: NextResponse.json({ error: '로그인하거나 익명 키가 필요합니다.' }, { status: 401 }) }
  const keyHash = guestKeyHash(key)
  return { author: { kind: 'guest', keyHash, tag: keyHash.slice(0, 4) } }
}

/** Rate-limit identity: the account email; guests are limited by IP (undefined), since anyone can mint new keys. */
export const authorRateKey = (author: Author) => author.kind === 'user' ? author.email : undefined

/** Columns a new row gets for its author. */
export const authorColumns = (author: Author) => author.kind === 'user'
  ? { user_id: author.userId, guest_tag: null }
  : { user_id: null, guest_tag: author.tag }

/** The key that wrote a guest post, and the hash of its password when one was sent (REQ-COMMUNITY-029). */
export async function recordGuestAuthorship(admin: Admin, author: Author, kind: GuestPostKind, id: string, pin: string | null = null) {
  if (author.kind !== 'guest') return null
  const { error } = await admin.schema('limbus').from('guest_authorship')
    .insert({ [kind === 'deck' ? 'deck_id' : 'plan_id']: id, key_hash: author.keyHash, ...(pin ? { pin_hash: guestPinHash(kind, id, pin) } : {}) })
  return error
}

/** Whether the author owns the row: the signed-in owner, or the guest whose key wrote it. */
export async function ownsPost(admin: Admin, author: Author, kind: GuestPostKind, row: { id: string; user_id: string | null }) {
  if (author.kind === 'user') return row.user_id !== null && row.user_id === author.userId
  if (row.user_id !== null) return false
  const { data, error } = await admin.schema('limbus').from('guest_authorship').select('key_hash')
    .eq(kind === 'deck' ? 'deck_id' : 'plan_id', row.id).maybeSingle()
  return !error && data?.key_hash === author.keyHash
}
