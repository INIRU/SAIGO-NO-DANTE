import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const supabase = createAdminClient()
    const { searchParams } = new URL(request.url)
    const pinnedOnly = searchParams.get('pinned') === 'true'

    if (pinnedOnly) {
      // pinned 공지 먼저, 없으면 최신 공지 fallback
      const { data: pinned, error: pErr } = await supabase
        .schema('limbus')
        .from('announcements')
        .select('id, title, content, pinned, created_at')
        .eq('pinned', true)
        .order('created_at', { ascending: false })
        .limit(1)

      if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

      if (pinned && pinned.length > 0) {
        return NextResponse.json({ data: pinned[0] })
      }

      // pinned 없으면 최신 공지
      const { data: latest, error: lErr } = await supabase
        .schema('limbus')
        .from('announcements')
        .select('id, title, content, pinned, created_at')
        .order('created_at', { ascending: false })
        .limit(1)

      if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 })

      return NextResponse.json({ data: latest?.[0] ?? null })
    }

    const { data, error } = await supabase
      .schema('limbus')
      .from('announcements')
      .select('id, title, content, pinned, created_at')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data: data ?? [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
