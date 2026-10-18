import { z } from 'zod'

export type SeriesPostKind = 'deck' | 'plan'
export type SeriesItem = { kind: SeriesPostKind; id: string; title: string; position: number }
export type SeriesView = { id: string; title: string; user_id: string; items: SeriesItem[] }
export type SeriesSummary = { id: string; title: string; count: number }

export const SERIES_TITLE_MAX = 60

export const orderSeriesItems = (items: SeriesItem[]): SeriesItem[] =>
  [...items].sort((a, b) => a.position - b.position)

/** 1-based place of a post in its series, with the posts around it. Null when the post is not in the list. */
export function locateInSeries(items: SeriesItem[], kind: SeriesPostKind, id: string) {
  const ordered = orderSeriesItems(items)
  const at = ordered.findIndex(item => item.kind === kind && item.id === id)
  if (at < 0) return null
  return { index: at + 1, total: ordered.length, prev: ordered[at - 1] ?? null, next: ordered[at + 1] ?? null, ordered }
}

export function moveSeriesItem(items: SeriesItem[], from: number, step: -1 | 1): SeriesItem[] {
  const to = from + step
  if (to < 0 || to >= items.length) return items
  const next = [...items]
  ;[next[from], next[to]] = [next[to], next[from]]
  return next
}

export const seriesPostHref = (kind: SeriesPostKind, id: string) =>
  kind === 'deck' ? `/decks/${id}` : `/planner/community/${id}`

const title = z.string().trim().min(1).max(SERIES_TITLE_MAX)

export const seriesCreateSchema = z.object({ title })

export const seriesPatchSchema = z.object({
  title: title.optional(),
  order: z.array(z.object({ kind: z.enum(['deck', 'plan']), id: z.string().uuid() })).max(200).optional(),
}).refine(body => body.title !== undefined || body.order !== undefined)
  .refine(body => !body.order || new Set(body.order.map(item => `${item.kind}:${item.id}`)).size === body.order.length)

/** What an editor sends with a post: a series of the author's, or null to leave the series. */
export const seriesChoiceSchema = z.string().uuid().nullable()
