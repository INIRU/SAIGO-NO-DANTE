'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import BackLink from '@/components/navigation/BackLink'
import { Link } from '@/lib/i18n/navigation'
import { GRADE_KEY, HISTORY_KEY, historyTotals, readGrade, readHistory, type PrescriptRunSummary } from '@/features/tools/lib/prescript-history'
import { GRADES, type PrescriptGrade } from '@/features/tools/lib/prescript'
import IndexIntro from './IndexIntro'
import PrescriptRules from './PrescriptRules'
import styles from '@/features/tools/components/PrescriptClient.module.css'

/**
 * The Index mode's entrance: the terminal to switch on, the last finished run, and the ways to my records, the ranking and
 * the rules. The site's look breaks into the Index's here, once a tab session.
 */
export default function PrescriptHub() {
  const t = useTranslations('prescriptMode')
  const locale = useLocale()
  const [last, setLast] = useState<PrescriptRunSummary | null>(null)
  // the records' figures for the menu (null until read: nothing is shown for them before)
  const [totals, setTotals] = useState<ReturnType<typeof historyTotals> | null>(null)
  useEffect(() => {
    try {
      const history = readHistory(window.localStorage.getItem(HISTORY_KEY))
      setLast(history[0] ?? null)
      setTotals(historyTotals(history))
    } catch { /* no records */ }
  }, [])
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
            aria-description={t(`grade_${item}_line`)} className={grade === item ? styles.gradeOn : undefined} onClick={() => choose(item)}>
            <b>{t(`grade_${item}`)}</b>
            <dl>
              <dt>{t('chipRerolls')}</dt><dd>{GRADES[item].rerolls}</dd>
              <dt>{t('chipReply')}</dt><dd>{GRADES[item].replyMs / 1000}<small>{t('unitSeconds')}</small></dd>
              <dt>{t('chipRefuse')}</dt><dd className={styles.word}>{t(GRADES[item].refuse ? 'chipYes' : 'chipNo')}</dd>
              <dt>{t('chipGrace')}</dt><dd>×{GRADES[item].multiplier}</dd>
            </dl>
          </button>)}
        </div>
        <Link href="/prescript/terminal" className={`${styles.b} ${styles.pri} ${styles.start}`}>{t('hubStart')}</Link>
        {totals && !totals.runs && <Link href="/prescript/guide" className={styles.first}>{t('firstGuide')}</Link>}
      </section>

      <div className={styles.side}>

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
        <Link href="/prescript/guide"><b>{t('guideTitle')}</b><span>{t('guideLine')}</span></Link>
        <Link href="/prescript/records"><b>{t('recordsTitle')}</b><span>{t('recordsLine')}</span>
          {totals && totals.runs > 0 && <i>{totals.runs}<small>{t('unitRuns')}</small></i>}</Link>
        <Link href="/prescript/ranking"><b>{t('rankingTitle')}</b><span>{t('rankingLine')}</span>
          {totals && totals.bestGrace > 0 && <i><small>{t('menuBest')}</small>{totals.bestGrace}</i>}</Link>
        <button type="button" onClick={() => setRules(true)}><b>{t('rulesTitle')}</b><span>{t('rulesLine')}</span></button>
      </nav>
      </div>
    </div>
    <PrescriptRules open={rules} onClose={() => setRules(false)} />
  </div>
}
