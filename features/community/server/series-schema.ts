import { z } from 'zod'
import { SERIES_TITLE_MAX } from '@/features/community/lib/series-order'

// Request checks for the series routes, on the server only: zod stays out of the pages that show or pick a series.
const title = z.string().trim().min(1).max(SERIES_TITLE_MAX)

export const seriesCreateSchema = z.object({ title })

export const seriesPatchSchema = z.object({
  title: title.optional(),
  order: z.array(z.object({ kind: z.enum(['deck', 'plan']), id: z.string().uuid() })).max(200).optional(),
}).refine(body => body.title !== undefined || body.order !== undefined)
  .refine(body => !body.order || new Set(body.order.map(item => `${item.kind}:${item.id}`)).size === body.order.length)

/** What an editor sends with a post: a series of the author's, or null to leave the series. */
export const seriesChoiceSchema = z.string().uuid().nullable()
