/** Friend code board rules: what a post may hold and who sees its code. No database access. */
import { SINNER_SLUGS } from '@/lib/constants/game'
export const FRIEND_CODE_RE = /^[A-Z][0-9]{9}$/
export const VISIBILITIES = ['public', 'members', 'exchange', 'approval'] as const
export type Visibility = typeof VISIBILITIES[number]
export const FRIEND_EGO_GRADES = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH'] as const
type Grade = typeof FRIEND_EGO_GRADES[number]
/** One support slot as stored: slot 0-11 (game numbers 01-09, 11-13), the identity's id and at most one E.G.O id per grade. */
export type StoredSlot = { slot: number; identity: string; egos: Partial<Record<Grade, string>> }
export type SupportPostInput = { code: string; visibility: Visibility; slots: StoredSlot[]; identityIds: string[] }

/** Why a request was refused: code is the key of the message in messages/*.json (friends.errors), error its Korean text. */
export const FRIEND_ERRORS = {
  invalid_request: '잘못된 요청입니다.', invalid_code: '친구 코드는 영문 대문자 1자와 숫자 9자입니다.', invalid_visibility: '공개 범위가 올바르지 않습니다.',
  need_slots: '지원 인격을 1~12개 넣어 주세요.', invalid_slot: '지원 칸이 올바르지 않습니다.', unknown_identity: '없는 인격입니다.',
  bad_ego: '그 인격에 넣을 수 없는 E.G.O입니다.', need_wanted: '구하는 인격을 1~3개 넣어 주세요.', duplicate_code: '이미 올라와 있는 친구 코드입니다.',
  own_code: '자기 친구 코드를 넣어 주세요.', not_exchange: '코드 교환 글이 아닙니다.', not_approval: '승인 후 공개 글이 아닙니다.', blocked: '친구 코드 게시판 이용이 정지되었습니다.', not_found: '글을 찾을 수 없습니다.',
} as const
export type FriendErrorCode = keyof typeof FRIEND_ERRORS
export type FriendError = { error: string; code: FriendErrorCode }
export const fail = (code: FriendErrorCode): FriendError => ({ error: FRIEND_ERRORS[code], code })

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** Identity and E.G.O ids a request names, to look up before parseSupportPost. Malformed ids are left out (and fail there). */
export function slotAssetIds(body: unknown): { identities: string[]; egos: string[] } {
  const slots = isRecord(body) && Array.isArray(body.slots) ? body.slots.filter(isRecord) : []
  const ids = (values: unknown[]) => [...new Set(values.filter((value): value is string => typeof value === 'string' && UUID_RE.test(value)))]
  return { identities: ids(slots.map(slot => slot.identity)), egos: ids(slots.flatMap(slot => isRecord(slot.egos) ? Object.values(slot.egos) : [])) }
}

/**
 * A support post from a request body: only the code, the visibility and the slots are read, so no free text is stored.
 * identities: id → sinner; egos: id → sinner and grade (rows the catalogue has).
 */
export function parseSupportPost(
  body: unknown, identities: ReadonlyMap<string, string>, egos: ReadonlyMap<string, { sinner: string; grade: string }>,
): SupportPostInput | FriendError {
  if (!isRecord(body)) return fail('invalid_request')
  const { code, visibility } = body
  if (typeof code !== 'string' || !FRIEND_CODE_RE.test(code)) return fail('invalid_code')
  if (!VISIBILITIES.includes(visibility as Visibility)) return fail('invalid_visibility')
  if (!Array.isArray(body.slots) || body.slots.length < 1 || body.slots.length > 12) return fail('need_slots')
  const slots: StoredSlot[] = [], used = new Set<number>()
  for (const item of body.slots) {
    if (!isRecord(item) || !Number.isInteger(item.slot) || (item.slot as number) < 0 || (item.slot as number) > 11 || used.has(item.slot as number)) return fail('invalid_slot')
    used.add(item.slot as number)
    const sinner = typeof item.identity === 'string' ? identities.get(item.identity) : undefined
    if (!sinner) return fail('unknown_identity')
    const chosen: StoredSlot['egos'] = {}
    for (const [grade, id] of Object.entries(isRecord(item.egos) ? item.egos : {})) {
      const ego = typeof id === 'string' ? egos.get(id) : undefined
      if (!FRIEND_EGO_GRADES.includes(grade as Grade) || !ego || ego.sinner !== sinner || ego.grade.toUpperCase() !== grade) return fail('bad_ego')
      chosen[grade as Grade] = id as string
    }
    slots.push({ slot: item.slot as number, identity: item.identity as string, egos: chosen })
  }
  slots.sort((a, b) => a.slot - b.slot)
  return { code, visibility: visibility as Visibility, slots, identityIds: [...new Set(slots.map(slot => slot.identity))] }
}

/**
 * The post's code if this viewer may see it: everyone, signed-in viewers, viewers who gave their own code, or viewers the
 * author approved; the author always.
 */
export function codeForViewer(post: { code: string; visibility: string }, viewer: { signedIn: boolean; mine: boolean; exchanged: boolean; approved?: boolean }): string | null {
  if (viewer.mine || post.visibility === 'public') return post.code
  if (post.visibility === 'members') return viewer.signedIn ? post.code : null
  if (post.visibility === 'approval') return viewer.approved ? post.code : null
  return viewer.exchanged ? post.code : null
}

export const REQUEST_DECISIONS = ['approved', 'declined'] as const
export type RequestStatus = 'pending' | typeof REQUEST_DECISIONS[number]
/** An author's answer to a code request: approved or declined, nothing else. */
export const isRequestDecision = (value: unknown): value is typeof REQUEST_DECISIONS[number] => REQUEST_DECISIONS.includes(value as never)

const BUMP_INTERVAL_MS = 12 * 60 * 60 * 1000
/** The list position after the author saves again: moved to now at most every 12 hours. */
export function nextBumpedAt(previous: string, now: Date): string {
  return now.getTime() - new Date(previous).getTime() >= BUMP_INTERVAL_MS ? now.toISOString() : previous
}

export const WANT_LIMIT = 3
const WANT_LIFE_MS = 24 * 60 * 60 * 1000
export type WantPostInput = { code: string; visibility: Visibility; identityIds: string[] }

/** Identity ids a want request names, to look up before parseWantPost. */
export function wantIdentityIds(body: unknown): string[] {
  const list = isRecord(body) && Array.isArray(body.identities) ? body.identities : []
  return [...new Set(list.filter((value): value is string => typeof value === 'string' && UUID_RE.test(value)))]
}

/** A "wanted identity" post: the author's own code, the visibility and one to three identities the catalogue has. Nothing else is read. */
export function parseWantPost(body: unknown, identities: ReadonlyMap<string, string>): WantPostInput | FriendError {
  if (!isRecord(body)) return fail('invalid_request')
  const { code, visibility } = body
  if (typeof code !== 'string' || !FRIEND_CODE_RE.test(code)) return fail('invalid_code')
  if (!VISIBILITIES.includes(visibility as Visibility)) return fail('invalid_visibility')
  if (!Array.isArray(body.identities)) return fail('need_wanted')
  const identityIds = [...new Set(body.identities as unknown[])]
  if (identityIds.length < 1 || identityIds.length > WANT_LIMIT) return fail('need_wanted')
  if (identityIds.some(id => typeof id !== 'string' || !identities.has(id))) return fail('unknown_identity')
  return { code, visibility: visibility as Visibility, identityIds: identityIds as string[] }
}

/** A want post is gone one day after it was written; saving it again does not extend it. */
export const wantExpiresAt = (createdAt: string) => new Date(new Date(createdAt).getTime() + WANT_LIFE_MS).toISOString()

/** Identities to count as asked for: the ones this save adds to the post. */
export const newlyWanted = (previous: readonly string[], next: readonly string[]) => next.filter(id => !previous.includes(id))

/** The game's sinner numbers in sinner order (there is no 10): the number on a strip is its identity's sinner. */
export const SINNER_NUMBERS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '11', '12', '13'] as const
export const sinnerNumber = (sinnerId: string): string | null => SINNER_NUMBERS[SINNER_SLUGS.indexOf(sinnerId)] ?? null

const SEEN_INTERVAL_MS = 10 * 60 * 1000
/** Whether the author's "last on the site" time is old enough to write again: at most once every 10 minutes. */
export const seenIsStale = (seenAt: string, now: number) => now - new Date(seenAt).getTime() > SEEN_INTERVAL_MS
