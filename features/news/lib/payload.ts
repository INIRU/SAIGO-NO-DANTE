/** The body a partner sends to POST /api/v1/news. The developer tools document these same fields (api-reference.ts). */
import { z } from 'zod'

export const NEWS_LANGS = ['ko', 'en', 'ja'] as const
export const NEWS_FEEDS = ['limbus', 'project_moon', 'hampang'] as const
export const NEWS_PLATFORMS = ['steam', 'x', 'youtube', 'chzzk', 'partner'] as const
export const NEWS_CATEGORIES = ['notice', 'update', 'maintenance', 'event', 'video', 'live'] as const
/** Hosts an image or thumbnail may come from; subdomains pass too. Images are shown from the original address, not copied. */
export const NEWS_MEDIA_HOSTS = ['steamstatic.com', 'twimg.com', 'ytimg.com', 'pstatic.net', 'livecloud-thumb.akamaized.net'] as const

const https = (hosts?: readonly string[]) =>
  z.string().max(2000).refine((value) => {
    if (!URL.canParse(value)) return false
    const url = new URL(value)
    return url.protocol === 'https:' && (!hosts || hosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`)))
  }, hosts ? `https URL on one of: ${hosts.join(', ')}` : 'https URL')
const time = z.iso.datetime({ offset: true })

const media = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('image'), url: https(NEWS_MEDIA_HOSTS) }),
  z.strictObject({ type: z.literal('youtube'), id: z.string().regex(/^[\w-]{11}$/, 'YouTube video id, not a URL') }),
  // A video elsewhere is a link out with an optional still.
  z.strictObject({ type: z.literal('video'), url: https(), thumbnail: https(NEWS_MEDIA_HOSTS).optional() }),
])
const text = z.strictObject({
  title: z.string().trim().min(1).max(200),
  body: z.string().max(4000).default(''),
  url: https().nullable().default(null),
  media: z.array(media).max(10).default([]),
  translated: z.boolean().default(false),
})

const author = z.strictObject({ name: z.string().trim().min(1).max(80), handle: z.string().trim().min(1).max(50).nullable().default(null), url: https().nullable().default(null) })
/** The per-language text and the author, exported so the documented field list can be checked against them. */
export const newsTextSchema = text
export const newsAuthorSchema = author

export const newsSchema = z
  .strictObject({
    id: z.string().trim().min(1).max(120),
    feed: z.enum(NEWS_FEEDS),
    platform: z.enum(NEWS_PLATFORMS),
    category: z.enum(NEWS_CATEGORIES).default('notice'),
    published_at: time,
    starts_at: time.nullable().default(null),
    ends_at: time.nullable().default(null),
    spoiler: z.boolean().default(false),
    author: author.nullable().default(null),
    content: z
      .strictObject({ ko: text.optional(), en: text.optional(), ja: text.optional() })
      .refine((content) => NEWS_LANGS.some((lang) => content[lang]), 'At least one of ko, en, ja is required'),
  })
  .refine((news) => !news.starts_at || !news.ends_at || Date.parse(news.ends_at) >= Date.parse(news.starts_at), { path: ['ends_at'], message: 'ends_at is before starts_at' })

export type NewsLang = (typeof NEWS_LANGS)[number]
export type NewsInput = z.infer<typeof newsSchema>
export type NewsText = z.infer<typeof text>
export type NewsMedia = z.infer<typeof media>
/** A stored item: the partner's `id` is `external_id`, unique within that partner. */
export type NewsItem = Omit<NewsInput, 'id'> & { id: string; partner: string; external_id: string }

export function parseNews(body: unknown): { ok: true; value: NewsInput } | { ok: false; issues: { path: string; message: string }[] } {
  const result = newsSchema.safeParse(body)
  if (result.success) return { ok: true, value: result.data }
  return { ok: false, issues: result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })) }
}
