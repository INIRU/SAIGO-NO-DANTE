'use client'

import { Suspense, type ReactNode } from 'react'
import { usePathname } from '@/lib/i18n/navigation'

function Resolved({ children }: { children: (pathname: string) => ReactNode }) {
  return children(usePathname())
}

/**
 * Small island for the parts of the navbar that need the pathname. On routes with unknown params the pathname is request
 * data and only arrives after the static shell, so the shell shows `children(null)` (the same bar, nothing marked current)
 * and the real pathname fills in the marks later. The navbar body never waits for it.
 */
export default function PathnameBoundary({ children }: { children: (pathname: string | null) => ReactNode }) {
  return <Suspense fallback={children(null)}><Resolved>{children}</Resolved></Suspense>
}
