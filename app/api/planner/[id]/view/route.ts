import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/utils/uuid'

// POST /api/planner/[id]/view — 조회수 1회 증가 (전용 엔드포인트, atomic)
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    const admin = createAdminClient()

    const { error } = await admin.schema('limbus').rpc('increment_md_plan_view', { plan_id: id })
    if (error) {
      console.error('[planner/[id]/view]', error.message)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
