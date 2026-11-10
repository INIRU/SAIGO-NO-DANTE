'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import type { IdentityStat, MetaData } from '@/lib/meta/types'
import type { SupportedLang } from '@/lib/i18n/types'
import styles from '@/styles/components/MetaAnalysis.module.css'
import DonutChart, { useSegments } from './DonutChart'
import { EgoLeaders, PairLeaders, PopularPosts, Portrait, SinnerLeaders } from './MetaSections'
import SkillExchangeInsight from './SkillExchangeInsight'

/** The whole scope at a glance; every identity opens the identity tab. */
export default function MetaOverview({ data, onSelect, shows = () => true }: {
  data: MetaData; onSelect: (identityId: string) => void
  /** Which identities the ranking lists (the page's rarity and sinner filters). */
  shows?: (row: IdentityStat) => boolean
}) {
  const t = useTranslations('meta.analysis')
  const rootT = useTranslations()
  const locale = useLocale() as SupportedLang
  const segments = useSegments()
  const [usage, setUsage] = useState<string | null>(null)
  const [combo, setCombo] = useState<string | null>(null)
  const [bench, setBench] = useState(false)
  const name = (row: { name_kr: string; name_en?: string | null; name_jp?: string | null }) => (locale === 'en' ? row.name_en : locale === 'ja' ? row.name_jp : row.name_kr) || row.name_kr
  const fielded = new Set(data.battleIdentityStats.map(row => row.identity_id))
  // A chosen sinner is never on the bench of a formation that fields them, so the bench ranking is not narrowed.
  const rankingRows = (bench ? data.supportIdentityStats : data.battleIdentityStats.filter(shows)).slice(0, 6)
  const slots = (data.skillSplits ?? []).reduce((sum, row) => sum + row.count, 0)

  return <div className={styles.analysis} data-meta-overview-tab>
    <section className={styles.overview} aria-labelledby="meta-overview-heading" data-meta-overview>
      <div className={styles.overviewHead}><h2 id="meta-overview-heading">{t('overview')}</h2></div>
      {data.sampleCount > 0 ? <div className={styles.overviewGrid}>
        <div className={styles.chartBlock}><h3>{t('usageTitle')}</h3>
          <DonutChart label={t('usageTitle')} segments={segments.usage(data.usageStats ?? [])} active={usage} onSelect={setUsage} /></div>
        <div className={styles.chartBlock}><h3>{t('comboTitle')}</h3>
          <DonutChart label={t('comboTitle')} segments={segments.combo(data.comboStats ?? [])} active={combo} onSelect={setCombo} /></div>
        <div className={styles.chartBlock}>
          <div className={styles.rankingHead}><h3>{t('topIdentities')}</h3>
            <div className={styles.segmented} role="group" aria-label={t('topIdentities')}>
              <button type="button" aria-pressed={!bench} onClick={() => setBench(false)}>{t('rankingFielded')}</button>
              <button type="button" aria-pressed={bench} onClick={() => setBench(true)}>{t('rankingBench')}</button>
            </div>
          </div>
          <ol className={styles.ranking}>{rankingRows.map((row, i) => <li key={row.identity_id}>
            <button type="button" disabled={!fielded.has(row.identity_id)} onClick={() => onSelect(row.identity_id)}>
              <span className={styles.rank}>{i + 1}</span>
              <Portrait row={row} size={40} className={styles.rankPortrait} />
              <span className={styles.rankName}>{name(row)}<small>{rootT('sinner.' + row.sinner_id)}</small></span>
              <span className={styles.share}>{(row.count / data.sampleCount * 100).toFixed(1)}<small>%</small></span>
              <span className={styles.legendCount}>{t('count', { count: row.count })}</span>
            </button>
          </li>)}</ol>
          {!rankingRows.length && <p className={styles.empty}>{t('empty')}</p>}
        </div>
      </div> : <p className={styles.empty}>{t('empty')}</p>}
    </section>
    {data.sampleCount > 0 && <>
      <SinnerLeaders data={data} onSelect={onSelect} />
      <div className={styles.pairRow}><EgoLeaders data={data} /><PairLeaders data={data} onSelect={onSelect} /></div>
      <SkillExchangeInsight splits={data.skillSplits ?? []} basis={t('skillsOverallBasis', { count: slots })} title={t('skillsOverall')} />
      <PopularPosts data={data} />
    </>}
  </div>
}
