import * as Sentry from '@sentry/nextjs'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { cacheLife, cacheTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { THEME_KEYWORDS, normalizeThemeKeyword } from '@/lib/constants/keywords'
import DeckDetailClient from './DeckDetailClient'
import DeckHero from '@/components/deck-detail/DeckHero'
import type { IdentitySlot, IdentityDetail } from '@/components/deck-detail/DeckIdentityCard'
import type { HeroSlot } from '@/components/deck-detail/DeckHero'
import type { DeckRecommendationSummary, DeckRecommendationsData } from '@/components/deck-detail/DeckRecommendations'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://saigo-no-dante.com'
const THEME_KEYWORD_SET = new Set<string>(THEME_KEYWORDS)
const MAX_OVERLAP_ROWS = 800
const MAX_CANDIDATE_DECKS = 96
const MAX_EXACT_OVERLAP_CANDIDATES = 128
const OTHER_OPINIONS_LIMIT = 3
const SIMILAR_DECKS_LIMIT = 6

function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString()
}

function isSupportedLang(lang: string): lang is 'ko' | 'en' | 'ja' {
  return lang === 'ko' || lang === 'en' || lang === 'ja'
}

function toSupportedLang(lang: string | null | undefined): 'ko' | 'en' | 'ja' | undefined {
  return lang && isSupportedLang(lang) ? lang : undefined
}

type Comment = {
  id: string
  content: string
  created_at: string
  user_id: string
  parent_id: string | null
  username: string | null
  avatar_url: string | null
  role?: string
}

type Props = { params: Promise<{ lang: string; id: string }> }

type EgoSlot = {
  grade: string
  ego: {
    id: string
    name?: string | null
    name_kr: string | null
    name_en?: string | null
    name_jp?: string | null
    grade: string
    sin_affinity: string | null
    sinner_id: string
    folder_name: string | null
    image_url: string | null
    cost: number[] | null
    ego_skills?: EgoAttackSkill[] | null
  } | null
}

type EgoAttackSkill = {
  skill_type: string | null
  category: string | null
  construe_level: number | null
  skill_order: number | null
}

type DeckRecommendationIdentity = {
  id: string
  sinner_id: string
  folder_name: string | null
  game_id: string | null
  keywords: string[] | null
  name: string | null
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
  content_type: string | null
  vote_count: number | null
  view_count: number | null
  comment_count: number | null
  created_at: string
  profiles: { username: string | null } | { username: string | null }[] | null
  deck_identities: Array<{
    slot_order: number | null
    gacksung: boolean | null
    identities: DeckRecommendationIdentity | DeckRecommendationIdentity[] | null
  }> | null
  deck_egos: Array<{ ego_id: string | null }> | null
}

type CurrentDeckForRecommendations = {
  id: string
  lang: string | null
  tags: string[] | null
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

const EMPTY_RECOMMENDATIONS: DeckRecommendationsData = {
  otherOpinions: [],
  similarDecks: [],
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
    deck_identities: (deck.deck_identities ?? []).map((slot) => ({
      slot_order: slot.slot_order ?? 99,
      gacksung: slot.gacksung ?? false,
      identities: unwrapOne(slot.identities),
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

function getSelectedEgoIds(deckEgos: Array<{ ego: { id?: string | null } | { id?: string | null }[] | null }> | null | undefined): string[] {
  const egoIds = new Set<string>()
  for (const row of deckEgos ?? []) {
    const ego = unwrapOne(row.ego)
    if (ego?.id) egoIds.add(ego.id)
  }
  return [...egoIds]
}

async function fetchEgoAttackSkillsByEgoId(
  supabase: ReturnType<typeof createAdminClient>,
  egoIds: string[],
  deckId: string,
): Promise<Map<string, EgoAttackSkill[]>> {
  const skillsByEgoId = new Map<string, EgoAttackSkill[]>()
  if (egoIds.length === 0) return skillsByEgoId

  const { data, error } = await supabase
    .schema('limbus')
    .from('ego_skills')
    .select('ego_id, skill_type, category, construe_level, skill_order')
    .in('ego_id', egoIds)

  if (error) {
    Sentry.captureException(error, {
      tags: { location: 'decks/[id]/page:fetchEgoAttackSkillsByEgoId' },
      extra: { deckId, msg: 'Failed to fetch selected E.G.O skill attack types' },
    })
    return skillsByEgoId
  }

  for (const row of data ?? []) {
    if (typeof row.ego_id !== 'string') continue
    const skill = {
      skill_type: row.skill_type ?? null,
      category: row.category ?? null,
      construe_level: row.construe_level ?? null,
      skill_order: row.skill_order ?? null,
    }
    const skills = skillsByEgoId.get(row.ego_id) ?? []
    skills.push(skill)
    skillsByEgoId.set(row.ego_id, skills)
  }

  return skillsByEgoId
}

async function fetchDeckRecommendations(
  supabase: ReturnType<typeof createAdminClient>,
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
        id, lang, title, description, tags, content_type, vote_count, view_count, comment_count, created_at,
        profiles!decks_user_id_fkey(username),
        deck_identities(
          slot_order, gacksung,
          identities(id, sinner_id, folder_name, game_id, keywords, name, name_kr, name_en, name_jp)
        ),
        deck_egos(ego_id)
      `)
      .in('id', candidateIdList)
      .eq('content_type', currentContentType)
      .eq('lang', lang)

    if (candidateError) throw candidateError

    const candidates = ((candidateRows ?? []) as unknown as RecommendationSourceDeck[])
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

async function getCachedDeckMetadata(lang: 'ko' | 'en' | 'ja', id: string): Promise<Metadata> {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.deck(id), CACHE_TAGS.decksList)

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .schema('limbus')
    .from('decks')
    .select('title, description, tags')
    .eq('id', id)
    .single()
  if (error) Sentry.captureException(error, { tags: { location: 'decks/[id]/page:generateMetadata' }, extra: { msg: 'Failed to fetch deck metadata' } })

  if (!data) {
    return { title: '덱을 찾을 수 없습니다' }
  }

  const title = data.title
  const description = data.description
    ? data.description.slice(0, 160)
    : `${data.title} — 림버스 컴퍼니 덱 빌드`
  const canonical = absoluteUrl(`/${lang}/decks/${id}`)
  const ogImage = absoluteUrl(`/${lang}/decks/${id}/opengraph-image`)

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${title} | 덱 게시판`,
      description,
      url: canonical,
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${title} | SAIGO NO DANTE` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | 덱 게시판`,
      description,
      images: [ogImage],
    },
  }
}

async function getCachedDeckDetailPayload(lang: 'ko' | 'en' | 'ja', id: string) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.deck(id), CACHE_TAGS.decksList)

  // Server-side prefetch: hero portrait strip + basic deck fields for LCP
  let initialDeck = null
  let initialComments: Comment[] = []
  let initialRecommendations: DeckRecommendationsData = EMPTY_RECOMMENDATIONS
  let heroSlots: (HeroSlot | null)[] = Array.from({ length: 12 }, () => null)

  try {
    const supabase = createAdminClient()

    const [deckResult, commentsResult] = await Promise.all([
      supabase
        .schema('limbus')
        .from('decks')
        .select(`
          id, lang, user_id, title, description, tags, content_type, vote_count, view_count, created_at,
          profiles!decks_user_id_fkey(username),
          deck_identities(
            slot_order, gacksung, s1_count, s2_count, s3_count,
            identities(
              id, sinner_id, folder_name, game_id, keywords, name, name_kr, name_en, name_jp, tier, rarity,
              hp, speed_min, speed_max, def_level, slash_res, pierce_res, blunt_res,
              skills(id, name, name_en, name_jp, skill_type, atk_type, sin_affinity, coins, base_power, coin_power, skill_order, variant_order, atk_weight, offense_level, description, description_en, description_jp, uptie_level),
              passives(name, name_en, name_jp, passive_type, sin_affinity, sin_count, active_cond, description, description_en, description_jp, passive_order, uptie_level)
            )
          ),
          deck_egos(
            grade,
            ego:ego_id(id, name, name_kr, name_en, name_jp, grade, sin_affinity, sinner_id, folder_name, image_url, cost)
          )
        `)
        .eq('id', id)
        .single(),
      supabase
        .schema('limbus')
        .from('deck_comments')
        .select('id, content, created_at, user_id, parent_id, profiles!deck_comments_user_id_fkey(username, avatar_url, role)')
        .eq('deck_id', id)
        .order('created_at', { ascending: true }),
    ])

    const data = deckResult.data
    if (deckResult.error) {
      Sentry.captureException(deckResult.error, {
        tags: { location: 'decks/[id]/page:DeckDetailPage' },
        extra: { deckId: id, msg: 'Failed to fetch deck detail prefetch' },
      })
    }
    if (commentsResult.error) {
      Sentry.captureException(commentsResult.error, {
        tags: { location: 'decks/[id]/page:DeckDetailPage' },
        extra: { deckId: id, msg: 'Failed to fetch deck comments prefetch' },
      })
    }
    if (data) {
      initialRecommendations = await fetchDeckRecommendations(
        supabase,
        lang,
        data as unknown as CurrentDeckForRecommendations
      )
      const egoSkillsByEgoId = await fetchEgoAttackSkillsByEgoId(
        supabase,
        getSelectedEgoIds(data.deck_egos as Array<{ ego: { id?: string | null } | { id?: string | null }[] | null }> | null),
        id,
      )

      const sortedIdentities = (data.deck_identities ?? [])
        .map((slot) => ({
          ...slot,
          identities: Array.isArray(slot.identities)
            ? ((slot.identities[0] as IdentityDetail | undefined) ?? null)
            : (slot.identities as unknown as IdentityDetail | null),
        })) as IdentitySlot[]

      sortedIdentities.sort((a, b) => {
        if (a.slot_order === 99 && b.slot_order !== 99) return 1
        if (b.slot_order === 99 && a.slot_order !== 99) return -1
        return a.slot_order - b.slot_order
      })

      // Build hero slots for server-side render
      heroSlots = Array.from({ length: 12 }, (_, i) => {
        const slot = sortedIdentities[i]
        if (!slot) return null
        const id_ = slot.identities
        return {
          slot_order: slot.slot_order,
          gacksung: slot.gacksung ?? null,
          identities: id_
            ? {
                sinner_id: id_.sinner_id,
                folder_name: id_.folder_name ?? null,
                game_id: id_.game_id ?? null,
                rarity: id_.rarity,
              }
            : null,
        } satisfies HeroSlot
      })

      initialDeck = {
        ...data,
        vote_count: data.vote_count ?? 0,
        view_count: data.view_count ?? 0,
        deck_identities: sortedIdentities,
        deck_egos: (data.deck_egos ?? []).map((es) => {
          const ego = Array.isArray(es.ego)
            ? ((es.ego[0] as EgoSlot['ego'] | undefined) ?? null)
            : (es.ego as EgoSlot['ego'])
          return {
            ...es,
            ego: ego ? { ...ego, ego_skills: egoSkillsByEgoId.get(ego.id) ?? [] } : null,
          }
        }) as EgoSlot[],
        profiles: Array.isArray(data.profiles) ? (data.profiles[0] ?? null) : data.profiles,
        all_sinner_egos: [],
        is_owner: false,
        is_admin: false,
        deck_code: undefined,
      } as any
    }

    if (commentsResult.data) {
      initialComments = commentsResult.data.map((row) => {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
        return {
          id: row.id,
          content: row.content,
          created_at: row.created_at,
          user_id: row.user_id,
          parent_id: row.parent_id,
          username: profile?.username ?? null,
          avatar_url: profile?.avatar_url ?? null,
          role: profile?.role ?? undefined,
        }
      })
    }
  } catch (error) {
    Sentry.captureException(error, {
      tags: { location: 'decks/[id]/page:DeckDetailPage' },
      extra: { deckId: id, msg: 'Deck detail server prefetch failed' },
    })
    // Fall back to client-side fetch
  }

  return {
    initialDeck,
    initialComments,
    initialRecommendations,
    heroSlots,
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang: rawLang, id } = await params
  const lang = isSupportedLang(rawLang) ? rawLang : 'ko'
  return getCachedDeckMetadata(lang, id)
}

export default async function DeckDetailPage({ params }: Props) {
  const { lang: rawLang, id } = await params
  const lang = isSupportedLang(rawLang) ? rawLang : 'ko'
  const {
    initialDeck,
    initialComments,
    initialRecommendations,
    heroSlots,
  } = await getCachedDeckDetailPayload(lang, id)

  return (
    <>
      <DeckHero slots={heroSlots} />
      <Suspense fallback={
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="animate-pulse" style={{ width: '100%', maxWidth: '64rem', margin: '0 auto', padding: '2rem 1.5rem' }}>
            <div style={{ background: '#1a1510', borderRadius: '0.5rem', height: '20rem', marginBottom: '1rem' }} />
            <div style={{ background: '#1a1510', borderRadius: '0.5rem', height: '10rem' }} />
          </div>
        </div>
      }>
        <DeckDetailClient
          id={id}
          initialDeck={initialDeck}
          initialComments={initialComments}
          initialRecommendations={initialRecommendations}
        />
      </Suspense>
    </>
  )
}
