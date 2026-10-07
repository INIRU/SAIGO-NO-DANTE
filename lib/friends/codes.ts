/** Friend code board rules: what a post may hold and who sees its code. No database access. */
export const FRIEND_CODE_RE = /^[A-Z][0-9]{9}$/
export const VISIBILITIES = ['public', 'members', 'exchange'] as const
export type Visibility = typeof VISIBILITIES[number]
export const FRIEND_EGO_GRADES = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH'] as const
type Grade = typeof FRIEND_EGO_GRADES[number]
/** One support slot as stored: slot 0-11 (game numbers 01-09, 11-13), the identity's id and at most one E.G.O id per grade. */
export type StoredSlot = { slot: number; identity: string; egos: Partial<Record<Grade, string>> }
export type SupportPostInput = { code: string; visibility: Visibility; slots: StoredSlot[]; identityIds: string[] }

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
): SupportPostInput | { error: string } {
  if (!isRecord(body)) return { error: '잘못된 요청입니다.' }
  const { code, visibility } = body
  if (typeof code !== 'string' || !FRIEND_CODE_RE.test(code)) return { error: '친구 코드는 영문 대문자 1자와 숫자 9자입니다.' }
  if (!VISIBILITIES.includes(visibility as Visibility)) return { error: '공개 범위가 올바르지 않습니다.' }
  if (!Array.isArray(body.slots) || body.slots.length < 1 || body.slots.length > 12) return { error: '지원 인격을 1~12개 넣어 주세요.' }
  const slots: StoredSlot[] = [], used = new Set<number>()
  for (const item of body.slots) {
    if (!isRecord(item) || !Number.isInteger(item.slot) || (item.slot as number) < 0 || (item.slot as number) > 11 || used.has(item.slot as number)) return { error: '지원 칸이 올바르지 않습니다.' }
    used.add(item.slot as number)
    const sinner = typeof item.identity === 'string' ? identities.get(item.identity) : undefined
    if (!sinner) return { error: '없는 인격입니다.' }
    const chosen: StoredSlot['egos'] = {}
    for (const [grade, id] of Object.entries(isRecord(item.egos) ? item.egos : {})) {
      const ego = typeof id === 'string' ? egos.get(id) : undefined
      if (!FRIEND_EGO_GRADES.includes(grade as Grade) || !ego || ego.sinner !== sinner || ego.grade.toUpperCase() !== grade) return { error: '그 인격에 넣을 수 없는 E.G.O입니다.' }
      chosen[grade as Grade] = id as string
    }
    slots.push({ slot: item.slot as number, identity: item.identity as string, egos: chosen })
  }
  slots.sort((a, b) => a.slot - b.slot)
  return { code, visibility: visibility as Visibility, slots, identityIds: [...new Set(slots.map(slot => slot.identity))] }
}

/** The post's code if this viewer may see it: everyone, signed-in viewers, or viewers who gave their own code; the author always. */
export function codeForViewer(post: { code: string; visibility: string }, viewer: { signedIn: boolean; mine: boolean; exchanged: boolean }): string | null {
  if (viewer.mine || post.visibility === 'public') return post.code
  if (post.visibility === 'members') return viewer.signedIn ? post.code : null
  return viewer.exchanged ? post.code : null
}

const BUMP_INTERVAL_MS = 12 * 60 * 60 * 1000
/** The list position after the author saves again: moved to now at most every 12 hours. */
export function nextBumpedAt(previous: string, now: Date): string {
  return now.getTime() - new Date(previous).getTime() >= BUMP_INTERVAL_MS ? now.toISOString() : previous
}
