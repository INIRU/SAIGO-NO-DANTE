import { notePlainText } from '@/lib/notes/blocks'
import * as Sentry from '@sentry/nextjs'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import { localeUrl, pageMetadata } from '@/lib/seo/metadata'
import { translations } from '@/lib/i18n/translations'
import JsonLd, { breadcrumbJsonLd } from '@/components/seo/JsonLd'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { cacheLife, cacheTag } from 'next/cache'
import type { DeckRecommendationsData } from '@/features/decks/components/DeckRecommendations'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import DeckDetailClient from './DeckDetailClient'
import DeckDetailSkeleton from '@/app/[lang]/decks/[id]/_components/DeckDetailSkeleton'
import { isAwakenedUptie, trimDeckIdentity } from '@/features/decks'
import { withPostAuthors, loadSeriesOfPost } from '@/features/community/server'
import { EMPTY_RECOMMENDATIONS, fetchDeckRecommendations, fetchEgoAttackSkillsByEgoId, getSelectedEgoIds, type CurrentDeckForRecommendations, type EgoAttackSkill } from '@/features/decks/server'
import type { SeriesView } from '@/features/community'
import type { IdentitySlot, IdentityDetail } from '@/lib/decks/identity-types'
import type { DeckDetail } from '@/features/decks/hooks/useDeckDetailData'
import CoVisitedLane from '@/features/community/components/CoVisitedLane'
import { RecommendationLaneSkeleton } from '@/features/decks/components/RecommendationSkeleton'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://saigo-no-dante.com'

function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString()
}

function createDeckReadClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function isSupportedLang(lang: string): lang is 'ko' | 'en' | 'ja' {
  return lang === 'ko' || lang === 'en' || lang === 'ja'
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

// What the page shows when the cached read throws: the client then fetches the deck itself.
const EMPTY_PAYLOAD = {
  initialDeck: null,
  initialComments: [] as Comment[],
  initialRecommendations: EMPTY_RECOMMENDATIONS,
  initialSeries: null as SeriesView | null,
}

async function getCachedDeckMetadata(lang: 'ko' | 'en' | 'ja', id: string): Promise<Metadata> {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.deck(id))

  const supabase = createDeckReadClient()
  const { data, error } = await supabase
    .schema('limbus')
    .from('decks')
    .select('title, description, tags')
    .eq('id', id)
    // A deleted deck is a "not found" page, not an error.
    .maybeSingle()
  if (error) Sentry.captureException(error, { tags: { location: 'decks/[id]/page:generateMetadata' }, extra: { msg: 'Failed to fetch deck metadata' } })

  if (!data) {
    // The page still answers 200 (the shell is already sent), so the "not found" screen must stay out of the index.
    return { title: { ko: '덱을 찾을 수 없습니다', en: 'Deck not found', ja: 'デッキが見つかりません' }[lang], robots: { index: false } }
  }

  const title = data.title
  const description = data.description
    ? notePlainText(data.description).replace(/\s+/g, ' ').trim().slice(0, 160)
    : `${data.title} — ${{ ko: '림버스 컴퍼니 덱 빌드', en: 'Limbus Company deck build', ja: 'リンバスカンパニー デッキ構築' }[lang]}`
  const boardName = { ko: '덱 게시판', en: 'Deck Board', ja: 'デッキ掲示板' }[lang]

  return pageMetadata({
    lang,
    path: `/decks/${id}`,
    // The author's title alone says nothing about the game in a search result.
    title: `${title} — ${{ ko: '림버스 컴퍼니 덱', en: 'Limbus Company Deck', ja: 'リンバスカンパニー デッキ' }[lang]}`,
    description,
    ogTitle: `${title} | ${boardName}`,
    image: { url: absoluteUrl(`/${lang}/decks/${id}/opengraph-image`), width: 1200, height: 630, alt: `${title} | SAIGO NO DANTE` },
  })
}

async function getCachedDeckDetailPayload(lang: 'ko' | 'en' | 'ja', id: string) {
  'use cache'
  // The deck's own edits, votes and comments revalidate its tag; the other decks it recommends refresh within the hour.
  cacheLife('page-1h')
  cacheTag(CACHE_TAGS.deck(id))

  // Server-side prefetch: hero portrait strip + basic deck fields for LCP. A failed read throws so that it is not cached
  // as an empty page; the caller catches it outside the cache and the client fetches instead.
  let initialDeck: DeckDetail | null = null
  let initialComments: Comment[] = []
  let initialRecommendations: DeckRecommendationsData = EMPTY_RECOMMENDATIONS
  let initialSeries: SeriesView | null = null

  const supabase = createDeckReadClient()

  const [deckResult, commentsResult] = await Promise.all([
    supabase
      .schema('limbus')
      .from('decks')
      .select(`
        id, lang, user_id, title, description, tags, main_keywords, content_type, vote_count, view_count, created_at,
        guest_tag, profiles!decks_user_id_fkey(username),
        deck_identities(
          slot_order, gacksung, uptie, s1_count, s2_count, s3_count,
          identities(
            id, sinner_id, folder_name, game_id, keywords, skill_keyword_list, affiliation, association_list, name_kr, name_en, name_jp, tier, rarity,
            hp, base_hp, hp_per_level, speed_min, speed_max, def_level, slash_res, pierce_res, blunt_res,
            skills(id, image_id, name, name_en, name_jp, skill_type, atk_type, sin_affinity, coins, base_power, coin_power, coin_list, skill_order, variant_order, atk_weight, offense_level, description, description_en, description_jp, uptie_level),
            passives(name, name_en, name_jp, passive_type, sin_affinity, sin_count, sin_requirements, active_cond, description, description_en, description_jp, passive_order, uptie_level)
          )
        ),
        deck_egos(
          grade,
          ego:ego_id(id, name_kr, name_en, name_jp, grade, sin_affinity, sinner_id, folder_name, image_url, cost)
        )
      `)
      .eq('id', id)
      .maybeSingle(),
    supabase
      .schema('limbus')
      .from('deck_comments')
      .select('id, content, created_at, user_id, parent_id, profiles!deck_comments_user_id_fkey(username, avatar_url, role)')
      .eq('deck_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (deckResult.error) throw deckResult.error
  if (commentsResult.error) throw commentsResult.error
  const data = deckResult.data
  if (data) {
    // Four reads that need only the deck, together (they waited for each other: four round trips → one). A series that
    // fails to load leaves the deck shown; any other failure falls back to the client fetch, as before.
    const [series, recommendations, egoSkillsByEgoId, [author]] = await Promise.all([
      loadSeriesOfPost(supabase, 'deck', id).catch(() => null),
      fetchDeckRecommendations(supabase, lang, data as unknown as CurrentDeckForRecommendations),
      fetchEgoAttackSkillsByEgoId(
        supabase,
        getSelectedEgoIds(data.deck_egos as Array<{ ego: { id?: string | null } | { id?: string | null }[] | null }> | null),
      ),
      withPostAuthors([data]),
    ])
    initialSeries = series
    // A series change revalidates its own tag (and the tag of each post it adds or drops), as does a member's new title.
    if (initialSeries) cacheTag(CACHE_TAGS.series(initialSeries.id))
    initialRecommendations = recommendations

    const sortedIdentities = (data.deck_identities ?? [])
      .map((slot) => ({
        ...slot,
        // Art follows uptie (III–IV awakened).
        gacksung: isAwakenedUptie(slot.uptie),
        identities: (() => {
          const identity = Array.isArray(slot.identities)
            ? ((slot.identities[0] as IdentityDetail | undefined) ?? null)
            : (slot.identities as unknown as IdentityDetail | null)
          // Only the skill/passive rows and the language this page renders go to the browser.
          return identity ? trimDeckIdentity(identity, slot.uptie ?? 4, lang) : null
        })(),
      })) as IdentitySlot[]

    sortedIdentities.sort((a, b) => {
      if (a.slot_order === 99 && b.slot_order !== 99) return 1
      if (b.slot_order === 99 && a.slot_order !== 99) return -1
      return a.slot_order - b.slot_order
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
      // withPostAuthors puts the author object here; the select's join type still says array.
      profiles: author.profiles as unknown as DeckDetail['profiles'],
      all_sinner_egos: [],
      is_owner: false,
      is_admin: false,
      deck_code: undefined,
    } as DeckDetail
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
  return {
    initialDeck,
    initialComments,
    initialRecommendations,
    initialSeries,
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await connection()
  const { lang: rawLang, id } = await params
  const lang = isSupportedLang(rawLang) ? rawLang : 'ko'
  return getCachedDeckMetadata(lang, id)
}

async function DeckDetailRuntime({ params }: Props) {
  await connection()
  const { lang: rawLang, id } = await params
  const lang = isSupportedLang(rawLang) ? rawLang : 'ko'
  const {
    initialDeck,
    initialComments,
    initialRecommendations,
    initialSeries,
  } = await getCachedDeckDetailPayload(lang, id).catch((error) => {
    Sentry.captureException(error, {
      tags: { location: 'decks/[id]/page:DeckDetailPage' },
      extra: { deckId: id, msg: 'Deck detail server prefetch failed' },
    })
    // Fall back to client-side fetch
    return EMPTY_PAYLOAD
  })

  return (
    <>
      {initialDeck && (
        <JsonLd data={breadcrumbJsonLd([
          { name: translations['nav.home'][lang], url: localeUrl(lang) },
          { name: translations['nav.decks'][lang], url: localeUrl(lang, '/decks') },
          { name: initialDeck.title, url: localeUrl(lang, `/decks/${id}`) },
        ])} />
      )}
      <Suspense fallback={<DeckDetailSkeleton />}>
        <DeckDetailClient
          id={id}
          initialDeck={initialDeck}
          initialComments={initialComments}
          initialRecommendations={initialRecommendations}
          initialSeries={initialSeries}
          coVisited={initialDeck && <Suspense fallback={<RecommendationLaneSkeleton kind="deck" />}><CoVisitedLane kind="deck" id={id} lang={lang} exclude={[...initialRecommendations.otherOpinions, ...initialRecommendations.similarDecks].map(deck => deck.id)} /></Suspense>}
        />
      </Suspense>
    </>
  )
}

export default function DeckDetailPage({ params }: Props) {
  return (
    <Suspense fallback={<DeckDetailSkeleton />}>
      <DeckDetailRuntime params={params} />
    </Suspense>
  )
}
