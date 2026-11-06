'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import BackLink from '@/components/navigation/BackLink'
import { HISTORY_KEY, historyTotals, readHistory, type PrescriptRunSummary } from '@/features/tools/lib/prescript-history'
import styles from './prescript.module.css'

/** My records: the dashboard over the finished runs of this browser, then each run, newest first. */
export default function PrescriptRecords() {
  const t = useTranslations('prescriptMode')
  const locale = useLocale()
  const [history, setHistory] = useState<PrescriptRunSummary[] | null>(null)
  useEffect(() => { try { setHistory(readHistory(window.localStorage.getItem(HISTORY_KEY))) } catch { setHistory([]) } }, [])
  const totals = historyTotals(history ?? [])
  return <div className={styles.root}>
    <div className={styles.wrap}>
      <header className={styles.head}>
        <BackLink href="/prescript" parent aria-label={t('toHub')} title={t('toHub')} className={styles.back}><ArrowLeft size={18} aria-hidden="true" /></BackLink>
        <h1>{t('recordsTitle')}</h1>
      </header>
      <dl className={styles.totals}>
        <div><dt>{t('totalRuns')}</dt><dd>{totals.runs}</dd></div>
        <div><dt>{t('totalGrace')}</dt><dd>{totals.grace}</dd></div>
        <div><dt>{t('bestGrace')}</dt><dd>{totals.bestGrace}</dd></div>
        <div><dt>{t('bestStreak')}</dt><dd>{totals.bestStreak}</dd></div>
        <div><dt>{t('fulfilRate')}</dt><dd>{totals.rate === null ? '-' : `${Math.round(totals.rate * 100)}%`}</dd></div>
      </dl>
      <h2 className={styles.sect}>{t('runsTitle')}</h2>
      {history && !history.length ? <p className={styles.empty}>{t('noRuns')}</p> :
        <ol className={styles.runs}>{(history ?? []).map(run => <li key={run.endedAt}>
          <time dateTime={new Date(run.endedAt).toISOString()}>{new Date(run.endedAt).toLocaleDateString(locale)}</time>
          <span className={styles.fl}>{run.floor ? `${run.floor}F` : '-'}</span>
          <span className={styles.counts}>{t(`grade_${run.grade ?? 'proselyte'}`)} {t('runCounts', { done: run.done, failed: run.failed, recalled: run.recalled })}</span>
          <b>{run.score}</b>
        </li>)}</ol>}
      <p className={styles.note}>{t('recordsNote')}</p>
    </div>
  </div>
}
