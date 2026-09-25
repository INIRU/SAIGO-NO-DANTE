'use client'

import type { ReactNode } from 'react'
import Image from 'next/image'
import { Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { RARITY_ICON_MAP } from '@/lib/constants/game'
import type { KeywordCondition } from '@/lib/random/engine'
import KeywordChips from './KeywordChips'
import styles from './random.module.css'

type Props = {
  identityEnabled: boolean
  egoEnabled: boolean
  collectionEnabled: boolean
  collectionCode: string
  collectionDecoded: boolean
  keywords: KeywordCondition[]
  rarityFilter: Set<number> | null
  onIdentityToggle: () => void
  onEgoToggle: () => void
  onCollectionToggle: () => void
  onCollectionCodeChange: (code: string) => void
  onKeywordsChange: (keywords: KeywordCondition[]) => void
  onKeywordMaxExceeded: () => void
  onRarityFilterChange: (filter: Set<number> | null) => void
  /** Roll / copy buttons, shown at the bottom of the panel on desktop. */
  actions: ReactNode
}

const RARITIES = [1, 2, 3]

export default function OptionPanel(props: Props) {
  const t = useTranslations('randomPage')
  // Every rarity on = no filter; the last one can't be turned off.
  function toggleRarity(rarity: number) {
    const current = props.rarityFilter ?? new Set(RARITIES)
    const next = new Set(current)
    if (next.has(rarity)) { if (next.size === 1) return; next.delete(rarity) } else next.add(rarity)
    props.onRarityFilterChange(next.size === RARITIES.length ? null : next)
  }
  return (
    <aside className={`${styles.panel} sticky-under-nav`}>
      <section className={styles.group}>
        <h2 className={styles.label}>{t('draw')}</h2>
        <div className={styles.pair}>
          <button type="button" className={styles.toggle} aria-pressed={props.identityEnabled} onClick={props.onIdentityToggle}>{t('identity')}</button>
          <button type="button" className={styles.toggle} aria-pressed={props.egoEnabled} onClick={props.onEgoToggle}>{t('ego')}</button>
        </div>
      </section>

      <section className={styles.group}>
        <h2 className={styles.label}>{t('rarity')}</h2>
        <div className={styles.rarities}>
          {RARITIES.map(rarity => {
            const on = props.rarityFilter === null || props.rarityFilter.has(rarity)
            return (
              <button key={rarity} type="button" className={styles.toggle} aria-pressed={on} aria-label={`${rarity}`} onClick={() => toggleRarity(rarity)} disabled={!props.identityEnabled}>
                <Image src={RARITY_ICON_MAP[rarity]} alt="" width={rarity * 24} height={24} unoptimized className={styles.rarityIcon} />
              </button>
            )
          })}
        </div>
      </section>

      <section className={styles.group}>
        <h2 className={styles.label}>{t('keywords')}</h2>
        <KeywordChips keywords={props.keywords} onChange={props.onKeywordsChange} onMaxExceeded={props.onKeywordMaxExceeded} disabled={!props.identityEnabled} />
      </section>

      <section className={styles.group}>
        <label className={styles.switchRow}>
          <span className={styles.label}>{t('collection')}</span>
          {props.collectionEnabled && props.collectionDecoded && <span className={styles.linked}><Check aria-hidden="true" />{t('collectionLinked')}</span>}
          <input type="checkbox" role="switch" className={styles.switch} checked={props.collectionEnabled} onChange={props.onCollectionToggle} />
        </label>
        {props.collectionEnabled && (
          <input
            type="text"
            className={styles.input}
            placeholder={t('collectionPlaceholder')}
            aria-label={t('collectionPlaceholder')}
            value={props.collectionCode}
            onChange={event => {
              const value = event.target.value
              const code = value.match(/[?&]code=([^&]+)/)?.[1]
              props.onCollectionCodeChange(code ? decodeURIComponent(code) : value)
            }}
          />
        )}
      </section>

      {props.actions}
    </aside>
  )
}
