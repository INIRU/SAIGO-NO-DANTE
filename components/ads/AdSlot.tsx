'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { usePathname } from 'next/navigation'
import { ADSENSE_ACCOUNT, ADSENSE_DISPLAY_SLOT } from '@/lib/seo/metadata'
import { isAdFreePath } from '@/lib/seo/ads'
import styles from './AdSlot.module.css'

declare global {
  interface Window { adsbygoogle?: unknown[] }
}

type Place = 'top' | 'inline' | 'panel' | 'left' | 'right'
const RAIL = 160
const GAP = 32
/** A side ad stands this far in from the window edge: off the edge, as far from the content as the margin allows (owner, 2026-11-06). */
const EDGE = 24

/** One AdSense request per <ins>; the key in AdSlot gives each page its own <ins> (and so a new ad). */
function Unit({ slot, className }: { slot: string; className: string }) {
  const ref = useRef<HTMLModElement>(null)
  useEffect(() => {
    // Two frames later, so a page-start banner the side ads have just hidden asks for nothing. StrictMode runs effects twice;
    // a hidden slot (a workspace, a phone-only or rail-hidden banner) has no width to fill.
    let second = 0
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => {
      const ins = ref.current
      if (!ins || ins.dataset.requested || !ins.offsetWidth) return
      ins.dataset.requested = '1'
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}) } catch { /* blocked by an ad blocker */ }
    }) })
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second) }
  }, [])
  return <ins ref={ref} className={`adsbygoogle ${className}`} data-ad-client={ADSENSE_ACCOUNT} data-ad-slot={slot} />
}

/**
 * Where a side ad stands: EDGE in from the window edge, away from the page's content, when the margin (measured from the
 * content's own boxes; pages are 64-90rem wide) holds the edge, the ad and at least GAP to the content; null when it does not.
 */
function useRailOffset(place: Place, pathname: string | null): number | null {
  const [offset, setOffset] = useState<number | null>(null)
  useEffect(() => {
    if (place !== 'left' && place !== 'right') return
    const main = document.getElementById('main-content')
    if (!main) return
    const measure = () => {
      // the page width without a classic (Windows) scrollbar: a fixed ad's `right` counts from the scrollbar, not the window edge
      const width = document.documentElement.clientWidth
      let left = width, right = 0
      for (const el of main.querySelectorAll(':scope > *, :scope > * > *, :scope > * > * > *, :scope > * > * > * > *')) {
        const box = el.getBoundingClientRect()
        if (box.width < 200 || box.width > width - 32 || !box.height || getComputedStyle(el).position === 'fixed') continue
        left = Math.min(left, box.left)
        right = Math.max(right, box.right)
      }
      const margin = place === 'left' ? left : width - right
      setOffset(right && margin >= EDGE + RAIL + GAP ? EDGE : null)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(main)
    return () => observer.disconnect()
  }, [place, pathname])
  return offset
}

/**
 * An ad where it never cuts into what is being read (DESIGN.md "광고"): `top`, a banner under a list page's title (it gives way
 * to the side ads where they stand); `inline`, the
 * same banner between a detail page's parts (under a deck's or plan's section tabs, before an identity's related lists, between
 * the home tools and video); `left` / `right`, a 160 x 600 ad standing in the empty margin near the window edge, away from the content, only when the
 * margin has room (and not on the home page, whose hero is full width); `panel`, a 300 x 250 ad in the skill motion player's
 * side panel. The size is reserved so an ad coming in never pushes the
 * page, and an unfilled unit hides its box. Ad-free pages draw nothing; development and a preview build (NEXT_PUBLIC_AD_PREVIEW=1,
 * e.g. behind a tunnel AdSense does not serve) show the reserved place instead of an ad.
 */
export default function AdSlot({ slot = ADSENSE_DISPLAY_SLOT, place, phoneOnly = false }: {
  slot?: string | null; place: Place
  /** Only below 768px (a page whose other ads are the wide-screen side ones) */
  phoneOnly?: boolean
}) {
  const pathname = usePathname()
  const offset = useRailOffset(place, pathname)
  const rail = place === 'left' || place === 'right'
  // a side ad that stands tells the page so: the page-start banner then gives way to it (owner, 2026-11-06)
  useEffect(() => {
    if (!rail || offset == null) return
    const flag = place === 'left' ? 'adRailLeft' : 'adRailRight'
    document.documentElement.dataset[flag] = ''
    return () => { delete document.documentElement.dataset[flag] }
  }, [rail, place, offset])
  // the skill motion player is ad-free and hides page ads, but owns one ad in its side panel
  if (!pathname || (place !== 'panel' && isAdFreePath(pathname))) return null
  if (rail && (/^\/(?:ko|en|ja)\/?$/.test(pathname) || offset == null)) return null
  const box = `${rail ? styles.rail : place === 'top' ? styles.top : place === 'panel' ? styles.panel : styles.inline}${phoneOnly ? ` ${styles.phoneOnly}` : ''}`
  const position = rail ? ({ [place]: `${offset}px` } as CSSProperties) : undefined
  const unit = rail ? styles.railUnit : place === 'panel' ? styles.panelUnit : styles.topUnit
  const kind = place === 'panel' ? '' : 'site-ad '
  const preview = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_AD_PREVIEW === '1'
  if (preview) return <aside className={`${kind}${box}`} style={position}><div className={`${unit} ${styles.preview}`}>AD</div></aside>
  if (!slot) return null
  return (
    <aside className={`${kind}${box}`} style={position}>
      <Unit key={pathname} slot={slot} className={unit} />
    </aside>
  )
}

/** The `top` ad's place while the page loads (PageHeaderSkeleton), so the loaded page does not move. */
export function AdSlotSpace() {
  const pathname = usePathname()
  if (isAdFreePath(pathname)) return null
  return <div className={styles.top} aria-hidden><div className={styles.topUnit} /></div>
}
