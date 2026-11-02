'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Link, useRouter } from '@/lib/i18n/navigation'
import { cameFrom, nextNavStack } from '@/lib/navigation/nav-stack'
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
 * (the page's natural parent), e.g. after arriving from a search result or a shared link. With `parent` it only ever
 * lands on `href`, and a page reached any other way leaves the history, so the browser's back does not return to it.
 */
export default function BackLink({ href, onClick, className, parent, ...props }: ComponentProps<typeof Link> & { parent?: boolean }) {
  const router = useRouter()
  return <Link href={href} {...props} className={className ? 'hit-target ' + className : 'hit-target'} onClick={event => {
    onClick?.(event)
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
    if (parent) {
      event.preventDefault()
      if (cameFrom(read(), String(href))) router.back()
      else router.replace(href as string)
    } else if (read().length >= 2) { event.preventDefault(); router.back() }
  }} />
}
