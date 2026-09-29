import { Suspense } from 'react'
import IntlClientProvider from '@/components/providers/IntlClientProvider'
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
          {/* This page is part of every route's RSC payload. next-intl's server provider would fill in the missing
              now/timeZone/formats from the request config and read headers(), so every page rendered per request. */}
          <IntlClientProvider locale={locale} messages={{ errorPage: messages.errorPage }} timeZone="Asia/Seoul">
            <PageError code="404" />
          </IntlClientProvider>
        </Suspense>
      </body>
    </html>
  )
}
