'use client'

import useSWR from 'swr'
import { useTranslations } from 'next-intl'
import styles from '@/styles/components/MetaAnalysis.module.css'

type Interest = { week: number; month: number; all: number }

async function fetchInterest(url: string): Promise<Interest> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('interest unavailable')
  return response.json()
}

/** Unique browsers that opened this identity's page, per period. */
export default function IdentityInterest({ id }: { id: string }) {
  const t = useTranslations('meta.analysis.interest')
  const { data, error } = useSWR<Interest>('/api/discovery/identity/' + id, fetchInterest)
  return <div className={styles.interest} data-identity-interest>
    <h3>{t('title')}</h3>
    <dl>
      {(['week', 'month', 'all'] as const).map(key => <div key={key}>
        <dt>{t(key)}</dt>
        <dd>{data ? data[key].toLocaleString() : error ? '—' : <span className={styles.interestPending} aria-hidden="true" />}</dd>
      </div>)}
    </dl>
    <p>{error ? t('error') : t('hint')}</p>
  </div>
}
