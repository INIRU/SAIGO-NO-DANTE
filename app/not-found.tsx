import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import PageError from '@/components/ui/PageError'
import { routing } from '@/lib/i18n/routing'

/** Fallback for URLs outside /{lang}/ (the proxy normally redirects those); localized 404s use app/[lang]/not-found.tsx. */
export default async function NotFound() {
  const locale = routing.defaultLocale
  const { errorPage } = await getMessages({ locale })
  return (
    <NextIntlClientProvider locale={locale} messages={{ errorPage }}>
      <PageError code="404" />
    </NextIntlClientProvider>
  )
}
