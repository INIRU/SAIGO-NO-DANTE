import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ avatar_url: null })
  }

  const admin = createAdminClient()
  const userId = await findOrCreateSupabaseUser(
    admin,
    session.user.email,
    session.user.name,
    session.user.image,
  )
  if (!userId) {
    return NextResponse.json({ avatar_url: null })
  }

  const { data } = await admin
    .schema('limbus')
    .from('profiles')
    .select('avatar_url')
    .eq('id', userId)
    .single()

  return NextResponse.json({ avatar_url: data?.avatar_url ?? null })
}
