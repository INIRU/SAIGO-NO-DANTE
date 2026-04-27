import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import { Black_Han_Sans, Song_Myung, Noto_Sans_JP } from 'next/font/google'
import localFont from 'next/font/local'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import './globals.css'
import SessionProvider from '@/components/providers/SessionProvider'
import SWRProvider from '@/components/providers/SWRProvider'
import { KeywordProvider, type KeywordInfo } from '@/components/providers/KeywordProvider'

import ServiceWorkerRegister from '@/components/pwa/ServiceWorkerRegister'
import JsonLd, { websiteJsonLd, organizationJsonLd, videoGameJsonLd } from '@/components/seo/JsonLd'
import { cacheLife } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const KeywordRowSchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  max_stack: z.number().nullable().optional(),
  icon_slug: z.string().nullable().optional(),
  sin_affinity: z.string().nullable().optional(),
  name_en: z.string().nullable().optional(),
  name_jp: z.string().nullable().optional(),
  description_en: z.string().nullable().optional(),
  description_jp: z.string().nullable().optional(),
})
const KeywordRowsSchema = z.array(KeywordRowSchema)

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
const toastPositionStyle = {
  '--toast-close-button-start': 'unset',
  '--toast-close-button-end': '0',
  '--toast-close-button-transform': 'translate(35%, -35%)',
} as CSSProperties

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
  cacheLife('page-1d')

  const supabase = createAdminClient()
  const allData: any[] = []
  let fetchError = false
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .schema('limbus')
      .from('keyword_meta')
      .select('name, description, max_stack, icon_slug, sin_affinity, name_en, name_jp, description_en, description_jp')
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
        .select('name, description, max_stack, icon_slug, sin_affinity, name_en, name_jp, description_en, description_jp')
        .range(from, from + 999)
      if (error || !data || data.length === 0) break
      allData.push(...data)
      if (data.length < 1000) break
      from += 1000
    }
  }

  const keywords: Record<string, KeywordInfo> = {}
  let parsedRows: z.infer<typeof KeywordRowsSchema>
  try {
    parsedRows = KeywordRowsSchema.parse(allData)
  } catch (parseErr) {
    console.error('[layout] keyword_meta parse error:', parseErr)
    parsedRows = []
  }
  for (const row of parsedRows) {
    keywords[row.name] = {
      desc: row.description ?? '',
      ...(row.max_stack != null ? { maxStack: row.max_stack } : {}),
      ...(row.icon_slug ? { iconSlug: row.icon_slug } : {}),
      ...(row.sin_affinity ? { sinAffinity: row.sin_affinity } : {}),
      nameEn: row.name_en ?? null,
      nameJp: row.name_jp ?? null,
      descEn: row.description_en ?? null,
      descJp: row.description_jp ?? null,
    }
  }
  return keywords
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const keywords = await getKeywordData()

  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth" className={`${songMyung.variable} ${blackHanSans.variable} ${excelsiorSans.variable} ${mikodacs.variable} ${bebasKai.variable} ${corporateLogo.variable} ${kotraBold.variable} ${scDream.variable} ${perfectDOS.variable} ${paperlogy.variable} ${notoSansJP.variable}`}>
      <head>
        <link rel="preconnect" href="https://lpgqcleszdlldneiwgep.supabase.co" />
        <link rel="preconnect" href="https://lh3.googleusercontent.com" crossOrigin="anonymous" />
        <JsonLd data={websiteJsonLd(SITE_URL)} />
        <JsonLd data={organizationJsonLd(SITE_URL)} />
        <JsonLd data={videoGameJsonLd(SITE_URL)} />
      </head>
      <body className="antialiased">
          <NuqsAdapter>
            <SessionProvider>
              <SWRProvider>
                <KeywordProvider keywords={keywords}>
                  {children}
                </KeywordProvider>
              </SWRProvider>
            </SessionProvider>
          </NuqsAdapter>
        <Toaster
          theme="dark"
          position="top-right"
          closeButton
          style={toastPositionStyle}
          toastOptions={{
            closeButtonAriaLabel: 'Dismiss notification',
            style: {
              background: '#1a1510',
              border: '0.0625rem solid #3a3020',
              color: '#e8dcc8',
              fontFamily: 'var(--font-body)',
              paddingRight: '2.5rem',
            },
          }}
        />
        <Analytics />
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
