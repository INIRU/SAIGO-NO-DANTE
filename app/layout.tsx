import type { Metadata } from 'next'
import { Song_Myung, Black_Han_Sans } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import SessionProvider from '@/components/providers/SessionProvider'
import FloatingFontControl from '@/components/ui/FloatingFontControl'

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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://saigonodante.com'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: '최애의 관리자 | SAIGO NO DANTE',
    template: '%s | 최애의 관리자',
  },
  description: 'Limbus Company 팬 아카이브 — 12인 수감자 인격·EGO 데이터베이스, 덱 빌더, 덱 공유를 한 곳에서.',
  keywords: [
    'Limbus Company', '림버스 컴퍼니', '수감자', '인격', 'EGO',
    '덱 빌더', '메타 분석', '팬 아카이브', '최애의 관리자',
    'Project Moon', '프로젝트 문',
  ],
  authors: [{ name: 'SAIGO NO DANTE' }],
  creator: 'SAIGO NO DANTE',
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: SITE_URL,
    siteName: '최애의 관리자',
    title: '최애의 관리자 | SAIGO NO DANTE',
    description: 'Limbus Company 팬 아카이브 — 수감자 DB, 덱 빌더, 덱 공유',
  },
  twitter: {
    card: 'summary_large_image',
    title: '최애의 관리자 | SAIGO NO DANTE',
    description: 'Limbus Company 팬 아카이브 — 수감자 DB, 덱 빌더, 덱 공유',
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
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" className={`${songMyung.variable} ${blackHanSans.variable}`}>
      <body className="antialiased">
        <SessionProvider>
          <Navbar />
          <main>{children}</main>
          <Footer />
          <FloatingFontControl />
        </SessionProvider>
        <Analytics />
      </body>
    </html>
  )
}
