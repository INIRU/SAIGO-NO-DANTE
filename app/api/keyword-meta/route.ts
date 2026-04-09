import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cacheLife } from 'next/cache'

async function getCachedKeywordMeta() {
  'use cache'
  cacheLife('page-5m')

  const supabase = createAdminClient()
  const allData: Array<{ name: string; description: string | null; max_stack: number | null }> = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .schema('limbus')
      .from('keyword_meta')
      .select('name, description, max_stack')
      .order('name')
      .range(from, from + 999)
    if (error || !data || data.length === 0) break
    allData.push(...data)
    if (data.length < 1000) break
    from += 1000
  }
  return allData
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
