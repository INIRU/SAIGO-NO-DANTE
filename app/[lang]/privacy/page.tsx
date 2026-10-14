import type { Metadata } from 'next'
import { metaText, pageMetadata } from '@/lib/seo/metadata'
import { cacheLife } from 'next/cache'
import { getLegalDoc } from '@/lib/data/legal'
import LegalDocument from '@/components/legal/LegalDocument'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return pageMetadata({ lang, path: '/privacy', title: metaText('legal.privacy.title', lang), description: metaText('legal.privacy.meta.description', lang) })
}

export default async function PrivacyPage({ params }: { params: Promise<{ lang: string }> }) {
  'use cache'
  cacheLife('page-1h')

  const { lang } = await params
  return <LegalDocument type="privacy" lang={lang} doc={await getLegalDoc('privacy', lang)} />
}
