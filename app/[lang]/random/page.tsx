import { cacheLife, cacheTag } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import { getSinners, getIdentities, getEGOs } from '@/lib/db/queries'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { localeAlternates } from '@/lib/seo/metadata'
import PageHeader from '@/components/ui/PageHeader'
import RandomClient from './RandomClient'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'randomPage' })
  return {
    title: t('title'),
    description: t('metaDescription'),
    alternates: localeAlternates(lang, '/random'),
    openGraph: { title: t('title'), description: t('metaDescription') },
  }
}

async function getRandomData() {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.gameData)
  return Promise.all([getSinners(), getIdentities(), getEGOs()])
}

export default async function RandomPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'randomPage' })
  const [sinners, identities, egos] = await getRandomData()
  return (
    <div className="mx-auto max-w-[80rem] px-4 pb-24 pt-[calc(64px+1.5rem)] md:pb-8">
      <PageHeader title={t('title')} />
      <RandomClient sinners={sinners} identities={identities} egos={egos} />
    </div>
  )
}
