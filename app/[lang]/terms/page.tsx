import type { Metadata } from 'next'
import { localeAlternates } from '@/lib/seo/metadata'
import { cacheLife } from 'next/cache'
import { getLegalDoc } from '@/lib/data/legal'
import { translations } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'
import LegalDocument from '@/components/legal/LegalDocument'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = (key: string) => {
    const entry = translations[key as keyof typeof translations]
    if (!entry) return key
    return entry[lang as SupportedLang] ?? entry['ko'] ?? key
  }
  return { title: t('legal.terms.title'), alternates: localeAlternates(lang, '/terms') }
}

export default async function TermsPage({ params }: { params: Promise<{ lang: string }> }) {
  'use cache'
  cacheLife('page-1h')

  const { lang } = await params
  return <LegalDocument type="terms" lang={lang} doc={await getLegalDoc('terms', lang)} />
}
