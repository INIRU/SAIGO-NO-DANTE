'use client'

import { ArrowUp, ArrowDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname } from '@/lib/i18n/navigation'
import styles from './PageNavigation.module.css'

export default function PageNavigation() {
  const t = useTranslations('common.pageNavigation')
  const pathname = usePathname()
  const [directions, setDirections] = useState({ up: false, down: false })

  useEffect(() => {
    const main = document.getElementById('main-content')
    if (!main) return
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const end = main.getBoundingClientRect().bottom + window.scrollY - window.innerHeight
        const up = end > 2 && window.scrollY > 2
        const down = end > 2 && window.scrollY < end - 2
        setDirections(previous => previous.up === up && previous.down === down ? previous : { up, down })
      })
    }
    const observer = new ResizeObserver(update)
    observer.observe(main)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, { passive: true })
    update()
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('resize', update); window.removeEventListener('scroll', update) }
  }, [pathname])

  if (!directions.up && !directions.down) return null

  function move(direction: 'top' | 'bottom') {
    const main = document.getElementById('main-content')
    const top = direction === 'top' ? 0 : Math.max(0, (main?.getBoundingClientRect().bottom ?? 0) + window.scrollY - window.innerHeight)
    window.scrollTo({ top, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }

  return (
    <nav className={styles.navigation} aria-label={t('label')}>
      {directions.up && <button type="button" onClick={() => move('top')} aria-label={t('top')} title={t('top')}>
        <ArrowUp aria-hidden="true" />
      </button>}
      {directions.up && directions.down && <span aria-hidden="true" />}
      {directions.down && <button type="button" onClick={() => move('bottom')} aria-label={t('bottom')} title={t('bottom')}>
        <ArrowDown aria-hidden="true" />
      </button>}
    </nav>
  )
}
