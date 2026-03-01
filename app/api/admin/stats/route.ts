import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const supabase = createAdminClient()

  const [decks, users, todayDecks, views] = await Promise.all([
    supabase.schema('limbus').from('decks').select('*', { count: 'exact', head: true }),
    supabase.schema('limbus').from('profiles').select('*', { count: 'exact', head: true }),
    supabase.schema('limbus').from('decks').select('*', { count: 'exact', head: true })
      .gte('created_at', new Date().toISOString().split('T')[0]),
    supabase.schema('limbus').from('decks').select('view_count'),
  ])

  const totalViews = (views.data ?? []).reduce(
    (sum: number, d: { view_count: number }) => sum + (d.view_count ?? 0), 0
  )

  return NextResponse.json({
    totalDecks: decks.count ?? 0,
    totalUsers: users.count ?? 0,
    todayDecks: todayDecks.count ?? 0,
    totalViews,
  })
}
