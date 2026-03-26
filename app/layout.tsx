import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Black_Han_Sans, Song_Myung } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import SessionProvider from '@/components/providers/SessionProvider'
import { KeywordProvider, type KeywordInfo } from '@/components/providers/KeywordProvider'
import FloatingFontControl from '@/components/ui/FloatingFontControl'
import ServiceWorkerRegister from '@/components/pwa/ServiceWorkerRegister'
import SkipNav from '@/components/a11y/SkipNav'
import JsonLd, { websiteJsonLd, organizationJsonLd, videoGameJsonLd } from '@/components/seo/JsonLd'
import AprilFools from '@/components/events/AprilFools'
import { createClient } from '@/lib/supabase/server'

const songMyung = Song_Myung({
  weight: '400',
  variable: '--font-song-myung',
  display: 'swap',
})

const blackHanSans = Black_Han_Sans({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-black-han',
  display: 'swap',
})

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://saigo-no-dante.com'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: '최애의 관리자 | SAIGO NO DANTE',
    template: '%s | 최애의 관리자',
  },
  description: '림버스 컴퍼니 정보 사이트 — 수감자 인격·EGO 데이터베이스, 거울 던전 기프트 도감, 키워드 도감, 덱 빌더, 티어표, 메타 분석까지 한 곳에서.',
  keywords: [
    'Limbus Company', '림버스 컴퍼니', '림버스', '림버스 정보', '림버스 정보 사이트',
    '림버스 컴퍼니 도감', '림버스 인격', '림버스 EGO', '림버스 덱', '림버스 덱 빌더',
    '수감자', '인격', 'EGO', '거울 던전', '에고 기프트', '키워드 도감',
    '림버스 거던', '거던 조합식', '거던 레시피', '거던 덱', '거던 기프트 조합',
    '덱 빌더', '메타 분석', '티어표', '리세마라', '림버스 티어표',
    '팬 아카이브', '최애의 관리자', 'SAIGO NO DANTE',
    'Project Moon', '프로젝트 문',
  ],
  authors: [{ name: 'SAIGO NO DANTE' }],
  creator: 'SAIGO NO DANTE',
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: SITE_URL,
    siteName: '최애의 관리자',
    title: '최애의 관리자 | 림버스 컴퍼니 정보 사이트',
    description: '림버스 컴퍼니 정보 사이트 — 수감자 인격·EGO DB, 거울 던전 기프트, 덱 빌더, 티어표',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '최애의 관리자 | 림버스 컴퍼니 정보 사이트',
    description: '림버스 컴퍼니 정보 사이트 — 수감자 인격·EGO DB, 거울 던전 기프트, 덱 빌더, 티어표',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  alternates: {
    canonical: SITE_URL,
  },
  verification: {
    google: 'Aj4bgbiMwETOsd8qKciqA6u8AyX7str5bylMewPSfxw',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '최애의 관리자',
  },
  icons: {
    icon: '/icons/icon-192x192.png',
    apple: '/icons/icon-192x192.png',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 서버 사이드: keyword_meta 전체 fetch → KeywordProvider로 전달
  const supabase = await createClient()
  let { data, error } = await supabase
    .schema('limbus')
    .from('keyword_meta')
    .select('name, description, max_stack, icon_slug, sin_affinity')

  // icon_slug/sin_affinity 컬럼이 아직 없으면 기본 컬럼만으로 재시도
  if (error) {
    const fallback = await supabase
      .schema('limbus')
      .from('keyword_meta')
      .select('name, description, max_stack')
    data = fallback.data as typeof data
    error = fallback.error
  }

  const keywords: Record<string, KeywordInfo> = {}
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    keywords[row.name as string] = {
      desc: (row.description as string) ?? '',
      ...(row.max_stack != null ? { maxStack: row.max_stack as number } : {}),
      ...((row.icon_slug as string) ? { iconSlug: row.icon_slug as string } : {}),
      ...((row.sin_affinity as string) ? { sinAffinity: row.sin_affinity as string } : {}),
    }
  }

  return (
    <html lang="ko" className={`${songMyung.variable} ${blackHanSans.variable}`}>
      <head>
        <link rel="preconnect" href="https://lpgqcleszdlldneiwgep.supabase.co" />
        <JsonLd data={websiteJsonLd(SITE_URL)} />
        <JsonLd data={organizationJsonLd(SITE_URL)} />
        <JsonLd data={videoGameJsonLd(SITE_URL)} />
      </head>
      <body className="antialiased">
        <SkipNav />
        <AprilFools />
        <SessionProvider>
          <KeywordProvider keywords={keywords}>
            <Navbar />
            <Suspense><main id="main-content">{children}</main></Suspense>
            <Footer />
            <FloatingFontControl />
          </KeywordProvider>
        </SessionProvider>
        <Analytics />
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
