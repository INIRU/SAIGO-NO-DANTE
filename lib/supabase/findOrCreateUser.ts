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

  // 이미 존재하는 경우 페이지네이션으로 이메일 검색 (listUsers는 email 필터 미지원)
  const PER_PAGE = 1000
  let page = 1
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ perPage: PER_PAGE, page })
    if (error || !data?.users?.length) break
    const match = data.users.find(u => u.email === email)
    if (match) return match.id
    if (data.users.length < PER_PAGE) break
    page++
  }
  return null
}
