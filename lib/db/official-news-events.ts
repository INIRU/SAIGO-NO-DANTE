import { cacheLife, cacheTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { createAdminClient } from '@/lib/supabase/admin'
import type { OfficialNewsEvent, OfficialNewsSource } from '@/lib/types'

export type OfficialNewsEventsMonthInput = {
  year: number
  month: number
}

type OfficialNewsEventRow = {
  id: string
  source: OfficialNewsSource
  source_item_id: string
  source_url: string
  title: string
  summary: string | null
  body: string | null
  starts_at: string
  ends_at: string | null
  published_at: string | null
  image_url: string | null
  image_path: string | null
  image_urls: string[] | null
  image_paths: string[] | null
  image_bucket: string | null
  locale: string | null
  tags: string[] | null
  raw_payload: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export function getCurrentOfficialNewsMonth(date = new Date()): OfficialNewsEventsMonthInput {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  }
}

export function getOfficialNewsMonthBounds({ year, month }: OfficialNewsEventsMonthInput) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error('Invalid calendar year')
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('Invalid calendar month')
  }

  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0))
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  }
}

function normalizeOfficialNewsEvent(row: OfficialNewsEventRow): OfficialNewsEvent {
  return {
    id: row.id,
    source: row.source,
    source_item_id: row.source_item_id,
    source_url: row.source_url,
    title: row.title,
    summary: row.summary ?? '',
    body: row.body ?? '',
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    published_at: row.published_at,
    image_url: row.image_url,
    image_path: row.image_path,
    image_urls: row.image_urls ?? [],
    image_paths: row.image_paths ?? [],
    image_bucket: row.image_bucket,
    locale: row.locale,
    tags: row.tags ?? [],
    raw_payload: row.raw_payload ?? {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function getOfficialNewsEventsForMonth(
  input: OfficialNewsEventsMonthInput,
): Promise<OfficialNewsEvent[]> {
  'use cache'
  cacheLife('page-5m')
  cacheTag(CACHE_TAGS.calendar)

  const { startIso, endIso } = getOfficialNewsMonthBounds(input)
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .schema('limbus')
    .from('official_news_events')
    .select('*')
    .or(
      `and(starts_at.gte.${startIso},starts_at.lt.${endIso}),and(published_at.gte.${startIso},published_at.lt.${endIso})`,
    )
    .order('starts_at', { ascending: true })
    .order('published_at', { ascending: true })
    .order('source', { ascending: true })

  if (error) throw error
  return ((data ?? []) as unknown as OfficialNewsEventRow[]).map(normalizeOfficialNewsEvent)
}
