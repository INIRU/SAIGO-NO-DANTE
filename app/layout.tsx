import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/seo/metadata'
import './globals.css'

export const metadata: Metadata = { metadataBase: new URL(SITE_URL) }

/** Pass-through: app/[lang]/layout.tsx renders <html lang={lang}> so crawlers see the page language; app/not-found.tsx renders its own document. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children
}
