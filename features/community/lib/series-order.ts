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
