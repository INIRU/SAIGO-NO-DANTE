import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerSession } from 'next-auth'
import { authOptions, requireActiveUser } from '@/lib/auth'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'

export const dynamic = 'force-dynamic'

// GET — 리뷰 목록 + 집계 + 본인 리뷰 여부
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const admin = createAdminClient()

  try {
    // 리뷰 목록 (최신순, 한줄평 있는 것만)
    const { data: reviews, error } = await admin
      .schema('limbus')
      .from('identity_reviews')
      .select('id, is_positive, content, created_at, user_id, profiles(username, avatar_url, role)')
      .eq('identity_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const allReviews = (reviews ?? []).map((r: Record<string, unknown>) => {
      const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
      return {
        id: r.id,
        is_positive: r.is_positive,
        content: r.content,
        created_at: r.created_at,
        user_id: r.user_id,
        username: (profile as Record<string, unknown> | null)?.username ?? null,
        avatar_url: (profile as Record<string, unknown> | null)?.avatar_url ?? null,
        role: (profile as Record<string, unknown> | null)?.role ?? 'user',
      }
    })

    // 집계
    const positiveCount = allReviews.filter(r => r.is_positive).length
    const negativeCount = allReviews.filter(r => !r.is_positive).length

    // 본인 리뷰 확인
    let myReview = null
    const session = await getServerSession(authOptions)
    if (session?.user?.email) {
      const userId = await findOrCreateSupabaseUser(
        admin, session.user.email, session.user.name, session.user.image,
      )
      if (userId) {
        myReview = allReviews.find(r => r.user_id === userId) ?? null
      }
    }

    // 한줄평 있는 리뷰만 목록에 포함
    const reviewsWithContent = allReviews.filter(r => r.content && (r.content as string).trim())

    return NextResponse.json({
      reviews: reviewsWithContent,
      positiveCount,
      negativeCount,
      myReview,
      total: allReviews.length,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 })
  }
}

// POST — 리뷰 작성/수정 (upsert)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const auth = await requireActiveUser()
    if (auth.error) return auth.response
    const { session } = auth

    const body = await request.json()
    const isPositive = body.is_positive === true
    const content = ((body.content as string) ?? '').trim().slice(0, 100)

    const admin = createAdminClient()
    const userId = await findOrCreateSupabaseUser(
      admin, session.user.email!, session.user.name, session.user.image,
    )
    if (!userId) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 500 })
    }

    // upsert (인격당 1인 1리뷰)
    const { data, error } = await admin
      .schema('limbus')
      .from('identity_reviews')
      .upsert(
        { identity_id: id, user_id: userId, is_positive: isPositive, content },
        { onConflict: 'identity_id,user_id' },
      )
      .select('id, is_positive, content, created_at, user_id')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data: profile } = await admin
      .schema('limbus')
      .from('profiles')
      .select('username, avatar_url, role')
      .eq('id', userId)
      .single()

    return NextResponse.json({
      ...data,
      username: profile?.username ?? session.user.name,
      avatar_url: profile?.avatar_url ?? null,
      role: profile?.role ?? 'user',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE — 리뷰 삭제 (본인만)
export async function DELETE(
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
      admin, session.user.email!, session.user.name, session.user.image,
    )
    if (!userId) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 500 })
    }

    const { error } = await admin
      .schema('limbus')
      .from('identity_reviews')
      .delete()
      .eq('identity_id', id)
      .eq('user_id', userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
