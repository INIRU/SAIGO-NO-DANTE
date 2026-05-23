import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerSession } from 'next-auth'
import { authOptions, requireActiveUser } from '@/lib/auth'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'
import { normalizePlannerListKeywords, stripPlanForList } from '@/lib/planner/stripPlanForList'
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
const PLANNER_LIST_SELECT = 'id, title, description, difficulty, deck, egos, floor_plan, tags, lang, vote_count, view_count, comment_count, created_at, user_id, profiles:user_id(username, avatar_url)'

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

function parseCsvParam(value: string | null) {
  if (!value) return []
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
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
    if (fallback.error) return { error: fallback.error.message }
    return { skillTypesByIdentityId: buildPlannerSkillTypeMap((fallback.data ?? []) as PlannerSkillRow[]) }
  }

  if (error) return { error: error.message }
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

    const { value: lang } = langResult
    const { value: limit } = limitResult
    const { value: offset } = offsetResult
    const { value: identityMode } = identityModeResult
    const { value: keywordTagMode } = keywordTagModeResult
    const identityIds = parseCsvParam(getParam(searchParams, 'identity_ids', 'ids'))
    const keywordTags = normalizePlannerListKeywords(parseCsvParam(getParam(searchParams, 'keyword_tags', 'kt')))
    const hasAdvancedFilters = identityIds.length > 0 || keywordTags.length > 0

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
      const { data: votes } = await admin
        .schema('limbus')
        .from('md_plan_votes')
        .select('plan_id')
        .eq('user_id', resolvedUserId)
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
      if (difficulty) query = query.eq('difficulty', difficulty)
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
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const rows = (data ?? []) as Record<string, unknown>[]
    const skillTypeResult = await fetchPlannerSkillTypeMap(supabase, getFormationIdentityIds(rows))
    if ('error' in skillTypeResult) return NextResponse.json({ error: skillTypeResult.error }, { status: 500 })

    const enrichedRows = addPlannerSkillTypesToRows(rows, skillTypeResult.skillTypesByIdentityId)
    if (hasAdvancedFilters) {
      const filteredPlans = enrichedRows
        .map(plan => ({ plan, summary: stripPlanForList(plan) }))
        .filter(({ plan, summary }) => {
          return matchesIdentityFilters(plan, identityIds, identityMode) &&
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
    const activeUser = await requireActiveUser()
    if (activeUser.error) return activeUser.response
    const { session } = activeUser

    const rateLimit = checkRequestRateLimit(req, {
      bucket: 'create',
      scope: 'planner:create',
      authenticatedKey: session.user.email,
    })
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit)

    const admin = createAdminClient()
    const userId = await findOrCreateSupabaseUser(admin, session.user.email!, session.user.name, session.user.image)

    const body = await req.json()
    const { title, description, difficulty, deck, egos, floor_plan, gift_inventory, tags } = body
    const planDifficulty = normalizePlanDifficulty(difficulty)
    const normalizedFloorPlan = normalizeFloorPlanDifficulty(floor_plan ?? [], planDifficulty).floorPlan
    const lang = parsePlannerMutationLang(body?.lang, body?.locale)

    if (!title?.trim()) return NextResponse.json({ error: '제목을 입력하세요' }, { status: 400 })

    const { data, error } = await admin
      .schema('limbus')
      .from('md_plans')
      .insert({
        user_id: userId,
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

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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
    return NextResponse.json({ id: data.id }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
