import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ bookmarked: false })
  }

  try {
    const admin = createAdminClient()
    const userId = await findOrCreateSupabaseUser(
      admin,
      session.user.email,
      session.user.name,
      session.user.image,
    )
    if (!userId) return NextResponse.json({ bookmarked: false })

    const { data } = await admin
      .schema('limbus')
      .from('deck_bookmarks')
      .select('deck_id')
      .eq('deck_id', id)
      .eq('user_id', userId)
      .maybeSingle()

    return NextResponse.json({ bookmarked: !!data })
  } catch {
    return NextResponse.json({ bookmarked: false })
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const admin = createAdminClient()
  const userId = await findOrCreateSupabaseUser(
    admin,
    session.user.email,
    session.user.name,
    session.user.image,
  )
  if (!userId) {
    return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 500 })
  }

  const { error: insertError } = await admin
    .schema('limbus')
    .from('deck_bookmarks')
    .insert({ deck_id: id, user_id: userId })

  if (insertError) {
    if (insertError.code === '23505') {
      await admin.schema('limbus').from('deck_bookmarks')
        .delete().eq('deck_id', id).eq('user_id', userId)
      return NextResponse.json({ bookmarked: false })
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ bookmarked: true })
}
