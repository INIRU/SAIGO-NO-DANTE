import { Suspense } from 'react'
import { cacheLife } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo/metadata'
import MotionBrowser from '@/features/motion/components/MotionBrowser'
import { MotionBrowserSkeleton } from '@/features/motion/components/SkillMotionSkeleton'
import PageHeader from '@/components/ui/PageHeader'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'motionPage' })
  return pageMetadata({ lang, path: '/motion/skills', title: t('metaTitle'), description: t('metaDescription') })
}

/** The picking page. A `?skill=` address of the old single page is sent to the watching page by next.config.ts. */
export default async function SkillMotionPage({ params }: { params: Promise<{ lang: string }> }) {
  'use cache'
  cacheLife('page-1h')

  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'motionPage' })
  return (
    <div className="mx-auto min-h-[100dvh] max-w-[76rem] px-4 pb-24 pt-[5.5rem] md:px-6">
      <PageHeader title={t('title')} ad={false} />
      <Suspense fallback={<MotionBrowserSkeleton />}><MotionBrowser /></Suspense>
    </div>
  )
}
