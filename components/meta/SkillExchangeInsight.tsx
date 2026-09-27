'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import ImageWithFallback from '@/components/ui/ImageWithFallback'
import { SIN_COLORS, normalizeSin } from '@/lib/constants/sin'
import { getSkillIconUrl } from '@/lib/utils/images'
import type { CountStat, MetaSkill } from '@/lib/meta/types'
import type { SupportedLang } from '@/lib/i18n/types'
import styles from '@/styles/components/MetaAnalysis.module.css'

const SHOWN = 5
const DEFAULT_SPLIT = '3-2-1'

/** How the formations fielding one identity spread its six skill slots over S1–S3: averages, then the most used splits. */
export default function SkillExchangeInsight({ splits, skills, identity, basis }: {
  splits: CountStat[]
  skills: MetaSkill[]
  identity: { sinner_id: string; game_id: string | null }
  basis: string
}) {
  const t = useTranslations('meta.analysis')
  const locale = useLocale() as SupportedLang
  const [all, setAll] = useState(false)
  const total = splits.reduce((sum, row) => sum + row.count, 0)
  if (!total) return null
  const counts = (key: string) => key.split('-').map(Number)
  const average = [0, 1, 2].map(i => splits.reduce((sum, row) => sum + counts(row.key)[i] * row.count, 0) / total)
  const custom = 1 - (splits.find(row => row.key === DEFAULT_SPLIT)?.count ?? 0) / total
  const top = splits[0].count
  const shown = all ? splits : splits.slice(0, SHOWN)

  const icon = (order: 1 | 2 | 3, dim = false) => {
    const skill = skills.find(row => row.order === order)
    const name = skill && ((locale === 'en' ? skill.name_en : locale === 'ja' ? skill.name_jp : null) || skill.name)
    const src = identity.game_id ? getSkillIconUrl(identity, order, skill ?? undefined) : ''
    const color = SIN_COLORS[normalizeSin(skill?.sin_affinity ?? null) ?? 'wrath']
    return <span className={styles.skillIcon} data-dim={dim || undefined} style={{ borderBottomColor: skill ? color : 'var(--border)' }} title={name ? `S${order} ${name}` : `S${order}`}>
      {src ? <ImageWithFallback src={src} alt={name ? `S${order} ${name}` : `S${order}`} width={32} height={32} fallbackType="skill" /> : <span>S{order}</span>}
    </span>
  }

  return <section className={styles.panel} aria-labelledby="skill-heading" data-meta-skills>
    <div className={styles.sectionHead}><h3 id="skill-heading">{t('skills')}</h3><span>{basis}</span></div>
    <div className={styles.skillSummary}>
      {([1, 2, 3] as const).map(order => <div key={order} className={styles.skillAverage}>
        {icon(order)}
        <span><small>{t('skillAverage')}</small><strong>{average[order - 1].toFixed(1)}</strong></span>
      </div>)}
      <div className={styles.skillCustom}>
        <span className={styles.share}>{(custom * 100).toFixed(1)}<small>%</small></span>
        <small>{t('skillCustom')}</small>
      </div>
    </div>
    <ol className={styles.skillSplits}>{shown.map((row, index) => {
      const split = counts(row.key)
      return <li key={row.key} data-top={index === 0 || undefined} aria-label={`S1 ${split[0]} · S2 ${split[1]} · S3 ${split[2]}, ${(row.count / total * 100).toFixed(1)}%`}>
        <span className={styles.skillSplit} aria-hidden="true">
          {([1, 2, 3] as const).map(order => <span key={order} className={styles.skillPick} data-zero={split[order - 1] === 0 || undefined}>
            {icon(order, split[order - 1] === 0)}<b>{split[order - 1]}</b>
          </span>)}
          {row.key === DEFAULT_SPLIT && <span className={styles.skillDefault}>{t('skillDefault')}</span>}
        </span>
        <span className={styles.skillTrack} aria-hidden="true"><span style={{ width: (row.count / top * 100) + '%' }} /></span>
        <span className={styles.share} aria-hidden="true">{(row.count / total * 100).toFixed(1)}<small>%</small></span>
        <span className={styles.legendCount} aria-hidden="true">{t('count', { count: row.count })}</span>
      </li>
    })}</ol>
    {splits.length > SHOWN && <button type="button" onClick={() => setAll(value => !value)} className={styles.moreButton}>{all ? t('less') : t('moreCount', { count: splits.length - SHOWN })}</button>}
  </section>
}
