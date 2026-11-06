import { Link } from '@/lib/i18n/navigation'

/**
 * A post author's name: a link to their profile page when the profile is public (a missing flag counts as public),
 * the plain name for a private profile or a guest (no userId).
 */
export default function PostAuthorName({ userId, username, profilePublic, className }: {
  userId?: string | null
  username: string
  profilePublic?: boolean
  className?: string
}) {
  if (userId && profilePublic !== false) return <Link href={`/users/${userId}`} className={className}>{username}</Link>
  return <p className={className}>{username}</p>
}
