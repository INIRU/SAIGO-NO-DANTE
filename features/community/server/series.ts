import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import type { SeriesItem, SeriesPostKind, SeriesSummary, SeriesView } from '@/features/community/lib/series-order'
import { seriesChoiceSchema } from './series-schema'

// Any client works: reads are public (RLS), writes need the service role.
type Db = SupabaseClient

const postTable = (kind: SeriesPostKind) => (kind === 'deck' ? 'decks' : 'md_plans')
const postColumn = (kind: SeriesPostKind) => (kind === 'deck' ? 'deck_id' : 'plan_id')
const postTag = (kind: SeriesPostKind, id: string) => (kind === 'deck' ? CACHE_TAGS.deck(id) : CACHE_TAGS.plan(id))

type ItemRow = { series_id: string; deck_id: string | null; plan_id: string | null; position: number }

async function titlesOf(db: Db, kind: SeriesPostKind, ids: string[]) {
  const titles = new Map<string, string>()
  if (!ids.length) return titles
  const { data, error } = await db.schema('limbus').from(postTable(kind)).select('id, title').in('id', ids)
  if (error) throw new Error(`series titles: ${error.message}`)
  for (const row of data ?? []) titles.set(row.id, row.title)
  return titles
}

/** Items of the given series rows with their post titles; a post that can no longer be read drops out of the list. */
async function itemsWithTitles(db: Db, rows: ItemRow[]): Promise<Map<string, SeriesItem[]>> {
  const [decks, plans] = await Promise.all([
    titlesOf(db, 'deck', rows.flatMap(row => row.deck_id ?? [])),
    titlesOf(db, 'plan', rows.flatMap(row => row.plan_id ?? [])),
  ])
  const bySeries = new Map<string, SeriesItem[]>()
  for (const row of rows) {
    const kind: SeriesPostKind = row.deck_id ? 'deck' : 'plan'
    const id = (row.deck_id ?? row.plan_id)!
    const title = (kind === 'deck' ? decks : plans).get(id)
    if (title === undefined) continue
    bySeries.set(row.series_id, [...(bySeries.get(row.series_id) ?? []), { kind, id, title, position: row.position }])
  }
  return bySeries
}

export async function loadSeries(db: Db, id: string): Promise<SeriesView | null> {
  const [series, items] = await Promise.all([
    db.schema('limbus').from('series').select('id, title, user_id').eq('id', id).maybeSingle(),
    db.schema('limbus').from('series_items').select('series_id, deck_id, plan_id, position').eq('series_id', id).order('position'),
  ])
  if (series.error || items.error) throw new Error('series lookup failed')
  if (!series.data) return null
  const grouped = await itemsWithTitles(db, items.data ?? [])
  return { ...series.data, items: grouped.get(id) ?? [] }
}

export async function loadSeriesOfPost(db: Db, kind: SeriesPostKind, postId: string): Promise<SeriesView | null> {
  const { data, error } = await db.schema('limbus').from('series_items').select('series_id').eq(postColumn(kind), postId).maybeSingle()
  if (error) throw new Error('series membership lookup failed')
  return data ? loadSeries(db, data.series_id) : null
}

/** The user's series with how many posts each holds (empty ones included: the owner may still fill them). */
export async function listUserSeries(db: Db, userId: string, opts: { hideEmpty?: boolean } = {}): Promise<SeriesSummary[]> {
  const { data, error } = await db.schema('limbus').from('series').select('id, title').eq('user_id', userId).order('created_at', { ascending: false })
  if (error) throw new Error('series list failed')
  const ids = (data ?? []).map(row => row.id)
  const counts = new Map<string, number>()
  if (ids.length) {
    const items = await db.schema('limbus').from('series_items').select('series_id').in('series_id', ids)
    if (items.error) throw new Error('series count failed')
    for (const row of items.data ?? []) counts.set(row.series_id, (counts.get(row.series_id) ?? 0) + 1)
  }
  const all = (data ?? []).map(row => ({ id: row.id, title: row.title, count: counts.get(row.id) ?? 0 }))
  return opts.hideEmpty ? all.filter(row => row.count > 0) : all
}

export function revalidateSeries(seriesId: string, posts: { kind: SeriesPostKind; id: string }[] = []) {
  revalidateTag(CACHE_TAGS.series(seriesId), 'max')
  for (const post of posts) revalidateTag(postTag(post.kind, post.id), 'max')
}

type SeriesWrite = { ok: true } | { ok: false; status: number; error: string }

/**
 * Puts a post the user owns into one of the user's series (appended last), or takes it out (null).
 * The route has already proved the user owns the post; the series owner is checked here and again by the DB trigger.
 */
async function applyPostSeries(
  db: Db,
  { kind, postId, userId, seriesId }: { kind: SeriesPostKind; postId: string; userId: string; seriesId: string | null },
): Promise<SeriesWrite> {
  const items = db.schema('limbus').from('series_items')
  const column = postColumn(kind)
  const current = await items.select('id, series_id').eq(column, postId).maybeSingle()
  if (current.error) return { ok: false, status: 500, error: 'Series unavailable' }
  const before = current.data?.series_id ?? null
  if (before === seriesId) return { ok: true }

  if (seriesId) {
    const owned = await db.schema('limbus').from('series').select('id').eq('id', seriesId).eq('user_id', userId).maybeSingle()
    if (owned.error) return { ok: false, status: 500, error: 'Series unavailable' }
    if (!owned.data) return { ok: false, status: 403, error: 'Series not found' }
  }
  if (current.data) {
    const removed = await db.schema('limbus').from('series_items').delete().eq('id', current.data.id)
    if (removed.error) return { ok: false, status: 500, error: 'Series unavailable' }
  }
  if (seriesId) {
    const last = await db.schema('limbus').from('series_items').select('position').eq('series_id', seriesId).order('position', { ascending: false }).limit(1)
    if (last.error) return { ok: false, status: 500, error: 'Series unavailable' }
    const position = last.data?.length ? last.data[0].position + 1 : 0
    const added = await db.schema('limbus').from('series_items').insert({ series_id: seriesId, [column]: postId, position })
    if (added.error) return { ok: false, status: 500, error: 'Series unavailable' }
  }
  for (const id of [before, seriesId]) if (id) revalidateSeries(id, [{ kind, id: postId }])
  return { ok: true }
}

/** A post changed or is about to be deleted: the series box of its neighbours shows its title, so refresh them. */
export async function revalidatePostSeries(db: Db, kind: SeriesPostKind, postId: string) {
  try {
    const { data } = await db.schema('limbus').from('series_items').select('series_id').eq(postColumn(kind), postId).maybeSingle()
    if (data) revalidateSeries(data.series_id)
  } catch { /* a stale series box until the next change is better than failing the post write */ }
}

/**
 * Applies the `series_id` an editor sent with a deck/plan write (absent = leave as is) and refreshes the series
 * the post is in. Returns an error response to hand back, or null. Only the post's owner may change its series.
 */
export async function saveSeriesChoice(
  db: Db,
  { kind, postId, userId, body }: { kind: SeriesPostKind; postId: string; userId: string | null; body: unknown },
): Promise<NextResponse | null> {
  const raw = body && typeof body === 'object' ? (body as { series_id?: unknown }).series_id : undefined
  if (raw !== undefined) {
    const choice = seriesChoiceSchema.safeParse(raw)
    if (!choice.success) return NextResponse.json({ error: 'Invalid series' }, { status: 400 })
    if (!userId) return NextResponse.json({ error: 'Series not found' }, { status: 403 })
    const result = await applyPostSeries(db, { kind, postId, userId, seriesId: choice.data })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  }
  await revalidatePostSeries(db, kind, postId)
  return null
}
