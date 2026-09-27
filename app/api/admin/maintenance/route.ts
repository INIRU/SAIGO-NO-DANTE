import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { maintenanceSchema } from '@/lib/maintenance-schema'
import { syncMaintenanceToEdge } from '@/lib/maintenance-edge'

export async function GET() {
  const auth = await requireAdmin()
  if (auth.error) return auth.response
  const { data, error } = await createAdminClient()
    .schema('limbus')
    .from('site_maintenance')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return NextResponse.json({ error: '점검 목록을 불러오지 못했습니다.' }, { status: 500 })
  const edge = Boolean(process.env.EDGE_CONFIG && process.env.VERCEL_API_TOKEN)
  return NextResponse.json({ items: data, edge }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (auth.error) return auth.response
  const parsed = maintenanceSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const { data, error } = await createAdminClient()
    .schema('limbus')
    .from('site_maintenance')
    .insert(parsed.data)
    .select()
    .single()
  if (error) return NextResponse.json({ error: '점검을 저장하지 못했습니다.' }, { status: 500 })
  return NextResponse.json({ ...data, edge: await syncMaintenanceToEdge() }, { status: 201 })
}
