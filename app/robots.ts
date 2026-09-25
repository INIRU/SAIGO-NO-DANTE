import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo/metadata'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Pages live under /{lang}/, so each private path is listed with a locale wildcard too.
        disallow: ['/admin/', '/*/admin', '/api/', '/mypage', '/*/mypage', '/*/login?callbackUrl='],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
