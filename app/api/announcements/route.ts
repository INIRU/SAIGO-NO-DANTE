import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const pinnedOnly = searchParams.get('pinned') === 'true'

  let query = supabase
    .schema('limbus')
    .from('announcements')
    .select('id, title, content, pinned, created_at')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })

  if (pinnedOnly) {
    query = query.eq('pinned', true).limit(1)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (pinnedOnly) {
    return NextResponse.json({ data: data?.[0] ?? null })
  }

  return NextResponse.json({ data: data ?? [] })
}
