'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Search, X } from 'lucide-react'
import BaseModal from '@/components/ui/BaseModal'
import IdentityFrameCard from '@/components/cards/IdentityFrameCard'
import { getSinnerLogoUrl } from '@/lib/utils/images'
import { SINNER_SLUGS } from '@/lib/constants/game'
import type { IdentityStat } from '@/lib/meta/types'
import { searchIdentityRows } from '@/features/meta/lib/identity-search'
import { useKeywords } from '@/components/providers/KeywordProvider'
import type { SupportedLang } from '@/lib/i18n/types'
import styles from '@/styles/components/MetaAnalysis.module.css'

const PAGE = 36

/** Searchable identity picker; cards show how often each identity is fielded and load more as the list scrolls. */
export default function IdentityPickerModal({ open, onClose, rows, sampleCount, selectedId, onSelect, name }: {
  open: boolean
  onClose: () => void
  rows: IdentityStat[]
  sampleCount: number
  selectedId: string
  onSelect: (identityId: string) => void
  name: (row: IdentityStat) => string
}) {
  const t = useTranslations('meta.analysis')
  const rootT = useTranslations()
  const locale = useLocale() as SupportedLang
  const keywords = useKeywords()
  const [search, setSearch] = useState('')
  const [sinner, setSinner] = useState('')
  const [byName, setByName] = useState(false)
  const [visible, setVisible] = useState(PAGE)
  const results = useRef<HTMLDivElement>(null)

  const sinners = SINNER_SLUGS.filter(slug => rows.some(row => row.sinner_id === slug))
  const filtered = useMemo(() => {
    const list = searchIdentityRows(sinner ? rows.filter(row => row.sinner_id === sinner) : rows, search, keywords)
    // A search ranks by relevance; the name order applies to the unsearched list.
    return byName && !search.trim() ? [...list].sort((a, b) => name(a).localeCompare(name(b), locale)) : list
  }, [rows, sinner, search, byName, locale, name, keywords])

  const reset = () => { setVisible(PAGE); results.current?.scrollTo({ top: 0 }) }
  useEffect(() => { if (open) { setSearch(''); setSinner(''); setVisible(PAGE) } }, [open])

  return <BaseModal open={open} onClose={onClose} title={t('identity')} maxWidth="60rem">
    <div className={styles.picker} data-analysis-picker>
      <header className={styles.pickerHead}>
        <h2>{t('identity')}</h2>
        <span className={styles.pickerCount}><b>{filtered.length}</b> / {rows.length}</span>
        <button type="button" onClick={onClose} aria-label={t('close')} className={styles.pickerClose}><X size={20} /></button>
      </header>
      <div className={styles.pickerTools}>
        <label className={styles.pickerSearch}>
          <Search size={17} aria-hidden="true" />
          <input autoFocus aria-label={t('search')} placeholder={t('search')} value={search} onChange={e => { setSearch(e.target.value); reset() }} />
          {search && <button type="button" onClick={() => { setSearch(''); reset() }} aria-label={t('clearSearch')}><X size={15} /></button>}
        </label>
        <div className={styles.pickerRow}>
          <div className={styles.pickerSinners} role="group" aria-label={t('sinner')}>
            <button type="button" aria-pressed={!sinner} onClick={() => { setSinner(''); reset() }} className={styles.pickerAll}>{t('all')}</button>
            {sinners.map(slug => <button type="button" key={slug} aria-pressed={sinner === slug} aria-label={rootT('sinner.' + slug)} title={rootT('sinner.' + slug)} onClick={() => { setSinner(sinner === slug ? '' : slug); reset() }}>
              <Image src={getSinnerLogoUrl(slug)} alt="" width={24} height={24} />
            </button>)}
          </div>
          <div className={styles.segmented} role="group" aria-label={t('sort')}>
            <button type="button" aria-pressed={!byName} onClick={() => { setByName(false); reset() }}>{t('sortUsage')}</button>
            <button type="button" aria-pressed={byName} onClick={() => { setByName(true); reset() }}>{t('sortName')}</button>
          </div>
        </div>
      </div>
      <div ref={results} className={styles.pickerResults} data-analysis-picker-results onScroll={event => {
        const el = event.currentTarget
        if (visible < filtered.length && el.scrollTop + el.clientHeight > el.scrollHeight - 480) setVisible(n => n + PAGE)
      }}>
        {filtered.length ? <ol className={styles.pickerGrid}>{filtered.slice(0, visible).map(row => {
          const active = row.identity_id === selectedId
          return <li key={row.identity_id}>
            <button type="button" className={'formation-board-button ' + styles.pickerCard} aria-pressed={active} aria-label={name(row)} onClick={() => onSelect(row.identity_id)}>
              <IdentityFrameCard identity={row} name={name(row)} selected={active} sizes="(max-width: 40rem) 30vw, 9rem" />
              <span className={styles.pickerStat}><span className={styles.share}>{(row.count / (sampleCount || 1) * 100).toFixed(1)}<small>%</small></span><span className={styles.legendCount}>{t('count', { count: row.count })}</span></span>
            </button>
          </li>
        })}</ol> : <p className={styles.empty}>{t('noMatches')}</p>}
      </div>
    </div>
  </BaseModal>
}
