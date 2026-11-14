import { NextRequest, NextResponse, after } from 'next/server'
import { pushForPost } from '@/lib/push/send'
import { revalidateTag } from 'next/cache'
import { saveSeriesChoice, withPostAuthors } from '@/features/community/server'
import { authorColumns, authorRateKey, guestPinOf, recordGuestAuthorship, resolveAuthor } from '@/features/account/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { findOrCreateSupabaseUser } from '@/lib/supabase/find-or-create-user'
import { normalizePlannerListKeywords, planMatchesDifficulty, storedDifficultiesFor, storedPlanDifficulty, stripPlanForList } from '@/lib/planner/strip-plan-for-list'
import { planFormationCount } from '@/features/planner'
import { parseCsvParam } from '@/features/decks'
import { normalizeFloorPlanDifficulty, normalizePlanDifficulty } from '@/lib/planner/floor-difficulty'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { checkRequestRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50
const ADVANCED_FILTER_CANDIDATE_LIMIT = 1000
const SUPPORTED_PLANNER_LANGS = ['ko', 'en', 'ja'] as const
const IDENTITY_MODE_VALUES = ['or', 'and'] as const
const COMBAT_SKILL_TYPES = ['slash', 'pierce', 'blunt'] as const
const PLANNER_LIST_SELECT = 'id, title, description, difficulty, deck, egos, floor_plan, gift_inventory, tags, lang, vote_count, view_count, comment_count, created_at, user_id, guest_tag, profiles:user_id(username, avatar_url)'

type PlannerLang = typeof SUPPORTED_PLANNER_LANGS[number]
type PlannerLangFilter = PlannerLang | 'all'
type FilterMode = typeof IDENTITY_MODE_VALUES[number]
type CombatSkillType = typeof COMBAT_SKILL_TYPES[number]
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>
type PlannerDeckSlot = {
  identity_id?: unknown
  slot_order?: unknown
  skill_types?: unknown
}
type PlannerSkillRow = {
  identity_id?: string | null
  skill_type?: string | null
  atk_type?: string | null
}

function isPlannerLang(value: unknown): value is PlannerLang {
  return typeof value === 'string' && SUPPORTED_PLANNER_LANGS.includes(value as PlannerLang)
}

function parsePlannerLangFilter(value: string | null): { value: PlannerLangFilter } | { error: string } {
  if (value === null || value === 'all') return { value: 'all' }
  if (isPlannerLang(value)) return { value }
  return { error: 'lang must be one of ko, en, ja, all' }
}

function parsePlannerMutationLang(...values: unknown[]): PlannerLang {
  return values.find(isPlannerLang) ?? 'ko'
}

function getParam(searchParams: URLSearchParams, primary: string, alias?: string) {
  const value = searchParams.get(primary)
  if (value !== null) return value
  return alias ? searchParams.get(alias) : null
}

function parseModeParam(value: string | null, name: string): { value: FilterMode } | { error: string } {
  if (value === null || value === '') return { value: 'or' }
  if (IDENTITY_MODE_VALUES.includes(value as FilterMode)) return { value: value as FilterMode }
  return { error: `${name} must be one of or, and` }
}

function parsePositiveIntegerParam(value: string | null, fallback: number, name: string) {
  if (value === null) return { value: fallback }
  if (!/^\d+$/.test(value)) return { error: `${name} must be a positive integer` }

  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1) return { error: `${name} must be a positive integer` }
  return { value: Math.min(parsed, MAX_PAGE_SIZE) }
}

function parseOffsetParam(value: string | null) {
  if (value === null) return { value: 0 }
  if (!/^\d+$/.test(value)) return { error: 'offset must be a non-negative integer' }

  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 0) return { error: 'offset must be a non-negative integer' }
  return { value: parsed }
}

/** Same bounds and message as the deck board's formation_count. */
function parseFormationCountParam(value: string | null): { value: number | null } | { error: string } {
  if (value === null || value === '') return { value: null }
  const parsed = /^\d+$/.test(value) ? Number(value) : NaN
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 12) return { error: 'formation_count must be an integer from 1 to 12' }
  return { value: parsed }
}

function isCombatSkillType(value: unknown): value is CombatSkillType {
  return typeof value === 'string' && COMBAT_SKILL_TYPES.includes(value as CombatSkillType)
}

function isFormationSlot(slot: PlannerDeckSlot) {
  const slotOrder = typeof slot.slot_order === 'number' ? slot.slot_order : 99
  return slotOrder < 99
}

function getPlanIdentityIdSet(plan: Record<string, unknown>) {
  const ids = new Set<string>()
  const deck = Array.isArray(plan.deck) ? plan.deck : []

  for (const slot of deck) {
    if (!slot || typeof slot !== 'object') continue
    const identityId = (slot as { identity_id?: unknown }).identity_id
    if (typeof identityId === 'string' && identityId) ids.add(identityId)
  }

  return ids
}

function getFormationIdentityIds(plans: Record<string, unknown>[]) {
  const ids = new Set<string>()

  for (const plan of plans) {
    const deck = Array.isArray(plan.deck) ? plan.deck : []
    for (const rawSlot of deck) {
      if (!rawSlot || typeof rawSlot !== 'object') continue
      const slot = rawSlot as PlannerDeckSlot
      if (!isFormationSlot(slot)) continue
      if (typeof slot.identity_id === 'string' && slot.identity_id) ids.add(slot.identity_id)
    }
  }

  return [...ids]
}

function buildPlannerSkillTypeMap(rows: PlannerSkillRow[]) {
  const skillTypesByIdentityId = new Map<string, Set<string>>()

  for (const row of rows) {
    if (!row.identity_id) continue
    const skillType = row.atk_type ?? row.skill_type
    if (!isCombatSkillType(skillType)) continue

    let skillTypes = skillTypesByIdentityId.get(row.identity_id)
    if (!skillTypes) {
      skillTypes = new Set()
      skillTypesByIdentityId.set(row.identity_id, skillTypes)
    }
    skillTypes.add(skillType)
  }

  return skillTypesByIdentityId
}

function isMissingAtkTypeError(error: { message?: string } | null) {
  return Boolean(error?.message?.includes('atk_type'))
}

async function fetchPlannerSkillTypeMap(supabase: SupabaseServerClient, identityIds: string[]) {
  if (identityIds.length === 0) return { skillTypesByIdentityId: new Map<string, Set<string>>() }

  const { data, error } = await supabase
    .schema('limbus')
    .from('skills')
    .select('identity_id, skill_type, atk_type')
    .in('identity_id', identityIds)
    .eq('uptie_level', 4)

  if (isMissingAtkTypeError(error)) {
    const fallback = await supabase
      .schema('limbus')
      .from('skills')
      .select('identity_id, skill_type')
      .in('identity_id', identityIds)
      .eq('uptie_level', 4)
    if (fallback.error) { console.error('[planner] skill types:', fallback.error.message); return { error: true as const } }
    return { skillTypesByIdentityId: buildPlannerSkillTypeMap((fallback.data ?? []) as PlannerSkillRow[]) }
  }

  if (error) { console.error('[planner] skill types:', error.message); return { error: true as const } }
  return { skillTypesByIdentityId: buildPlannerSkillTypeMap((data ?? []) as PlannerSkillRow[]) }
}

function addPlannerSkillTypesToRows(
  rows: Record<string, unknown>[],
  skillTypesByIdentityId: Map<string, Set<string>>,
) {
  if (skillTypesByIdentityId.size === 0) return rows

  return rows.map(plan => {
    if (!Array.isArray(plan.deck)) return plan

    return {
      ...plan,
      deck: plan.deck.map(rawSlot => {
        if (!rawSlot || typeof rawSlot !== 'object') return rawSlot

        const slot = rawSlot as PlannerDeckSlot
        const skillTypes = typeof slot.identity_id === 'string'
          ? skillTypesByIdentityId.get(slot.identity_id)
          : undefined

        if (!isFormationSlot(slot) || !skillTypes || skillTypes.size === 0) return rawSlot

        const existingSkillTypes = Array.isArray(slot.skill_types)
          ? slot.skill_types.filter(isCombatSkillType)
          : []

        return {
          ...slot,
          skill_types: [...new Set([...existingSkillTypes, ...skillTypes])],
        }
      }),
    }
  })
}

function matchesMode(required: string[], available: Set<string>, mode: FilterMode) {
  if (required.length === 0) return true
  return mode === 'and'
    ? required.every(item => available.has(item))
    : required.some(item => available.has(item))
}

function matchesIdentityFilters(plan: Record<string, unknown>, identityIds: string[], identityMode: FilterMode) {
  if (identityIds.length === 0) return true
  const available = getPlanIdentityIdSet(plan)
  return matchesMode(identityIds, available, identityMode)
}

function matchesKeywordFilters(
  plan: ReturnType<typeof stripPlanForList>,
  keywordTags: string[],
  keywordTagMode: FilterMode,
) {
  const { filter_keywords: rawFilterKeywords, selected_keywords: rawSelectedKeywords } = plan as {
    filter_keywords?: unknown
    selected_keywords?: unknown
  }
  const rawKeywords = [
    ...(Array.isArray(rawFilterKeywords) ? rawFilterKeywords : []),
    ...(Array.isArray(rawSelectedKeywords) ? rawSelectedKeywords : []),
  ].filter((keyword): keyword is string => typeof keyword === 'string')
  const filterKeywords = normalizePlannerListKeywords(rawKeywords)
  return matchesMode(keywordTags, new Set(filterKeywords), keywordTagMode)
}

// GET /api/planner — 플랜 목록
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(req.url)

    const sort = searchParams.get('sort') ?? 'latest'
    const difficulty = searchParams.get('difficulty')
    const tag = searchParams.get('tag')
    // Design Ref: §4.2 — 마이페이지용 파라미터
    const userIdParam = searchParams.get('userId')
    const votedBy = searchParams.get('votedBy')
    const langResult = parsePlannerLangFilter(searchParams.get('lang'))
    if ('error' in langResult) return NextResponse.json({ error: langResult.error }, { status: 400 })

    const limitResult = parsePositiveIntegerParam(searchParams.get('limit'), DEFAULT_PAGE_SIZE, 'limit')
    if ('error' in limitResult) return NextResponse.json({ error: limitResult.error }, { status: 400 })

    const offsetResult = parseOffsetParam(searchParams.get('offset'))
    if ('error' in offsetResult) return NextResponse.json({ error: offsetResult.error }, { status: 400 })

    const identityModeResult = parseModeParam(getParam(searchParams, 'identity_mode', 'im'), 'identity_mode')
    if ('error' in identityModeResult) return NextResponse.json({ error: identityModeResult.error }, { status: 400 })

    const keywordTagModeResult = parseModeParam(getParam(searchParams, 'keyword_tag_mode', 'ktm'), 'keyword_tag_mode')
    if ('error' in keywordTagModeResult) return NextResponse.json({ error: keywordTagModeResult.error }, { status: 400 })

    const formationCountResult = parseFormationCountParam(getParam(searchParams, 'formation_count', 'fc'))
    if ('error' in formationCountResult) return NextResponse.json({ error: formationCountResult.error }, { status: 400 })

    const { value: lang } = langResult
    const { value: limit } = limitResult
    const { value: offset } = offsetResult
    const { value: identityMode } = identityModeResult
    const { value: keywordTagMode } = keywordTagModeResult
    const { value: formationCount } = formationCountResult
    const identityIds = parseCsvParam(getParam(searchParams, 'identity_ids', 'ids'))
    const keywordTags = normalizePlannerListKeywords(parseCsvParam(getParam(searchParams, 'keyword_tags', 'kt')))
    // The normal filter also reads the plans stored as hard and keeps those with normal floors: that takes each plan's floors, like the filters above.
    const hasAdvancedFilters = identityIds.length > 0 || keywordTags.length > 0 || formationCount !== null || difficulty === 'normal'

    if (userIdParam !== null && userIdParam !== 'me') return NextResponse.json({ error: 'userId must be me' }, { status: 400 })

    // userId=me 또는 votedBy=me → 인증 필요
    let resolvedUserId: string | null = null
    if (userIdParam === 'me' || votedBy === 'me') {
      const session = await getServerSession(authOptions)
      if (!session?.user?.email) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
      const admin = createAdminClient()
      resolvedUserId = await findOrCreateSupabaseUser(admin, session.user.email, session.user.name, session.user.image)
    }

    // votedBy=me → 내가 추천한 플랜 ID 목록 조회
    let votedPlanIds: string[] | null = null
    if (votedBy === 'me' && resolvedUserId) {
      const admin = createAdminClient()
      const { data: votes, error: votesError } = await admin
        .schema('limbus')
        .from('md_plan_votes')
        .select('plan_id')
        .eq('user_id', resolvedUserId)
      if (votesError) {
        console.error('[planner] votedBy:', votesError.message)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
      }
      votedPlanIds = votes?.map((v: { plan_id: string }) => v.plan_id) ?? []
      if (votedPlanIds.length === 0) {
        return NextResponse.json({ plans: [], total: 0 })
      }
    }

    const buildQuery = (rangeStart: number, rangeEnd: number) => {
      let query = supabase
        .schema('limbus')
        .from('md_plans')
        .select(PLANNER_LIST_SELECT, { count: 'exact' })

      if (userIdParam === 'me' && resolvedUserId) query = query.eq('user_id', resolvedUserId)
      if (votedPlanIds) query = query.in('id', votedPlanIds)
      if (difficulty) query = query.in('difficulty', storedDifficultiesFor(difficulty))
      if (tag) query = query.contains('tags', [tag])
      if (lang !== 'all') query = query.eq('lang', lang)

      query = sort === 'popular'
        ? query.order('vote_count', { ascending: false }).order('created_at', { ascending: false })
        : query.order('created_at', { ascending: false })

      return query.range(rangeStart, rangeEnd)
    }

    const rangeStart = hasAdvancedFilters ? 0 : offset
    const rangeEnd = hasAdvancedFilters ? ADVANCED_FILTER_CANDIDATE_LIMIT - 1 : offset + limit - 1
    const { data, count, error } = await buildQuery(rangeStart, rangeEnd)
    if (error) {
      console.error('[planner] list:', error.message)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const rows = (await withPostAuthors((data ?? []) as { user_id?: string | null; profiles?: unknown }[])) as Record<string, unknown>[]
    const skillTypeResult = await fetchPlannerSkillTypeMap(supabase, getFormationIdentityIds(rows))
    if ('error' in skillTypeResult) return NextResponse.json({ error: 'Internal server error' }, { status: 500 })

    const enrichedRows = addPlannerSkillTypesToRows(rows, skillTypeResult.skillTypesByIdentityId)
    if (hasAdvancedFilters) {
      const filteredPlans = enrichedRows
        .map(plan => ({ plan, summary: stripPlanForList(plan) }))
        .filter(({ plan, summary }) => {
          return (!difficulty || planMatchesDifficulty(summary.difficulty, summary.difficulty_summary, difficulty)) &&
            (formationCount === null || planFormationCount(plan.deck) === formationCount) &&
            matchesIdentityFilters(plan, identityIds, identityMode) &&
            matchesKeywordFilters(summary, keywordTags, keywordTagMode)
        })
        .map(({ summary }) => summary)

      const plans = filteredPlans
        .slice(offset, offset + limit)
      return NextResponse.json({ plans, total: filteredPlans.length })
    }

    const plans = enrichedRows.map(plan => stripPlanForList(plan))
    return NextResponse.json({ plans, total: count })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/planner — 플랜 생성
export async function POST(req: NextRequest) {
  try {
    const admin = createAdminClient()
    const resolved = await resolveAuthor(req, admin)
    if ('response' in resolved) return resolved.response
    const { author } = resolved
    const userId = author.kind === 'user' ? author.userId : null

    const rateLimit = checkRequestRateLimit(req, {
      bucket: 'create',
      scope: author.kind === 'guest' ? 'planner:create:guest' : 'planner:create',
      authenticatedKey: authorRateKey(author),
    })
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit)

    const body = await req.json().catch(() => null)
    if (body === null) return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
    const { title, description, difficulty, deck, egos, floor_plan, gift_inventory, tags } = body
    // A guest's password for the plan; screens from before it existed send none.
    const pin = author.kind === 'guest' ? guestPinOf(body?.pin) : null
    if (pin === false) return NextResponse.json({ error: '비밀번호는 숫자 4~6자리입니다.' }, { status: 400 })
    const normalizedFloorPlan = normalizeFloorPlanDifficulty(floor_plan ?? [], normalizePlanDifficulty(difficulty)).floorPlan
    const planDifficulty = storedPlanDifficulty(normalizedFloorPlan, normalizePlanDifficulty(difficulty))
    const lang = parsePlannerMutationLang(body?.lang, body?.locale)

    if (!title?.trim()) return NextResponse.json({ error: '제목을 입력하세요' }, { status: 400 })

    const { data, error } = await admin
      .schema('limbus')
      .from('md_plans')
      .insert({
        ...authorColumns(author),
        title: title.trim(),
        description: description?.trim() ?? '',
        difficulty: planDifficulty,
        deck: deck ?? [],
        egos: egos ?? [],
        floor_plan: normalizedFloorPlan,
        gift_inventory: gift_inventory ?? [],
        tags: tags ?? [],
        lang,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[planner] create:', error.message)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const { error: activityError } = userId
      ? await admin.schema('limbus').rpc('community_record_plan', { p_plan_id: data.id, p_user_id: userId })
      : { error: await recordGuestAuthorship(admin, author, 'plan', data.id, pin) }
    if (activityError) {
      // The answer stays the same; a delete that fails leaves a plan without its activity record, so it is logged.
      const { error: rollbackError } = await admin.schema('limbus').from('md_plans').delete().eq('id', data.id)
      if (rollbackError) console.error('[planner] rollback failed:', data.id, rollbackError.message)
      return NextResponse.json({ error: '플랜을 저장하지 못했습니다. 다시 시도해주세요.' }, { status: 500 })
    }

    const seriesError = await saveSeriesChoice(admin, { kind: 'plan', postId: data.id, userId, body })
    if (seriesError) return seriesError

    await writeAuditLog({
      actorId: userId,
      action: 'planner_create',
      targetType: 'planner',
      targetId: data.id,
      details: {
        difficulty: planDifficulty,
        lang,
        tagCount: Array.isArray(tags) ? tags.length : 0,
        deckCount: Array.isArray(deck) ? deck.length : 0,
        egoCount: Array.isArray(egos) ? egos.length : 0,
      },
    })

    revalidateTag(CACHE_TAGS.plansList, 'max')
    if (userId) after(() => pushForPost('plan', data.id))
    return NextResponse.json({ id: data.id }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
