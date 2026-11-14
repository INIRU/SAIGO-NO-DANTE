'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import BackLink from '@/components/navigation/BackLink'
import { HISTORY_KEY, historyTotals, readHistory } from '@/features/tools/lib/prescript-history'
import styles from '@/features/tools/components/PrescriptClient.module.css'

/**
 * The ranking of Proselytes by grace. Its server table is not in place yet (a migration goes with the site's next
 * deploy), so for now the page shows the rules a ranked run follows and this browser's best.
 */
export default function PrescriptRanking() {
  const t = useTranslations('prescriptMode')
  const [best, setBest] = useState<number | null>(null)
  useEffect(() => { try { setBest(historyTotals(readHistory(window.localStorage.getItem(HISTORY_KEY))).bestGrace) } catch { setBest(0) } }, [])
  return <div className={styles.root}>
    <div className={styles.wrap}>
      <header className={styles.head}>
        <BackLink href="/prescript" parent aria-label={t('toHub')} title={t('toHub')} className={styles.back}><ArrowLeft size={18} aria-hidden="true" /></BackLink>
        <h1>{t('rankingTitle')}</h1>
      </header>
      <section className={styles.last}>
        <h2>{t('rankingMine')}</h2>
        <p className={styles.grace}><b>{best ?? '-'}</b>{t('scoreUnit')}</p>
      </section>
      <p className={styles.empty}>{t('rankingSoon')}</p>
    </div>
  </div>
}
