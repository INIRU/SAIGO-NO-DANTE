import type { Metadata } from 'next'
import { Suspense } from 'react'
import { cacheLife } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { translations } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'
import KeywordsClient from './KeywordsClient'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = (key: string) => {
    const entry = translations[key as keyof typeof translations]
    if (!entry) return key
    return entry[lang as SupportedLang] ?? entry['ko'] ?? key
  }
  return {
    title: t('keyword.meta.title'),
    description: t('keyword.meta.description'),
    openGraph: {
      title: `${t('keyword.title')} | SAIGO NO DANTE`,
    },
  }
}


async function fetchAllKeywords(supabase: ReturnType<typeof createAdminClient>) {
  const all: any[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase.schema('limbus').from('keyword_meta')
      .select('name, description, max_stack, icon_slug, sin_affinity, category, name_en, name_jp, description_en, description_jp')
      .order('name')
      .range(from, from + 999)
    if (error || !data || data.length === 0) break
    all.push(...data)
    if (data.length < 1000) break
    from += 1000
  }
  return all
}

export default async function KeywordsPage() {
  'use cache'
  cacheLife('page-5m')
  const supabase = createAdminClient()

  const keywords = await fetchAllKeywords(supabase)

  const [
    { data: identities, error: identitiesError },
    { data: sinners, error: sinnersError },
    { data: gifts, error: giftsError },
    { data: egos, error: egosError },
  ] = await Promise.all([
    supabase.schema('limbus').from('identities')
      .select('id, name, name_kr, name_en, name_jp, sinner_id, keywords, rarity, game_id, folder_name')
      .order('name'),
    supabase.schema('limbus').from('sinners')
      .select('id, name_kr, name_en, name_jp'),
    supabase.schema('limbus').from('ego_gifts')
      .select('name, keyword, grade, image_url, effect_base, effect_plus, effect_plusplus')
      .order('name'),
    supabase.schema('limbus').from('ego')
      .select('id, name, name_kr, name_en, name_jp, sinner_id, grade, sin_affinity, keywords, folder_name, image_url')
      .order('name'),
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
    /* KeywordsClient uses nuqs (useSearchParams internally), requiring Suspense
       to prevent CSR bailout from de-opting the entire page to client rendering. */
    <Suspense fallback={null}>
      <KeywordsClient
        keywords={safeKeywords}
        identities={safeIdentities}
        sinners={sinners ?? []}
        gifts={safeGifts}
        egos={safeEgos}
      />
    </Suspense>
  )
}
