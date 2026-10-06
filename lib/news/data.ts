import { cacheLife, cacheTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { monthRange } from './calendar'
import type { NewsItem } from './payload'

/** The news of one Korean month (YYYY-MM), oldest first. Refreshed when a partner posts or deletes an item. */
export async function loadNewsMonth(month: string): Promise<NewsItem[]> {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.news)
  const [from, to] = monthRange(month)
  const { data, error } = await createAdminClient()
    .schema('limbus')
    .from('news_items')
    .select('id, partner, external_id, feed, platform, category, published_at, starts_at, ends_at, spoiler, author, content')
    .gte('published_at', from)
    .lt('published_at', to)
    .order('published_at')
  if (error) throw error
  return data as NewsItem[]
}
