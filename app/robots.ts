import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo/metadata'

export default function robots(): MetadataRoute.Robots {
  return {
    // Every crawler, every path: the private pages answer a visitor without a session with the login page, and a crawler
    // that renders a page may fetch the API it reads from.
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
