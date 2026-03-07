import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_AVATAR_URL } from '@/lib/constants/game'

// next-auth 유저를 Supabase auth에 find-or-create
export async function findOrCreateSupabaseUser(
  admin: SupabaseClient,
  email: string,
  name?: string | null,
  _avatarUrl?: string | null,
): Promise<string | null> {
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      user_name: name ?? email,
      avatar_url: DEFAULT_AVATAR_URL,
    },
  })
  if (!createError) return created.user.id

  // 이미 존재하는 경우 목록에서 찾기
  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  return users.find(u => u.email === email)?.id ?? null
}
