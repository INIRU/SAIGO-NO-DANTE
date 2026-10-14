import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

// An unknown URL is answered through this route, so its head is this route's: without it the 404 carried the home title
// and the layout's "index, follow" (not-found.tsx's own metadata is read only when the 404 is decided before the shell).
export const metadata: Metadata = { title: '404', robots: { index: false, follow: false } }

/** Sends unknown /{lang}/... URLs to app/[lang]/not-found.tsx, so the 404 keeps the site layout and locale. */
export default function CatchAll() {
  notFound()
}
