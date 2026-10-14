import type { Metadata } from 'next'
import PageError from '@/components/ui/PageError'

// Read when a 404 is decided before the shell is sent; unknown URLs get the same from app/[lang]/[...rest]/page.tsx.
export const metadata: Metadata = { title: '404', robots: { index: false, follow: false } }

export default function NotFound() {
  return <PageError code="404" />
}
