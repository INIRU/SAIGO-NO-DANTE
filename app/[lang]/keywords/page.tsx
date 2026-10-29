import type { Metadata } from 'next'
import { metaText, pageMetadata } from '@/lib/seo/metadata'
import { Suspense } from 'react'
import { cacheLife, cacheTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { getGameTextRefNames } from '@/lib/db/game-text-refs'
import { isMissingColumnError, keywordTextsFromRefs, loadKeywordRefTexts } from '@/lib/keywords/ref-text'
import KeywordsClient from './KeywordsClient'
import StaticQueryAdapter from '@/components/providers/StaticQueryAdapter'
import KeywordsLoading from './loading'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return pageMetadata({
    lang,
    path: '/keywords',
    title: metaText('keyword.meta.title', lang),
    description: metaText('keyword.meta.description', lang),
    ogTitle: `${metaText('keyword.title', lang)} | SAIGO NO DANTE`,
  })
}


const KEYWORD_COLUMNS = 'name, description, max_stack, icon_slug, sin_affinity, category, name_en, name_jp, description_en, description_jp'

/** keyword_meta rows with the names and descriptions of their game_text_refs row (keyword_meta's own where a row has no game_id). */
async function fetchAllKeywords(supabase: ReturnType<typeof createAdminClient>, withRefs: boolean) {
  // game_id first; a database without that column (migration not applied yet) answers with the plain columns.
  for (const select of [`${KEYWORD_COLUMNS}, game_id`, KEYWORD_COLUMNS]) {
    const all: any[] = []
    let from = 0
    let missingColumn = false
    while (true) {
      const { data, error } = await supabase.schema('limbus').from('keyword_meta')
        .select(select)
        .order('name')
        .range(from, from + 999)
      if (error && isMissingColumnError(error) && select !== KEYWORD_COLUMNS) { missingColumn = true; break }
      if (error || !data || data.length === 0) break
      all.push(...data)
      if (data.length < 1000) break
      from += 1000
    }
    if (missingColumn) continue
    const refs = withRefs && all.some(row => row.game_id) ? await loadKeywordRefTexts(supabase) : null
    // A failed read throws like the refs read below: the page is then built from keyword_meta and cached only briefly.
    if (withRefs && refs === null && all.some(row => row.game_id)) throw new Error('game_text_refs: keyword texts could not be read')
    return all.map(row => {
      const { game_id: _gameId, ...keyword } = keywordTextsFromRefs(row, refs)
      return keyword
    })
  }
  return []
}

/** Game id → keyword_meta name, for finding the gifts whose raw effect text names a keyword by [Id]. Throws when the table cannot be read or is still empty. */
async function getRefKeywords(): Promise<Record<string, string>> {
  const names = await getGameTextRefNames('ko')
  if (Object.keys(names).length === 0) throw new Error('game_text_refs is empty')
  return Object.fromEntries(Object.entries(names).flatMap(([id, ref]) => (ref.kw ? [[id, ref.kw]] : [])))
}

/**
 * The page, cached. With the reference table it is cached for good; a failed or empty table read throws before anything
 * is stored, and KeywordsPage then builds the page without the table for a minute only, so a failure is never kept.
 */
async function renderKeywords(withRefs: boolean) {
  'use cache'
  if (withRefs) cacheLife('max')
  else cacheLife('page-1m')
  cacheTag(CACHE_TAGS.keywords, CACHE_TAGS.gameData, CACHE_TAGS.gameTextRefs)
  const supabase = createAdminClient()

  const [keywords, refKeywords] = await Promise.all([fetchAllKeywords(supabase, withRefs), withRefs ? getRefKeywords() : {}])

  const [
    { data: identities, error: identitiesError },
    { data: sinners, error: sinnersError },
    { data: gifts, error: giftsError },
    { data: egos, error: egosError },
  ] = await Promise.all([
    supabase.schema('limbus').from('identities')
      .select('id, name_kr, name_en, name_jp, sinner_id, keywords, rarity, game_id, folder_name')
      .order('name_kr'),
    supabase.schema('limbus').from('sinners')
      .select('id, name_kr, name_en, name_jp'),
    supabase.schema('limbus').from('ego_gifts')
      .select('name, keyword, grade, image_url, effect_base, effect_plus, effect_plusplus')
      .order('name'),
    supabase.schema('limbus').from('ego')
      .select('id, name_kr, name_en, name_jp, sinner_id, grade, sin_affinity, keywords, folder_name, image_url')
      .order('name_kr'),
  ])

  if (identitiesError) console.error('Failed to fetch identities:', identitiesError)
  if (sinnersError) console.error('Failed to fetch sinners:', sinnersError)
  if (giftsError) console.error('Failed to fetch gifts:', giftsError)
  if (egosError) console.error('Failed to fetch egos:', egosError)

  const safeKeywords = keywords
  const safeIdentities = identities ?? []
  const safeGifts = gifts ?? []
  const safeEgos = egos ?? []

  /* ── 빈도 카운트 맵 (서버사이드) ── */
  const identityCountMap: Record<string, number> = {}
  safeIdentities.forEach(id => {
    (id.keywords ?? []).forEach((kw: string) => {
      identityCountMap[kw] = (identityCountMap[kw] || 0) + 1
    })
  })

  const egoCountMap: Record<string, number> = {}
  safeEgos.forEach(ego => {
    (ego.keywords ?? []).forEach((kw: string) => {
      egoCountMap[kw] = (egoCountMap[kw] || 0) + 1
    })
  })

  const giftCountMap: Record<string, number> = {}
  safeGifts.forEach(g => {
    giftCountMap[g.keyword] = (giftCountMap[g.keyword] || 0) + 1
  })

  return (
    /* Prerendered without filters; the URL's filters apply after hydration (StaticQueryAdapter). */
    <Suspense fallback={null}>
      <StaticQueryAdapter fallback={<KeywordsLoading />}>
        <KeywordsClient
          keywords={safeKeywords}
          identities={safeIdentities}
          sinners={sinners ?? []}
          gifts={safeGifts}
          egos={safeEgos}
          refKeywords={refKeywords}
        />
      </StaticQueryAdapter>
    </Suspense>
  )
}

export default async function KeywordsPage() {
  try {
    return await renderKeywords(true)
  } catch (error) {
    console.error('Failed to build the keywords page with game text refs:', error)
    return renderKeywords(false)
  }
}
