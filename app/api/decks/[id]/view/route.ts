import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const VIEW_COOKIE_MAX_AGE_SECONDS = 30

function viewCookieName(deckId: string) {
  return `deck_view_${deckId}`
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    if (!UUID_PATTERN.test(id)) {
      return NextResponse.json({ error: 'Invalid deck id' }, { status: 400 })
    }

    const cookieName = viewCookieName(id)
    if (request.cookies.has(cookieName)) {
      return NextResponse.json({ ok: true, counted: false })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .schema('limbus')
      .rpc('increment_view', { deck_id: id })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    void data

    const response = NextResponse.json({ ok: true, counted: true })
    response.cookies.set(cookieName, '1', {
      httpOnly: true,
      maxAge: VIEW_COOKIE_MAX_AGE_SECONDS,
      path: `/api/decks/${id}/view`,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
    return response
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
