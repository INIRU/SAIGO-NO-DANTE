'use client'

import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { useKeywordData, useKeywords } from '@/components/providers/KeywordProvider'
import { localizeDeckKeyword } from '@/components/decks/decks-types'
import { FilterChoice, FilterIconTile, FilterSection, FilterTextButton, filterStyles } from '@/components/board/FilterControls'
import { KEYWORD_DECK_KEYWORDS } from '@/lib/decks/keyword-rules'
import { RARITY_ICON_MAP, SINNER_SLUGS } from '@/lib/constants/game'
import { getSinnerLogoUrl } from '@/lib/utils/images'
import { META_DIFFICULTIES, META_FILTER_KEYS, META_FILTER_MODES, META_RARITIES, META_USAGES, type MetaFacets, type MetaFilterKey, type MetaFilterMode, type MetaFilters as Filters } from '@/lib/meta/types'
import type { SupportedLang } from '@/lib/i18n/types'
import { usageColor } from './DonutChart'
import { DIFFICULTY_COLORS } from './MetaSections'
import styles from '@/styles/components/MetaAnalysis.module.css'

export type MetaFilterPatch = { [K in MetaFilterKey]?: string[] | null } & { [K in MetaFilterMode]?: 'or' | null }

/**
 * The analysis page's filters, in the build of the boards' filter column. Every filter takes several values; pressing a
 * chosen one takes it off. Keywords and sinners, which a formation has several of, get the boards' AND / OR switch once
 * two are chosen.
 */
export default function MetaFilters({ id, value, facets, showDifficulty, onChange, onClear }: {
  id: string
  value: Filters
  /** How many formations each option keeps. Absent until a result has arrived: nothing is disabled before the counts are known. */
  facets?: MetaFacets
  showDifficulty: boolean
  onChange: (patch: MetaFilterPatch) => void
  onClear: () => void
}) {
  const t = useTranslations('meta')
  const rootT = useTranslations()
  const locale = useLocale() as SupportedLang
  const keywords = useKeywords()
  const { getIconUrl } = useKeywordData()
  const chosen = (key: MetaFilterKey): readonly string[] => value[key] ?? []
  const toggle = (key: MetaFilterKey, option: string) => {
    const next = chosen(key).includes(option) ? chosen(key).filter(item => item !== option) : [...chosen(key), option]
    onChange({ [key]: next.length ? next : null })
  }
  const empty = (key: keyof MetaFacets, option: string) => Boolean(facets) && !facets?.[key]?.[option] && !chosen(key).includes(option)
  // All chosen values at once is the default; the switch turns it to any one of them.
  const modeSwitch = (mode: MetaFilterMode, filter: string) => chosen(META_FILTER_MODES[mode]).length >= 2 && (
    <FilterTextButton aria-pressed={!value[mode]} aria-label={t('filters.matchMode', { filter })} onClick={() => onChange({ [mode]: value[mode] ? null : 'or' })}>
      {rootT(value[mode] ? 'decks.filters.or' : 'decks.filters.and')}
    </FilterTextButton>
  )

  return <div id={id} className={styles.filters} data-meta-filters>
    <div className={styles.filterWide}><FilterSection label={t('analysis.usageTitle')} count={chosen('usage').length}>
      <div className={filterStyles.choices}>
        {META_USAGES.map(key => <FilterChoice key={key} active={chosen('usage').includes(key)} tone={usageColor(key)} disabled={empty('usage', key)} onClick={() => toggle('usage', key)}>{t('analysis.usage.' + key)}</FilterChoice>)}
      </div>
    </FilterSection></div>
    <div className={styles.filterWide}><FilterSection label={t('analysis.comboTitle')} count={chosen('keyword').length} end={modeSwitch('keywordMode', t('analysis.comboTitle'))}>
      <div className={`${filterStyles.tiles} ${styles.filterKeywords}`}>
        {KEYWORD_DECK_KEYWORDS.map(key => <FilterIconTile key={key} active={chosen('keyword').includes(key)} label={localizeDeckKeyword(key, keywords[key], locale)} iconUrl={getIconUrl(key)} disabled={empty('keyword', key)} onClick={() => toggle('keyword', key)} />)}
      </div>
    </FilterSection></div>
    {showDifficulty && <div className={styles.filterNarrow}><FilterSection label={t('filters.difficulty')} count={chosen('difficulty').length}>
      <div className={filterStyles.choices}>
        {META_DIFFICULTIES.map(key => <FilterChoice key={key} active={chosen('difficulty').includes(key)} tone={DIFFICULTY_COLORS[key]} disabled={empty('difficulty', key)} onClick={() => toggle('difficulty', key)}>{rootT('planner.difficultyValues.' + key)}</FilterChoice>)}
      </div>
    </FilterSection></div>}
    <div className={styles.filterNarrow}><FilterSection label={t('filters.rarity')} count={chosen('rarity').length}>
      <div className={filterStyles.choices}>
        {META_RARITIES.map(key => <FilterChoice key={key} active={chosen('rarity').includes(key)} aria-label={t('filters.rarityValue', { count: Number(key) })} onClick={() => toggle('rarity', key)}>
          <Image src={RARITY_ICON_MAP[Number(key)]} alt="" width={Number(key) * 20} height={20} className={styles.filterRarity} />
        </FilterChoice>)}
      </div>
    </FilterSection></div>
    <div className={styles.filterWide}><FilterSection label={t('filters.sinner')} count={chosen('sinner').length} end={modeSwitch('sinnerMode', t('filters.sinner'))}>
      <div className={`${filterStyles.sinners} ${styles.filterSinners}`} role="group" aria-label={t('filters.sinner')}>
        {SINNER_SLUGS.map(slug => <button key={slug} type="button" className={filterStyles.sinner} aria-pressed={chosen('sinner').includes(slug)} data-picked={chosen('sinner').includes(slug) || undefined}
          aria-label={rootT('sinner.' + slug)} title={rootT('sinner.' + slug)} onClick={() => toggle('sinner', slug)}>
          <Image src={getSinnerLogoUrl(slug)} alt="" width={44} height={44} className={filterStyles.sinnerLogo} />
        </button>)}
      </div>
    </FilterSection></div>
    <div className={styles.filterEnd}>
      {META_FILTER_KEYS.some(key => chosen(key).length > 0) && <FilterTextButton onClick={onClear}>{t('filters.clear')}</FilterTextButton>}
    </div>
  </div>
}
