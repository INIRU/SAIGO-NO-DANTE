'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, ChevronLeft, ChevronRight, Layers, Map as MapIcon } from 'lucide-react'
import { Link } from '@/lib/i18n/navigation'
import { locateInSeries, seriesPostHref, type SeriesPostKind, type SeriesView } from '@/lib/series/order'
import styles from './SeriesBox.module.css'

/** Where a deck or plan sits in its author's series, under the title: name, "3/7", neighbours, and the whole list folded open. */
export default function SeriesBox({ series, kind, postId }: { series: SeriesView; kind: SeriesPostKind; postId: string }) {
  const t = useTranslations('series')
  const [open, setOpen] = useState(false)
  const at = locateInSeries(series.items, kind, postId)
  if (!at) return null
  return (
    <section className={styles.box} data-open={open || undefined} aria-label={t('title')}>
      <div className={styles.bar}>
        <Layers size={16} className={styles.icon} aria-hidden="true" />
        <Link href={`/series/${series.id}`} className={styles.name}>{series.title}</Link>
        <span className={styles.position}>{at.index}/{at.total}</span>
        <span className={styles.steps}>
          {at.prev
            ? <Link href={seriesPostHref(at.prev.kind, at.prev.id)} className={styles.step} aria-label={`${t('prev')}: ${at.prev.title}`} title={at.prev.title}><ChevronLeft size={18} aria-hidden="true" /></Link>
            : <span className={styles.step} aria-hidden="true"><ChevronLeft size={18} /></span>}
          {at.next
            ? <Link href={seriesPostHref(at.next.kind, at.next.id)} className={styles.step} aria-label={`${t('next')}: ${at.next.title}`} title={at.next.title}><ChevronRight size={18} aria-hidden="true" /></Link>
            : <span className={styles.step} aria-hidden="true"><ChevronRight size={18} /></span>}
          <button type="button" className={`${styles.step} ${styles.toggle}`} aria-expanded={open} aria-label={t('list')} onClick={() => setOpen(value => !value)}>
            <ChevronDown size={18} aria-hidden="true" />
          </button>
        </span>
      </div>
      <div className={styles.fold}>
        <div className={styles.foldInner} inert={!open}>
          <ol className={styles.list}>
            {at.ordered.map((item, index) => {
              const current = item.kind === kind && item.id === postId
              const Icon = item.kind === 'deck' ? Layers : MapIcon
              return (
                <li key={`${item.kind}:${item.id}`}>
                  <Link href={seriesPostHref(item.kind, item.id)} className={styles.row} aria-current={current ? 'page' : undefined}>
                    <span className={styles.index}>{index + 1}</span>
                    <Icon size={16} aria-hidden="true" />
                    <span className={styles.rowTitle}>{item.title}</span>
                  </Link>
                </li>
              )
            })}
          </ol>
          <Link href={`/series/${series.id}`} className={styles.all}>{t('viewAll')}</Link>
        </div>
      </div>
    </section>
  )
}
