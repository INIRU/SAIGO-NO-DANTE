import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { pageMetadata } from '@/lib/seo/metadata'
import PrescriptRecords from '@/features/tools/components/PrescriptRecords'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'prescriptMode' })
  return pageMetadata({ lang, path: '/prescript/records', noindex: true, title: t('recordsTitle'), description: t('metaDescription') })
}

export default function Page() {
  return <PrescriptRecords />
}
