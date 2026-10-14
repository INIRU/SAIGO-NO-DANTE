import type { Metadata } from 'next'
import { metaText, pageMetadata } from '@/lib/seo/metadata'
import { cacheLife } from 'next/cache'
import { getLegalDoc } from '@/lib/data/legal'
import LegalDocument from '@/components/legal/LegalDocument'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return pageMetadata({ lang, path: '/terms', title: metaText('legal.terms.title', lang), description: metaText('legal.terms.meta.description', lang) })
}

export default async function TermsPage({ params }: { params: Promise<{ lang: string }> }) {
  'use cache'
  cacheLife('page-1h')

  const { lang } = await params
  return <LegalDocument type="terms" lang={lang} doc={await getLegalDoc('terms', lang)} />
}
