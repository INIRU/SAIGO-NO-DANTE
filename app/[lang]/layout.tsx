import { Suspense } from 'react'
import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/lib/i18n/routing'
import type { SupportedLang } from '@/lib/i18n/types'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import FloatingFontControl from '@/components/ui/FloatingFontControl'
import SkipNav from '@/components/a11y/SkipNav'
import AprilFoolsWrapper from '@/components/events/AprilFoolsWrapper'
import SetHtmlLang from '@/components/i18n/SetHtmlLang'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ lang: locale }))
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

  return (
    <NextIntlClientProvider locale={validLang} messages={messages} now={new Date()} timeZone="Asia/Seoul">
      <SetHtmlLang lang={validLang} />
      <SkipNav />
      <AprilFoolsWrapper />
      <Suspense><Navbar /></Suspense>
      <Suspense><main id="main-content">{children}</main></Suspense>
      <Footer />
      <Suspense><FloatingFontControl /></Suspense>
    </NextIntlClientProvider>
  )
}
