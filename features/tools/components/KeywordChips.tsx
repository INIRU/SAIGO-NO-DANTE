'use client'

import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { useKeywordData, useKeywords } from '@/components/providers/KeywordProvider'
import { SIN_COLORS } from '@/lib/constants/sin'
import { getLocalizedKeywordName } from '@/lib/i18n'
import type { SupportedLang } from '@/lib/i18n/types'
import type { KeywordCondition } from '@/features/tools/lib/random/engine'
import styles from '@/features/tools/components/RandomClient.module.css'

const MAIN_KEYWORDS = ['화상', '출혈', '진동', '파열', '침잠', '호흡', '충전']

export default function KeywordChips({ keywords, onChange, onMaxExceeded, disabled }: {
  keywords: KeywordCondition[]
  onChange: (keywords: KeywordCondition[]) => void
  onMaxExceeded: () => void
  disabled?: boolean
}) {
  const t = useTranslations('randomPage')
  const lang = useLocale() as SupportedLang
  const catalog = useKeywords()
  const { sinMap, getIconUrl } = useKeywordData()
  const label = (kw: string) => getLocalizedKeywordName(kw, catalog[kw], lang)

  function toggle(kw: string) {
    if (keywords.some(k => k.keyword === kw)) return onChange(keywords.filter(k => k.keyword !== kw))
    if (keywords.length >= 2) return onMaxExceeded()
    onChange([...keywords, { keyword: kw, minCount: 5 }])
  }

  return (
    <>
      <div className={styles.keywords}>
        {MAIN_KEYWORDS.map(kw => {
          const icon = getIconUrl(kw)
          return (
            <button key={kw} type="button" className={styles.toggle} aria-pressed={keywords.some(k => k.keyword === kw)} onClick={() => toggle(kw)} disabled={disabled}>
              {icon && <Image src={icon} alt="" width={16} height={16} />}
              {label(kw)}
            </button>
          )
        })}
      </div>
      {!disabled && keywords.map(({ keyword, minCount }) => {
        const sin = sinMap[keyword]
        const color = sin ? SIN_COLORS[sin] : '#c8900a'
        return (
          <label key={keyword} className={styles.slider} style={{ '--kw': color } as React.CSSProperties}>
            <span className={styles.sliderName}>{label(keyword)}</span>
            <input type="range" min={1} max={12} value={minCount} aria-label={t('keywordMin', { count: minCount })}
              onChange={event => onChange(keywords.map(k => k.keyword === keyword ? { ...k, minCount: Number(event.target.value) } : k))} />
            <span className={styles.sliderValue}>{t('keywordMin', { count: minCount })}</span>
          </label>
        )
      })}
    </>
  )
}
