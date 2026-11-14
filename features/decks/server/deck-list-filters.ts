import { notePlainText } from '@/lib/notes/blocks'
import { parseCsvParam } from '../lib/filter-params'
import { parseSearchQuery, type ParsedSearch } from '@/lib/utils/search'
import { THEME_KEYWORDS, normalizeThemeKeyword } from '@/lib/constants/keywords'
import {
  DECK_MAIN_KEYWORDS,
  computeDeckMainKeywordsFromSlots,
} from '@/lib/decks/keyword-rules'

export const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50
export const ADVANCED_FILTER_CANDIDATE_LIMIT = 1000
const SUPPORTED_DECK_LANGS = ['ko', 'en', 'ja'] as const
const MODE_VALUES = ['or', 'and'] as const
const PINNED_DECK_KEYWORD_SET = new Set<string>(DECK_MAIN_KEYWORDS)
const THEME_KEYWORD_SET = new Set<string>(THEME_KEYWORDS)
export const DECK_LIST_FILTER_BASE_SELECT = `
        id, user_id, title, description, tags, main_keywords, content_type, lang, vote_count, view_count, comment_count, created_at,
        guest_tag, profiles!decks_user_id_fkey(username)
      `
export const DECK_LIST_FILTER_SELECT_WITH_SKILL_KEYWORDS = `
        id, user_id, title, description, tags, main_keywords, content_type, lang, vote_count, view_count, comment_count, created_at,
        guest_tag, profiles!decks_user_id_fkey(username),
        deck_identities(slot_order, identities(id, keywords, skill_keyword_list, skills(atk_type, skill_type))),
        deck_egos(grade)
      `
export const DECK_LIST_FILTER_SELECT_LEGACY = `
        id, user_id, title, description, tags, content_type, lang, vote_count, view_count, comment_count, created_at,
        guest_tag, profiles!decks_user_id_fkey(username),
        deck_identities(slot_order, identities(id, keywords)),
        deck_egos(grade)
      `
export const DECK_LIST_SELECT_WITH_SKILL_KEYWORDS = `
        id, user_id, title, description, tags, main_keywords, content_type, lang, vote_count, view_count, comment_count, created_at,
        guest_tag, profiles!decks_user_id_fkey(username),
        deck_identities(slot_order, gacksung, s1_count, s2_count, s3_count, identities(id, sinner_id, folder_name, game_id, keywords, skill_keyword_list, name_kr)),
        deck_egos(ego_id, grade)
      `
export const DECK_LIST_SELECT_LEGACY = `
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
export type DeckListRow = {
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

export function parseDeckLangFilter(value: string | null): { value: DeckLangFilter } | { error: string } {
  if (value === null || value === 'all') return { value: 'all' }
  if (isDeckLang(value)) return { value }
  return { error: 'lang must be one of ko, en, ja, all' }
}

export function parseDeckMutationLang(...values: unknown[]): DeckLang {
  return values.find(isDeckLang) ?? 'ko'
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

export function parseAdvancedDeckFilters(searchParams: URLSearchParams): { value: AdvancedDeckFilters; hasAdvancedFilters: boolean } | { error: string } {
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

export function parsePositiveIntegerParam(value: string | null, fallback: number, name: string) {
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

export function parseOffsetParam(value: string | null) {
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

export function isMissingDeckKeywordColumnError(error: { message?: string } | null) {
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

export function needsDeckFilterIndex(filters: AdvancedDeckFilters) {
  return filters.mainKeywords.length > 0 ||
    filters.keywordTags.length > 0 ||
    filters.formationCount !== null ||
    filters.minInfoScore !== null ||
    filters.identityIds.length > 0
}

export function deckMatchesAdvancedFilters(deck: DeckListRow, filters: AdvancedDeckFilters) {
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

/**
 * Decks are public to everyone, so a list answer does not depend on who asks. Without a session cookie the CDN may keep
 * it for 30 seconds (and refresh it in the background). A request that carries a session cookie keeps the old no-header answer.
 */
