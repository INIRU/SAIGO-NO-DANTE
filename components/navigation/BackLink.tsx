'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Link, useRouter } from '@/lib/i18n/navigation'
import { nextNavStack } from '@/lib/navigation/nav-stack'
import type { ComponentProps } from 'react'

/** In-app page history of this tab: pathnames visited through the site, latest last. */
const KEY = 'limbus-nav-stack'
const read = (): string[] => { try { const value: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? '[]'); return Array.isArray(value) ? value.filter(item => typeof item === 'string') : [] } catch { return [] } }

/** Records in-app navigation for BackLink; mounted once in the locale layout. */
export function NavigationTracker() {
  const pathname = usePathname()
  useEffect(() => {
    try { sessionStorage.setItem(KEY, JSON.stringify(nextNavStack(read(), pathname))) } catch { /* private mode: BackLink uses its fallback */ }
  }, [pathname])
  return null
}

/**
 * A back link: returns to the previous page when it was a page of this site in this tab, otherwise opens `href`
 * (the page's natural parent), e.g. after arriving from a search result or a shared link.
 */
export default function BackLink({ href, onClick, ...props }: ComponentProps<typeof Link>) {
  const router = useRouter()
  return <Link href={href} {...props} onClick={event => {
    onClick?.(event)
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
    if (read().length >= 2) { event.preventDefault(); router.back() }
  }} />
}
