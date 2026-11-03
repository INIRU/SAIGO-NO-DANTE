'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import BackLink from '@/components/navigation/BackLink'
import { Link } from '@/lib/i18n/navigation'
import { GRADE_KEY, HISTORY_KEY, readGrade, readHistory, type PrescriptRunSummary } from '@/lib/fun/prescript-history'
import type { PrescriptGrade } from '@/lib/fun/prescript'
import IndexIntro from './IndexIntro'
import PrescriptRules from './PrescriptRules'
import styles from './prescript.module.css'

/**
 * The Index mode's entrance: the terminal to switch on, the last finished run, and the ways to my records, the ranking and
 * the rules. The site's look breaks into the Index's here, once a tab session.
 */
export default function PrescriptHub() {
  const t = useTranslations('prescriptMode')
  const locale = useLocale()
  const [last, setLast] = useState<PrescriptRunSummary | null>(null)
  useEffect(() => { try { setLast(readHistory(window.localStorage.getItem(HISTORY_KEY))[0] ?? null) } catch { /* no records */ } }, [])
  const [rules, setRules] = useState(false)
  const [grade, setGrade] = useState<PrescriptGrade>('proselyte')
  useEffect(() => { try { setGrade(readGrade(window.localStorage.getItem(GRADE_KEY))) } catch { /* proselyte */ } }, [])
  const choose = (next: PrescriptGrade) => { setGrade(next); try { window.localStorage.setItem(GRADE_KEY, next) } catch { /* this visit only */ } }
  return <div className={styles.root} data-prescript-hub>
    <IndexIntro siteName="SAIGO NO DANTE" title={t('title')} english="The Index" />
    <div className={`${styles.wrap} ${styles.hub}`}>
      <BackLink href="/" aria-label={t('leave')} title={t('leave')} className={styles.back}><ArrowLeft size={18} aria-hidden="true" /></BackLink>
      <section className={styles.hero}>
        {/* eslint-disable-next-line @next/next/no-img-element -- the game's Index emblem from public/ */}
        <img src="/assets/fun/prescript/index_emblem_color_256.png" alt="" width={112} height={112} />
        <h1>{t('title')}</h1>
        <p>{t('hubLine')}</p>
        <div className={styles.grades} role="radiogroup" aria-label={t('gradeTitle')}>
          {(['proselyte', 'proxy'] as const).map(item => <button key={item} type="button" role="radio" aria-checked={grade === item}
            className={grade === item ? styles.gradeOn : undefined} onClick={() => choose(item)}>
            <b>{t(`grade_${item}`)}</b><span>{t(`grade_${item}_line`)}</span>
          </button>)}
        </div>
        <Link href="/prescript/terminal" className={`${styles.b} ${styles.pri} ${styles.start}`}>{t('hubStart')}</Link>
      </section>

      {last && <section className={styles.last} aria-label={t('hubLast')}>
        <h2>{t('hubLast')}<time dateTime={new Date(last.endedAt).toISOString()}>{new Date(last.endedAt).toLocaleDateString(locale)}</time></h2>
        <p className={styles.grace}><b>{last.score}</b>{t('scoreUnit')}</p>
        <dl>
          <div><dt>{t('status_done')}</dt><dd>{last.done}</dd></div>
          <div><dt>{t('status_failed')}</dt><dd>{last.failed}</dd></div>
          <div><dt>{t('status_void')}</dt><dd>{last.recalled}</dd></div>
          <div><dt>{t('bestStreak')}</dt><dd>{last.bestStreak}</dd></div>
          <div><dt>{t('reachedFloor')}</dt><dd>{last.floor || '-'}</dd></div>
        </dl>
      </section>}

      <nav className={styles.menu} aria-label={t('title')}>
        <Link href="/prescript/records"><b>{t('recordsTitle')}</b><span>{t('recordsLine')}</span></Link>
        <Link href="/prescript/ranking"><b>{t('rankingTitle')}</b><span>{t('rankingLine')}</span></Link>
        <button type="button" onClick={() => setRules(true)}><b>{t('rulesTitle')}</b><span>{t('rulesLine')}</span></button>
      </nav>
    </div>
    <PrescriptRules open={rules} onClose={() => setRules(false)} />
  </div>
}
