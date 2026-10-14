import { Suspense } from 'react'
import type { Metadata } from 'next'
import { metaText, pageMetadata } from '@/lib/seo/metadata'
import { FriendsSkeleton } from '@/components/friends/FriendsSkeleton'
import FriendsClient from './FriendsClient'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return pageMetadata({ lang, path: '/friends', title: metaText('friends.meta.title', lang), description: metaText('friends.meta.description', lang) })
}

/** Friend code board: support line-ups and "wanted identities" posts. Posts are written on new/. */
export default async function FriendsPage({ params }: { params: Promise<{ lang: string }> }) {
  await params
  // The tab is read from the address (nuqs), which needs a Suspense boundary under Cache Components.
  return <Suspense fallback={<FriendsSkeleton />}><FriendsClient /></Suspense>
}
