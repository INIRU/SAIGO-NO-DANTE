import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { maintenanceSchema, syncMaintenanceToEdge } from '@/features/admin/server'

type Params = { params: Promise<{ id: string }> }

async function rowId(params: Params['params']) {
  const id = Number((await params).id)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireAdmin()
  if (auth.error) return auth.response
  const id = await rowId(params)
  if (!id) return NextResponse.json({ error: '잘못된 점검입니다.' }, { status: 400 })
  const parsed = maintenanceSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const { data, error } = await createAdminClient()
    .schema('limbus')
    .from('site_maintenance')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) return NextResponse.json({ error: '점검을 저장하지 못했습니다.' }, { status: 500 })
  if (!data) return NextResponse.json({ error: '점검을 찾지 못했습니다.' }, { status: 404 })
  return NextResponse.json({ ...data, edge: await syncMaintenanceToEdge() })
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireAdmin()
  if (auth.error) return auth.response
  const id = await rowId(params)
  if (!id) return NextResponse.json({ error: '잘못된 점검입니다.' }, { status: 400 })
  const { error } = await createAdminClient().schema('limbus').from('site_maintenance').delete().eq('id', id)
  if (error) return NextResponse.json({ error: '점검을 삭제하지 못했습니다.' }, { status: 500 })
  return NextResponse.json({ ok: true, edge: await syncMaintenanceToEdge() })
}
