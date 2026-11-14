import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { DEFAULT_AVATAR_URL } from '@/lib/constants/game'
import { getCurrentLegalDocs } from '@/lib/data/legal'

const SAFE_ADJECTIVES_KO = [
  '차분한',
  '상냥한',
  '성실한',
  '빛나는',
  '용감한',
  '신중한',
  '다정한',
  '고요한',
  '영리한',
  '침착한',
  '따뜻한',
  '믿음직한',
] as const

const SINNER_NAMES_KO = [
  '이상',
  '파우스트',
  '돈키호테',
  '료슈',
  '뫼르소',
  '홍루',
  '히스클리프',
  '이스마엘',
  '로쟈',
  '싱클레어',
  '오티스',
  '그레고르',
] as const

const USERNAME_COLLISION_ATTEMPTS = 8
const CREATE_USER_ATTEMPTS = 5
const LEGAL_ACK_SEED_ATTEMPTS = 4
const LEGAL_ACK_SEED_RETRY_MS = 150

type LegalAcknowledgementSeedRow = {
  user_id: string
  doc_type: 'privacy' | 'terms'
  version: string
  acknowledged_at: string
}

function randomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function buildSafeUsernameBase(): string {
  return `${randomItem(SAFE_ADJECTIVES_KO)} ${randomItem(SINNER_NAMES_KO)}`
}

function withNumericSuffix(username: string): string {
  return `${username} ${Math.floor(100 + Math.random() * 900)}`
}

async function isUsernameTaken(admin: SupabaseClient<Database>, username: string): Promise<boolean | null> {
  const { data, error } = await admin
    .schema('limbus')
    .from('profiles')
    .select('id')
    .eq('username', username)
    .limit(1)

  if (error) return null
  return (data?.length ?? 0) > 0
}

async function generateSafeUsername(admin: SupabaseClient<Database>): Promise<string> {
  const tried = new Set<string>()

  for (let attempt = 0; attempt < USERNAME_COLLISION_ATTEMPTS; attempt++) {
    const base = buildSafeUsernameBase()
    const candidate = attempt === 0 ? base : withNumericSuffix(base)
    if (tried.has(candidate)) continue
    tried.add(candidate)

    const taken = await isUsernameTaken(admin, candidate)
    if (taken === false) return candidate
    if (taken === null) return candidate
  }

  return withNumericSuffix(buildSafeUsernameBase())
}

async function findExistingUserIdByEmail(admin: SupabaseClient<Database>, email: string): Promise<string | null> {
  const PER_PAGE = 1000
  let page = 1

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ perPage: PER_PAGE, page })
    if (error || !data?.users?.length) break

    const match = data.users.find(u => u.email === email)
    if (match) return match.id
    if (data.users.length < PER_PAGE) break
    page++
  }

  return null
}

function buildCurrentLegalAcknowledgementRows(userId: string): Promise<LegalAcknowledgementSeedRow[]> {
  return getCurrentLegalDocs('ko').then(docs => {
    const acknowledgedAt = new Date().toISOString()
    const rowsByKey = new Map<string, LegalAcknowledgementSeedRow>()

    for (const doc of docs) {
      if (doc.type !== 'terms' && doc.type !== 'privacy') continue
      const version = doc.version.trim()
      if (!version) continue

      rowsByKey.set(`${doc.type}:${version}`, {
        user_id: userId,
        doc_type: doc.type,
        version,
        acknowledged_at: acknowledgedAt,
      })
    }

    return Array.from(rowsByKey.values())
  })
}

function isProfileVisibilityRace(error: { code?: string; message?: string }): boolean {
  return error.code === '23503' || (error.message ?? '').toLowerCase().includes('foreign key')
}

function getSafeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}

async function seedCurrentLegalAcknowledgements(admin: SupabaseClient<Database>, userId: string): Promise<void> {
  let rows: LegalAcknowledgementSeedRow[]
  try {
    rows = await buildCurrentLegalAcknowledgementRows(userId)
  } catch (error) {
    console.error('Failed to load current legal docs for new user acknowledgement seed', {
      message: getSafeErrorMessage(error),
    })
    return
  }

  if (rows.length === 0) return

  for (let attempt = 0; attempt < LEGAL_ACK_SEED_ATTEMPTS; attempt++) {
    const { error } = await admin
      .schema('limbus')
      .from('legal_acknowledgements')
      .upsert(rows, { onConflict: 'user_id,doc_type,version' })

    if (!error) return
    if (!isProfileVisibilityRace(error) || attempt === LEGAL_ACK_SEED_ATTEMPTS - 1) {
      console.error('Failed to seed legal acknowledgements for new user', {
        code: error.code,
        message: error.message,
      })
      return
    }

    await wait(LEGAL_ACK_SEED_RETRY_MS * (attempt + 1))
  }
}

// Restored databases may not have the auth.users profile trigger installed.
// Ignore existing IDs so account names, roles, and avatars are never overwritten.
async function ensureUserProfile(admin: SupabaseClient<Database>, userId: string, username: string): Promise<boolean> {
  const { error } = await admin.schema('limbus').from('profiles').upsert(
    { id: userId, username, avatar_url: DEFAULT_AVATAR_URL },
    { onConflict: 'id', ignoreDuplicates: true },
  )
  return !error
}

// Every signed-in request asks for its user; remembering the answer keeps those requests off the auth API.
const KNOWN_USER_MS = 10 * 60 * 1000
const knownUsers = new Map<string, { id: string; until: number }>()

function remember(email: string, id: string): string {
  const now = Date.now()
  if (knownUsers.size >= 1000) for (const [key, entry] of knownUsers) if (entry.until <= now) knownUsers.delete(key)
  knownUsers.set(email, { id, until: now + KNOWN_USER_MS })
  return id
}

/** Drops a remembered id, e.g. after the account is deleted. */
export function forgetSupabaseUser(email: string): void {
  knownUsers.delete(email)
}

/** The auth user id for an email in one query; undefined when the lookup function is missing or the call fails. */
async function lookUpUserId(admin: SupabaseClient<Database>, email: string): Promise<string | null | undefined> {
  try {
    const { data, error } = await admin.schema('limbus').rpc('auth_user_id_by_email', { p_email: email })
    if (error) return undefined
    return data ?? null
  } catch {
    return undefined
  }
}

async function ensureExistingUserProfile(admin: SupabaseClient<Database>, userId: string): Promise<boolean> {
  const { data, error } = await admin.schema('limbus').from('profiles').select('id').eq('id', userId).maybeSingle()
  if (!error && data) return true
  return ensureUserProfile(admin, userId, await generateSafeUsername(admin))
}

// next-auth 유저를 Supabase auth에 find-or-create
export async function findOrCreateSupabaseUser(
  admin: SupabaseClient<Database>,
  email: string,
  _name?: string | null,
  _avatarUrl?: string | null,
): Promise<string | null> {
  const known = knownUsers.get(email)
  if (known && known.until > Date.now()) return known.id

  const foundId = await lookUpUserId(admin, email)
  if (foundId && await ensureExistingUserProfile(admin, foundId)) return remember(email, foundId)

  for (let attempt = 0; attempt < CREATE_USER_ATTEMPTS; attempt++) {
    const userName = await generateSafeUsername(admin)
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        user_name: userName,
        avatar_url: DEFAULT_AVATAR_URL,
      },
    })
    if (!createError) {
      if (!await ensureUserProfile(admin, created.user.id, userName)) continue
      await seedCurrentLegalAcknowledgements(admin, created.user.id)
      return remember(email, created.user.id)
    }

    // Another request may have created the user first. Listing every user is the fallback for a database without the lookup.
    const lookedUp = await lookUpUserId(admin, email)
    const existingUserId = lookedUp === undefined ? await findExistingUserIdByEmail(admin, email) : lookedUp
    if (existingUserId && await ensureUserProfile(admin, existingUserId, userName)) return remember(email, existingUserId)
  }

  return null
}
