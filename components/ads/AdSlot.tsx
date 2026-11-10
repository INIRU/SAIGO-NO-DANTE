'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { usePathname } from 'next/navigation'
import { ADSENSE_ACCOUNT, ADSENSE_SLOTS, ADS_ON, isAdFreePath } from '@/lib/seo/ads'
import styles from './AdSlot.module.css'

declare global {
  interface Window { adsbygoogle?: unknown[] }
}

type Place = 'top' | 'inline' | 'panel' | 'hero' | 'left' | 'right'
const RAIL = 160
const GAP = 32
/** A side ad stands this far in from the window edge: off the edge, as far from the content as the margin allows (owner, 2026-11-06). */
const EDGE = 24
/** The window height a 600px side ad needs below the navbar (AdSlot.module.css shows `.rail` from the same height). */
const RAIL_MIN_HEIGHT = 760
/** A side ad's top below the navbar (`.rail` top: 6rem). */
const RAIL_TOP = 96

/** One AdSense request per <ins>; the key in AdSlot gives each page its own <ins> (and so a new ad). */
function Unit({ slot, className }: { slot: string; className: string }) {
  const ref = useRef<HTMLModElement>(null)
  useEffect(() => {
    const ins = ref.current
    if (!ins) return
    // A hidden slot (a workspace, a phone-only banner, a page-start banner while the side ads stand) has no width and asks for
    // nothing; it asks once it shows, e.g. when a narrower window drops the side ads. Two frames later, so a banner the side
    // ads hide right after the first paint asks for nothing. StrictMode runs effects twice: `requested` keeps it to one ask.
    let first = 0, second = 0
    const tryRequest = () => {
      cancelAnimationFrame(first); cancelAnimationFrame(second)
      first = requestAnimationFrame(() => { second = requestAnimationFrame(() => {
        if (ins.dataset.requested || !ins.offsetWidth) return
        ins.dataset.requested = '1'
        observer.disconnect()
        // push({}) fills the first unprocessed ins.adsbygoogle on the page, not this one: with the class on every slot from the
        // start, a hidden page-start banner earlier in the page took the side ad's request. Only the slot asking now has it.
        ins.classList.add('adsbygoogle')
        try { (window.adsbygoogle = window.adsbygoogle || []).push({}) } catch { /* blocked by an ad blocker */ }
      }) })
    }
    const observer = new ResizeObserver(tryRequest)
    observer.observe(ins)
    return () => { observer.disconnect(); cancelAnimationFrame(first); cancelAnimationFrame(second) }
  }, [])
  return <ins ref={ref} className={className} data-ad-client={ADSENSE_ACCOUNT} data-ad-slot={slot} />
}

/**
 * Where a side ad stands: EDGE in from the window edge, away from the page's content, when the margin (measured from the
 * content's own boxes; pages are 64-90rem wide) holds the edge, the ad and at least GAP to the content and the window is tall
 * enough for the whole ad; null when it does not; undefined until measured. Content inside a `data-ad-rail-below` backdrop (a
 * sinner's hero, the home's first screen) stands above the side ads and does not count.
 */
function useRailOffset(place: Place, pathname: string | null): number | null | undefined {
  const [offset, setOffset] = useState<number | null>()
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
        // a full-bleed backdrop (a hero's art reaching the window edge) is decoration, not the content the ad stands beside
        if (box.width < 200 || box.width > width - 32 || box.left <= 0 || box.right >= width || !box.height
          || getComputedStyle(el).position === 'fixed' || el.closest('[data-ad-rail-below]')) continue
        left = Math.min(left, box.left)
        right = Math.max(right, box.right)
      }
      const margin = place === 'left' ? left : width - right
      const fits = right && innerHeight >= RAIL_MIN_HEIGHT
      setOffset(fits && margin >= EDGE + RAIL + GAP ? EDGE : null)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(main)
    return () => observer.disconnect()
  }, [place, pathname])
  return offset
}

/**
 * Where a side ad stands vertically: both stay in view while the page scrolls (owner, 2026-11-07, choosing this over AdSense's
 * "one sticky ad visible at a time", support.google.com/adsense/answer/10734935 — see DESIGN.md "광고"). Each starts below a
 * full-bleed backdrop (`data-ad-rail-below`, e.g. a sinner's hero art) and rises with the page to its place under the navbar
 * (RAIL_TOP); at the end of the page it stops GAP above the footer and scrolls up with it. Written straight to the element on
 * scroll and resize, so neither re-renders the ad.
 */
function useRailTop(rail: boolean) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!rail) return
    let frame = 0
    const place = () => {
      frame = 0
      const ad = ref.current
      if (!ad) return
      const backdrop = document.querySelector('[data-ad-rail-below]')
      // the drawn footer only: a hidden one (display: none on some pages, a streamed copy not shown yet) reads top 0, which put
      // both side ads above the window on plan and deck details
      const footer = [...document.querySelectorAll('.site-footer')].find(f => f.getClientRects().length)
      const below = backdrop ? backdrop.getBoundingClientRect().bottom + GAP : -Infinity
      const footerTop = footer ? footer.getBoundingClientRect().top : Infinity
      ad.style.top = `${Math.min(Math.max(RAIL_TOP, below), footerTop - GAP - ad.offsetHeight)}px`
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(place) }
    place()
    addEventListener('scroll', schedule, { passive: true })
    addEventListener('resize', schedule)
    // the page under it changes without a scroll (a loading screen with no hero giving way to the home, sections streaming in,
    // which move the backdrop and the footer): placed only on scroll, the side ad stayed at the navbar, over the home's hero
    const content = new ResizeObserver(schedule)
    const main = document.getElementById('main-content')
    if (main) content.observe(main)
    return () => {
      removeEventListener('scroll', schedule); removeEventListener('resize', schedule); content.disconnect(); cancelAnimationFrame(frame)
    }
  })
  return ref
}

/**
 * An ad where it never cuts into what is being read (DESIGN.md "광고"): `top`, a banner under a list page's title (it gives way
 * to the side ads where they stand); `inline`, the
 * same banner between a detail page's parts (under a deck's or plan's section tabs, before an identity's related lists, between
 * the home tools and video); `left` / `right`, a 160 x 600 ad standing in the empty margin near the window edge, away from the content, only when the
 * margin has room (below the home's first screen there); `hero`, a banner under the home hero's links (768px and wider); `panel`, a 300 x 250 ad in the skill motion player's
 * side panel. The size is reserved so an ad coming in never pushes the
 * page, and an unfilled unit hides its box. Ad-free pages draw nothing; development and a preview build (NEXT_PUBLIC_AD_PREVIEW=1,
 * e.g. behind a tunnel AdSense does not serve) show the reserved place instead of an ad.
 */
type AdSlotProps = {
  /** The place's own unit when left out; null draws no ad. */
  slot?: string | null; place: Place
  /** Only below 768px (a page whose other ads are the wide-screen side ones) */
  phoneOnly?: boolean
}

/** Nothing at all while the ads are switched off (ADS_ON): not even the side ads' measuring. */
export default function AdSlot(props: AdSlotProps) {
  return ADS_ON ? <Ad {...props} /> : null
}

function Ad({ slot: unitSlot, place, phoneOnly = false }: AdSlotProps) {
  const pathname = usePathname()
  const offset = useRailOffset(place, pathname)
  const rail = place === 'left' || place === 'right'
  const railRef = useRailTop(rail && offset != null)
  // the home hero's banner is the home's page-start banner: the list pages' start unit
  const slot = unitSlot === undefined ? ADSENSE_SLOTS[rail ? 'rail' : place === 'hero' ? 'top' : place] : unitSlot
  // Each side ad tells the page whether it stands ("on") or found no room ("off"): the page-start banner gives way to a side ad
  // and shows when neither fits, e.g. after the window narrows (owner, 2026-11-06). AdSlot.module.css reads the flags.
  useEffect(() => {
    if (!rail || offset === undefined) return
    const flag = place === 'left' ? 'adRailLeft' : 'adRailRight'
    document.documentElement.dataset[flag] = offset == null ? 'off' : 'on'
    return () => { delete document.documentElement.dataset[flag] }
  }, [rail, place, offset])
  // the skill motion player is ad-free and hides page ads, but owns one ad in its side panel
  if (!pathname || (place !== 'panel' && isAdFreePath(pathname))) return null
  // A side ad stays in the page while it has no room (hidden, not removed), so the ad it already holds comes back when the
  // window widens; removing it and asking AdSense again after a resize comes back unfilled (owner, 2026-11-07). Hidden, its
  // unit has no width and asks for nothing until it shows.
  const off = rail && offset == null
  const box = `${rail ? styles.rail : place === 'top' ? styles.top : place === 'panel' ? styles.panel : place === 'hero' ? styles.hero : styles.inline}${phoneOnly ? ` ${styles.phoneOnly}` : ''}`
  const position = rail ? ({ [place]: `${offset ?? EDGE}px` } as CSSProperties) : undefined
  const unit = rail ? styles.railUnit : place === 'panel' ? styles.panelUnit : place === 'hero' ? styles.heroUnit : place === 'inline' ? styles.inlineUnit : styles.topUnit
  const kind = place === 'panel' ? '' : 'site-ad '
  const preview = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_AD_PREVIEW === '1'
  if (preview) return <aside ref={rail ? railRef : undefined} data-off={off || undefined} className={`${kind}${box}`} style={position}><div className={`${unit} ${styles.preview}`}>AD</div></aside>
  if (!slot) return null
  return (
    <aside ref={rail ? railRef : undefined} data-off={off || undefined} className={`${kind}${box}`} style={position}>
      <Unit key={pathname} slot={slot} className={unit} />
    </aside>
  )
}

/** The `top` ad's place while the page loads (PageHeaderSkeleton), so the loaded page does not move. */
export function AdSlotSpace() {
  const pathname = usePathname()
  if (!ADS_ON || isAdFreePath(pathname)) return null
  return <div className={styles.top} aria-hidden><div className={styles.topUnit} /></div>
}
