import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { pageMetadata } from '@/lib/seo/metadata'
import HubWrapper from './_components/HubWrapper'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'prescriptMode' })
  return pageMetadata({ lang, path: '/prescript', noindex: true, title: t('title'), description: t('metaDescription') })
}

export default function Page() {
  return <HubWrapper />
}
