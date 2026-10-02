'use client'

import type { CSSProperties } from 'react'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'
import UnderlineTabBar from '@/components/ui/UnderlineTabBar'
import { META_SOURCES, META_PERIODS, DEFAULT_META_SOURCE, DEFAULT_META_PERIOD, type MetaSource, type MetaPeriod, type MetaData } from '@/lib/meta/types'
import { useQueryState, useQueryStates, parseAsString, parseAsStringLiteral } from 'nuqs'
import IdentityAnalysis from '@/components/meta/IdentityAnalysis'
import MetaOverview from '@/components/meta/MetaOverview'
import DungeonAnalysis from '@/components/meta/DungeonAnalysis'
import { MetaBodySkeleton } from '@/components/meta/MetaSkeleton'
import styles from '@/styles/components/MetaAnalysis.module.css'

const VIEWS = ['overall', 'identity', 'dungeon'] as const
/** A section's place in the arrival order (MetaAnalysis.module.css `.arrive`). */
const order = (i: number) => ({ '--i': i }) as CSSProperties

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
  // Tab switches push history so back returns to the previous tab; picking another identity replaces it.
  const [view, setView] = useQueryStates({ tab: parseAsStringLiteral(VIEWS).withDefault('overall'), id: parseAsString.withDefault('') })
  const showTab = (tab: typeof VIEWS[number], id?: string) => {
    setView(id === undefined ? { tab } : { tab, id }, { history: 'push' })
    const tabs = document.querySelector('[data-meta-views]')
    if (tabs && tabs.getBoundingClientRect().top < 0) tabs.scrollIntoView({ block: 'start' })
  }
  const fallbackData = initialData?.source === source && initialData.period === period ? initialData : undefined
  const { data, error, isLoading, mutate } = useSWR<MetaData>(`/api/meta/usage?source=${source}&period=${period}`, fetchMeta, {
    fallbackData, keepPreviousData: true, revalidateOnFocus: false,
  })
  // Keep the previous result on screen (dimmed) while another source or period loads, so the page does not collapse and jump.
  const stale = Boolean(data && (data.source !== source || data.period !== period))
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
      {isLoading && !data && <MetaBodySkeleton />}
      {data && <>
      {data.sampleCount === 0 && period !== 'all' && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
          <p className="text-sm text-[var(--text-secondary)]">{t('emptyPeriod')}</p>
          <button type="button" onClick={() => setPeriod('all')} className="rounded px-3 py-2 text-sm text-[var(--gold)] hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-[var(--gold)]">
            {t('showAllTime')}
          </button>
        </div>
      )}
        <div className={`${styles.summaryBar} ${styles.arrive}${stale ? " " + styles.stale : ""}`} style={order(0)}>
          <dl className={styles.sampleStats} aria-live="polite">
            <div><dt>{t('sampleValid')}</dt><dd data-sample-count>{data.sampleCount}</dd></div>
            <div><dt>{t('sampleDecks')}</dt><dd>{data.sourceCounts.decks}</dd></div>
            <div><dt>{t('samplePlanner')}</dt><dd>{data.sourceCounts.planner}</dd></div>
          </dl>
          <div className={styles.overviewNotes}>
            {data.sampleCount < 20 && <p className={styles.caution}>{t('smallSample')}</p>}
            <details className={styles.methodology}><summary>{t('methodologyLabel')}</summary><p>{t('methodology')}</p>{data.excludedSamples > 0 && <p>{t('excluded', { count: data.excludedSamples })}</p>}</details>
          </div>
        </div>
        <div className={`${styles.views} ${styles.arrive}`} style={order(1)} data-meta-views>
          <UnderlineTabBar tabs={VIEWS.map(key => ({ key, label: t('views.' + key) }))} activeKey={view.tab} onTabChange={key => showTab(key as typeof VIEWS[number])} />
        </div>
        <div role="tabpanel" aria-label={t('views.' + view.tab)} aria-busy={stale || undefined} className={`${styles.arrive}${stale ? " " + styles.stale : ""}`} style={order(2)}>
          {/* Redrawn per tab, so a tab switch rises too, without the first arrival's wait. */}
          <div key={view.tab} className={styles.arrive} data-meta-panel={view.tab}>
            {view.tab === 'overall' && <MetaOverview data={data} onSelect={id => showTab('identity', id)} />}
            {view.tab === 'identity' && <IdentityAnalysis data={data} selectedId={view.id} onSelect={id => setView({ id })} />}
            {view.tab === 'dungeon' && <DungeonAnalysis data={data} />}
          </div>
        </div>
      </>}
    </div>
}
