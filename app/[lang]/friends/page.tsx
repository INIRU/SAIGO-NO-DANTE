import { Suspense } from 'react'
import { FriendsSkeleton } from '@/components/friends/FriendsSkeleton'
import FriendsClient from './FriendsClient'

/** Friend code board: support line-ups and "wanted identities" posts. Posts are written on new/. */
export default async function FriendsPage({ params }: { params: Promise<{ lang: string }> }) {
  await params
  // The tab is read from the address (nuqs), which needs a Suspense boundary under Cache Components.
  return <Suspense fallback={<FriendsSkeleton />}><FriendsClient /></Suspense>
}
