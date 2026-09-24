import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import { Black_Han_Sans, Song_Myung, Noto_Sans_JP, Noto_Sans_Mono } from 'next/font/google'
import localFont from 'next/font/local'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import { MotionConfig } from 'motion/react'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import './globals.css'
import SessionProvider from '@/components/providers/SessionProvider'
import SWRProvider from '@/components/providers/SWRProvider'

import ServiceWorkerRegister from '@/components/pwa/ServiceWorkerRegister'
import JsonLd, { websiteJsonLd, organizationJsonLd, videoGameJsonLd } from '@/components/seo/JsonLd'

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

// numeric overlay font — loaded on demand outside critical layout text
const excelsiorSans = localFont({
  src: '../public/fonts/ExcelsiorSans.woff2',
  variable: '--font-excelsior',
  display: 'swap',
  preload: false,
})

// visible identity-name font — loaded by IdentityCard measurement when cards render
const mikodacs = localFont({
  src: '../public/fonts/Mikodacs.woff2',
  variable: '--font-mikodacs',
  display: 'swap',
  preload: false,
  fallback: ['Pretendard', 'Segoe UI', 'sans-serif'],
})

// decorative — display:optional prevents FOUT
const bebasKai = localFont({
  src: [
    { path: '../public/fonts/BebasKai.woff2', style: 'normal' },
  ],
  variable: '--font-bebas-kai',
  display: 'optional',
  preload: false,
})

// heading font — keep swap but specify fallback with similar metrics to reduce shift
const kotraBold = localFont({
  src: '../public/fonts/KOTRA_BOLD.woff2',
  weight: '700',
  variable: '--font-kotra-bold',
  display: 'swap',
  preload: true,
  fallback: ['Apple SD Gothic Neo', 'Malgun Gothic', 'sans-serif'],
})

// body font — keep swap (critical for readability) + similar-metric fallbacks
const scDream = localFont({
  src: '../public/fonts/SCDream5.woff2',
  weight: '500',
  variable: '--font-scdream',
  display: 'swap',
  preload: true,
  fallback: ['Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', 'sans-serif'],
})

const pretendard = localFont({
  src: '../public/fonts/PretendardVariable.woff2',
  weight: '45 920',
  style: 'normal',
  variable: '--font-pretendard',
  display: 'swap',
  preload: true,
  fallback: ['Apple SD Gothic Neo', 'Malgun Gothic', 'sans-serif'],
})

const paperlogy = localFont({
  src: [
    { path: '../public/fonts/Paperlogy-Light.woff2', weight: '300', style: 'normal' },
    { path: '../public/fonts/Paperlogy-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../public/fonts/Paperlogy-Bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-paperlogy',
  display: 'swap',
  preload: false,
})

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-jp',
  display: 'optional',
  preload: false,
})

const notoSansMono = Noto_Sans_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-sans-mono',
  display: 'swap',
  preload: false,
})

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://saigo-no-dante.com'
const shouldRenderAnalytics = process.env.VERCEL === '1'
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
  description: '림버스 컴퍼니 정보 사이트 — 수감자 인격·EGO 데이터베이스, 거울 던전 기프트 도감, 키워드 도감, 덱 빌더, 메타 분석까지 한 곳에서.',
  keywords: [
    'Limbus Company', '림버스 컴퍼니', '림버스', '림버스 정보', '림버스 정보 사이트',
    '림버스 컴퍼니 도감', '림버스 인격', '림버스 EGO', '림버스 덱', '림버스 덱 빌더',
    '수감자', '인격', 'EGO', '거울 던전', '에고 기프트', '키워드 도감',
    '림버스 거던', '거던 조합식', '거던 레시피', '거던 덱', '거던 기프트 조합',
    '덱 빌더', '메타 분석',
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
    description: '림버스 컴퍼니 정보 사이트 — 수감자 인격·EGO DB, 거울 던전 기프트, 덱 빌더',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '최애의 관리자 | 림버스 컴퍼니 정보 사이트',
    description: '림버스 컴퍼니 정보 사이트 — 수감자 인격·EGO DB, 거울 던전 기프트, 덱 빌더',
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
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/icons/apple-touch-icon.png',
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
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth" className={`${songMyung.variable} ${blackHanSans.variable} ${excelsiorSans.variable} ${mikodacs.variable} ${bebasKai.variable} ${kotraBold.variable} ${scDream.variable} ${pretendard.variable} ${paperlogy.variable} ${notoSansJP.variable} ${notoSansMono.variable}`}>
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
                <MotionConfig reducedMotion="user">{children}</MotionConfig>
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
        {shouldRenderAnalytics ? <Analytics /> : null}
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
