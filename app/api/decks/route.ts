
import { notePlainText } from '@/lib/notes/blocks'
import { authorColumns, authorRateKey, recordGuestAuthorship, resolveAuthor } from '@/lib/guest/server'
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { insertDeckIdentities, normalizeUptie } from '@/lib/decks/deck-identity-uptie'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { checkRequestRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import { parseSearchQuery, type ParsedSearch } from '@/lib/utils/search'
import { THEME_KEYWORDS, normalizeThemeKeyword } from '@/lib/constants/keywords'
import {
  DECK_MAIN_KEYWORDS,
  computeDeckMainKeywordsFromSlots,
  parseDeckMainKeywordsInput,
} from '@/lib/decks/keyword-rules'

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50
const ADVANCED_FILTER_CANDIDATE_LIMIT = 1000
const SUPPORTED_DECK_LANGS = ['ko', 'en', 'ja'] as const
const MODE_VALUES = ['or', 'and'] as const
const PINNED_DECK_KEYWORD_SET = new Set<string>(DECK_MAIN_KEYWORDS)
const THEME_KEYWORD_SET = new Set<string>(THEME_KEYWORDS)
const DECK_LIST_FILTER_BASE_SELECT = `
        id, user_id, title, description, tags, main_keywords, content_type, lang, vote_count, view_count, comment_count, created_at,
        guest_tag, profiles!decks_user_id_fkey(username)
      `
const DECK_LIST_FILTER_SELECT_WITH_SKILL_KEYWORDS = `
        id, user_id, title, description, tags, main_keywords, content_type, lang, vote_count, view_count, comment_count, created_at,
        guest_tag, profiles!decks_user_id_fkey(username),
        deck_identities(slot_order, identities(id, keywords, skill_keyword_list, skills(atk_type, skill_type))),
        deck_egos(grade)
      `
const DECK_LIST_FILTER_SELECT_LEGACY = `
        id, user_id, title, description, tags, content_type, lang, vote_count, view_count, comment_count, created_at,
        guest_tag, profiles!decks_user_id_fkey(username),
        deck_identities(slot_order, identities(id, keywords)),
        deck_egos(grade)
      `
const DECK_LIST_SELECT_WITH_SKILL_KEYWORDS = `
        id, user_id, title, description, tags, main_keywords, content_type, lang, vote_count, view_count, comment_count, created_at,
        guest_tag, profiles!decks_user_id_fkey(username),
        deck_identities(slot_order, gacksung, s1_count, s2_count, s3_count, identities(id, sinner_id, folder_name, game_id, keywords, skill_keyword_list, name_kr)),
        deck_egos(ego_id, grade)
      `
const DECK_LIST_SELECT_LEGACY = `
        id, user_id, title, description, tags, content_type, lang, vote_count, view_count, comment_count, created_at,
        guest_tag, profiles!decks_user_id_fkey(username),
        deck_identities(slot_order, gacksung, s1_count, s2_count, s3_count, identities(id, sinner_id, folder_name, game_id, keywords, name_kr)),
        deck_egos(ego_id, grade)
      `

type DeckLang = typeof SUPPORTED_DECK_LANGS[number]
type DeckLangFilter = DeckLang | 'all'
type FilterMode = typeof MODE_VALUES[number]
type ProfileRow = { username?: string | null }
type DeckIdentityRow = {
  slot_order: number | null
  identities: {
    id?: string | null
    sinner_id?: string | null
    folder_name?: string | null
    game_id?: string | null
    keywords?: string[] | null
    skill_keyword_list?: string[] | null
    skills?: Array<{
      atk_type?: string | null
      skill_type?: string | null
    }> | null
    name_kr?: string | null
  } | null
}
type DeckEgoRow = {
  ego_id?: string | null
  grade?: string | null
}
type DeckListRow = {
  id: string
  title: string
  description: string | null
  tags: string[] | null
  main_keywords?: string[] | null
  content_type?: string | null
  lang?: DeckLang | null
  vote_count: number
  view_count: number
  comment_count?: number | null
  created_at: string
  profiles?: ProfileRow | ProfileRow[] | null
  deck_identities?: DeckIdentityRow[] | null
  deck_egos?: DeckEgoRow[] | null
}
type AdvancedDeckFilters = {
  q: string
  parsedSearch: ParsedSearch
  searchTermsLower: string[]
  contentType: string | null
  tags: string[]
  mainKeywords: string[]
  mainKeywordMode: FilterMode
  keywordTags: string[]
  keywordTagMode: FilterMode
  formationCount: number | null
  minInfoScore: number | null
  identityIds: string[]
  identityMode: FilterMode
}
type DeckFilterIndex = {
  mainKeywords: Set<string>
  keywordTags: Set<string>
  identityIds: Set<string>
  formationCount: number
  infoScore: number
}

function isDeckLang(value: unknown): value is DeckLang {
  return typeof value === 'string' && SUPPORTED_DECK_LANGS.includes(value as DeckLang)
}

function parseDeckLangFilter(value: string | null): { value: DeckLangFilter } | { error: string } {
  if (value === null || value === 'all') return { value: 'all' }
  if (isDeckLang(value)) return { value }
  return { error: 'lang must be one of ko, en, ja, all' }
}

function parseDeckMutationLang(...values: unknown[]): DeckLang {
  return values.find(isDeckLang) ?? 'ko'
}

function parseCsvParam(value: string | null) {
  if (!value) return []
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function getParam(searchParams: URLSearchParams, primary: string, alias?: string) {
  const value = searchParams.get(primary)
  if (value !== null) return value
  return alias ? searchParams.get(alias) : null
}

function parseModeParam(value: string | null, name: string): { value: FilterMode } | { error: string } {
  if (value === null || value === '') return { value: 'or' }
  if (MODE_VALUES.includes(value as FilterMode)) return { value: value as FilterMode }
  return { error: `${name} must be one of or, and` }
}

function parseBoundedIntegerFilter(
  value: string | null,
  name: string,
  min: number,
  max: number,
): { value: number | null } | { error: string } {
  if (value === null || value === '') return { value: null }
  if (!/^\d+$/.test(value)) {
    return { error: `${name} must be an integer from ${min} to ${max}` }
  }

  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    return { error: `${name} must be an integer from ${min} to ${max}` }
  }

  return { value: parsed }
}

function parseAdvancedDeckFilters(searchParams: URLSearchParams): { value: AdvancedDeckFilters; hasAdvancedFilters: boolean } | { error: string } {
  const mainKeywordModeResult = parseModeParam(getParam(searchParams, 'main_keyword_mode', 'km'), 'main_keyword_mode')
  if ('error' in mainKeywordModeResult) return mainKeywordModeResult

  const keywordTagModeResult = parseModeParam(getParam(searchParams, 'keyword_tag_mode', 'ktm'), 'keyword_tag_mode')
  if ('error' in keywordTagModeResult) return keywordTagModeResult

  const identityModeResult = parseModeParam(getParam(searchParams, 'identity_mode', 'im'), 'identity_mode')
  if ('error' in identityModeResult) return identityModeResult

  const formationCountResult = parseBoundedIntegerFilter(
    getParam(searchParams, 'formation_count', 'fc'),
    'formation_count',
    1,
    12,
  )
  if ('error' in formationCountResult) return formationCountResult

  const minInfoScoreResult = parseBoundedIntegerFilter(
    getParam(searchParams, 'min_info_score', 'score'),
    'min_info_score',
    1,
    3,
  )
  if ('error' in minInfoScoreResult) return minInfoScoreResult

  const q = searchParams.get('q')?.trim() ?? ''
  const parsedSearch = parseSearchQuery(q)
  const value = {
    q,
    parsedSearch,
    searchTermsLower: parsedSearch.terms.map(term => term.toLowerCase()),
    contentType: getParam(searchParams, 'content_type', 'ct')?.trim() || null,
    tags: parseCsvParam(searchParams.get('tags')),
    mainKeywords: parseCsvParam(getParam(searchParams, 'main_keywords', 'kw')),
    mainKeywordMode: mainKeywordModeResult.value,
    keywordTags: parseCsvParam(getParam(searchParams, 'keyword_tags', 'kt')),
    keywordTagMode: keywordTagModeResult.value,
    formationCount: formationCountResult.value,
    minInfoScore: minInfoScoreResult.value,
    identityIds: parseCsvParam(getParam(searchParams, 'identity_ids', 'ids')),
    identityMode: identityModeResult.value,
  }

  return {
    value,
    hasAdvancedFilters: Boolean(
      value.q ||
      value.contentType ||
      value.tags.length > 0 ||
      value.mainKeywords.length > 0 ||
      value.keywordTags.length > 0 ||
      value.formationCount !== null ||
      value.minInfoScore !== null ||
      value.identityIds.length > 0
    ),
  }
}

function parsePositiveIntegerParam(value: string | null, fallback: number, name: string) {
  if (value === null) return { value: fallback }
  if (!/^\d+$/.test(value)) {
    return { error: `${name} must be a positive integer` }
  }

  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return { error: `${name} must be a positive integer` }
  }

  return { value: Math.min(parsed, MAX_PAGE_SIZE) }
}

function parseOffsetParam(value: string | null) {
  if (value === null) return { value: 0 }
  if (!/^\d+$/.test(value)) {
    return { error: 'offset must be a non-negative integer' }
  }

  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    return { error: 'offset must be a non-negative integer' }
  }

  return { value: parsed }
}

function isMissingDeckKeywordColumnError(error: { message?: string } | null) {
  return Boolean(
    error?.message?.includes('skill_keyword_list') ||
    error?.message?.includes('main_keywords')
  )
}

function getProfileUsername(deck: DeckListRow) {
  const profile = Array.isArray(deck.profiles) ? deck.profiles[0] : deck.profiles
  return profile?.username ?? ''
}

function getIdentityKeywords(identity: NonNullable<DeckIdentityRow['identities']>) {
  return identity.skill_keyword_list && identity.skill_keyword_list.length > 0
    ? identity.skill_keyword_list
    : (identity.keywords ?? [])
}

function buildDeckFilterIndex(deck: DeckListRow): DeckFilterIndex {
  const keywordTags = new Set<string>()
  const identityIds = new Set<string>()
  let formationCount = 0

  for (const slot of deck.deck_identities ?? []) {
    const identity = slot.identities
    if (identity?.id) identityIds.add(identity.id)
    if ((slot.slot_order ?? 99) === 99 || !identity) continue
    formationCount++

    for (const rawKeyword of getIdentityKeywords(identity)) {
      const keyword = rawKeyword.trim()
      if (!keyword) continue
      keywordTags.add(keyword)

      const normalized = normalizeThemeKeyword(keyword)
      if (THEME_KEYWORD_SET.has(normalized)) keywordTags.add(normalized)
    }
  }

  const persistedMainKeywords = (deck.main_keywords ?? [])
    .map(keyword => normalizeThemeKeyword(keyword.trim()))
    .filter(keyword => PINNED_DECK_KEYWORD_SET.has(keyword))
  const mainKeywords = new Set(
    persistedMainKeywords.length > 0
      ? persistedMainKeywords
      : computeDeckMainKeywordsFromSlots(deck.deck_identities ?? [])
  )

  for (const rawTag of deck.tags ?? []) {
    const normalized = normalizeThemeKeyword(rawTag.trim())
    if (PINNED_DECK_KEYWORD_SET.has(normalized)) mainKeywords.add(normalized)
  }

  const hasFormationOrder = formationCount > 0
  const hasNonDefaultEgo = (deck.deck_egos ?? []).some(ego => {
    const grade = typeof ego.grade === 'string' ? ego.grade.trim().toUpperCase() : ''
    return grade !== '' && grade !== 'ZAYIN' && grade !== 'BASIC' && grade !== '기본'
  })
  const hasDescription = notePlainText(deck.description ?? '').length >= 20

  return {
    mainKeywords,
    keywordTags,
    identityIds,
    formationCount,
    infoScore: Number(hasFormationOrder) + Number(hasNonDefaultEgo) + Number(hasDescription),
  }
}

function matchesMode(required: string[], available: Set<string>, mode: FilterMode) {
  if (required.length === 0) return true
  return mode === 'and'
    ? required.every(item => available.has(item))
    : required.some(item => available.has(item))
}

function deckMatchesSearch(deck: DeckListRow, filters: AdvancedDeckFilters) {
  if (filters.searchTermsLower.length === 0) return true
  const searchText = [
    deck.title,
    notePlainText(deck.description ?? ''),
    getProfileUsername(deck),
    ...(deck.tags ?? []),
  ].join('\n').toLowerCase()

  return filters.parsedSearch.mode === 'and'
    ? filters.searchTermsLower.every(term => searchText.includes(term))
    : filters.searchTermsLower.some(term => searchText.includes(term))
}

function needsDeckFilterIndex(filters: AdvancedDeckFilters) {
  return filters.mainKeywords.length > 0 ||
    filters.keywordTags.length > 0 ||
    filters.formationCount !== null ||
    filters.minInfoScore !== null ||
    filters.identityIds.length > 0
}

function deckMatchesAdvancedFilters(deck: DeckListRow, filters: AdvancedDeckFilters) {
  if (filters.contentType && deck.content_type !== filters.contentType) return false
  if (filters.tags.length > 0 && !filters.tags.some(tag => (deck.tags ?? []).includes(tag))) return false
  if (!deckMatchesSearch(deck, filters)) return false

  if (!needsDeckFilterIndex(filters)) return true

  const index = buildDeckFilterIndex(deck)
  if (!matchesMode(filters.mainKeywords, index.mainKeywords, filters.mainKeywordMode)) return false
  if (!matchesMode(filters.keywordTags, index.keywordTags, filters.keywordTagMode)) return false
  if (filters.formationCount !== null && index.formationCount !== filters.formationCount) return false
  if (filters.minInfoScore !== null && index.infoScore < filters.minInfoScore) return false
  if (!matchesMode(filters.identityIds, index.identityIds, filters.identityMode)) return false

  return true
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const sort = searchParams.get('sort') || 'latest'
    const identityId = searchParams.get('identity_id')
    const langResult = parseDeckLangFilter(searchParams.get('lang'))
    if ('error' in langResult) {
      return NextResponse.json({ error: langResult.error }, { status: 400 })
    }

    const limitResult = parsePositiveIntegerParam(searchParams.get('limit'), DEFAULT_PAGE_SIZE, 'limit')
    if ('error' in limitResult) {
      return NextResponse.json({ error: limitResult.error }, { status: 400 })
    }

    const offsetResult = parseOffsetParam(searchParams.get('offset'))
    if ('error' in offsetResult) {
      return NextResponse.json({ error: offsetResult.error }, { status: 400 })
    }

    const advancedFiltersResult = parseAdvancedDeckFilters(searchParams)
    if ('error' in advancedFiltersResult) {
      return NextResponse.json({ error: advancedFiltersResult.error }, { status: 400 })
    }

    const { value: lang } = langResult
    const { value: limit } = limitResult
    const { value: offset } = offsetResult
    const { value: advancedFilters, hasAdvancedFilters } = advancedFiltersResult

    let deckIds: string[] | null = null
    if (identityId) {
      const { data: matches, error: matchesError } = await supabase
        .schema('limbus')
        .from('deck_identities')
        .select('deck_id')
        .eq('identity_id', identityId)

      if (matchesError) {
        return NextResponse.json({ error: matchesError.message }, { status: 500 })
      }

      if (!matches || matches.length === 0) {
        return NextResponse.json([])
      }

      deckIds = [...new Set(matches.map(m => m.deck_id))]
    }

    const buildQuery = (select: string, rangeStart?: number, rangeEnd?: number) => {
      let query = supabase
        .schema('limbus')
        .from('decks')
        .select(select)

      query = sort === 'popular'
        ? query
          .order('vote_count', { ascending: false })
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
        : query
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })

      if (deckIds) query = query.in('id', deckIds)
      if (lang !== 'all') query = query.eq('lang', lang)
      return typeof rangeStart === 'number' && typeof rangeEnd === 'number'
        ? query.range(rangeStart, rangeEnd)
        : query
    }

    const rangeStart = hasAdvancedFilters ? 0 : offset
    const rangeEnd = hasAdvancedFilters ? ADVANCED_FILTER_CANDIDATE_LIMIT - 1 : offset + limit - 1
    const needsIndex = hasAdvancedFilters && needsDeckFilterIndex(advancedFilters)
    const candidateSelect = needsIndex
      ? DECK_LIST_FILTER_SELECT_WITH_SKILL_KEYWORDS
      : hasAdvancedFilters
        ? DECK_LIST_FILTER_BASE_SELECT
        : DECK_LIST_SELECT_WITH_SKILL_KEYWORDS
    let { data, error } = await buildQuery(candidateSelect, rangeStart, rangeEnd)
    if (isMissingDeckKeywordColumnError(error)) {
      const legacySelect = needsIndex
        ? DECK_LIST_FILTER_SELECT_LEGACY
        : DECK_LIST_SELECT_LEGACY
      const legacyResult = await buildQuery(legacySelect, rangeStart, rangeEnd)
      data = legacyResult.data
      error = legacyResult.error
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = (data ?? []) as unknown as DeckListRow[]
    if (!hasAdvancedFilters) {
      return NextResponse.json(rows)
    }

    const pageIds = rows
      .filter(deck => deckMatchesAdvancedFilters(deck, advancedFilters))
      .slice(offset, offset + limit)
      .map(deck => deck.id)

    if (pageIds.length === 0) {
      return NextResponse.json([])
    }

    let fullResult = await buildQuery(DECK_LIST_SELECT_WITH_SKILL_KEYWORDS)
      .in('id', pageIds)
    if (isMissingDeckKeywordColumnError(fullResult.error)) {
      fullResult = await buildQuery(DECK_LIST_SELECT_LEGACY).in('id', pageIds)
    }

    if (fullResult.error) {
      return NextResponse.json({ error: fullResult.error.message }, { status: 500 })
    }

    const fullRows = (fullResult.data ?? []) as unknown as DeckListRow[]
    const fullRowsById = new Map(fullRows.map(deck => [deck.id, deck]))
    return NextResponse.json(pageIds.map(id => fullRowsById.get(id)).filter(Boolean))
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = createAdminClient()
    const resolved = await resolveAuthor(request, admin)
    if ('response' in resolved) return resolved.response
    const { author } = resolved
    const userId = author.kind === 'user' ? author.userId : null

    const rateLimit = checkRequestRateLimit(request, {
      bucket: 'create',
      scope: author.kind === 'guest' ? 'decks:create:guest' : 'decks:create',
      authenticatedKey: authorRateKey(author),
    })
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit)

    const body = await request.json()
    const { title, description, tags, identitySlots, egoSlots, content_type } = body
    const mainKeywordsResult = parseDeckMainKeywordsInput(body?.main_keywords)
    if ('error' in mainKeywordsResult) {
      return NextResponse.json({ error: mainKeywordsResult.error }, { status: 400 })
    }
    const lang = parseDeckMutationLang(body?.lang, body?.locale)
    // identitySlots: [{ identity_id, gacksung, slot_order }]
    // egoSlots: [{ ego_id, grade }]

    if (!title?.trim()) {
      return NextResponse.json({ error: '제목을 입력해주세요.' }, { status: 400 })
    }

    const { data: deck, error: deckError } = await admin
      .schema('limbus')
      .from('decks')
      .insert({
        ...authorColumns(author),
        title,
        description,
        tags: tags || [],
        main_keywords: mainKeywordsResult.value,
        content_type: content_type || '없음',
        lang,
      })
      .select()
      .single()

    if (deckError) {
      return NextResponse.json({ error: deckError.message }, { status: 500 })
    }

    if (identitySlots?.length > 0) {
      const rows = identitySlots.map((slot: { identity_id: string; gacksung: boolean; slot_order: number; s1_count?: number; s2_count?: number; s3_count?: number; uptie?: number }) => ({
        deck_id: deck.id,
        identity_id: slot.identity_id,
        slot_order: slot.slot_order,
        gacksung: normalizeUptie(slot.uptie) >= 3,
        s1_count: slot.s1_count ?? 3,
        s2_count: slot.s2_count ?? 2,
        s3_count: slot.s3_count ?? 1,
        uptie: normalizeUptie(slot.uptie),
      }))
      const { error: identityInsertError } = await insertDeckIdentities(next => admin.schema('limbus').from('deck_identities').insert(next), rows)
      if (identityInsertError) {
        // Rollback: delete the parent deck
        await admin.schema('limbus').from('decks').delete().eq('id', deck.id)
        return NextResponse.json({ error: identityInsertError.message }, { status: 500 })
      }
    }

    if (egoSlots?.length > 0) {
      const rows = egoSlots.map((slot: { ego_id: string; grade: string }) => ({
        deck_id: deck.id,
        ego_id: slot.ego_id,
        grade: slot.grade,
      }))
      const { error: egoInsertError } = await admin.schema('limbus').from('deck_egos').insert(rows)
      if (egoInsertError) {
        // Rollback: delete the parent deck (cascades to deck_identities)
        await admin.schema('limbus').from('decks').delete().eq('id', deck.id)
        return NextResponse.json({ error: egoInsertError.message }, { status: 500 })
      }
    }

    // Guests earn no activity points; their key is recorded instead (points follow when the deck moves to an account).
    const { error: activityError } = userId
      ? await admin.schema('limbus').rpc('community_record_deck', { p_deck_id: deck.id, p_user_id: userId })
      : { error: await recordGuestAuthorship(admin, author, 'deck', deck.id) }
    if (activityError) {
      await admin.schema('limbus').from('decks').delete().eq('id', deck.id)
      return NextResponse.json({ error: '덱을 저장하지 못했습니다. 다시 시도해주세요.' }, { status: 500 })
    }

    await writeAuditLog({
      actorId: userId,
      action: 'deck_create',
      targetType: 'deck',
      targetId: deck.id,
      details: {
        contentType: deck.content_type,
        tagCount: Array.isArray(deck.tags) ? deck.tags.length : 0,
        mainKeywordCount: mainKeywordsResult.value.length,
        identityCount: Array.isArray(identitySlots) ? identitySlots.length : 0,
        egoCount: Array.isArray(egoSlots) ? egoSlots.length : 0,
      },
    })

    // The board pages hold no list (the client loads it), so only the new deck's own page is revalidated here.
    for (const locale of ['ko', 'en', 'ja'] as const) revalidatePath(`/${locale}/decks/${deck.id}`)
    revalidateTag(CACHE_TAGS.deck(deck.id), 'max')
    revalidateTag(CACHE_TAGS.decksList, 'max')
    return NextResponse.json(deck, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
