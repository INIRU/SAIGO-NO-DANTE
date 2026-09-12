import '@/styles/globals/workspaces.css'
import VisitTracker from '@/components/discovery/VisitTracker'
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { getMessages, setRequestLocale, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/lib/i18n/routing'
import type { SupportedLang } from '@/lib/i18n/types'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import FloatingFontControl from '@/components/ui/FloatingFontControl'
import SkipNav from '@/components/a11y/SkipNav'
import AprilFoolsWrapper from '@/components/events/AprilFoolsWrapper'
import SetHtmlLang from '@/components/i18n/SetHtmlLang'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://saigo-no-dante.com'
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

  return {
    openGraph: {
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      images: [ogImage],
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

  const messages = await getMessages()
  const t = await getTranslations()
  const mainNavLabel = t('common.mainNav')

  return (
    <NextIntlClientProvider locale={validLang} messages={messages} timeZone="Asia/Seoul">
      <SetHtmlLang lang={validLang} />
      <SkipNav />
      <AprilFoolsWrapper />
      <div className="site-navigation"><Navbar mainNavLabel={mainNavLabel} /></div>
      <Suspense fallback={null}><VisitTracker /></Suspense>
      <main id="main-content">{children}</main>
      <Footer />
      <FloatingFontControl />
    </NextIntlClientProvider>
  )
}
