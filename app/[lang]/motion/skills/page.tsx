import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo/metadata'
import SkillMotionViewer from '@/components/motion/SkillMotionViewer'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'motionPage' })
  return pageMetadata({ lang, path: '/motion/skills', title: t('metaTitle'), description: t('metaDescription') })
}

/** The frame (title, way back, full screen) is the layout's, shared with the loading screen. */
export default function SkillMotionPage() {
  return <SkillMotionViewer />
}
