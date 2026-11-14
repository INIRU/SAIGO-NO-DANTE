import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { THEME_KEYWORDS, normalizeThemeKeyword } from '@/lib/constants/keywords'
import { withPostAuthors } from '@/lib/server/post-authors'
import type { DeckRecommendationSummary, DeckRecommendationsData } from '@/features/decks/components/DeckRecommendations'

const THEME_KEYWORD_SET = new Set<string>(THEME_KEYWORDS)
const MAX_OVERLAP_ROWS = 800
const MAX_CANDIDATE_DECKS = 96
const MAX_EXACT_OVERLAP_CANDIDATES = 128
const OTHER_OPINIONS_LIMIT = 3
const SIMILAR_DECKS_LIMIT = 6

type DeckRecommendationIdentity = {
  id: string
  sinner_id: string
  folder_name: string | null
  game_id: string | null
  keywords: string[] | null
  skill_keyword_list?: string[] | null
  name_kr: string | null
  name_en: string | null
  name_jp: string | null
}

type DeckRecommendationIdentitySlot = {
  slot_order: number
  gacksung: boolean
  identities: DeckRecommendationIdentity | null
}

type RecommendationSourceDeck = {
  id: string
  lang: string | null
  title: string
  description: string | null
  tags: string[] | null
  main_keywords?: string[] | null
  content_type: string | null
  vote_count: number | null
  view_count: number | null
  comment_count: number | null
  created_at: string
  user_id?: string | null
  profiles: { username: string | null } | { username: string | null }[] | null
  guest_tag?: string | null
  deck_identities: Array<{
    slot_order: number | null
    gacksung: boolean | null
    identities: DeckRecommendationIdentity | DeckRecommendationIdentity[] | null
  }> | null
  deck_egos: Array<{ ego_id: string | null }> | null
}

export type CurrentDeckForRecommendations = {
  id: string
  lang: string | null
  tags: string[] | null
  main_keywords?: string[] | null
  content_type: string | null
  deck_identities: Array<{
    slot_order: number | null
    identities: { id: string; keywords: string[] | null } | Array<{ id: string; keywords: string[] | null }> | null
  }> | null
  deck_egos: Array<{
    ego?: { id: string } | { id: string }[] | null
    ego_id?: string | null
  }> | null
}

type RecommendationCandidate = {
  deck: DeckRecommendationSummary
  identityIds: Set<string>
  identitySignature: string
  formationSignature: string
  egoSignature: string
  themeKeywords: Set<string>
  egoIds: Set<string>
}

export const EMPTY_RECOMMENDATIONS: DeckRecommendationsData = {
  otherOpinions: [],
  similarDecks: [],
}

function isSupportedLang(lang: string): lang is 'ko' | 'en' | 'ja' {
  return lang === 'ko' || lang === 'en' || lang === 'ja'
}

function toSupportedLang(lang: string | null | undefined): 'ko' | 'en' | 'ja' | undefined {
  return lang && isSupportedLang(lang) ? lang : undefined
}

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
}

function toSortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort()
}

function buildIdentityIdSet(slots: CurrentDeckForRecommendations['deck_identities'] | DeckRecommendationIdentitySlot[] | null | undefined): Set<string> {
  const ids = new Set<string>()
  for (const slot of slots ?? []) {
    const identity = unwrapOne(slot.identities)
    if (identity?.id) ids.add(identity.id)
  }
  return ids
}

function buildIdentitySetSignature(identityIds: Set<string>): string {
  return toSortedUnique([...identityIds]).join('|')
}

function buildFormationSignature(slots: CurrentDeckForRecommendations['deck_identities'] | DeckRecommendationIdentitySlot[] | null | undefined): string {
  const parts: string[] = []
  for (const slot of slots ?? []) {
    const identity = unwrapOne(slot.identities)
    if (!identity?.id) continue
    parts.push(`${identity.id}:${slot.slot_order ?? 99}`)
  }
  return parts.sort().join('|')
}

function buildEgoSignature(egos: CurrentDeckForRecommendations['deck_egos'] | Array<{ ego_id: string }> | null | undefined): string {
  const egoIds: string[] = []
  for (const row of egos ?? []) {
    if ('ego_id' in row && row.ego_id) {
      egoIds.push(row.ego_id)
      continue
    }
    if ('ego' in row) {
      const ego = unwrapOne(row.ego)
      if (ego?.id) egoIds.push(ego.id)
    }
  }
  return toSortedUnique(egoIds).join('|')
}

function buildThemeKeywordSet(slots: CurrentDeckForRecommendations['deck_identities'] | DeckRecommendationIdentitySlot[] | null | undefined): Set<string> {
  const keywords = new Set<string>()
  for (const slot of slots ?? []) {
    const identity = unwrapOne(slot.identities)
    for (const keyword of identity?.keywords ?? []) {
      const normalized = normalizeThemeKeyword(keyword)
      if (THEME_KEYWORD_SET.has(normalized)) keywords.add(normalized)
    }
  }
  return keywords
}

function intersectionSize<T>(left: Set<T>, right: Set<T>): number {
  let count = 0
  for (const item of left) {
    if (right.has(item)) count++
  }
  return count
}

function recencyBoost(createdAt: string): number {
  const createdMs = Date.parse(createdAt)
  if (!Number.isFinite(createdMs)) return 0
  const ageDays = Math.max(0, (Date.now() - createdMs) / 86_400_000)
  return Math.max(0, 30 - ageDays) / 30
}

function getUsername(profiles: RecommendationSourceDeck['profiles']): string | undefined {
  return unwrapOne(profiles)?.username ?? undefined
}

/** DeckCard reads only these identity fields; the candidate query also loads affiliation/association lists. */
function pickRecommendationIdentity(identity: DeckRecommendationIdentity | null): DeckRecommendationIdentity | null {
  if (!identity) return null
  const { id, sinner_id, folder_name, game_id, keywords, skill_keyword_list, name_kr, name_en, name_jp } = identity
  return { id, sinner_id, folder_name, game_id, keywords, skill_keyword_list, name_kr, name_en, name_jp }
}

function toRecommendationSummary(deck: RecommendationSourceDeck): DeckRecommendationSummary {
  return {
    id: deck.id,
    lang: toSupportedLang(deck.lang),
    title: deck.title,
    description: deck.description,
    tags: deck.tags ?? [],
    content_type: deck.content_type ?? undefined,
    vote_count: deck.vote_count ?? 0,
    view_count: deck.view_count ?? 0,
    comment_count: deck.comment_count ?? 0,
    created_at: deck.created_at,
    username: getUsername(deck.profiles),
    guest_tag: deck.guest_tag ?? null,
    deck_identities: (deck.deck_identities ?? []).map((slot) => ({
      slot_order: slot.slot_order ?? 99,
      gacksung: slot.gacksung ?? false,
      identities: pickRecommendationIdentity(unwrapOne(slot.identities)),
    })),
    deck_egos: (deck.deck_egos ?? [])
      .filter((ego): ego is { ego_id: string } => typeof ego.ego_id === 'string')
      .map((ego) => ({ ego_id: ego.ego_id })),
  }
}

function toRecommendationCandidate(deck: RecommendationSourceDeck): RecommendationCandidate | null {
  const summary = toRecommendationSummary(deck)
  const identityIds = buildIdentityIdSet(summary.deck_identities)
  return {
    deck: summary,
    identityIds,
    identitySignature: buildIdentitySetSignature(identityIds),
    formationSignature: buildFormationSignature(summary.deck_identities),
    egoSignature: buildEgoSignature(summary.deck_egos),
    themeKeywords: buildThemeKeywordSet(summary.deck_identities),
    egoIds: new Set((summary.deck_egos ?? []).map((ego) => ego.ego_id)),
  }
}

function scoreRecommendationCandidate(
  candidate: RecommendationCandidate,
  currentIdentityIds: Set<string>,
  currentThemeKeywords: Set<string>,
  currentEgoIds: Set<string>,
) {
  const identityOverlap = intersectionSize(currentIdentityIds, candidate.identityIds)
  const keywordOverlap = intersectionSize(currentThemeKeywords, candidate.themeKeywords)
  const egoOverlap = intersectionSize(currentEgoIds, candidate.egoIds)
  const score =
    identityOverlap * 100 +
    keywordOverlap * 24 +
    egoOverlap * 8 +
    Math.min(candidate.deck.vote_count, 50) * 0.2 +
    recencyBoost(candidate.deck.created_at) * 4

  return { score, identityOverlap, keywordOverlap }
}

function getRecommendationContentType(contentType: string | null | undefined): string | null {
  const normalized = contentType?.trim()
  return normalized && normalized !== '없음' ? normalized : null
}

export function getSelectedEgoIds(deckEgos: Array<{ ego: { id?: string | null } | { id?: string | null }[] | null }> | null | undefined): string[] {
  const egoIds = new Set<string>()
  for (const row of deckEgos ?? []) {
    const ego = unwrapOne(row.ego)
    if (ego?.id) egoIds.add(ego.id)
  }
  return [...egoIds]
}

export async function fetchDeckRecommendations(
  supabase: SupabaseClient,
  lang: 'ko' | 'en' | 'ja',
  currentDeck: CurrentDeckForRecommendations
): Promise<DeckRecommendationsData> {
  const currentContentType = getRecommendationContentType(currentDeck.content_type)
  if (!currentContentType) return EMPTY_RECOMMENDATIONS

  const currentIdentityIds = buildIdentityIdSet(currentDeck.deck_identities)
  if (currentIdentityIds.size === 0) return EMPTY_RECOMMENDATIONS

  try {
    const currentIdentitySignature = buildIdentitySetSignature(currentIdentityIds)
    const currentFormationSignature = buildFormationSignature(currentDeck.deck_identities)
    const currentEgoSignature = buildEgoSignature(currentDeck.deck_egos)
    const currentThemeKeywords = buildThemeKeywordSet(currentDeck.deck_identities)
    const currentEgoIds = new Set(currentEgoSignature ? currentEgoSignature.split('|') : [])

    const { data: overlapRows, error: overlapError } = await supabase
      .schema('limbus')
      .from('deck_identities')
      .select('deck_id, identity_id, decks!inner(content_type, lang)')
      .in('identity_id', [...currentIdentityIds])
      .eq('decks.content_type', currentContentType)
      .eq('decks.lang', lang)
      .neq('deck_id', currentDeck.id)
      .limit(MAX_OVERLAP_ROWS)

    if (overlapError) throw overlapError

    const overlapByDeck = new Map<string, Set<string>>()
    for (const row of overlapRows ?? []) {
      if (typeof row.deck_id !== 'string' || typeof row.identity_id !== 'string') continue
      const identityIds = overlapByDeck.get(row.deck_id) ?? new Set<string>()
      identityIds.add(row.identity_id)
      overlapByDeck.set(row.deck_id, identityIds)
    }

    const overlapEntries = [...overlapByDeck.entries()]
      .map(([deckId, identityIds]) => ({ deckId, overlapCount: identityIds.size }))
      .sort((a, b) => b.overlapCount - a.overlapCount || a.deckId.localeCompare(b.deckId))

    const exactOverlapCandidateIds = overlapEntries
      .filter(({ overlapCount }) => overlapCount === currentIdentityIds.size)
      .slice(0, MAX_EXACT_OVERLAP_CANDIDATES)
      .map(({ deckId }) => deckId)

    const candidateIds = new Set<string>()
    for (const deckId of exactOverlapCandidateIds) {
      candidateIds.add(deckId)
    }

    const maxCandidateCount = Math.max(MAX_CANDIDATE_DECKS, exactOverlapCandidateIds.length)
    const addCandidateId = (deckId: string): void => {
      if (candidateIds.has(deckId) || candidateIds.size < maxCandidateCount) {
        candidateIds.add(deckId)
      }
    }

    for (const { deckId } of overlapEntries) {
      addCandidateId(deckId)
    }

    const { data: sameTypeRows, error: sameTypeError } = await supabase
      .schema('limbus')
      .from('decks')
      .select('id')
      .eq('content_type', currentContentType)
      .eq('lang', lang)
      .neq('id', currentDeck.id)
      .order('vote_count', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(32)

    if (sameTypeError) throw sameTypeError
    for (const row of sameTypeRows ?? []) {
      if (typeof row.id === 'string') addCandidateId(row.id)
    }

    const currentTags = (currentDeck.tags ?? []).filter(Boolean)
    if (currentTags.length > 0) {
      const { data: tagRows, error: tagError } = await supabase
        .schema('limbus')
        .from('decks')
        .select('id')
        .overlaps('tags', currentTags)
        .eq('content_type', currentContentType)
        .eq('lang', lang)
        .neq('id', currentDeck.id)
        .order('vote_count', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(32)

      if (tagError) throw tagError
      for (const row of tagRows ?? []) {
        if (typeof row.id === 'string') addCandidateId(row.id)
      }
    }

    const candidateIdList = [...candidateIds]
    if (candidateIdList.length === 0) return EMPTY_RECOMMENDATIONS

    const { data: candidateRows, error: candidateError } = await supabase
      .schema('limbus')
      .from('decks')
      .select(`
        id, lang, user_id, title, description, tags, main_keywords, content_type, vote_count, view_count, comment_count, created_at,
        guest_tag, profiles!decks_user_id_fkey(username),
        deck_identities(
          slot_order, gacksung, uptie,
          identities(id, sinner_id, folder_name, game_id, keywords, skill_keyword_list, affiliation, association_list, name_kr, name_en, name_jp)
        ),
        deck_egos(ego_id)
      `)
      .in('id', candidateIdList)
      .eq('content_type', currentContentType)
      .eq('lang', lang)

    if (candidateError) throw candidateError

    const candidates = (await withPostAuthors((candidateRows ?? []) as unknown as RecommendationSourceDeck[]))
      .map(toRecommendationCandidate)
      .filter((candidate): candidate is RecommendationCandidate => {
        if (!candidate) return false
        return (
          candidate.deck.lang === lang &&
          getRecommendationContentType(candidate.deck.content_type) === currentContentType
        )
      })
    const otherOpinions = candidates
      .filter((candidate) => {
        if (candidate.identitySignature !== currentIdentitySignature) return false
        const formationChanged = candidate.formationSignature !== currentFormationSignature
        const egoChanged = candidate.egoSignature !== currentEgoSignature
        return formationChanged || egoChanged
      })
      .sort((a, b) => b.deck.vote_count - a.deck.vote_count || Date.parse(b.deck.created_at) - Date.parse(a.deck.created_at))
      .slice(0, OTHER_OPINIONS_LIMIT)
      .map(({ deck }) => deck)

    const otherOpinionIds = new Set(otherOpinions.map((deck) => deck.id))

    const similarDecks = candidates
      .filter((candidate) => !otherOpinionIds.has(candidate.deck.id))
      .map((candidate) => {
        const { score, identityOverlap, keywordOverlap } = scoreRecommendationCandidate(
          candidate,
          currentIdentityIds,
          currentThemeKeywords,
          currentEgoIds,
        )

        return {
          deck: candidate.deck,
          score,
          identityOverlap,
          keywordOverlap,
        }
      })
      .filter(({ identityOverlap, keywordOverlap }) => identityOverlap > 0 || keywordOverlap > 0)
      .sort((a, b) => b.score - a.score || b.deck.vote_count - a.deck.vote_count || Date.parse(b.deck.created_at) - Date.parse(a.deck.created_at))
      .slice(0, SIMILAR_DECKS_LIMIT)
      .map(({ deck }) => deck)

    return { otherOpinions, similarDecks }
  } catch (error) {
    Sentry.captureException(error, {
      tags: { location: 'decks/[id]/page:fetchDeckRecommendations' },
      extra: { deckId: currentDeck.id, msg: 'Failed to fetch deck recommendations' },
    })
    return EMPTY_RECOMMENDATIONS
  }
}

