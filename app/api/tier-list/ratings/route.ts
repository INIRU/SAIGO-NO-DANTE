import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions, requireActiveUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { deriveTier, type Tier } from '@/lib/tier-list/tierModel'
import { checkRequestRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'

const TIER_LIST_CATEGORIES = ['reroll', 'overall', 'mirror_dungeon', 'goodstuff'] as const
const OVERALL_SOURCE_CATEGORIES = ['reroll', 'goodstuff', 'mirror_dungeon'] as const
const EDITABLE_CATEGORIES = ['reroll', 'mirror_dungeon', 'goodstuff'] as const
const RATING_PERIODS = ['7d', '30d', '1y', 'all'] as const
const SUPPORTED_LOCALES = ['ko', 'en', 'ja'] as const
type TierListCategory = typeof TIER_LIST_CATEGORIES[number]
type OverallSourceCategory = typeof OVERALL_SOURCE_CATEGORIES[number]
type RatingPeriod = typeof RATING_PERIODS[number]
type RatingAggregate = {
  averageScore: number | null
  ratingCount: number
  derivedTier: Tier
  distribution: Record<number, number>
}

const MIN_ACCOUNT_AGE_DAYS = 14
const MAX_COMMENT_LENGTH = 280

function parseCategory(value: unknown): TierListCategory | null {
  if (typeof value !== 'string' || value.length === 0) return null
  return TIER_LIST_CATEGORIES.includes(value as TierListCategory) ? value as TierListCategory : null
}

function parsePeriod(value: unknown): RatingPeriod {
  if (typeof value !== 'string' || value.length === 0) return 'all'
  return RATING_PERIODS.includes(value as RatingPeriod) ? value as RatingPeriod : 'all'
}

function getPeriodStart(period: RatingPeriod): string | null {
  const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '1y' ? 365 : null
  if (!days) return null
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

function revalidateTierListCaches() {
  revalidateTag(CACHE_TAGS.tierList, 'max')
  for (const locale of SUPPORTED_LOCALES) {
    revalidatePath(`/${locale}/tier-list`)
  }
}

function isEditableCategory(category: TierListCategory): boolean {
  return EDITABLE_CATEGORIES.includes(category as typeof EDITABLE_CATEGORIES[number])
}

function getAccountAgeDays(createdAt: string | null | undefined): number | null {
  if (!createdAt) return null
  const createdTime = new Date(createdAt).getTime()
  if (!Number.isFinite(createdTime)) return null
  return Math.floor((Date.now() - createdTime) / 86_400_000)
}

function emptyDistribution(): Record<number, number> {
  return Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, 0])) as Record<number, number>
}

function emptyAggregate(): RatingAggregate {
  return {
    averageScore: null,
    ratingCount: 0,
    derivedTier: 'N/A',
    distribution: emptyDistribution(),
  }
}

function emptySourceAggregates(): Record<OverallSourceCategory, RatingAggregate> {
  return Object.fromEntries(
    OVERALL_SOURCE_CATEGORIES.map(category => [category, emptyAggregate()]),
  ) as Record<OverallSourceCategory, RatingAggregate>
}

function getOverallReadonlyViewer(viewer: Awaited<ReturnType<typeof getViewerState>>['viewer']) {
  return {
    ...viewer,
    canRate: false,
    reason: 'overall_readonly' as const,
  }
}

async function getViewerState(admin: ReturnType<typeof createAdminClient>) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return {
      session: null,
      userId: null,
      viewer: {
        authenticated: false,
        canRate: false,
        reason: 'login_required' as const,
        accountAgeDays: null,
      },
    }
  }

  if (session.user.isSuspended) {
    return {
      session,
      userId: null,
      viewer: {
        authenticated: true,
        canRate: false,
        reason: 'suspended' as const,
        accountAgeDays: null,
      },
    }
  }

  const userId = await findOrCreateSupabaseUser(admin, session.user.email, session.user.name, session.user.image)
  if (!userId) {
    return {
      session,
      userId: null,
      viewer: {
        authenticated: true,
        canRate: false,
        reason: 'login_required' as const,
        accountAgeDays: null,
      },
    }
  }

  const { data: profile, error: profileError } = await admin
    .schema('limbus')
    .from('profiles')
    .select('created_at, suspended')
    .eq('id', userId)
    .single()

  if (profileError) throw new Error(profileError.message)

  const accountAgeDays = getAccountAgeDays(profile?.created_at)
  const canRate = profile?.suspended !== true
    && accountAgeDays !== null
    && accountAgeDays >= MIN_ACCOUNT_AGE_DAYS

  return {
    session,
    userId,
    viewer: {
      authenticated: true,
      canRate,
      reason: profile?.suspended === true
        ? 'suspended' as const
        : canRate
          ? 'eligible' as const
          : 'account_too_new' as const,
      accountAgeDays,
    },
  }
}

async function getOverallRatingResponse(
  admin: ReturnType<typeof createAdminClient>,
  identityId: string,
  viewerState: Awaited<ReturnType<typeof getViewerState>>,
  period: RatingPeriod,
) {
  let ratingsQuery = admin
    .schema('limbus')
    .from('tier_ratings')
    .select('id, score, comment, created_at, user_id, category, profiles(username, avatar_url, role)')
    .eq('identity_id', identityId)
    .in('category', [...OVERALL_SOURCE_CATEGORIES])
    .order('created_at', { ascending: false })
  const periodStart = getPeriodStart(period)
  if (periodStart) {
    ratingsQuery = ratingsQuery.gte('created_at', periodStart)
  }
  const { data: ratings, error } = await ratingsQuery

  const viewer = getOverallReadonlyViewer(viewerState.viewer)

  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') {
      return NextResponse.json({
        aggregate: emptyAggregate(),
        sourceAggregates: emptySourceAggregates(),
        comments: [],
        myRating: null,
        viewer,
      })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const sourceStats = new Map<string, { count: number; total: number; scores: number[] }>()
  const comments = []

  for (const rating of ratings ?? []) {
    const score = Number((rating as { score: unknown }).score)
    const category = (rating as { category: unknown }).category
    if (
      typeof category !== 'string'
      || !OVERALL_SOURCE_CATEGORIES.includes(category as typeof OVERALL_SOURCE_CATEGORIES[number])
      || !Number.isInteger(score)
      || score < 1
      || score > 10
    ) {
      continue
    }

    const stats = sourceStats.get(category) ?? { count: 0, total: 0, scores: [] }
    stats.count += 1
    stats.total += score
    stats.scores.push(score)
    sourceStats.set(category, stats)

    const comment = (rating as { comment: unknown }).comment
    if (typeof comment === 'string' && comment.trim().length > 0) {
      const profile = Array.isArray((rating as { profiles: unknown }).profiles)
        ? (rating as { profiles: unknown[] }).profiles[0]
        : (rating as { profiles: unknown }).profiles

      comments.push({
        id: (rating as { id: unknown }).id,
        score,
        comment,
        created_at: (rating as { created_at: unknown }).created_at,
        category,
        username: (profile as Record<string, unknown> | null)?.username ?? null,
        avatar_url: (profile as Record<string, unknown> | null)?.avatar_url ?? null,
        role: (profile as Record<string, unknown> | null)?.role ?? 'user',
      })
    }
  }

  const sourceAggregates = emptySourceAggregates()
  for (const category of OVERALL_SOURCE_CATEGORIES) {
    const stats = sourceStats.get(category)
    if (!stats) continue

    const sourceDistribution = emptyDistribution()
    for (const score of stats.scores) {
      sourceDistribution[score] = (sourceDistribution[score] ?? 0) + 1
    }

    const sourceAverageScore = stats.count > 0
      ? Number((stats.total / stats.count).toFixed(2))
      : null

    sourceAggregates[category] = {
      averageScore: sourceAverageScore,
      ratingCount: stats.count,
      derivedTier: deriveTier(sourceAverageScore, stats.count),
      distribution: sourceDistribution,
    }
  }

  const usableStats = [...sourceStats.values()].filter(stats => stats.count > 0)
  const usableAverages = usableStats.map(stats => stats.total / stats.count)
  const distribution = emptyDistribution()
  for (const stats of usableStats) {
    for (const score of stats.scores) {
      distribution[score] = (distribution[score] ?? 0) + 1
    }
  }

  const ratingCount = usableStats.reduce((sum, stats) => sum + stats.count, 0)
  const averageScore = usableAverages.length > 0
    ? Number((usableAverages.reduce((sum, average) => sum + average, 0) / usableAverages.length).toFixed(2))
    : null

  return NextResponse.json({
    aggregate: {
      averageScore,
      ratingCount,
      derivedTier: deriveTier(averageScore, ratingCount),
      distribution,
    },
    sourceAggregates,
    comments,
    myRating: null,
    viewer,
  })
}

export async function GET(request: NextRequest) {
  try {
    const identityId = request.nextUrl.searchParams.get('identityId')
    const category = parseCategory(request.nextUrl.searchParams.get('category'))
    const period = parsePeriod(request.nextUrl.searchParams.get('period'))

    if (!identityId) {
      return NextResponse.json({ error: 'identityId가 필요합니다.' }, { status: 400 })
    }
    if (!category) {
      return NextResponse.json({ error: '유효하지 않은 티어 카테고리입니다.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const viewerState = await getViewerState(admin)

    if (category === 'overall') {
      return getOverallRatingResponse(admin, identityId, viewerState, period)
    }

    let ratingsQuery = admin
      .schema('limbus')
      .from('tier_ratings')
      .select('id, score, comment, created_at, user_id, profiles(username, avatar_url, role)')
      .eq('identity_id', identityId)
      .eq('category', category)
      .order('created_at', { ascending: false })
    const periodStart = getPeriodStart(period)
    if (periodStart) {
      ratingsQuery = ratingsQuery.gte('created_at', periodStart)
    }
    const { data: ratings, error } = await ratingsQuery

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') {
        return NextResponse.json({
          aggregate: {
            averageScore: null,
            ratingCount: 0,
            derivedTier: 'N/A',
            distribution: emptyDistribution(),
          },
          comments: [],
          myRating: null,
          viewer: viewerState.viewer,
        })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const allRatings = (ratings ?? []).map((rating: Record<string, unknown>) => {
      const profile = Array.isArray(rating.profiles) ? rating.profiles[0] : rating.profiles
      return {
        id: rating.id as string,
        score: rating.score as number,
        comment: rating.comment as string,
        created_at: rating.created_at as string,
        user_id: rating.user_id as string,
        username: (profile as Record<string, unknown> | null)?.username ?? null,
        avatar_url: (profile as Record<string, unknown> | null)?.avatar_url ?? null,
        role: (profile as Record<string, unknown> | null)?.role ?? 'user',
      }
    })

    const distribution = emptyDistribution()
    let scoreTotal = 0
    for (const rating of allRatings) {
      distribution[rating.score] = (distribution[rating.score] ?? 0) + 1
      scoreTotal += rating.score
    }

    const ratingCount = allRatings.length
    const averageScore = ratingCount > 0 ? Number((scoreTotal / ratingCount).toFixed(2)) : null
    const { data: myRatingSource, error: myRatingError } = viewerState.userId
      ? await admin
        .schema('limbus')
        .from('tier_ratings')
        .select('id, score, comment')
        .eq('identity_id', identityId)
        .eq('category', category)
        .eq('user_id', viewerState.userId)
        .maybeSingle()
      : { data: null, error: null }

    if (myRatingError) {
      return NextResponse.json({ error: myRatingError.message }, { status: 500 })
    }

    return NextResponse.json({
      aggregate: {
        averageScore,
        ratingCount,
        derivedTier: deriveTier(averageScore, ratingCount),
        distribution,
      },
      comments: allRatings
        .filter(rating => rating.comment.trim().length > 0)
        .map(({ user_id: _userId, ...rating }) => rating),
      myRating: myRatingSource
        ? {
          id: myRatingSource.id,
          score: myRatingSource.score,
          comment: myRatingSource.comment,
        }
        : null,
      viewer: viewerState.viewer,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireActiveUser()
    if (auth.error) return auth.response
    const { session } = auth

    const rateLimit = checkRequestRateLimit(request, {
      bucket: 'rating',
      scope: 'tier-ratings:upsert',
      authenticatedKey: session.user.email,
    })
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit)

    const body = await request.json()
    const identityId = typeof body.identityId === 'string' ? body.identityId : null
    const category = parseCategory(body.category)
    const score = Number(body.score)
    const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, MAX_COMMENT_LENGTH) : ''

    if (!identityId) {
      return NextResponse.json({ error: 'identityId가 필요합니다.' }, { status: 400 })
    }
    if (!category) {
      return NextResponse.json({ error: '유효하지 않은 티어 카테고리입니다.' }, { status: 400 })
    }
    if (category === 'overall') {
      return NextResponse.json({
        error: '종합 평가는 리세, 굿스터프, 거던 평가에서 자동 계산되며 직접 등록할 수 없습니다.',
        reason: 'overall_readonly',
      }, { status: 400 })
    }
    if (!Number.isInteger(score) || score < 1 || score > 10) {
      return NextResponse.json({ error: '점수는 1부터 10까지의 정수여야 합니다.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const userId = await findOrCreateSupabaseUser(admin, session.user.email!, session.user.name, session.user.image)
    if (!userId) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 500 })
    }

    const { data: profile, error: profileError } = await admin
      .schema('limbus')
      .from('profiles')
      .select('created_at, suspended')
      .eq('id', userId)
      .single()

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }
    if (profile?.suspended === true) {
      return NextResponse.json({ error: '이용이 정지된 계정입니다.' }, { status: 403 })
    }

    const accountAgeDays = getAccountAgeDays(profile?.created_at)
    if (accountAgeDays === null || accountAgeDays < MIN_ACCOUNT_AGE_DAYS) {
      return NextResponse.json({
        error: '가입 후 14일이 지난 계정만 평가할 수 있습니다.',
        accountAgeDays,
      }, { status: 403 })
    }

    const { data: existingRating, error: existingRatingError } = await admin
      .schema('limbus')
      .from('tier_ratings')
      .select('id')
      .eq('identity_id', identityId)
      .eq('category', category)
      .eq('user_id', userId)
      .maybeSingle()

    if (existingRatingError) {
      return NextResponse.json({ error: existingRatingError.message }, { status: 500 })
    }

    const { data, error } = await admin
      .schema('limbus')
      .from('tier_ratings')
      .upsert(
        { identity_id: identityId, user_id: userId, category, score, comment },
        { onConflict: 'identity_id,user_id,category' },
      )
      .select('id, identity_id, user_id, category, score, comment, created_at, updated_at')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await writeAuditLog({
      actorId: userId,
      action: existingRating ? 'tier_rating_update' : 'tier_rating_create',
      targetType: 'tier_rating',
      targetId: data.id,
      details: {
        identityId,
        category,
        score,
        hadComment: comment.length > 0,
      },
    })

    revalidateTierListCaches()
    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireActiveUser()
    if (auth.error) return auth.response
    const { session } = auth

    const rateLimit = checkRequestRateLimit(request, {
      bucket: 'rating',
      scope: 'tier-ratings:delete',
      authenticatedKey: session.user.email,
    })
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit)

    let body: { identityId?: unknown; category?: unknown } = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }

    const identityId = typeof body.identityId === 'string'
      ? body.identityId
      : request.nextUrl.searchParams.get('identityId')
    const category = parseCategory(
      typeof body.category === 'string'
        ? body.category
        : request.nextUrl.searchParams.get('category'),
    )

    if (!identityId) {
      return NextResponse.json({ error: 'identityId가 필요합니다.' }, { status: 400 })
    }
    if (!category) {
      return NextResponse.json({ error: '유효하지 않은 티어 카테고리입니다.' }, { status: 400 })
    }
    if (!isEditableCategory(category)) {
      return NextResponse.json({
        error: '종합 평가는 자동 계산되며 직접 삭제할 수 없습니다.',
        reason: 'overall_readonly',
      }, { status: 400 })
    }

    const admin = createAdminClient()
    const userId = await findOrCreateSupabaseUser(admin, session.user.email!, session.user.name, session.user.image)
    if (!userId) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 500 })
    }

    const { data: existingRating, error: existingRatingError } = await admin
      .schema('limbus')
      .from('tier_ratings')
      .select('id')
      .eq('identity_id', identityId)
      .eq('category', category)
      .eq('user_id', userId)
      .maybeSingle()

    if (existingRatingError) {
      return NextResponse.json({ error: existingRatingError.message }, { status: 500 })
    }

    const { error } = await admin
      .schema('limbus')
      .from('tier_ratings')
      .delete()
      .eq('identity_id', identityId)
      .eq('category', category)
      .eq('user_id', userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (existingRating) {
      await writeAuditLog({
        actorId: userId,
        action: 'tier_rating_delete',
        targetType: 'tier_rating',
        targetId: existingRating.id,
        details: {
          identityId,
          category,
        },
      })
    }

    revalidateTierListCaches()
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
