import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateBody, createEgoSchema } from '@/lib/schemas/admin'

function isMissingReleaseDateColumn(error: { code?: string; message?: string }) {
  return error.code === '42703' && (error.message ?? '').includes('release_date')
}

function omitReleaseDate<T extends { release_date?: string | null }>(body: T) {
  const { release_date: _releaseDate, ...rest } = body
  return rest
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const supabase = createAdminClient()
    const { searchParams } = new URL(request.url)
    const sinner_id = searchParams.get('sinner_id')

    let query = supabase.schema('limbus').from('ego').select('*').order('name')

    if (sinner_id) {
      query = query.eq('sinner_id', sinner_id)
    }

    const { data: ego, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data: ego })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const raw = await request.json()
    const parsed = validateBody(createEgoSchema, raw)
    if (!parsed.success) return parsed.response
    const body = parsed.data

    const supabase = createAdminClient()

    let result = await supabase
      .schema('limbus')
      .from('ego')
      .insert(body)
      .select()
      .single()

    if (
      result.error &&
      isMissingReleaseDateColumn(result.error) &&
      (body.release_date === null || body.release_date === undefined)
    ) {
      result = await supabase
        .schema('limbus')
        .from('ego')
        .insert(omitReleaseDate(body))
        .select()
        .single()
    }

    const { data: ego, error } = result

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data: ego }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
