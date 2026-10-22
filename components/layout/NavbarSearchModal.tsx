'use client'

import { Suspense, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useLocale } from 'next-intl'
import { loadSearchIndex } from '@/hooks/useSearchIndex'

const SearchModal = dynamic(() => import('@/components/ui/SearchModal'))

interface Props {
  open: boolean
  /** Hover/focus on the search button: start loading before it is opened. */
  preload: boolean
  onClose: () => void
}

/**
 * The search modal's chunk loads after the page is idle (or on the first hover/open) instead of with every page. It is
 * mounted closed first and opened a frame later, so even the first open plays the enter animation. It has its own
 * Suspense boundary: a lazy chunk that is still loading must never send the navbar back to a fallback.
 * The search index (about 120KB) is fetched on hover/focus or the first open, not with the page.
 */
export default function NavbarSearchModal({ open, preload, onClose }: Props) {
  const [mounted, setMounted] = useState(false)
  const [ready, setReady] = useState(false)
  const locale = useLocale()
  if ((open || preload) && !mounted) setMounted(true)

  useEffect(() => {
    if (open || preload) loadSearchIndex(locale).catch(() => {})
  }, [open, preload, locale])

  useEffect(() => {
    if (mounted) return
    const idle = window.requestIdleCallback?.(() => setMounted(true), { timeout: 3000 })
    const timer = idle === undefined ? window.setTimeout(() => setMounted(true), 2000) : undefined
    return () => { if (idle !== undefined) window.cancelIdleCallback(idle); else window.clearTimeout(timer) }
  }, [mounted])
  useEffect(() => {
    if (!mounted) return
    let frame = 0
    void import('@/components/ui/SearchModal').then(() => {
      frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => setReady(true)) })
    })
    return () => cancelAnimationFrame(frame)
  }, [mounted])

  if (!mounted) return null
  return <Suspense fallback={null}><SearchModal open={open && ready} onClose={onClose} /></Suspense>
}
