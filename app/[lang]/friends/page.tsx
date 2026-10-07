import FriendsClient from './FriendsClient'

/** Friend code board (support identities). Prototype of the screen: no posts are stored yet. */
export default async function FriendsPage({ params }: { params: Promise<{ lang: string }> }) {
  await params
  return <FriendsClient />
}
