import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const supabase = createAdminClient()

  // 배정된 인격
  const { data: assigned, error: assignedErr } = await supabase
    .schema('limbus')
    .from('tier_list')
    .select(`
      tier, sort_order,
      identity:identities(id, name_kr, rarity, sinner_id, game_id, folder_name, acquisition_info)
    `)
    .order('sort_order')

  if (assignedErr) return NextResponse.json({ error: assignedErr.message }, { status: 500 })

  // 배정된 identity_id 목록
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assignedIds = (assigned ?? []).map((r: any) => {
    const ident = Array.isArray(r.identity) ? r.identity[0] : r.identity
    return ident?.id
  }).filter(Boolean) as string[]

  // 미배정 인격
  let unassignedQuery = supabase
    .schema('limbus')
    .from('identities')
    .select('id, name_kr, rarity, sinner_id, game_id, folder_name, acquisition_info')
    .order('name_kr')

  if (assignedIds.length > 0) {
    // not.in 필터로 배정된 인격 제외
    unassignedQuery = unassignedQuery.not('id', 'in', `(${assignedIds.join(',')})`)
  }

  const { data: unassigned, error: unassignedErr } = await unassignedQuery

  if (unassignedErr) return NextResponse.json({ error: unassignedErr.message }, { status: 500 })

  return NextResponse.json({ assigned: assigned ?? [], unassigned: unassigned ?? [] })
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const supabase = createAdminClient()
  const body = await request.json()
  const { tiers } = body as { tiers: Record<string, string[]> }

  if (!tiers) return NextResponse.json({ error: 'tiers 데이터가 필요합니다.' }, { status: 400 })

  // 기존 데이터 삭제
  const { error: deleteErr } = await supabase
    .schema('limbus')
    .from('tier_list')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // delete all rows

  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 })

  // 새 데이터 일괄 삽입
  const rows: { identity_id: string; tier: string; sort_order: number }[] = []
  for (const [tier, ids] of Object.entries(tiers)) {
    ids.forEach((id, idx) => {
      rows.push({ identity_id: id, tier, sort_order: idx })
    })
  }

  if (rows.length > 0) {
    const { error: insertErr } = await supabase
      .schema('limbus')
      .from('tier_list')
      .insert(rows)

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, count: rows.length })
}
