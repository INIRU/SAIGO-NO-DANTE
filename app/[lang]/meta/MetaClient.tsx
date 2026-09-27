'use client'

import useSWR from 'swr'
import { useTranslations } from 'next-intl'
import UnderlineTabBar from '@/components/ui/UnderlineTabBar'
import { META_SOURCES, META_PERIODS, DEFAULT_META_SOURCE, DEFAULT_META_PERIOD, type MetaSource, type MetaPeriod, type MetaData } from '@/lib/meta/types'
import { useQueryState, useQueryStates, parseAsString, parseAsStringLiteral } from 'nuqs'
import IdentityAnalysis from '@/components/meta/IdentityAnalysis'
import MetaOverview from '@/components/meta/MetaOverview'
import DungeonAnalysis from '@/components/meta/DungeonAnalysis'
import { SkeletonCircle, SkeletonLine, SkeletonPage } from '@/components/ui/Skeleton'
import styles from '@/styles/components/MetaAnalysis.module.css'

const VIEWS = ['overall', 'identity', 'dungeon'] as const

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
      {isLoading && !data && <SkeletonPage className={styles.analysis}>
        <div className={styles.overview}>
          <div className={styles.overviewHead}><SkeletonLine w="6rem" h="1.25rem" /><SkeletonLine w="18rem" h="0.75rem" /></div>
          <div className={styles.overviewGrid}>
            {[0, 1].map(i => <div key={i} className={styles.chartBlock}><SkeletonLine w="5rem" h="0.9375rem" />
              <div className={styles.donut}><SkeletonCircle size="8.75rem" raised /><div className={styles.legend}>{[0, 1, 2, 3].map(j => <SkeletonLine key={j} h="1.5rem" raised className="my-1" />)}</div></div>
            </div>)}
            <div className={styles.chartBlock}><SkeletonLine w="7rem" h="0.9375rem" />{[0, 1, 2, 3, 4, 5].map(j => <SkeletonLine key={j} h="2.5rem" raised className="my-0.5" />)}</div>
          </div>
        </div>
        <div className={styles.panel}><div className={styles.sectionHead}><SkeletonLine w="9rem" h="1rem" /></div>
          <div className={styles.sinnerGrid}>{Array.from({ length: 12 }, (_, i) => <SkeletonLine key={i} h="9.5rem" raised />)}</div>
        </div>
      </SkeletonPage>}
      {data && <>
      {data.sampleCount === 0 && period !== 'all' && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
          <p className="text-sm text-[var(--text-secondary)]">{t('emptyPeriod')}</p>
          <button type="button" onClick={() => setPeriod('all')} className="rounded px-3 py-2 text-sm text-[var(--gold)] hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-[var(--gold)]">
            {t('showAllTime')}
          </button>
        </div>
      )}
        <div className={styles.summaryBar + (stale ? " " + styles.stale : "")}>
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
        <div className={styles.views} data-meta-views>
          <UnderlineTabBar tabs={VIEWS.map(key => ({ key, label: t('views.' + key) }))} activeKey={view.tab} onTabChange={key => showTab(key as typeof VIEWS[number])} />
        </div>
        <div role="tabpanel" aria-label={t('views.' + view.tab)} aria-busy={stale || undefined} className={stale ? styles.stale : undefined}>
          {view.tab === 'overall' && <MetaOverview data={data} onSelect={id => showTab('identity', id)} />}
          {view.tab === 'identity' && <IdentityAnalysis data={data} selectedId={view.id} onSelect={id => setView({ id })} />}
          {view.tab === 'dungeon' && <DungeonAnalysis data={data} />}
        </div>
      </>}
    </div>
}
