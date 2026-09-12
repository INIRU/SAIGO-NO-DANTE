import type { Metadata } from 'next'
import { cacheLife, cacheTag } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import BoardHeader from '@/components/discovery/BoardHeader'
import { createAdminClient } from '@/lib/supabase/admin'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import DecksClient from './DecksClient'
import DecksScrollLock from './DecksScrollLock'
import type { DeckSummary } from '@/components/decks/DeckCard'
import type { SupportedLang } from '@/lib/i18n/types'
import { normalizeDeckLanguageFilter, type DeckLanguageFilter } from '@/components/decks/decks-types'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'decks.meta' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: 'https://saigo-no-dante.com/decks' },
  }
}

const PAGE_SIZE = 12
const DECK_LIST_SELECT_WITH_SKILL_KEYWORDS = `
      id, user_id, title, description, tags, main_keywords, content_type, lang, vote_count, view_count, comment_count, created_at,
      profiles!decks_user_id_fkey(username),
      deck_identities(slot_order, gacksung, s1_count, s2_count, s3_count, identities(id, sinner_id, folder_name, game_id, keywords, skill_keyword_list, name_kr)),
      deck_egos(ego_id, grade)
    `
const DECK_LIST_SELECT_LEGACY = `
      id, user_id, title, description, tags, content_type, lang, vote_count, view_count, comment_count, created_at,
      profiles!decks_user_id_fkey(username),
      deck_identities(slot_order, gacksung, s1_count, s2_count, s3_count, identities(id, sinner_id, folder_name, game_id, keywords, name_kr)),
      deck_egos(ego_id, grade)
    `
type DeckSort = 'latest' | 'popular'
type DeckLangFilter = SupportedLang | 'all'

function isSupportedDeckLang(value: string | undefined): value is SupportedLang {
  return value === 'ko' || value === 'en' || value === 'ja'
}

function normalizeDeckSort(sort: string | string[] | undefined): DeckSort {
  const value = Array.isArray(sort) ? sort[0] : sort
  return value === 'popular' ? 'popular' : 'latest'
}

function normalizeDeckLangFilter(routeLang: string, queryLang: string | string[] | undefined): DeckLangFilter {
  const value = Array.isArray(queryLang) ? queryLang[0] : queryLang
  if (value === 'all') return 'all'
  if (isSupportedDeckLang(value)) return value
  if (isSupportedDeckLang(routeLang)) return routeLang
  return 'ko'
}

function normalizeDeckLangQuery(queryLang: string | string[] | undefined): DeckLanguageFilter {
  const value = Array.isArray(queryLang) ? queryLang[0] : queryLang
  return normalizeDeckLanguageFilter(value)
}

function isMissingDeckKeywordColumnError(error: { message?: string } | null) {
  return Boolean(
    error?.message?.includes('skill_keyword_list') ||
    error?.message?.includes('main_keywords')
  )
}

async function getCachedInitialDecks({
  initialSort,
  initialLang,
}: {
  initialSort: DeckSort
  initialLang: DeckLangFilter
}): Promise<DeckSummary[]> {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.decksList)
  const supabase = createAdminClient()

  const buildQuery = (select: string) => {
    let query = supabase
      .schema('limbus')
      .from('decks')
      .select(select)

    if (initialLang !== 'all') {
      query = query.eq('lang', initialLang)
    }

    query = initialSort === 'popular'
      ? query
          .order('vote_count', { ascending: false })
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
      : query
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })

    return query.range(0, PAGE_SIZE - 1)
  }

  let { data, error } = await buildQuery(DECK_LIST_SELECT_WITH_SKILL_KEYWORDS)
  if (isMissingDeckKeywordColumnError(error)) {
    const legacyResult = await buildQuery(DECK_LIST_SELECT_LEGACY)
    data = legacyResult.data
    error = legacyResult.error
  }

  if (error) {
    console.error('[DecksPage] initial fetch error:', error)
  }

  const rows = (data ?? []) as unknown as Array<DeckSummary & { profiles?: { username?: string } | { username?: string }[] | null }>

  return rows.map(d => {
    const profiles = d.profiles as { username?: string } | { username?: string }[] | null
    const username = Array.isArray(profiles)
      ? (profiles[0]?.username ?? undefined)
      : (profiles?.username ?? undefined)
    return { ...d, profiles: undefined, username } as unknown as DeckSummary
  })
}

export default async function DecksPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ sort?: string | string[]; lang?: string | string[] }>
}) {
  const [{ lang: routeLang }, { sort, lang }] = await Promise.all([params, searchParams])
  const initialSort = normalizeDeckSort(sort)
  const initialLang = normalizeDeckLangFilter(routeLang, lang)
  const initialLanguageFilter = normalizeDeckLangQuery(lang)
  const t = await getTranslations({ locale: routeLang, namespace: 'decks.header' })
  const headerCopy = {
    eyebrow: t('eyebrow'),
    title: t('title'),
    subtitle: t('subtitle'),
    newDeck: t('newDeck'),
  }
  const initialDecks = await getCachedInitialDecks({ initialSort, initialLang })

  return (
    <div className="community-board flex h-[100dvh] flex-col overflow-hidden" style={{ background: 'var(--bg-deep)' }}>
      <DecksScrollLock />
      <BoardHeader kind="deck" lang={routeLang} title={headerCopy.title} subtitle={headerCopy.subtitle} eyebrow={headerCopy.eyebrow} action={headerCopy.newDeck} />
      {/* The route loading boundary already covers the request-bound query state. */}
      <DecksClient initialDecks={initialDecks} initialTotal={initialDecks.length} initialSort={initialSort} initialLanguageFilter={initialLanguageFilter} />
    </div>
  )
}
