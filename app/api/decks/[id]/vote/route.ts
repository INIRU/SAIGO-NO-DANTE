import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { authOptions, requireActiveUser } from '@/lib/auth'
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
    const auth = await requireActiveUser()
    if (auth.error) return auth.response
    const { session } = auth

    const admin = createAdminClient()
    const userId = await findOrCreateSupabaseUser(
      admin,
      session.user.email!,
      session.user.name,
      session.user.image,
    )
    if (!userId) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 500 })
    }

    const { data: voted, error: voteError } = await admin
      .schema('limbus')
      .rpc('toggle_vote', { p_deck_id: id, p_user_id: userId })

    if (voteError) {
      return NextResponse.json({ error: voteError.message }, { status: 500 })
    }

    revalidatePath('/decks')
    revalidatePath(`/decks/${id}`)
    return NextResponse.json({ voted })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
