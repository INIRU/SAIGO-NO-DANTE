import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { pageMetadata } from '@/lib/seo/metadata'
import PrescriptRanking from '@/components/fun/prescript/PrescriptRanking'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'prescriptMode' })
  return pageMetadata({ lang, path: '/prescript/ranking', noindex: true, title: t('rankingTitle'), description: t('metaDescription') })
}

export default function Page() {
  return <PrescriptRanking />
}
