import { Suspense } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import PageError from '@/components/ui/PageError'
import { routing } from '@/lib/i18n/routing'
import messages from '@/messages/en.json'

/** Fallback for URLs outside /{lang}/ (the proxy normally redirects those); localized 404s use app/[lang]/not-found.tsx. */
export default function NotFound() {
  const locale = routing.defaultLocale
  return (
    <html lang={locale}>
      <body className="antialiased">
        <Suspense fallback={null}>
          <NextIntlClientProvider locale={locale} messages={{ errorPage: messages.errorPage }}>
            <PageError code="404" />
          </NextIntlClientProvider>
        </Suspense>
      </body>
    </html>
  )
}
