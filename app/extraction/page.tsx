import type { Metadata } from 'next'
import { cacheLife } from 'next/cache'
import ExtractionWrapper from './ExtractionWrapper'
import { getServerLang, serverT } from '@/lib/i18n/server'
import type { TranslationKey } from '@/lib/i18n/translations'

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLang()
  const title = serverT('extraction.title' as TranslationKey, lang)
  const description = serverT('extraction.description' as TranslationKey, lang)
  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
  }
}

export default async function ExtractionPage() {
  'use cache'
  cacheLife('page-1h')
  return <ExtractionWrapper />
}
