import 'server-only'
import { NextResponse } from 'next/server'
import { requireActiveUser, requireUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { findOrCreateSupabaseUser } from '@/lib/supabase/find-or-create-user'

/**
 * Sign-in and the Supabase account in one step, for routes that need the account id right away: 401 without a session,
 * (with `activeOnly`) 403 for a suspended account, 500 when the account cannot be found or created. Routes that do
 * other work between the session check and the lookup (a rate limit, reading the body) keep the two steps apart.
 */
export async function requireAccount({ activeOnly = false }: { activeOnly?: boolean } = {}) {
  const auth = activeOnly ? await requireActiveUser() : await requireUser()
  if (auth.error) return auth
  const { session } = auth
  const admin = createAdminClient()
  const userId = await findOrCreateSupabaseUser(admin, session.user!.email!, session.user!.name, session.user!.image)
  if (!userId) {
    return { error: true as const, response: NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 500 }) }
  }
  return { error: false as const, session, admin, userId }
}
