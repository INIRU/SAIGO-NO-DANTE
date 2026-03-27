import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'
import { SINNER_SLUGS } from '@/lib/constants/game'

const STORY_CHAPTERS = ['canto-1', 'canto-2', 'canto-3', 'canto-4'] as const

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://saigo-no-dante.com'
  const now = new Date()

  const supabase = await createClient()

  // 인격 + EGO + 덱 + 플래너 동적 페이지
  const [{ data: identities }, { data: egos }, { data: decks }, { data: plans }] = await Promise.all([
    supabase.schema('limbus').from('identities').select('id, sinner_id'),
    supabase.schema('limbus').from('ego').select('id, sinner_id'),
    supabase.schema('limbus').from('decks').select('id, created_at').order('created_at', { ascending: false }).limit(500),
    supabase.schema('limbus').from('mirror_dungeon_plans').select('id, created_at').order('created_at', { ascending: false }).limit(200),
  ])

  // 정적 페이지 — 주요 콘텐츠
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/sinners`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/sinners/identities`, lastModified: now, changeFrequency: 'weekly', priority: 0.85 },
    { url: `${baseUrl}/sinners/ego`, lastModified: now, changeFrequency: 'weekly', priority: 0.85 },
    { url: `${baseUrl}/decks`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/mirror-dungeon`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/planner`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/planner/community`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${baseUrl}/keywords`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/meta`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${baseUrl}/tier-list`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/story`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/story/prologue`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/bot`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/collection`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${baseUrl}/announcements`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${baseUrl}/extraction`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${baseUrl}/random`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${baseUrl}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ]

  // 스토리 챕터 페이지
  const storyPages: MetadataRoute.Sitemap = STORY_CHAPTERS.map(ch => ({
    url: `${baseUrl}/story/${ch}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

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

  // 덱 상세 페이지
  const deckPages: MetadataRoute.Sitemap = (decks ?? []).map(deck => ({
    url: `${baseUrl}/decks/${deck.id}`,
    lastModified: deck.created_at ? new Date(deck.created_at) : now,
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }))

  // 거울 던전 플래너 커뮤니티 상세
  const planPages: MetadataRoute.Sitemap = (plans ?? []).map(plan => ({
    url: `${baseUrl}/planner/community/${plan.id}`,
    lastModified: plan.created_at ? new Date(plan.created_at) : now,
    changeFrequency: 'monthly' as const,
    priority: 0.4,
  }))

  return [
    ...staticPages,
    ...storyPages,
    ...sinnerPages,
    ...identityPages,
    ...egoPages,
    ...deckPages,
    ...planPages,
  ]
}
