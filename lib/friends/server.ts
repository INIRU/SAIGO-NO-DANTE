import type { createAdminClient } from '@/lib/supabase/admin'
import { resolveAuthor, type Author } from '@/lib/guest/server'

type Admin = ReturnType<typeof createAdminClient>
export type FriendPostRow = {
  id: string; code: string; visibility: string; slots: unknown; identity_ids: string[]
  user_id: string | null; key_hash: string | null; guest_tag: string | null; created_at: string; bumped_at: string; seen_at: string
}

/** Who is looking: a signed-in user, a guest with a key, or nobody (null). Never an error response. */
export async function viewerOf(request: Request, admin: Admin): Promise<Author | null> {
  const resolved = await resolveAuthor(request, admin)
  return 'author' in resolved ? resolved.author : null
}

export const isAuthorOf = (row: Pick<FriendPostRow, 'user_id' | 'key_hash'>, viewer: Author | null) =>
  !!viewer && (viewer.kind === 'user' ? row.user_id === viewer.userId : row.key_hash === viewer.keyHash)

/** The filter that finds a viewer's own rows in a table with (user column, key hash column). */
export const ownerFilter = (viewer: Author, userColumn = 'user_id', keyColumn = 'key_hash') =>
  viewer.kind === 'user' ? { column: userColumn, value: viewer.userId } : { column: keyColumn, value: viewer.keyHash }
