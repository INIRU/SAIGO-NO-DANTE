import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Black_Han_Sans, Song_Myung, Noto_Sans_JP } from 'next/font/google'
import localFont from 'next/font/local'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import './globals.css'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import SessionProvider from '@/components/providers/SessionProvider'
import SWRProvider from '@/components/providers/SWRProvider'
import { KeywordProvider, type KeywordInfo } from '@/components/providers/KeywordProvider'
import { LanguageProvider } from '@/lib/i18n'
import type { SupportedLang } from '@/lib/i18n/types'
import { headers } from 'next/headers'

import FloatingFontControl from '@/components/ui/FloatingFontControl'
import ServiceWorkerRegister from '@/components/pwa/ServiceWorkerRegister'
import SkipNav from '@/components/a11y/SkipNav'
import JsonLd, { websiteJsonLd, organizationJsonLd, videoGameJsonLd } from '@/components/seo/JsonLd'
import AprilFoolsWrapper from '@/components/events/AprilFoolsWrapper'
import { cacheLife } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

// decorative — display:optional prevents FOUT (stays on fallback if not loaded in time)
const songMyung = Song_Myung({
  weight: '400',
  variable: '--font-song-myung',
  display: 'optional',
})

// decorative — display:optional prevents FOUT
const blackHanSans = Black_Han_Sans({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-black-han',
  display: 'optional',
})

/* ── Local Fonts ──────────────────────────────────────── */

// decorative — display:optional prevents FOUT
const excelsiorSans = localFont({
  src: '../public/fonts/ExcelsiorSans.ttf',
  variable: '--font-excelsior',
  display: 'optional',
})

// decorative — display:optional prevents FOUT
const mikodacs = localFont({
  src: '../public/fonts/Mikodacs.ttf',
  variable: '--font-mikodacs',
  display: 'optional',
})

// decorative — display:optional prevents FOUT
const bebasKai = localFont({
  src: [
    { path: '../public/fonts/BebasKai.otf', style: 'normal' },
  ],
  variable: '--font-bebas-kai',
  display: 'optional',
})

// decorative — display:optional prevents FOUT
const corporateLogo = localFont({
  src: '../public/fonts/Corporate-Logo-Bold-ver2.otf',
  weight: '700',
  variable: '--font-corporate-logo',
  display: 'optional',
})

// heading font — keep swap but specify fallback with similar metrics to reduce shift
const kotraBold = localFont({
  src: '../public/fonts/KOTRA_BOLD.ttf',
  weight: '700',
  variable: '--font-kotra-bold',
  display: 'swap',
  fallback: ['Apple SD Gothic Neo', 'Malgun Gothic', 'sans-serif'],
})

// body font — keep swap (critical for readability) + similar-metric fallbacks
const scDream = localFont({
  src: '../public/fonts/SCDream5.otf',
  weight: '500',
  variable: '--font-scdream',
  display: 'swap',
  fallback: ['Apple SD Gothic Neo', 'Malgun Gothic', 'sans-serif'],
})

// decorative — display:optional prevents FOUT
const perfectDOS = localFont({
  src: '../public/fonts/PerfectDOSVGA437.ttf',
  variable: '--font-perfect-dos',
  display: 'optional',
})

// decorative — display:optional prevents FOUT
const paperlogy = localFont({
  src: [
    { path: '../public/fonts/Paperlogy-Light.ttf', weight: '300', style: 'normal' },
    { path: '../public/fonts/Paperlogy-Regular.ttf', weight: '400', style: 'normal' },
    { path: '../public/fonts/Paperlogy-Bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-paperlogy',
  display: 'optional',
})

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-jp',
  display: 'optional',
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

async function getKeywordData(): Promise<Record<string, KeywordInfo>> {
  'use cache'
  cacheLife('page-1h')

  const supabase = createAdminClient()
  const allData: any[] = []
  let fetchError = false
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .schema('limbus')
      .from('keyword_meta')
      .select('name, description, max_stack, icon_slug, sin_affinity')
      .range(from, from + 999)
    if (error) { fetchError = true; break }
    if (!data || data.length === 0) break
    allData.push(...data)
    if (data.length < 1000) break
    from += 1000
  }

  // icon_slug/sin_affinity 컬럼이 아직 없으면 기본 컬럼만으로 재시도
  if (fetchError) {
    allData.length = 0
    from = 0
    while (true) {
      const { data, error } = await supabase
        .schema('limbus')
        .from('keyword_meta')
        .select('name, description, max_stack')
        .range(from, from + 999)
      if (error || !data || data.length === 0) break
      allData.push(...data)
      if (data.length < 1000) break
      from += 1000
    }
  }

  const keywords: Record<string, KeywordInfo> = {}
  for (const row of allData as Record<string, unknown>[]) {
    keywords[row.name as string] = {
      desc: (row.description as string) ?? '',
      ...(row.max_stack != null ? { maxStack: row.max_stack as number } : {}),
      ...((row.icon_slug as string) ? { iconSlug: row.icon_slug as string } : {}),
      ...((row.sin_affinity as string) ? { sinAffinity: row.sin_affinity as string } : {}),
    }
  }
  return keywords
}

async function DetectedLangProvider({
  langPromise,
  children,
}: {
  langPromise: ReturnType<typeof headers>
  children: React.ReactNode
}) {
  const h = await langPromise
  const lang = (h.get('x-lang') as SupportedLang) || 'ko'
  return <LanguageProvider initialLang={lang}>{children}</LanguageProvider>
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const keywords = await getKeywordData()
  const langPromise = headers()

  const appContent = (
    <>
      <Suspense><Navbar /></Suspense>
      <Suspense><main id="main-content">{children}</main></Suspense>
      <Footer />
      <Suspense><FloatingFontControl /></Suspense>
    </>
  )

  return (
    <html lang="ko" suppressHydrationWarning data-scroll-behavior="smooth" className={`${songMyung.variable} ${blackHanSans.variable} ${excelsiorSans.variable} ${mikodacs.variable} ${bebasKai.variable} ${corporateLogo.variable} ${kotraBold.variable} ${scDream.variable} ${perfectDOS.variable} ${paperlogy.variable} ${notoSansJP.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var m=document.cookie.match(/preferred_lang=([^;]+)/);if(m){document.documentElement.lang=m[1];if(m[1]!=='ko'){var s=document.createElement('style');s.textContent='.lang-fallback,.lang-fallback *{color:transparent!important}';document.head.appendChild(s)}}})()` }} />
        <link rel="preconnect" href="https://lpgqcleszdlldneiwgep.supabase.co" />
        {/* Preload critical body/heading fonts to minimize CLS from font swap */}
        <link rel="preload" href="/fonts/SCDream5.otf" as="font" type="font/otf" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/KOTRA_BOLD.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        <JsonLd data={websiteJsonLd(SITE_URL)} />
        <JsonLd data={organizationJsonLd(SITE_URL)} />
        <JsonLd data={videoGameJsonLd(SITE_URL)} />
      </head>
      <body className="antialiased">
          <SkipNav />
          <AprilFoolsWrapper />
          <NuqsAdapter>
            <SessionProvider>
              <SWRProvider>
                <KeywordProvider keywords={keywords}>
                  <Suspense fallback={<LanguageProvider initialLang="ko"><div className="lang-fallback">{appContent}</div></LanguageProvider>}>
                    <DetectedLangProvider langPromise={langPromise}>
                      {appContent}
                    </DetectedLangProvider>
                  </Suspense>
                </KeywordProvider>
              </SWRProvider>
            </SessionProvider>
          </NuqsAdapter>
        <Toaster
          theme="dark"
          position="top-right"
          toastOptions={{
            style: {
              background: '#1a1510',
              border: '1px solid #3a3020',
              color: '#e8dcc8',
              fontFamily: 'var(--font-body)',
            },
          }}
        />
        <Analytics />
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
