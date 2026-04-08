import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerSession } from 'next-auth'
import { authOptions, requireActiveUser } from '@/lib/auth'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'
import { stripPlanForList } from '@/lib/planner/stripPlanForList'


// GET /api/planner — 플랜 목록
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(req.url)

    const sort = searchParams.get('sort') ?? 'latest'
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50)
    const offset = parseInt(searchParams.get('offset') ?? '0')
    const difficulty = searchParams.get('difficulty')
    const tag = searchParams.get('tag')
    const lang = searchParams.get('lang') // 'ko' | 'en' | 'ja' | null
    // Design Ref: §4.2 — 마이페이지용 파라미터
    const userIdParam = searchParams.get('userId')
    const votedBy = searchParams.get('votedBy')

    // userId=me 또는 votedBy=me → 인증 필요
    let resolvedUserId: string | null = null
    if (userIdParam === 'me' || votedBy === 'me') {
      const session = await getServerSession(authOptions)
      if (!session?.user?.email) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
      const admin = createAdminClient()
      resolvedUserId = await findOrCreateSupabaseUser(admin, session.user.email, session.user.name, session.user.image)
    }

    // votedBy=me → 내가 추천한 플랜 ID 목록 조회
    let votedPlanIds: string[] | null = null
    if (votedBy === 'me' && resolvedUserId) {
      const admin = createAdminClient()
      const { data: votes } = await admin
        .schema('limbus')
        .from('md_plan_votes')
        .select('plan_id')
        .eq('user_id', resolvedUserId)
      votedPlanIds = votes?.map((v: { plan_id: string }) => v.plan_id) ?? []
      if (votedPlanIds.length === 0) {
        return NextResponse.json({ plans: [], total: 0 })
      }
    }

    let query = supabase
      .schema('limbus')
      .from('md_plans')
      .select('id, title, description, difficulty, deck, egos, tags, vote_count, view_count, comment_count, lang, created_at, user_id, profiles:user_id(username, avatar_url)', { count: 'exact' })

    if (userIdParam === 'me' && resolvedUserId) query = query.eq('user_id', resolvedUserId)
    if (votedPlanIds) query = query.in('id', votedPlanIds)
    if (difficulty) query = query.eq('difficulty', difficulty)
    if (tag) query = query.contains('tags', [tag])
    if (lang && ['ko', 'en', 'ja'].includes(lang)) query = query.eq('lang', lang)

    if (sort === 'popular') {
      query = query.order('vote_count', { ascending: false }).order('created_at', { ascending: false })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    query = query.range(offset, offset + limit - 1)

    const { data, count, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const plans = (data ?? []).map(plan => stripPlanForList(plan as Record<string, unknown>))
    return NextResponse.json({ plans, total: count })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/planner — 플랜 생성
export async function POST(req: NextRequest) {
  try {
    const activeUser = await requireActiveUser()
    if (activeUser.error) return activeUser.response
    const { session } = activeUser

    const admin = createAdminClient()
    const userId = await findOrCreateSupabaseUser(admin, session.user.email!, session.user.name, session.user.image)

    const body = await req.json()
    const { title, description, difficulty, deck, egos, floor_plan, gift_inventory, tags } = body
    const lang = body.lang

    if (!title?.trim()) return NextResponse.json({ error: '제목을 입력하세요' }, { status: 400 })

    const { data, error } = await admin
      .schema('limbus')
      .from('md_plans')
      .insert({
        user_id: userId,
        title: title.trim(),
        description: description?.trim() ?? '',
        difficulty: difficulty ?? 'hard',
        deck: deck ?? [],
        egos: egos ?? [],
        floor_plan: floor_plan ?? [],
        gift_inventory: gift_inventory ?? [],
        tags: tags ?? [],
        lang: lang || 'ko',
      })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ id: data.id }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
