import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo/metadata'
import PageHeader from '@/components/ui/PageHeader'
import SkillMotionViewer from '@/components/motion/SkillMotionViewer'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'motionPage' })
  return pageMetadata({ lang, path: '/motion/skills', title: t('metaTitle'), description: t('metaDescription') })
}

export default async function SkillMotionPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'motionPage' })
  return (
    <div className="mx-auto max-w-[90rem] px-4 pb-24 pt-[calc(64px+1.5rem)] md:pb-10">
      <PageHeader title={t('title')} />
      <SkillMotionViewer />
    </div>
  )
}
