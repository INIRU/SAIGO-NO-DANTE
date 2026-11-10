import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerSession } from 'next-auth'
import { authOptions, requireActiveUser } from '@/lib/auth'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'


// GET /api/planner/[id]/vote — 추천 상태 확인
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ voted: false })

    const admin = createAdminClient()
    const userId = await findOrCreateSupabaseUser(admin, session.user.email, session.user.name, session.user.image)

    const { data, error } = await admin.schema('limbus').from('md_plan_votes').select('plan_id').eq('plan_id', id).eq('user_id', userId).maybeSingle()
    if (error) {
      console.error('[planner/[id]/vote]', error.message)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ voted: !!data })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/planner/[id]/vote — 추천 토글
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const auth = await requireActiveUser()
    if (auth.error) return auth.response
    const { session } = auth

    const admin = createAdminClient()
    const userId = await findOrCreateSupabaseUser(admin, session.user.email!, session.user.name, session.user.image)

    const { data, error } = await admin.schema('limbus').rpc('toggle_plan_vote', {
      p_plan_id: id,
      p_user_id: userId,
    })

    if (error) {
      console.error('[planner/[id]/vote]', error.message)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    revalidateTag(CACHE_TAGS.plan(id), 'max')
    revalidateTag(CACHE_TAGS.plansList, 'max')
    return NextResponse.json({ voted: data })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
