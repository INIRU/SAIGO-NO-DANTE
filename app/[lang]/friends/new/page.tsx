import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import ComposeClient from '../_components/ComposeClient'

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<{ kind?: string | string[] }> }

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ lang }, { kind }] = await Promise.all([params, searchParams])
  const t = await getTranslations({ locale: lang, namespace: 'friends.compose' })
  return { title: t(kind === 'want' ? 'want' : 'support'), robots: { index: false, follow: false } }
}

/** Writing page of the friend code board: ?kind=want for a "wanted identities" post, a support line-up otherwise. */
export default async function NewFriendPostPage({ params, searchParams }: Props) {
  const [, { kind }] = await Promise.all([params, searchParams])
  return <ComposeClient key={kind === 'want' ? 'want' : 'support'} kind={kind === 'want' ? 'want' : 'support'} />
}
