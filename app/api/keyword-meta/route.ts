import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cacheLife, cacheTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { CATALOG_CACHE_CONTROL } from '@/lib/constants/http-cache'

const KEYWORD_META_BASE_SELECT = 'name, description, max_stack'
const KEYWORD_META_EFFECT_SELECT = `${KEYWORD_META_BASE_SELECT}, effect_type`
type KeywordMetaRow = {
  name: string
  description: string | null
  max_stack: number | null
  effect_type?: 'positive' | 'negative' | 'neutral' | null
}

function isMissingEffectTypeError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown }
  const text = [candidate.message, candidate.details, candidate.hint]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase()
  return candidate.code === '42703' || (text.includes('effect_type') && text.includes('column'))
}

async function getCachedKeywordMeta() {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.keywords, CACHE_TAGS.gameData)

  const supabase = createAdminClient()
  const fetchRows = async (selectColumns: string) => {
    const rows: KeywordMetaRow[] = []
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .schema('limbus')
        .from('keyword_meta')
        .select(selectColumns)
        .order('name')
        .range(from, from + 999)
      if (error) return { rows, error }
      if (!data || data.length === 0) break
      rows.push(...(data as unknown as KeywordMetaRow[]))
      if (data.length < 1000) break
      from += 1000
    }
    return { rows, error: null }
  }

  const effectResult = await fetchRows(KEYWORD_META_EFFECT_SELECT)
  if (effectResult.error && isMissingEffectTypeError(effectResult.error)) {
    const baseResult = await fetchRows(KEYWORD_META_BASE_SELECT)
    return baseResult.rows
  }
  return effectResult.rows
}

export async function GET() {
  try {
    const data = await getCachedKeywordMeta()
    return NextResponse.json(data, { headers: { 'Cache-Control': CATALOG_CACHE_CONTROL } })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
