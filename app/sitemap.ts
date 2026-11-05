import * as Sentry from '@sentry/nextjs'
import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'
import { SINNER_SLUGS } from '@/lib/constants/game'
import { PRIMARY_LOCALE, localeLanguages, localeUrl } from '@/lib/seo/metadata'
import { loadMotionCatalog } from '@/lib/motion/feed'
import { toMotionParam } from '@/lib/motion/catalog'

type Entry = MetadataRoute.Sitemap[number]
type Row = { id: string; sinner_id?: string; release_date?: string | null; updated_at?: string | null }

/**
 * One entry per page: the /ko URL (primary audience) with en/ja/x-default as hreflang alternates.
 * No changefreq or priority: Google and Bing ignore both. lastmod is given only where a real date exists.
 */
function entry(path: string, lastModified?: string | null): Entry {
  return {
    url: localeUrl(PRIMARY_LOCALE, path),
    ...(lastModified ? { lastModified: new Date(lastModified) } : {}),
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
    supabase.schema('limbus').from('md_plans').select('id, updated_at').order('created_at', { ascending: false }).limit(500),
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
  // Every skill motion has its own address (?skill=, with its own title). The R2 list down: the motion page alone.
  const motionSkills = await loadMotionCatalog(PRIMARY_LOCALE).then(
    sinners => sinners.flatMap(sinner => [
      ...sinner.identities.flatMap(identity => identity.skills.map(skill => entry(`/motion/skills/watch?skill=${toMotionParam(skill.key)}`, identity.released))),
      ...(sinner.egos ?? []).flatMap(ego => ego.skills.map(skill => entry(`/motion/skills/watch?skill=${toMotionParam(skill.key)}`))),
    ]),
    error => { Sentry.captureException(error, { tags: { location: 'sitemap:sitemap' }, extra: { msg: 'Failed to read the motion list' } }); return [] },
  )

  // Left out: pages kept out of the index (login, my page, writing and editing screens, and the personal or crawler-empty
  // /collection, /friends, /planner editor, /planner/run, /random) and /decks/new, /developers, which are not decided yet.
  return [
    entry('/', gameDataDate),
    entry('/sinners', gameDataDate),
    entry('/sinners/identities', latest(identityRows, 'release_date')),
    entry('/sinners/ego', latest(egoRows, 'release_date')),
    entry('/decks', latest(deckRows, 'updated_at')),
    entry('/mirror-dungeon'),
    entry('/planner/community', latest(planRows, 'updated_at')),
    entry('/keywords'),
    entry('/meta'),
    entry('/calendar'),
    entry('/announcements'),
    entry('/tools/experience'),
    entry('/tools/lunacy'),
    entry('/tools/damage'),
    entry('/tools/clash'),
    entry('/motion/skills'),
    entry('/about'),
    entry('/privacy'),
    entry('/terms'),
    ...SINNER_SLUGS.map(slug => entry(`/sinners/${slug}`, latest([...identityRows, ...egoRows].filter(row => row.sinner_id === slug), 'release_date'))),
    ...identityRows.map(row => entry(`/sinners/${row.sinner_id}/identities/${row.id}`, row.release_date)),
    ...egoRows.map(row => entry(`/sinners/${row.sinner_id}/ego/${row.id}`, row.release_date)),
    ...deckRows.map(row => entry(`/decks/${row.id}`, row.updated_at)),
    ...planRows.map(row => entry(`/planner/community/${row.id}`, row.updated_at)),
    ...motionSkills,
  ]
}
