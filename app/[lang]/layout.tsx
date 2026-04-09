import { Suspense } from 'react'
import { LanguageProvider } from '@/lib/i18n'
import type { SupportedLang } from '@/lib/i18n/types'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import FloatingFontControl from '@/components/ui/FloatingFontControl'
import SkipNav from '@/components/a11y/SkipNav'
import AprilFoolsWrapper from '@/components/events/AprilFoolsWrapper'

const VALID_LANGS = ['ko', 'en', 'ja']

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const validLang = (VALID_LANGS.includes(lang) ? lang : 'ko') as SupportedLang

  return (
    <LanguageProvider initialLang={validLang}>
      <SkipNav />
      <AprilFoolsWrapper />
      <Suspense><Navbar /></Suspense>
      <Suspense><main id="main-content">{children}</main></Suspense>
      <Footer />
      <Suspense><FloatingFontControl /></Suspense>
    </LanguageProvider>
  )
}
