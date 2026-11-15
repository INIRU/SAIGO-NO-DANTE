import '@/styles/globals/workspaces.css'
import type { CSSProperties } from 'react'
import { Toaster } from 'sonner'
import MotionProvider from '@/components/ui/MotionProvider'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import SessionProvider from '@/components/providers/SessionProvider'
import SignedInNotices from './_components/SignedInNotices'
import SWRProvider from '@/components/providers/SWRProvider'
import ServiceWorkerRegister from '@/components/pwa/ServiceWorkerRegister'
import UpdateNotice from '@/components/pwa/UpdateNotice'
import JsonLd, { websiteJsonLd, organizationJsonLd, videoGameJsonLd } from '@/components/seo/JsonLd'
import VisitTracker from '@/features/community/components/VisitTracker'
import { NavigationTracker } from '@/components/navigation/BackLink'
import { KonamiListener } from '@/components/brand/easter-eggs'
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import IntlClientProvider from '@/components/providers/IntlClientProvider'
import { getMessages, setRequestLocale, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/lib/i18n/routing'
import type { SupportedLang } from '@/lib/i18n/types'
import { translations } from '@/lib/i18n/translations'
import { ADSENSE_ACCOUNT, CLOUDFLARE_WEB_ANALYTICS_TOKEN, OG_LOCALE, SITE_NAME, SITE_URL, localeUrl } from '@/lib/seo/metadata'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import AdSlot from '@/components/ads/AdSlot'
import { ADS_ON } from '@/lib/seo/ads'
import PageNavigation from '@/components/ui/PageNavigation'
import AnnouncementPopup from '@/features/admin/components/AnnouncementPopup'
import SkipNav from '@/components/a11y/SkipNav'
import ScrollbarHover from '@/components/layout/ScrollbarHover'
import AprilFoolsWrapper from '@/features/mirror-dungeon/components/AprilFoolsWrapper'
import { KeywordProvider } from '@/components/providers/KeywordProvider'
import { GameTextRefsProvider } from '@/components/providers/GameTextRefsProvider'
import { getGameTextRefNamesWireOrNull } from '@/lib/db/game-text-refs'
import { getKeywordCatalog } from '@/lib/keywords/server-data'
import { fontVariables } from '../fonts'
import { ROOT_OMITTED_MESSAGES, omitMessages } from '@/lib/i18n/client-messages'
import { NAV_BOOT_SCRIPT } from '@/lib/constants/nav-boot'
import { MEDIA_ORIGIN } from '@/lib/seo/media-origin'

const toastPositionStyle = {
  '--toast-close-button-start': 'unset',
  '--toast-close-button-end': '0',
  '--toast-close-button-transform': 'translate(35%, -35%)',
} as CSSProperties

function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString()
}

function isSupportedLang(lang: string): lang is SupportedLang {
  return lang === 'ko' || lang === 'en' || lang === 'ja'
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ lang: locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang: rawLang } = await params
  const lang = isSupportedLang(rawLang) ? rawLang : 'ko'
  const ogImage = absoluteUrl(`/${lang}/opengraph-image`)
  const title = translations['home.meta.title'][lang]
  const description = translations['home.meta.description'][lang]

  // No alternates here: a layout cannot know the page path, and an inherited canonical would point every page at home.
  return {
    title: { default: title, template: `%s | ${SITE_NAME[lang]}` },
    description,
    keywords: [
      'Limbus Company', '림버스 컴퍼니', '림버스', '림버스 정보', '림버스 도감',
      '림버스 인격', '림버스 E.G.O', '림버스 덱', '거울 던전', '에고 기프트', '키워드 도감',
      '최애의 관리자', 'SAIGO NO DANTE', 'Project Moon', '프로젝트 문',
    ],
    authors: [{ name: 'SAIGO NO DANTE' }],
    creator: 'SAIGO NO DANTE',
    openGraph: {
      type: 'website',
      locale: OG_LOCALE[lang],
      url: localeUrl(lang),
      siteName: SITE_NAME[lang],
      title,
      description,
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
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
      // Google Search does not accept SVG favicons, and one unusable icon link makes it drop them all.
      icon: [{ url: '/favicon.ico', sizes: '16x16 32x32 48x48' }],
      apple: '/icons/apple-touch-icon.png',
    },
    other: {
      'mobile-web-app-capable': 'yes',
      'google-adsense-account': ADSENSE_ACCOUNT,
    },
  }
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  if (!hasLocale(routing.locales, lang)) {
    notFound()
  }
  const validLang = lang as SupportedLang

  setRequestLocale(validLang)

  // Explicit locale: with Cache Components the shell (<html>) must not read the request locale from headers.
  // Descriptions are left out of every page's payload; tooltips load them once from /api/keyword-descriptions.
  // The names of `[Id]` references in game text go along with the page so the first paint is final (no raw ids swapping later).
  const [messages, keywords, refNames, t] = await Promise.all([
    getMessages({ locale: validLang }),
    // A failed read is not cached; this page then draws without keyword icons.
    getKeywordCatalog(validLang).catch(() => ({})),
    getGameTextRefNamesWireOrNull(validLang),
    getTranslations({ locale: validLang }),
  ])
  const mainNavLabel = t('common.mainNav')

  return (
    <html lang={validLang} suppressHydrationWarning data-scroll-behavior="smooth" className={fontVariables}>
      <head>
        {/* Game icons shown without the optimizer load from storage directly; optimized images come from the media host when self-hosted. */}
        <link rel="preconnect" href="https://lpgqcleszdlldneiwgep.supabase.co" />
        {process.env.SELF_HOSTED === '1' ? <link rel="preconnect" href={MEDIA_ORIGIN} /> : null}
        {/* The AdSense code as AdSense gives it (async, in the head): site review and Auto ads read it from the HTML. */}
        {ADS_ON && <script async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_ACCOUNT}`} crossOrigin="anonymous" />}
      </head>
      <body className="antialiased">
        {/* The inline scripts open the body rather than sit in the head: AdSense puts its own script first in the head
            before React hydrates, and React then finds every head child one place off (a hydration mismatch). They
            still run before the page paints. */}
        {/* Sets html[data-mac]/[data-auth-hint] before paint so the navbar never swaps its hint or login slot. */}
        <script dangerouslySetInnerHTML={{ __html: NAV_BOOT_SCRIPT }} />
        <JsonLd data={websiteJsonLd(validLang)} />
        <JsonLd data={organizationJsonLd(SITE_URL)} />
        <JsonLd data={videoGameJsonLd(validLang)} />
        <NuqsAdapter>
          <SessionProvider notices={<SignedInNotices />}>
            <SWRProvider>
              <MotionProvider>
                {/* Section-only messages (planner, meta, …) are added by their layouts, not sent with every page. */}
                <IntlClientProvider locale={validLang} messages={omitMessages(messages, ROOT_OMITTED_MESSAGES)} timeZone="Asia/Seoul">
                  <GameTextRefsProvider locale={validLang} names={refNames}>
                    <KeywordProvider keywords={keywords}>
                      <SkipNav lang={validLang} />
                      <AprilFoolsWrapper />
                      {/* The navbar body never reads the pathname (request data on routes with unknown params, e.g. /decks/[id]), so it is part of the static shell; its pathname-dependent marks are small Suspense islands inside. */}
                      <div className="site-navigation"><Navbar mainNavLabel={mainNavLabel} /></div>
                      <Suspense fallback={null}><VisitTracker /></Suspense>
                      <Suspense fallback={null}><NavigationTracker /></Suspense>
                      <KonamiListener />
                      {/* Catches page-level dynamic holes (formerly caught by app/loading.tsx above <html>); plain Suspense keeps the old page during navigations. */}
                      <main id="main-content"><Suspense fallback={null}>{children}</Suspense></main>
                      {/* The side ads, in the empty margins of a wide screen (DESIGN.md "광고"); they read the pathname, so each
                          is its own island. The other ads sit in the pages, where each fits. */}
                      <Suspense fallback={null}><AdSlot place="left" /></Suspense>
                      <Suspense fallback={null}><AdSlot place="right" /></Suspense>
                      <Footer lang={validLang} />
                      <Suspense fallback={null}><PageNavigation /></Suspense>
                      <Suspense fallback={null}><AnnouncementPopup lang={validLang} /></Suspense>
                      <UpdateNotice />
                    </KeywordProvider>
                  </GameTextRefsProvider>
                </IntlClientProvider>
              </MotionProvider>
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
              background: 'var(--bg-card)',
              border: '0.0625rem solid #3a3020',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-body)',
              paddingRight: '2.5rem',
            },
          }}
        />
        <ScrollbarHover />
        {process.env.SELF_HOSTED === '1' ? (
          <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon={JSON.stringify({ token: CLOUDFLARE_WEB_ANALYTICS_TOKEN })} />
        ) : null}
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
