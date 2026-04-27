import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

type ProfileRow = {
  id: string
  username: string | null
  avatar_url: string | null
  role: string | null
  suspended: boolean | null
  suspension_reason: string | null
  suspended_until: string | null
  suspended_at: string | null
  suspended_by: string | null
  last_seen_at: string | null
  last_ip_hash: string | null
  last_ip_masked: string | null
  last_user_agent_hash: string | null
  last_country: string | null
  created_at: string
}

type AuthUserSummary = {
  email?: string | null
  last_sign_in_at?: string | null
}

type DuplicateMatchType = 'ip' | 'user_agent'

type DuplicateProfileRow = Pick<
  ProfileRow,
  | 'id'
  | 'username'
  | 'avatar_url'
  | 'last_seen_at'
  | 'last_ip_hash'
  | 'last_user_agent_hash'
  | 'last_country'
  | 'created_at'
>

type DuplicateMatchCandidate = {
  profile: DuplicateProfileRow
  matchTypes: Set<DuplicateMatchType>
}

const DEFAULT_LIMIT = 40
const MAX_LIMIT = 100
const MAX_DUPLICATE_MATCHES_PER_USER = 8
const EMAIL_SEARCH_AUTH_SCAN_LIMIT = 200
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function parseBoundedInt(value: string | null, fallback: number, min: number, max: number) {
  if (value === null) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}

function isSuspensionActive(profile: Pick<ProfileRow, 'suspended' | 'suspended_until'>) {
  return profile.suspended === true && (
    profile.suspended_until === null || new Date(profile.suspended_until).getTime() > Date.now()
  )
}

function countCluster(values: Array<string | null>) {
  const counts = new Map<string, number>()
  for (const value of values) {
    if (!value) continue
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return counts
}

function groupProfilesByHash(
  profiles: DuplicateProfileRow[],
  hashKey: 'last_ip_hash' | 'last_user_agent_hash',
) {
  const grouped = new Map<string, DuplicateProfileRow[]>()
  for (const profile of profiles) {
    const hash = profile[hashKey]
    if (!hash) continue
    const current = grouped.get(hash)
    if (current) {
      current.push(profile)
    } else {
      grouped.set(hash, [profile])
    }
  }
  return grouped
}

function dateMs(value: string | null) {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function compareDuplicateCandidates(
  a: DuplicateMatchCandidate,
  b: DuplicateMatchCandidate,
) {
  const aLastActivity = dateMs(a.profile.last_seen_at) || dateMs(a.profile.created_at)
  const bLastActivity = dateMs(b.profile.last_seen_at) || dateMs(b.profile.created_at)
  if (aLastActivity !== bLastActivity) return bLastActivity - aLastActivity
  return a.profile.id.localeCompare(b.profile.id)
}

function collectDuplicateCandidates(
  profile: ProfileRow,
  ipProfilesByHash: Map<string, DuplicateProfileRow[]>,
  userAgentProfilesByHash: Map<string, DuplicateProfileRow[]>,
) {
  const candidates = new Map<string, DuplicateMatchCandidate>()

  const addMatches = (
    matches: DuplicateProfileRow[] | undefined,
    matchType: DuplicateMatchType,
  ) => {
    for (const match of matches ?? []) {
      if (match.id === profile.id) continue
      const existing = candidates.get(match.id)
      if (existing) {
        existing.matchTypes.add(matchType)
      } else {
        candidates.set(match.id, {
          profile: match,
          matchTypes: new Set([matchType]),
        })
      }
    }
  }

  if (profile.last_ip_hash) {
    addMatches(ipProfilesByHash.get(profile.last_ip_hash), 'ip')
  }
  if (profile.last_user_agent_hash) {
    addMatches(userAgentProfilesByHash.get(profile.last_user_agent_hash), 'user_agent')
  }

  return [...candidates.values()]
    .sort(compareDuplicateCandidates)
    .slice(0, MAX_DUPLICATE_MATCHES_PER_USER)
}

function isMissingAuthUserError(error: { message?: string; status?: number }) {
  return error.status === 404 || error.message?.toLowerCase().includes('not found') === true
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim().toLowerCase() ?? ''
    const role = searchParams.get('role')?.trim()
    const status = searchParams.get('status')?.trim()
    const limit = parseBoundedInt(searchParams.get('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT)
    const offset = parseBoundedInt(searchParams.get('offset'), 0, 0, Number.MAX_SAFE_INTEGER)
    const pageEnd = offset + limit - 1

    const supabase = createAdminClient()
    let emailSearchUserIds: string[] | null = null

    if (search.includes('@')) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: EMAIL_SEARCH_AUTH_SCAN_LIMIT,
      })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      emailSearchUserIds = (data?.users ?? [])
        .filter(user => user.email?.toLowerCase().includes(search))
        .map(user => user.id)

      if (emailSearchUserIds.length === 0) {
        return NextResponse.json({
          users: [],
          total: 0,
          count: 0,
          hasMore: false,
          nextOffset: null,
        })
      }
    }

    const now = new Date().toISOString()
    let profilesQuery = supabase
      .schema('limbus')
      .from('profiles')
      .select(`
        id,
        username,
        avatar_url,
        role,
        suspended,
        suspension_reason,
        suspended_until,
        suspended_at,
        suspended_by,
        last_seen_at,
        last_ip_hash,
        last_ip_masked,
        last_user_agent_hash,
        last_country,
        created_at
      `, { count: 'exact' })

    if (role && role !== 'all') {
      profilesQuery = profilesQuery.eq('role', role)
    }

    if (status === 'suspended') {
      profilesQuery = profilesQuery
        .eq('suspended', true)
        .or(`suspended_until.is.null,suspended_until.gt.${now}`)
    } else if (status === 'active') {
      profilesQuery = profilesQuery.or(`suspended.is.false,suspended.is.null,suspended_until.lte.${now}`)
    } else if (status === 'expired') {
      profilesQuery = profilesQuery
        .eq('suspended', true)
        .not('suspended_until', 'is', null)
        .lte('suspended_until', now)
    }

    if (emailSearchUserIds) {
      profilesQuery = profilesQuery.in('id', emailSearchUserIds)
    } else if (search) {
      if (UUID_PATTERN.test(search)) {
        profilesQuery = profilesQuery.eq('id', search)
      } else {
        profilesQuery = profilesQuery.ilike('username', `%${search}%`)
      }
    }

    const profilesRes = await profilesQuery
      .order('created_at', { ascending: false })
      .range(offset, pageEnd)

    if (profilesRes.error) {
      return NextResponse.json({ error: profilesRes.error.message }, { status: 500 })
    }

    const profiles = (profilesRes.data ?? []) as ProfileRow[]
    const total = profilesRes.count ?? 0
    const userIds = profiles.map(profile => profile.id)
    const ipHashes = [...new Set(profiles.map(profile => profile.last_ip_hash).filter(Boolean))] as string[]
    const userAgentHashes = [...new Set(profiles.map(profile => profile.last_user_agent_hash).filter(Boolean))] as string[]

    const [decksRes, authResults, ipClusterRes, userAgentClusterRes] = await Promise.all([
      userIds.length > 0
        ? supabase
            .schema('limbus')
            .from('decks')
            .select('user_id')
            .in('user_id', userIds)
        : Promise.resolve({ data: [], error: null }),
      Promise.all(userIds.map(async id => {
        const { data, error } = await supabase.auth.admin.getUserById(id)
        return { id, user: data?.user, error }
      })),
      ipHashes.length > 0
        ? supabase
            .schema('limbus')
            .from('profiles')
            .select(`
              id,
              username,
              avatar_url,
              last_seen_at,
              last_ip_hash,
              last_user_agent_hash,
              last_country,
              created_at
            `)
            .in('last_ip_hash', ipHashes)
        : Promise.resolve({ data: [], error: null }),
      userAgentHashes.length > 0
        ? supabase
            .schema('limbus')
            .from('profiles')
            .select(`
              id,
              username,
              avatar_url,
              last_seen_at,
              last_ip_hash,
              last_user_agent_hash,
              last_country,
              created_at
            `)
            .in('last_user_agent_hash', userAgentHashes)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (decksRes.error) {
      return NextResponse.json({ error: decksRes.error.message }, { status: 500 })
    }
    if (ipClusterRes.error) {
      return NextResponse.json({ error: ipClusterRes.error.message }, { status: 500 })
    }
    if (userAgentClusterRes.error) {
      return NextResponse.json({ error: userAgentClusterRes.error.message }, { status: 500 })
    }

    const authError = authResults.find(result => result.error && !isMissingAuthUserError(result.error))
    if (authError?.error) {
      return NextResponse.json({ error: authError.error.message }, { status: 500 })
    }

    const authMap = new Map<string, AuthUserSummary>()
    for (const result of authResults) {
      if (!result.user) continue
      authMap.set(result.id, {
        email: result.user.email,
        last_sign_in_at: result.user.last_sign_in_at,
      })
    }

    const countMap = new Map<string, number>()
    for (const d of decksRes.data ?? []) {
      countMap.set(d.user_id, (countMap.get(d.user_id) ?? 0) + 1)
    }

    const ipClusterCounts = countCluster((ipClusterRes.data ?? []).map(row => row.last_ip_hash))
    const userAgentClusterCounts = countCluster(
      (userAgentClusterRes.data ?? []).map(row => row.last_user_agent_hash),
    )
    const ipProfilesByHash = groupProfilesByHash(
      (ipClusterRes.data ?? []) as DuplicateProfileRow[],
      'last_ip_hash',
    )
    const userAgentProfilesByHash = groupProfilesByHash(
      (userAgentClusterRes.data ?? []) as DuplicateProfileRow[],
      'last_user_agent_hash',
    )
    const duplicateCandidatesByUserId = new Map<string, DuplicateMatchCandidate[]>()
    const duplicateAuthUserIds = new Set<string>()

    for (const profile of profiles) {
      const candidates = collectDuplicateCandidates(profile, ipProfilesByHash, userAgentProfilesByHash)
      duplicateCandidatesByUserId.set(profile.id, candidates)
      for (const candidate of candidates) {
        if (!authMap.has(candidate.profile.id)) {
          duplicateAuthUserIds.add(candidate.profile.id)
        }
      }
    }

    const duplicateAuthResults = await Promise.all([...duplicateAuthUserIds].map(async id => {
      const { data, error } = await supabase.auth.admin.getUserById(id)
      return { id, user: data?.user, error }
    }))
    const duplicateAuthError = duplicateAuthResults.find(
      result => result.error && !isMissingAuthUserError(result.error),
    )
    if (duplicateAuthError?.error) {
      return NextResponse.json({ error: duplicateAuthError.error.message }, { status: 500 })
    }
    for (const result of duplicateAuthResults) {
      if (!result.user) continue
      authMap.set(result.id, {
        email: result.user.email,
        last_sign_in_at: result.user.last_sign_in_at,
      })
    }

    const users = profiles
      .map(p => {
        const authUser = authMap.get(p.id)
        const activeSuspension = isSuspensionActive(p)
        const sameIpHashCount = p.last_ip_hash ? ipClusterCounts.get(p.last_ip_hash) ?? 0 : 0
        const sameUserAgentHashCount = p.last_user_agent_hash
          ? userAgentClusterCounts.get(p.last_user_agent_hash) ?? 0
          : 0
        return {
          id: p.id,
          username: p.username,
          avatar_url: p.avatar_url,
          email: authUser?.email ?? null,
          auth_last_sign_in_at: authUser?.last_sign_in_at ?? null,
          role: p.role ?? 'user',
          suspended: activeSuspension,
          suspended_raw: p.suspended ?? false,
          suspension_active: activeSuspension,
          suspension_expired: p.suspended === true && !activeSuspension,
          suspension_reason: p.suspension_reason,
          suspended_until: p.suspended_until,
          suspended_at: p.suspended_at,
          suspended_by: p.suspended_by,
          last_seen_at: p.last_seen_at,
          last_ip_masked: p.last_ip_masked,
          last_country: p.last_country,
          created_at: p.created_at,
          deck_count: countMap.get(p.id) ?? 0,
          same_ip_hash_count: sameIpHashCount,
          same_user_agent_hash_count: sameUserAgentHashCount,
          duplicate_risk_count: Math.max(sameIpHashCount, sameUserAgentHashCount),
          duplicate_risk: sameIpHashCount > 1 || sameUserAgentHashCount > 1,
          duplicate_matches: (duplicateCandidatesByUserId.get(p.id) ?? []).map(candidate => {
            const duplicateAuthUser = authMap.get(candidate.profile.id)
            return {
              id: candidate.profile.id,
              username: candidate.profile.username,
              email: duplicateAuthUser?.email ?? null,
              avatar_url: candidate.profile.avatar_url,
              match_types: (['ip', 'user_agent'] as const).filter(matchType => (
                candidate.matchTypes.has(matchType)
              )),
              last_seen_at: candidate.profile.last_seen_at,
              last_country: candidate.profile.last_country,
              created_at: candidate.profile.created_at,
            }
          }),
        }
      })

    const nextOffset = offset + users.length
    const hasMore = nextOffset < total

    return NextResponse.json({
      users,
      total,
      count: users.length,
      hasMore,
      nextOffset: hasMore ? nextOffset : null,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
