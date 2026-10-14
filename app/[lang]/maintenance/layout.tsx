import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import RequestTimeRoute from '@/components/layout/RequestTimeRoute'

// The page is a client component, so its metadata lives here. A crawler that arrives during maintenance must not index the notice.
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'maintenance' })
  return { title: t('title'), robots: { index: false, follow: false } }
}

// The notice comes from the URL (reason, message, start and end time); the route renders per request so it is in the HTML.
export default function MaintenanceLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <RequestTimeRoute />
    </>
  )
}
