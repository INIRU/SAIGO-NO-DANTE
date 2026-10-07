import ComposeClient from './ComposeClient'

/** Writing page of the friend code board: ?kind=want for a "wanted identities" post, a support line-up otherwise. */
export default async function NewFriendPostPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ kind?: string | string[] }> }) {
  const [, { kind }] = await Promise.all([params, searchParams])
  return <ComposeClient key={kind === 'want' ? 'want' : 'support'} kind={kind === 'want' ? 'want' : 'support'} />
}
