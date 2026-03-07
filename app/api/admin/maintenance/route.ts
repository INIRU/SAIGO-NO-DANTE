import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET: 전체 점검 목록
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .schema('limbus')
    .from('site_maintenance')
    .select('*')
    .order('path')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST: 점검 상태 토글
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await request.json()
  const { id, is_active, message } = body

  if (typeof id !== 'number') {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const supabase = await createClient()
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof is_active === 'boolean') update.is_active = is_active
  if (typeof message === 'string') update.message = message

  const { error } = await supabase
    .schema('limbus')
    .from('site_maintenance')
    .update(update)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// PUT: 새 점검 항목 추가
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await request.json()
  const { path, label, message } = body

  if (!path || !label) {
    return NextResponse.json({ error: 'path and label required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .schema('limbus')
    .from('site_maintenance')
    .upsert(
      { path, label, message: message || '현재 점검 중입니다. 잠시 후 다시 시도해주세요.' },
      { onConflict: 'path' },
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE: 점검 항목 삭제
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const supabase = await createClient()
  const { error } = await supabase
    .schema('limbus')
    .from('site_maintenance')
    .delete()
    .eq('id', parseInt(id))

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
