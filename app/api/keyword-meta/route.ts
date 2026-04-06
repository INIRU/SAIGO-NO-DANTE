import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cacheLife } from 'next/cache'

async function getCachedKeywordMeta() {
  'use cache'
  cacheLife('page-5m')

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .schema('limbus')
    .from('keyword_meta')
    .select('name, description, max_stack')
    .order('name')

  if (error) return []
  return data ?? []
}

export async function GET() {
  try {
    const data = await getCachedKeywordMeta()
    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
