import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateBody, updateEgoSchema } from '@/lib/schemas/admin'

function isMissingReleaseDateColumn(error: { code?: string; message?: string }) {
  return error.code === '42703' && (error.message ?? '').includes('release_date')
}

function omitReleaseDate<T extends { release_date?: string | null }>(body: T) {
  const { release_date: _releaseDate, ...rest } = body
  return rest
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const { id } = await params
    const supabase = createAdminClient()

    const { data: ego, error } = await supabase
      .schema('limbus')
      .from('ego')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !ego) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: egoSkills } = await supabase
      .schema('limbus')
      .from('ego_skills')
      .select('*')
      .eq('ego_id', id)
      .order('skill_order')

    return NextResponse.json({ data: { ...ego, ego_skills: egoSkills ?? [] } })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const { id } = await params
    const raw = await request.json()
    const parsed = validateBody(updateEgoSchema, raw)
    if (!parsed.success) return parsed.response
    const supabase = createAdminClient()

    let result = await supabase
      .schema('limbus')
      .from('ego')
      .update(parsed.data)
      .eq('id', id)
      .select()
      .single()

    if (
      result.error &&
      isMissingReleaseDateColumn(result.error) &&
      (parsed.data.release_date === null || parsed.data.release_date === undefined)
    ) {
      result = await supabase
        .schema('limbus')
        .from('ego')
        .update(omitReleaseDate(parsed.data))
        .eq('id', id)
        .select()
        .single()
    }

    const { data: ego, error } = result

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data: ego })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const { id } = await params
    const supabase = createAdminClient()

    const { error } = await supabase
      .schema('limbus')
      .from('ego')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
