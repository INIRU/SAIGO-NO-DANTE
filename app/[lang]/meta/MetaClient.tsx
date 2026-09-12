'use client'

import useSWR from 'swr'
import { useTranslations } from 'next-intl'
import UnderlineTabBar from '@/components/ui/UnderlineTabBar'
import { META_SOURCES, META_PERIODS, DEFAULT_META_SOURCE, DEFAULT_META_PERIOD, type MetaSource, type MetaPeriod, type MetaData } from '@/lib/meta/types'
import { useQueryState, parseAsString } from 'nuqs'
import IdentityAnalysis from '@/components/meta/IdentityAnalysis'
import styles from '@/styles/components/MetaAnalysis.module.css'

async function fetchMeta(url: string): Promise<MetaData> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Could not load usage statistics')
  return response.json()
}

export default function MetaClient({ initialData }: { initialData: MetaData | null }) {
  const t = useTranslations('meta')
  const [sourceParam, setSource] = useQueryState('source', parseAsString.withDefault(DEFAULT_META_SOURCE))
  const [periodParam, setPeriod] = useQueryState('period', parseAsString.withDefault(DEFAULT_META_PERIOD))
  const source = META_SOURCES.includes(sourceParam as MetaSource) ? sourceParam as MetaSource : DEFAULT_META_SOURCE
  const period = META_PERIODS.includes(periodParam as MetaPeriod) ? periodParam as MetaPeriod : DEFAULT_META_PERIOD
  const fallbackData = initialData?.source === source && initialData.period === period ? initialData : undefined
  const { data, error, isLoading, mutate } = useSWR<MetaData>(`/api/meta/usage?source=${source}&period=${period}`, fetchMeta, {
    fallbackData, keepPreviousData: false, revalidateOnFocus: false,
  })
  return <div>
      <div className={styles.toolbar}>
        <UnderlineTabBar
          tabs={META_SOURCES.map(key => ({ key, label: t(`source.${key}`) }))}
          activeKey={source}
          onTabChange={setSource}
        />
        <div className={styles.periods} role="group" aria-label={t('periodLabel')}>
          {META_PERIODS.map(value => (
            <button key={value} type="button" onClick={() => setPeriod(value)} aria-pressed={period === value}
              className={styles.period}
              style={{ background: period === value ? 'var(--gold)' : 'rgba(255,255,255,0.05)', color: period === value ? 'var(--bg-deep)' : 'var(--text-secondary)' }}>
              {t(`period.${value}`)}
            </button>
          ))}
        </div>
      </div>
        {error && <div role="alert" className="text-sm" style={{ color: 'var(--gold)' }}>
          {t('loadError')}{' '}
          <button type="button" onClick={() => mutate()} className="underline underline-offset-2">{t('retry')}</button>
        </div>}
      {isLoading && !data && <div className="space-y-3 mt-6" role="status" aria-label={t('loading')}>
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-lg animate-pulse" style={{ background: 'var(--bg-elevated)', opacity: 1 - i * 0.08 }} />)}
      </div>}
      {data && <>
      {data.sampleCount === 0 && period !== 'all' && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
          <p className="text-sm text-[var(--text-secondary)]">{t('emptyPeriod')}</p>
          <button type="button" onClick={() => setPeriod('all')} className="rounded px-3 py-2 text-sm text-[var(--gold)] hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-[var(--gold)]">
            {t('showAllTime')}
          </button>
        </div>
      )}
        <IdentityAnalysis data={data} summary={<>
          <p className={styles.sample} aria-live="polite">{t('sample', { count: data.sampleCount, decks: data.sourceCounts.decks, planner: data.sourceCounts.planner, excluded: data.excludedSamples })}</p>
          {data.sampleCount < 20 && <p className={styles.caution}>{t('smallSample')}</p>}
          <details className={styles.methodology}><summary>{t('methodologyLabel')}</summary><p>{t('methodology')}</p></details>
        </>} />
      </>}
    </div>
}
