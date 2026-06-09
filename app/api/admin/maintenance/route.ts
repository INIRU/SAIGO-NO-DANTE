import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'


// GET: 전체 점검 목록
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .schema('limbus')
      .from('site_maintenance')
      .select('*')
      .order('path')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST: 점검 상태 토글
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { id, is_active, message, reason, ends_at, path, label } = body

    if (typeof id !== 'number') {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (typeof is_active === 'boolean') update.is_active = is_active
    if (typeof message === 'string') update.message = message
    if (typeof reason === 'string') update.reason = reason
    if (ends_at !== undefined) update.ends_at = ends_at
    if (typeof path === 'string') {
      const trimmedPath = path.trim()
      if (trimmedPath) {
        update.path = trimmedPath.startsWith('/') ? trimmedPath : `/${trimmedPath}`
      }
    }
    if (typeof label === 'string') {
      const trimmedLabel = label.trim()
      if (trimmedLabel) update.label = trimmedLabel
    }

    const { error } = await supabase
      .schema('limbus')
      .from('site_maintenance')
      .update(update)
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PUT: 새 점검 항목 추가
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { path, label, message, reason, ends_at, is_active } = body

    if (!path || !label) {
      return NextResponse.json({ error: 'path and label required' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const maintenance = {
      path,
      label,
      message: message || '현재 점검 중입니다. 잠시 후 다시 시도해주세요.',
      ...(typeof reason === 'string' ? { reason } : {}),
      ...(ends_at !== undefined ? { ends_at } : {}),
      ...(typeof is_active === 'boolean' ? { is_active } : {}),
    }
    const { data, error } = await supabase
      .schema('limbus')
      .from('site_maintenance')
      .upsert(
        maintenance,
        { onConflict: 'path' },
      )
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE: 점검 항목 삭제
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const supabase = createAdminClient()
    const { error } = await supabase
      .schema('limbus')
      .from('site_maintenance')
      .delete()
      .eq('id', parseInt(id))

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
