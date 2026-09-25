'use client'

import { useEffect, useRef } from 'react'
import { useTapEgg } from '@/components/community/easterEggs'
import styles from './HeroWordmark.module.css'

// HOSHI twists into SAIGO on a CSS loop; paused while the tab is hidden or the hero is off-screen.
export default function HeroWordmark({ className = '', as: Tag = 'h1' }: { className?: string; as?: 'h1' | 'p' }) {
  const ref = useRef<HTMLHeadingElement & HTMLParagraphElement>(null)
  const tapStar = useTapEgg('twisted-star', 10)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let onScreen = true
    const sync = () => el.toggleAttribute('data-paused', document.hidden || !onScreen)
    const io = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; sync() })
    io.observe(el)
    document.addEventListener('visibilitychange', sync)
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', sync) }
  }, [])

  return (
    <Tag ref={ref} className={`${styles.wordmark} ${className}`} onClick={tapStar}>
      <span className="sr-only">SAIGO NO DANTE</span>
      <span className={styles.visual} aria-hidden="true">
        <span className={styles.slot}>
          <span className={styles.hoshi}>HOSHI</span>
          <span className={styles.ghost}>SAIGO</span>
          <span className={styles.saigo}>SAIGO</span>
        </span>
        <span>NO DANTE</span>
      </span>
    </Tag>
  )
}
