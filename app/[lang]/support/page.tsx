import { Suspense } from 'react'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { localeAlternates } from '@/lib/seo/metadata'
import SupportDesk from '@/components/support/SupportDesk'
import SupportSkeleton from '@/components/support/SupportSkeleton'
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'supportDesk' })
  return { title: t('title'), alternates: localeAlternates(lang, '/support') }
}
type Props = { searchParams: Promise<{ topic?: string }> }
async function SupportContent({ searchParams }: Props) {
  const { topic } = await searchParams
  const initialTopic = topic === 'api-limit' ? topic : undefined
  return <SupportDesk key={initialTopic ?? 'default'} initialTopic={initialTopic} />
}
export default function SupportPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<SupportSkeleton />}>
      <SupportContent searchParams={searchParams} />
    </Suspense>
  )
}
