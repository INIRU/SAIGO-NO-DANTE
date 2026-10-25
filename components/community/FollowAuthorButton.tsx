'use client'
import useSWR from 'swr'
import { useLocale } from 'next-intl'
import { useSession } from 'next-auth/react'
import { UserCheck, UserPlus } from 'lucide-react'
import Button from '@/components/ui/Button'
import { getCommunityCopy } from '@/lib/community/copy'
import { followsEndpoint, followsFetcher, useFollowMutation } from './Follows'

/**
 * Follow the author of the post being read, from beside their name. Signed out it still offers to follow (the press
 * leads to sign-in) without asking the server; on one's own post it is absent.
 */
export default function FollowAuthorButton({ userId }: { userId: string }) {
  const t = getCommunityCopy(useLocale())
  const { status } = useSession()
  const { data } = useSWR(status === 'authenticated' ? followsEndpoint(userId) : null, followsFetcher)
  const { busy, change } = useFollowMutation()
  if (data?.owner) return null
  const following = data?.is_following === true
  // Holds its place, unseen, until the session and the follow state are known, so the label does not flip after paint.
  const pending = status === 'loading' || (status === 'authenticated' && !data)
  return (
    <Button size="sm" variant={following ? 'secondary' : 'outline'} icon={following ? UserCheck : UserPlus} loading={busy}
      aria-pressed={following} aria-hidden={pending || undefined} className={pending ? 'invisible' : ''} onClick={() => change(userId, following)}>{following ? t.following : t.follow}</Button>
  )
}
