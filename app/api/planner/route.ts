import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'

export const dynamic = 'force-dynamic'

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

    let query = supabase
      .schema('limbus')
      .from('md_plans')
      .select('id, title, description, difficulty, deck, egos, tags, vote_count, view_count, comment_count, created_at, user_id, profiles:user_id(username, avatar_url)', { count: 'exact' })

    if (difficulty) query = query.eq('difficulty', difficulty)
    if (tag) query = query.contains('tags', [tag])

    if (sort === 'popular') {
      query = query.order('vote_count', { ascending: false }).order('created_at', { ascending: false })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    query = query.range(offset, offset + limit - 1)

    const { data, count, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ plans: data, total: count })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/planner — 플랜 생성
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })

    const admin = createAdminClient()
    const userId = await findOrCreateSupabaseUser(admin, session.user.email, session.user.name, session.user.image)

    const body = await req.json()
    const { title, description, difficulty, deck, egos, floor_plan, gift_inventory, tags } = body

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
      })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ id: data.id }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
