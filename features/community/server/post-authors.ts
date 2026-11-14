import { createAdminClient } from '@/lib/supabase/admin'

type PostAuthor = { username: string; avatar_url: string | null; public_profile: boolean }

/**
 * Sets each post's `profiles` to its author's name, avatar and profile privacy. The profiles table lets the public key read
 * public profiles only, so a post read with it shows a private author as anonymous; a post names its author either way,
 * so the authors are read here with the server key (only those of the posts, so nobody can list every user). Suspended
 * accounts are left out and stay anonymous. When the lookup fails, a post keeps the author it was read with.
 */
export async function withPostAuthors<T extends { user_id?: string | null; profiles?: unknown }>(rows: T[]): Promise<T[]> {
  const ids = [...new Set(rows.map(row => row.user_id).filter((id): id is string => Boolean(id)))]
  const authors = new Map<string, PostAuthor>()
  if (ids.length) {
    const { data, error } = await createAdminClient().schema('limbus').from('profiles')
      .select('id, username, avatar_url, public_profile').in('id', ids).eq('suspended', false)
    if (error) console.error('post authors', error.message)
    for (const row of data ?? []) if (row.username) authors.set(row.id, { username: row.username, avatar_url: row.avatar_url, public_profile: row.public_profile })
  }
  return rows.map(row => {
    const embedded = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    return { ...row, profiles: (row.user_id ? authors.get(row.user_id) : undefined) ?? embedded ?? null } as T
  })
}
