import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// POST /api/planner/[id]/view — 조회수 1회 증가 (전용 엔드포인트)
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()

  const { data } = await admin
    .schema('limbus')
    .from('md_plans')
    .select('view_count')
    .eq('id', id)
    .single()

  if (data) {
    await admin
      .schema('limbus')
      .from('md_plans')
      .update({ view_count: (data.view_count ?? 0) + 1 })
      .eq('id', id)
  }

  return NextResponse.json({ ok: true })
}
