'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { usePathname } from 'next/navigation'
import { ADSENSE_ACCOUNT, ADSENSE_DISPLAY_SLOT } from '@/lib/seo/metadata'
import { isAdFreePath } from '@/lib/seo/ads'
import styles from './AdSlot.module.css'

declare global {
  interface Window { adsbygoogle?: unknown[] }
}

type Place = 'top' | 'inline' | 'left' | 'right'
const RAIL = 160
const GAP = 32

/** One AdSense request per <ins>; the key in AdSlot gives each page its own <ins> (and so a new ad). */
function Unit({ slot, className }: { slot: string; className: string }) {
  const ref = useRef<HTMLModElement>(null)
  useEffect(() => {
    const ins = ref.current
    // StrictMode runs effects twice; a hidden slot (a full-screen workspace) has no width to fill
    if (!ins || ins.dataset.requested || !ins.offsetWidth) return
    ins.dataset.requested = '1'
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}) } catch { /* blocked by an ad blocker */ }
  }, [])
  return <ins ref={ref} className={`adsbygoogle ${className}`} data-ad-client={ADSENSE_ACCOUNT} data-ad-slot={slot} />
}

/**
 * Where a side ad stands: GAP beside the page's content, measured from the content's own boxes (pages are 64-90rem wide), or
 * null when the margin is too narrow for it.
 */
function useRailOffset(place: Place, pathname: string | null): number | null {
  const [offset, setOffset] = useState<number | null>(null)
  useEffect(() => {
    if (place !== 'left' && place !== 'right') return
    const main = document.getElementById('main-content')
    if (!main) return
    const measure = () => {
      let left = innerWidth, right = 0
      for (const el of main.querySelectorAll(':scope > *, :scope > * > *, :scope > * > * > *, :scope > * > * > * > *')) {
        const box = el.getBoundingClientRect()
        if (box.width < 200 || box.width > innerWidth - 32 || !box.height || getComputedStyle(el).position === 'fixed') continue
        left = Math.min(left, box.left)
        right = Math.max(right, box.right)
      }
      const margin = place === 'left' ? left : innerWidth - right
      setOffset(right && margin >= RAIL + GAP + 16 ? margin - RAIL - GAP : null)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(main)
    return () => observer.disconnect()
  }, [place, pathname])
  return offset
}

/**
 * An ad where it never cuts into what is being read (DESIGN.md "광고"): `top`, a banner under a list page's title; `inline`, the
 * same banner between a detail page's parts (under a deck's or plan's section tabs, before an identity's related lists, between
 * the home tools and video); `left` / `right`, a 160 x 600 ad standing in the empty margin GAP beside the content, only when the
 * margin has room (and not on the home page, whose hero is full width). The size is reserved so an ad coming in never pushes the
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
  if (isAdFreePath(pathname)) return null
  const rail = place === 'left' || place === 'right'
  if (rail && (/^\/(?:ko|en|ja)\/?$/.test(pathname!) || offset == null)) return null
  const box = `${rail ? styles.rail : place === 'top' ? styles.top : styles.inline}${phoneOnly ? ` ${styles.phoneOnly}` : ''}`
  const position = rail ? ({ [place]: `${offset}px` } as CSSProperties) : undefined
  const unit = rail ? styles.railUnit : styles.topUnit
  const preview = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_AD_PREVIEW === '1'
  if (preview) return <aside className={`site-ad ${box}`} style={position}><div className={`${unit} ${styles.preview}`}>AD</div></aside>
  if (!slot) return null
  return (
    <aside className={`site-ad ${box}`} style={position}>
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
