import type { MetadataRoute } from 'next'
import { SINNER_SLUGS } from '@/lib/data/sinners'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://saigonodante.com'
  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/sinners`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/decks`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/collection`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.5,
    },
  ]

  const sinnerPages: MetadataRoute.Sitemap = SINNER_SLUGS.map(slug => ({
    url: `${baseUrl}/sinners/${slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [...staticPages, ...sinnerPages]
}
