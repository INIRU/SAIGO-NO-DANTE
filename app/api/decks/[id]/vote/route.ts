import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
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
    return NextResponse.json({ voted: false })
  }

  try {
    const admin = createAdminClient()
    const userId = await findOrCreateSupabaseUser(
      admin,
      session.user.email,
      session.user.name,
      session.user.image,
    )
    if (!userId) return NextResponse.json({ voted: false })

    const { data } = await admin
      .schema('limbus')
      .from('deck_votes')
      .select('deck_id')
      .eq('deck_id', id)
      .eq('user_id', userId)
      .maybeSingle()

    return NextResponse.json({ voted: !!data })
  } catch {
    return NextResponse.json({ voted: false })
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
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

    const { error: voteError } = await admin
      .schema('limbus')
      .from('deck_votes')
      .insert({ deck_id: id, user_id: userId })

    if (voteError) {
      if (voteError.code === '23505') {
        await admin.schema('limbus').from('deck_votes')
          .delete().eq('deck_id', id).eq('user_id', userId)
        await admin.schema('limbus').rpc('decrement_vote', { deck_id: id })
        revalidatePath('/decks')
        revalidatePath(`/decks/${id}`)
        return NextResponse.json({ voted: false })
      }
      return NextResponse.json({ error: voteError.message }, { status: 500 })
    }

    await admin.schema('limbus').rpc('increment_vote', { deck_id: id })
    revalidatePath('/decks')
    revalidatePath(`/decks/${id}`)
    return NextResponse.json({ voted: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
