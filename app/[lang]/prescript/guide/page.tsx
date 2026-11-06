import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { pageMetadata } from '@/lib/seo/metadata'
import PrescriptGuide from '@/features/tools/components/PrescriptGuide'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'prescriptMode' })
  return pageMetadata({ lang, path: '/prescript/guide', noindex: true, title: t('guideTitle'), description: t('metaDescription') })
}

export default function Page() {
  return <PrescriptGuide />
}
