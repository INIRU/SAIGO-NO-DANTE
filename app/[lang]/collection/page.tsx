import type { Metadata } from 'next'
import { localeAlternates } from '@/lib/seo/metadata'
import { Suspense } from 'react'
import { fetchCollectionData } from '@/lib/db/collection'
import CollectionClient from './CollectionClient'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'collectionPage' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: localeAlternates(lang, '/collection'),
  }
}

export default async function CollectionPage() {
  const data = await fetchCollectionData()
  // CollectionClient already wraps CollectionViewer (which uses useSearchParams)
  // in its own Suspense boundary — no additional wrapping needed here.
  return <CollectionClient initialData={data} />
}
