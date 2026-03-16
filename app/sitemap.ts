import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'
import { SINNER_SLUGS } from '@/lib/constants/game'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://saigo-no-dante.com'
  const now = new Date()

  const supabase = await createClient()

  // 인격 + EGO 페이지 동적 생성
  const [{ data: identities }, { data: egos }] = await Promise.all([
    supabase.schema('limbus').from('identities').select('id, sinner_id'),
    supabase.schema('limbus').from('ego').select('id, sinner_id'),
  ])

  // 정적 페이지
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/sinners`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/decks`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/mirror-dungeon`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/keywords`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/meta`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${baseUrl}/tier-list`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/collection`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${baseUrl}/extraction`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${baseUrl}/random`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
  ]

  // 수감자 목록 페이지
  const sinnerPages: MetadataRoute.Sitemap = SINNER_SLUGS.map(slug => ({
    url: `${baseUrl}/sinners/${slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  // 인격 상세 페이지
  const identityPages: MetadataRoute.Sitemap = (identities ?? []).map(id => ({
    url: `${baseUrl}/sinners/${id.sinner_id}/identities/${id.id}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

  // EGO 상세 페이지
  const egoPages: MetadataRoute.Sitemap = (egos ?? []).map(ego => ({
    url: `${baseUrl}/sinners/${ego.sinner_id}/ego/${ego.id}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }))

  return [...staticPages, ...sinnerPages, ...identityPages, ...egoPages]
}
