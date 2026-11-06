'use client'

import { useState, type CSSProperties } from 'react'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'
import { SlidersHorizontal } from 'lucide-react'
import UnderlineTabBar from '@/components/ui/UnderlineTabBar'
import { META_SOURCES, META_PERIODS, META_FILTER_KEYS, META_FILTER_MODES, DEFAULT_META_SOURCE, DEFAULT_META_PERIOD, parseMetaFilters, parseMetaPeriod, type IdentityStat, type MetaFilterMode, type MetaSource, type MetaData } from '@/lib/meta/types'
import { useQueryState, useQueryStates, parseAsArrayOf, parseAsString, parseAsStringLiteral } from 'nuqs'
import IdentityAnalysis from '@/components/meta/IdentityAnalysis'
import MetaOverview from '@/components/meta/MetaOverview'
import DungeonAnalysis from '@/components/meta/DungeonAnalysis'
import MetaFilters from '@/components/meta/MetaFilters'
import { MetaBodySkeleton } from '@/components/meta/MetaSkeleton'
import styles from '@/styles/components/MetaAnalysis.module.css'

const VIEWS = ['overall', 'identity', 'dungeon'] as const
const FILTER_MODES = Object.keys(META_FILTER_MODES) as MetaFilterMode[]
const list = parseAsArrayOf(parseAsString).withDefault([])
const FILTER_PARAMS = { usage: list, keyword: list, difficulty: list, sinner: list, rarity: list, keywordMode: parseAsString.withDefault(''), sinnerMode: parseAsString.withDefault('') }
const NO_FILTERS = { usage: null, keyword: null, difficulty: null, sinner: null, rarity: null, keywordMode: null, sinnerMode: null }
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
  const period = parseMetaPeriod(periodParam)
  const [filterParams, setFilterParams] = useQueryStates(FILTER_PARAMS)
  // An unknown value in the address is no filter. A difficulty is a plan's: the deck board has none to narrow by.
  const { filters } = parseMetaFilters(key => key === 'difficulty' && source === 'decks' ? null : filterParams[key])
  const filterCount = META_FILTER_KEYS.reduce((sum, key) => sum + (filters[key]?.length ?? 0), 0)
  // An address that carries filters opens with them in view.
  const [filtersOpen, setFiltersOpen] = useState(filterCount > 0)
  // A sinner or rarity keeps the formations that field such an identity; the identity lists then show those identities.
  const shows = (row: IdentityStat) => (!filters.sinner || filters.sinner.includes(row.sinner_id)) && (!filters.rarity || (filters.rarity as string[]).includes(String(row.rarity)))
  const query = new URLSearchParams({ source, period })
  for (const key of [...META_FILTER_KEYS, ...FILTER_MODES]) if (filters[key]) query.set(key, String(filters[key]))
  // Tab switches push history so back returns to the previous tab; picking another identity replaces it.
  const [view, setView] = useQueryStates({ tab: parseAsStringLiteral(VIEWS).withDefault('overall'), id: parseAsString.withDefault('') })
  const showTab = (tab: typeof VIEWS[number], id?: string) => {
    setView(id === undefined ? { tab } : { tab, id }, { history: 'push' })
    const tabs = document.querySelector('[data-meta-views]')
    if (tabs && tabs.getBoundingClientRect().top < 0) tabs.scrollIntoView({ block: 'start' })
  }
  const fallbackData = initialData?.source === source && initialData.period === period && !filterCount ? initialData : undefined
  const { data, error, isLoading, mutate } = useSWR<MetaData>(`/api/meta/usage?${query}`, fetchMeta, {
    fallbackData, keepPreviousData: true, revalidateOnFocus: false,
  })
  // Keep the previous result on screen (dimmed) while another scope loads, so the page does not collapse and jump.
  const stale = Boolean(data && (data.source !== source || data.period !== period || JSON.stringify(data.filters ?? {}) !== JSON.stringify(filters)))
  return <div>
      <div className={styles.toolbar}>
        <UnderlineTabBar
          tabs={META_SOURCES.map(key => ({ key, label: t(`source.${key}`) }))}
          activeKey={source}
          onTabChange={key => {
            setSource(key)
            // The deck board has no difficulty: a chosen one would stay in the address with nothing to take it off.
            if (key === 'decks' && filterParams.difficulty.length) setFilterParams({ difficulty: null })
          }}
        />
        <div className={styles.toolbarEnd}>
          <div className={styles.periods} role="group" aria-label={t('periodLabel')}>
            {META_PERIODS.map(value => (
              <button key={value} type="button" onClick={() => setPeriod(value)} aria-pressed={period === value}
                className={styles.period}
                style={{ background: period === value ? 'var(--gold)' : 'rgba(255,255,255,0.05)', color: period === value ? 'var(--bg-deep)' : 'var(--text-secondary)' }}>
                {t(`period.${value}`)}
              </button>
            ))}
          </div>
          <button type="button" className={styles.filterToggle} aria-expanded={filtersOpen} aria-controls={filtersOpen ? 'meta-filters' : undefined} onClick={() => setFiltersOpen(open => !open)}>
            <SlidersHorizontal size={15} aria-hidden="true" />{t('filters.button')}{filterCount > 0 && <b>{filterCount}</b>}
          </button>
        </div>
        {filtersOpen && <MetaFilters id="meta-filters" value={filters} facets={data?.facets} showDifficulty={source !== 'decks'} onChange={patch => { setFilterParams(patch) }} onClear={() => { setFilterParams(NO_FILTERS) }} />}
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
            {view.tab === 'overall' && <MetaOverview data={data} shows={shows} onSelect={id => showTab('identity', id)} />}
            {view.tab === 'identity' && <IdentityAnalysis data={data} shows={shows} selectedId={view.id} onSelect={id => setView({ id })} />}
            {view.tab === 'dungeon' && <DungeonAnalysis data={data} />}
          </div>
        </div>
      </>}
    </div>
}
