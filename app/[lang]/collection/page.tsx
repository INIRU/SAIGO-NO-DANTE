import type { Metadata } from 'next'
import { localeAlternates } from '@/lib/seo/metadata'
import { Suspense } from 'react'
import { cacheLife, cacheTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import type { CollectionData } from '@/lib/collection'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
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

async function fetchCollectionData(): Promise<CollectionData> {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.gameData)
  const supabase = createAdminClient()

  const [sinnersRes, identitiesRes, egosRes] = await Promise.all([
    supabase.schema('limbus').from('sinners').select('id, name_kr, order_num').order('order_num'),
    supabase.schema('limbus').from('identities').select('id, sinner_id, name_kr, game_id, folder_name, rarity, keywords').order('game_id'),
    supabase.schema('limbus').from('ego').select('id, sinner_id, name_kr, grade, sin_affinity, folder_name, image_url').order('grade').order('name_kr'),
  ])

  if (sinnersRes.error || identitiesRes.error || egosRes.error) {
    throw new Error('컬렉션 데이터를 불러올 수 없습니다.')
  }

  const identities: CollectionData['identities'] = {}
  const egos: CollectionData['egos'] = {}

  for (const s of sinnersRes.data) {
    identities[s.id] = []
    egos[s.id] = []
  }
  for (const i of identitiesRes.data) {
    identities[i.sinner_id]?.push(i)
  }
  for (const e of egosRes.data) {
    egos[e.sinner_id]?.push(e)
  }

  return { sinners: sinnersRes.data, identities, egos }
}

export default async function CollectionPage() {
  const data = await fetchCollectionData()
  // CollectionClient already wraps CollectionViewer (which uses useSearchParams)
  // in its own Suspense boundary — no additional wrapping needed here.
  return <CollectionClient initialData={data} />
}
