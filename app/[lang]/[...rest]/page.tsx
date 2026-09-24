import { notFound } from 'next/navigation'

/** Sends unknown /{lang}/... URLs to app/[lang]/not-found.tsx, so the 404 keeps the site layout and locale. */
export default function CatchAll() {
  notFound()
}
