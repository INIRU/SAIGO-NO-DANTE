import type { Metadata } from 'next'
import { metaText, pageMetadata, seoLang } from '@/lib/seo/metadata'
import { ABOUT } from '@/lib/data/about'
import LegalDocument from '@/components/legal/LegalDocument'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return pageMetadata({ lang, path: '/about', title: metaText('legal.about.title', lang), description: metaText('legal.about.meta.description', lang) })
}

export default async function AboutPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return <LegalDocument type="about" lang={lang} doc={ABOUT[seoLang(lang)]} />
}
