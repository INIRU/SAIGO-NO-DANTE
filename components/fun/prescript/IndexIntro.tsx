'use client'

import { useEffect, useState } from 'react'
import DanteLogo from '@/components/brand/DanteLogo'
import styles from './prescript.module.css'

const SEEN_KEY = 'prescript-intro-seen'

/**
 * The page's one orchestrated moment: the site's own look (Dante's clock head and name in gold on brown) tears apart into
 * black, and the Index's emblem comes up in its blue. Once a tab session; a click or Escape skips it, reduced motion shows
 * the page at once.
 */
export default function IndexIntro({ siteName, title, english }: { siteName: string; title: string; english: string }) {
  // decided once, when first drawn (the page renders in the browser only): effects may run twice in development
  const [phase, setPhase] = useState<'playing' | 'leaving' | 'gone'>(() => {
    let seen = false
    try { seen = window.sessionStorage.getItem(SEEN_KEY) === '1' } catch { /* plays */ }
    return seen || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'gone' : 'playing'
  })
  useEffect(() => {
    try { window.sessionStorage.setItem(SEEN_KEY, '1') } catch { /* plays again next time */ }
    if (phase === 'gone') return
    const leave = window.setTimeout(() => setPhase('leaving'), 2600)
    const gone = window.setTimeout(() => setPhase('gone'), 3000)
    const skip = (event: KeyboardEvent) => { if (event.key === 'Escape') setPhase('gone') }
    window.addEventListener('keydown', skip)
    return () => { window.clearTimeout(leave); window.clearTimeout(gone); window.removeEventListener('keydown', skip) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, [])
  if (phase === 'gone') return null
  return <div className={`${styles.intro} ${styles.playing} ${phase === 'leaving' ? styles.leaving : ''}`} onClick={() => setPhase('gone')} aria-hidden="true">
    <div className={styles.introSite}><DanteLogo size="1.6em" />{siteName}</div>
    <div className={styles.introIndex}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a small game emblem from public/ */}
      <img src="/assets/fun/prescript/index_emblem_color_256.png" alt="" width={120} height={120} />
      <p>{title}</p>
      <small>{english}</small>
    </div>
    <div className={styles.scan} />
  </div>
}
