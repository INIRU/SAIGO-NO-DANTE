import * as Sentry from '@sentry/nextjs'
import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'
import { SINNER_SLUGS } from '@/lib/constants/game'
import { PRIMARY_LOCALE, localeLanguages, localeUrl } from '@/lib/seo/metadata'

type Entry = MetadataRoute.Sitemap[number]
type Row = { id: string; sinner_id?: string; release_date?: string | null; updated_at?: string | null }

/** One entry per page: the /ko URL (primary audience) with en/ja/x-default as hreflang alternates. */
function entry(path: string, lastModified: string | null | undefined, changeFrequency: Entry['changeFrequency'], priority: number): Entry {
  return {
    url: localeUrl(PRIMARY_LOCALE, path),
    ...(lastModified ? { lastModified: new Date(lastModified) } : {}),
    changeFrequency,
    priority,
    alternates: { languages: localeLanguages(path) },
  }
}

/** Latest date among rows (ISO dates compare lexically); undefined when no row has one. */
function latest(rows: Row[], key: 'release_date' | 'updated_at'): string | undefined {
  return rows.reduce<string | undefined>((max, row) => (row[key] && (!max || row[key]! > max) ? row[key]! : max), undefined)
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient()

  const [{ data: identities, error: identitiesError }, { data: egos, error: egosError }, { data: decks, error: decksError }, { data: plans, error: plansError }] = await Promise.all([
    supabase.schema('limbus').from('identities').select('id, sinner_id, release_date'),
    supabase.schema('limbus').from('ego').select('id, sinner_id, release_date'),
    supabase.schema('limbus').from('decks').select('id, updated_at').order('created_at', { ascending: false }).limit(500),
    supabase.schema('limbus').from('md_plans').select('id, updated_at').order('created_at', { ascending: false }).limit(200),
  ])
  if (identitiesError) Sentry.captureException(identitiesError, { tags: { location: 'sitemap:sitemap' }, extra: { msg: 'Failed to fetch identities' } })
  if (egosError) Sentry.captureException(egosError, { tags: { location: 'sitemap:sitemap' }, extra: { msg: 'Failed to fetch egos' } })
  if (decksError) Sentry.captureException(decksError, { tags: { location: 'sitemap:sitemap' }, extra: { msg: 'Failed to fetch decks' } })
  if (plansError) Sentry.captureException(plansError, { tags: { location: 'sitemap:sitemap' }, extra: { msg: 'Failed to fetch plans' } })

  const identityRows: Row[] = identities ?? []
  const egoRows: Row[] = egos ?? []
  const deckRows: Row[] = decks ?? []
  const planRows: Row[] = plans ?? []
  const gameDataDate = latest([...identityRows, ...egoRows], 'release_date')

  // /planner and /decks/new are omitted: the proxy redirects anonymous visitors to login.
  return [
    entry('/', gameDataDate, 'daily', 1.0),
    entry('/sinners', gameDataDate, 'weekly', 0.9),
    entry('/sinners/identities', latest(identityRows, 'release_date'), 'weekly', 0.85),
    entry('/sinners/ego', latest(egoRows, 'release_date'), 'weekly', 0.85),
    entry('/decks', latest(deckRows, 'updated_at'), 'daily', 0.8),
    entry('/mirror-dungeon', null, 'weekly', 0.8),
    entry('/planner/community', latest(planRows, 'updated_at'), 'daily', 0.7),
    entry('/planner/run', null, 'monthly', 0.5),
    entry('/keywords', null, 'weekly', 0.7),
    entry('/meta', null, 'daily', 0.7),
    entry('/collection', gameDataDate, 'weekly', 0.5),
    entry('/announcements', null, 'weekly', 0.5),
    entry('/random', null, 'monthly', 0.4),
    entry('/tools/experience', null, 'monthly', 0.4),
    entry('/tools/lunacy', null, 'monthly', 0.4),
    entry('/tools/damage', null, 'monthly', 0.4),
    entry('/privacy', null, 'yearly', 0.2),
    entry('/terms', null, 'yearly', 0.2),
    ...SINNER_SLUGS.map(slug => entry(
      `/sinners/${slug}`,
      latest([...identityRows, ...egoRows].filter(row => row.sinner_id === slug), 'release_date'),
      'weekly',
      0.8,
    )),
    ...identityRows.map(row => entry(`/sinners/${row.sinner_id}/identities/${row.id}`, row.release_date, 'monthly', 0.6)),
    ...egoRows.map(row => entry(`/sinners/${row.sinner_id}/ego/${row.id}`, row.release_date, 'monthly', 0.5)),
    ...deckRows.map(row => entry(`/decks/${row.id}`, row.updated_at, 'monthly', 0.5)),
    ...planRows.map(row => entry(`/planner/community/${row.id}`, row.updated_at, 'monthly', 0.4)),
  ]
}
