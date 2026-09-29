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
    // The page end moves only when the content or the window resizes; scrolling reads just scrollY, so animations
    // running during a scroll are not forced into an extra layout every frame.
    let mainBottom = 0
    const measure = () => { mainBottom = main.getBoundingClientRect().bottom + window.scrollY }
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const end = mainBottom - window.innerHeight
        const up = end > 2 && window.scrollY > Math.min(240, window.innerHeight / 4)
        const down = end > 2 && window.scrollY < end - 2
        setDirections(previous => previous.up === up && previous.down === down ? previous : { up, down })
      })
    }
    const resized = () => { measure(); update() }
    const observer = new ResizeObserver(resized)
    observer.observe(main)
    window.addEventListener('resize', resized)
    window.addEventListener('scroll', update, { passive: true })
    resized()
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('resize', resized); window.removeEventListener('scroll', update) }
  }, [pathname])

  function move(direction: 'top' | 'bottom') {
    const main = document.getElementById('main-content')
    const top = direction === 'top' ? 0 : Math.max(0, (main?.getBoundingClientRect().bottom ?? 0) + window.scrollY - window.innerHeight)
    window.scrollTo({ top, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }

  return (
    // 두 버튼을 항상 두고 칸 높이를 전환해 갑자기 튀어나오지 않게 한다
    <nav className={`${styles.navigation} print:hidden!`} aria-label={t('label')} data-open={directions.up || directions.down || undefined}>
      <div className={styles.slot} data-open={directions.up || undefined} data-divider={(directions.up && directions.down) || undefined}>
        <div><button type="button" onClick={() => move('top')} aria-label={t('top')} title={t('top')} tabIndex={directions.up ? undefined : -1} aria-hidden={!directions.up || undefined}>
          <ArrowUp aria-hidden="true" />
        </button></div>
      </div>
      <div className={styles.slot} data-open={directions.down || undefined}>
        <div><button type="button" onClick={() => move('bottom')} aria-label={t('bottom')} title={t('bottom')} tabIndex={directions.down ? undefined : -1} aria-hidden={!directions.down || undefined}>
          <ArrowDown aria-hidden="true" />
        </button></div>
      </div>
    </nav>
  )
}
