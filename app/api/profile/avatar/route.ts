import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'


export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ avatar_url: null, username: null })
    }

    const admin = createAdminClient()
    const userId = await findOrCreateSupabaseUser(
      admin,
      session.user.email,
      session.user.name,
      session.user.image,
    )
    if (!userId) {
      return NextResponse.json({ avatar_url: null, username: null })
    }

    const { data } = await admin
      .schema('limbus')
      .from('profiles')
      .select('avatar_url, username')
      .eq('id', userId)
      .single()

    // The site nickname, not the Google account name, is what the site shows.
    return NextResponse.json({ avatar_url: data?.avatar_url ?? null, username: data?.username ?? null })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
