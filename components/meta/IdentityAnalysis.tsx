'use client'

import Image from 'next/image'
import { motion, useReducedMotion } from 'motion/react'
import { smoothTransition } from '@/lib/animations'
import { getIdentityPortraitUrl, getIdentityProfileUrl } from '@/lib/utils/images'
import { useState, type ReactNode } from 'react'
import styles from '@/styles/components/MetaAnalysis.module.css'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowUpRight, Layers3, X, ChevronsUpDown } from 'lucide-react'
import { Link } from '@/lib/i18n/navigation'
import { isBaseEgo, type CountStat, type MetaData, type MetaInsightPost, type MetaUsage } from '@/lib/meta/types'
import type { Identity } from '@/lib/types'
import type { SupportedLang } from '@/lib/i18n/types'
import IdentityCard from '@/components/sinners/IdentityCard'
import EgoDisplayCard from '@/components/sinners/EgoDisplayCard'
import { Toggle } from '@/components/tools/LunacyControls'
import IdentityInterest from './IdentityInterest'
import IdentityPickerModal from './IdentityPickerModal'
import KeywordBadge from './KeywordBadge'
import DonutChart, { ComboLabel, comboColors, usageColor, type DonutSegment } from './DonutChart'
import { EgoLeaders, PairLeaders, PlanInsights, SinnerLeaders } from './MetaSections'
import SkillExchangeInsight from './SkillExchangeInsight'

function countBy(posts: MetaInsightPost[], key: (post: MetaInsightPost) => string): CountStat[] {
  const counts = new Map<string, number>()
  for (const post of posts) counts.set(key(post), (counts.get(key(post)) ?? 0) + 1)
  return [...counts].map(([k, count]) => ({ key: k, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
}
const comboKey = (post: MetaInsightPost) => post.combo.join('+')
const OTHER = '__other'
const LEGEND_LIMIT = 6
const COMPANION_LIMIT = 8
const ORDER_SLOTS = 12
/** Keeps the largest slices readable; the rest share one slice. */
function collapse(rows: CountStat[]): CountStat[] {
  if (rows.length <= LEGEND_LIMIT + 1) return rows
  return [...rows.slice(0, LEGEND_LIMIT), { key: OTHER, count: rows.slice(LEGEND_LIMIT).reduce((sum, row) => sum + row.count, 0) }]
}

function Share({ value, digits = 1 }: { value: number; digits?: number }) {
  return <span className={styles.share}>{value.toFixed(digits)}<small>%</small></span>
}

export default function IdentityAnalysis({ data, summary }: { data: MetaData; summary: ReactNode }) {
  const t = useTranslations('meta.analysis')
  const reduceMotion = useReducedMotion()
  const locale = useLocale() as SupportedLang
  const [selected, setSelected] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const rootT = useTranslations()
  const [excludeBase, setExcludeBase] = useState(true)
  const [formationOnly, setFormationOnly] = useState(true)
  const [allCompanions, setAllCompanions] = useState(false)
  const [usageFilter, setUsageFilter] = useState<string | null>(null)
  const [comboFilter, setComboFilter] = useState<string | null>(null)
  const [overviewUsage, setOverviewUsage] = useState<string | null>(null)
  const [overviewCombo, setOverviewCombo] = useState<string | null>(null)
  const [rankingBench, setRankingBench] = useState(false)
  const identityId = data.battleIdentityStats.some(row => row.identity_id === selected) ? selected : data.battleIdentityStats[0]?.identity_id ?? ''
  const insight = data.identityInsights?.[identityId]
  const name = (row: { name_kr: string; name_en?: string | null; name_jp?: string | null }) => (locale === 'en' ? row.name_en : locale === 'ja' ? row.name_jp : row.name_kr) || row.name_kr
  const usageSegments = (rows: CountStat[]): DonutSegment[] => rows.map(row => ({ key: row.key, count: row.count, colors: [usageColor(row.key as MetaUsage)], label: t('usage.' + row.key) }))
  const comboSegments = (rows: CountStat[]): DonutSegment[] => collapse(rows).map(row => row.key === OTHER
    ? { key: OTHER, count: row.count, colors: ['#3a2a15'], label: t('others', { count: rows.length - LEGEND_LIMIT }) }
    : { key: row.key, count: row.count, colors: comboColors(row.key), label: <ComboLabel combo={row.key} /> })
  const selectIdentity = (id: string) => { setSelected(id); setUsageFilter(null); setComboFilter(null); setAllCompanions(false) }
  const focusIdentity = (id: string) => {
    selectIdentity(id)
    document.querySelector('[data-analysis-subject]')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  }
  const fielded = new Set(data.battleIdentityStats.map(row => row.identity_id))
  const rankingRows = (rankingBench ? data.supportIdentityStats : data.battleIdentityStats).slice(0, 6)
  const portrait = (row: { sinner_id: string; folder_name: string | null; game_id: string | null }, size: number, className: string) => row.game_id && row.folder_name
    ? <Image src={getIdentityPortraitUrl(row.sinner_id, row.folder_name, row.game_id, false)} alt="" width={size} height={size} className={className} />
    : <span className={className} aria-hidden="true" />

  const overview = <section className={styles.overview} aria-labelledby="meta-overview-heading" data-meta-overview>
    <div className={styles.overviewHead}><h2 id="meta-overview-heading">{t('overview')}</h2>{summary}</div>
    {data.sampleCount > 0 && <div className={styles.overviewGrid}>
      <div className={styles.chartBlock}><h3>{t('usageTitle')}</h3>
        <DonutChart label={t('usageTitle')} segments={usageSegments(data.usageStats ?? [])} active={overviewUsage} onSelect={setOverviewUsage} /></div>
      <div className={styles.chartBlock}><h3>{t('comboTitle')}</h3><p className={styles.hint}>{t('comboHint')}</p>
        <DonutChart label={t('comboTitle')} segments={comboSegments(data.comboStats ?? [])} active={overviewCombo} onSelect={setOverviewCombo} /></div>
      <div className={styles.chartBlock}>
        <div className={styles.rankingHead}><h3>{t('topIdentities')}</h3>
          <div className={styles.segmented} role="group" aria-label={t('topIdentities')}>
            <button type="button" aria-pressed={!rankingBench} onClick={() => setRankingBench(false)}>{t('rankingFielded')}</button>
            <button type="button" aria-pressed={rankingBench} onClick={() => setRankingBench(true)}>{t('rankingBench')}</button>
          </div>
        </div>
        <ol className={styles.ranking}>{rankingRows.map((row, i) => <li key={row.identity_id}>
          <button type="button" aria-pressed={!rankingBench && row.identity_id === identityId} disabled={!fielded.has(row.identity_id)} onClick={() => focusIdentity(row.identity_id)}>
            <span className={styles.rank}>{i + 1}</span>
            {portrait(row, 40, styles.rankPortrait)}
            <span className={styles.rankName}>{name(row)}<small>{rootT('sinner.' + row.sinner_id)}</small></span>
            <Share value={row.count / data.sampleCount * 100} />
            <span className={styles.legendCount}>{t('count', { count: row.count })}</span>
          </button>
        </li>)}</ol>
        {!rankingRows.length && <p className={styles.empty}>{t('empty')}</p>}</div>
    </div>}
  </section>
  const overall = data.sampleCount > 0 && <>
    <SinnerLeaders data={data} onSelect={focusIdentity} />
    <div className={styles.pairRow}><EgoLeaders data={data} /><PairLeaders data={data} onSelect={focusIdentity} /></div>
    <PlanInsights summary={data.planStats} data={data} headingId="plans-heading" />
  </>
  if (!data.battleIdentityStats.length) return <section className={styles.analysis}>{overview}<div className={styles.panel}><p className={styles.empty}>{t('empty')}</p></div></section>

  const identity = data.battleIdentityStats.find(row => row.identity_id === identityId)!
  const egos = insight?.egos.filter(ego => !excludeBase || !isBaseEgo(ego.game_id)) ?? []
  const companions = (insight?.companions ?? []).flatMap(row => {
    const companion = data.battleIdentityStats.find(identity => identity.identity_id === row.identity_id)
    return companion ? [{ ...companion, count: row.count }] : []
  })
  const scoped = insight?.posts.filter(post => !formationOnly || !post.support) ?? []
  const scopedUsage = countBy(scoped, post => post.usage)
  const scopedCombo = countBy(scoped, comboKey)
  const activeUsage = scopedUsage.some(row => row.key === usageFilter) ? usageFilter : null
  const shownCombos = collapse(scopedCombo)
  const activeCombo = shownCombos.some(row => row.key === comboFilter) ? comboFilter : null
  const matchesCombo = (post: MetaInsightPost) => activeCombo === null
    || (activeCombo === OTHER ? !shownCombos.some(row => row.key === comboKey(post)) : comboKey(post) === activeCombo)
  const posts = scoped.filter(post => (activeUsage === null || post.usage === activeUsage) && matchesCombo(post))
  const percent = (count: number) => count / (insight?.count || 1) * 100
  const cardIdentity = (row: typeof identity): Identity => ({ ...row, id: row.identity_id, name: name(row), tier: row.rarity, hp: 0, speed_min: 0, speed_max: 0, def_level: 0 })
  const orders = Array.from({ length: ORDER_SLOTS }, (_, i) => insight?.orders[String(i + 1)] ?? 0)
  const topOrderCount = Math.max(...orders)
  const topOrder = topOrderCount ? orders.indexOf(topOrderCount) + 1 : null
  const art = getIdentityProfileUrl(cardIdentity(identity), true)
  const basis = t('basis', { count: insight?.count ?? 0 })

  return <section className={styles.analysis} data-identity-analysis>
    {overview}
    {overall}
    <div className={styles.subject} data-analysis-subject>
      {art && <Image key={art} src={art} alt="" fill sizes="(max-width: 639px) 100vw, 48rem" className={styles.subjectArt} />}
      <div className={styles.subjectCard}><IdentityCard identity={cardIdentity(identity)} compact board showName={false} disableHoverEffects /></div>
      <div className={styles.subjectBody}>
        <p className={styles.subjectSinner}>{rootT('sinner.' + identity.sinner_id)}</p>
        <h2 className={styles.subjectName}>{name(identity)}</h2>
        {insight && <dl className={styles.subjectStats}>
          <div><dt>{t('statFielded')}</dt><dd>{insight.count}</dd></div>
          <div><dt>{t('statRate')}</dt><dd>{(insight.count / (data.sampleCount || 1) * 100).toFixed(1)}<small>%</small></dd></div>
          {topOrder && <div><dt>{t('statOrder')}</dt><dd>{topOrder}</dd></div>}
        </dl>}
        <div className={styles.subjectActions}>
          <button type="button" onClick={() => setPickerOpen(true)} aria-haspopup="dialog" className={styles.changeButton}>{t('change')}<ChevronsUpDown size={15} /></button>
          <Link href={'/sinners/' + identity.sinner_id + '/identities/' + identityId} className={styles.detailLink}>{t('detail')}<ArrowUpRight size={14} /></Link>
          {insight?.plan && <Link href={'/planner/community?ids=' + identityId} className={styles.detailLink}>{t('plansWith')}<ArrowUpRight size={14} /></Link>}
        </div>
      </div>
      <IdentityInterest id={identityId} />
    </div>
    <IdentityPickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} rows={data.battleIdentityStats} sampleCount={data.sampleCount} selectedId={identityId} name={name} onSelect={id => { selectIdentity(id); setPickerOpen(false) }} />
    {!insight ? <p className={styles.empty}>{t('empty')}</p> : <motion.div key={identityId} className={styles.analysis} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={smoothTransition}>
      <div className={styles.usageRow}>
        <section className={styles.panel} aria-labelledby="order-heading">
          <div className={styles.sectionHead}><h3 id="order-heading">{t('order')}</h3><span>{basis}</span></div>
          <ol className={styles.orderChart}>{orders.map((count, i) => <li key={i} data-top={count > 0 && count === topOrderCount ? '' : undefined} aria-label={t('position', { order: i + 1 }) + ' ' + percent(count).toFixed(1) + '%'}>
            <span className={styles.orderShare} aria-hidden="true">{count ? percent(count).toFixed(1) + '%' : ''}</span>
            <span className={styles.orderTrack} aria-hidden="true">
              {count > 0 && <motion.span className={styles.orderBar} style={{ height: (count / topOrderCount * 100) + '%' }} initial={reduceMotion ? false : { scaleY: 0 }} animate={{ scaleY: 1 }} transition={reduceMotion ? { duration: 0 } : { duration: .55, delay: i * .03, ease: [0.22, 1, 0.36, 1] }} />}
            </span>
            <span className={styles.orderNumber} aria-hidden="true">{i + 1}</span>
          </li>)}</ol>
        </section>
        <section className={styles.panel} aria-labelledby="purpose-heading" data-meta-purpose>
          <div className={styles.sectionHead}>
            <h3 id="purpose-heading">{t('purpose')}</h3>
            <span>{t(formationOnly ? 'purposeBasis' : 'purposeBasisAll', { count: scoped.length })}</span>
            <Toggle label={t('formationOnly')} checked={formationOnly} onChange={setFormationOnly} showState />
          </div>
          {scoped.length ? <div className={styles.purposeCharts}>
            <div className={styles.chartBlock}><h4>{t('usageTitle')}</h4><DonutChart label={t('usageTitle')} segments={usageSegments(scopedUsage)} active={activeUsage} onSelect={setUsageFilter} /></div>
            <div className={styles.chartBlock}><h4>{t('comboTitle')}</h4><DonutChart label={t('comboTitle')} segments={comboSegments(scopedCombo)} active={activeCombo} onSelect={setComboFilter} /></div>
          </div> : <p className={styles.empty}>{t('empty')}</p>}
        </section>
      </div>
      <SkillExchangeInsight splits={insight.skills ?? []} skills={data.skillCatalog?.[identityId] ?? []} identity={identity} basis={basis} />
      <PlanInsights summary={insight.plan} data={data} identityId={identityId} headingId="identity-plans-heading" />
      <section className={styles.panel} aria-labelledby="companion-heading" data-meta-companions>
        <div className={styles.sectionHead}><h3 id="companion-heading">{t('companions')}</h3><span>{basis}</span></div>
        {companions.length ? <ul className={styles.companions}>
          {(allCompanions ? companions : companions.slice(0, COMPANION_LIMIT)).map(row => <li key={row.identity_id} className={styles.companion}>
            {portrait(row, 48, styles.companionPortrait)}
            <div className={styles.companionInfo}>
              <div className={styles.companionLabel}><Link href={'/sinners/' + row.sinner_id + '/identities/' + row.identity_id} className={styles.companionName}>{name(row)}<small>{rootT('sinner.' + row.sinner_id)}</small></Link><Share value={percent(row.count)} /></div>
              <div className={styles.companionTrack} aria-hidden="true"><div style={{ width: percent(row.count) + '%' }} /></div>
              <p className={styles.companionCount}>{t('companionCount', { count: row.count, total: insight.count })}</p>
            </div>
          </li>)}
        </ul> : <p className={styles.empty}>{t('noCompanions')}</p>}
        {companions.length > COMPANION_LIMIT && <button type="button" onClick={() => setAllCompanions(v => !v)} className={styles.moreButton}>{allCompanions ? t('less') : t('moreCount', { count: companions.length - COMPANION_LIMIT })}</button>}
      </section>
      <section className={styles.panel} aria-labelledby="ego-heading">
        <div className={styles.sectionHead}><h3 id="ego-heading">{t('egos')}</h3><span>{basis}</span><Toggle label={t('excludeBase')} checked={excludeBase} onChange={setExcludeBase} showState /></div>
        <div className={styles.egoGrid}>{egos.map(ego => <div key={ego.ego_id} className="min-w-0" data-meta-ego>
          <EgoDisplayCard ego={ego} name={name(ego)} sinnerId={ego.sinner_id} lang={locale} href={'/sinners/' + ego.sinner_id + '/ego/' + ego.ego_id} />
          <div className={styles.egoStat}><Share value={percent(ego.count)} /><span className={styles.legendCount}>{t('count', { count: ego.count })}</span></div>
        </div>)}</div>
        {!egos.length && <div className={styles.emptyRow}><Layers3 size={24} className="shrink-0 opacity-40" /><p>{excludeBase && insight.egos.length ? t('baseOnly') : t('empty')}</p></div>}
      </section>
      <section className={styles.panel} aria-labelledby="posts-heading">
        <div className={styles.sectionHead}><h3 id="posts-heading">{t('decks')}</h3><span>{t('count', { count: posts.length })}</span>
          {(activeUsage !== null || activeCombo !== null) && <button type="button" onClick={() => { setUsageFilter(null); setComboFilter(null) }} className={styles.clearFilter}>{t('clearFilter')}<X size={14} /></button>}
        </div>
        <ul className={styles.posts}>{posts.map(post => <li key={post.source + ':' + post.id}><Link className={styles.post} href={post.source === 'decks' ? '/decks/' + post.id : '/planner/community/' + post.id}>
          <span className={styles.postSource}>{t('sourceTag.' + post.source)}</span>
          <span className={styles.postBody}><span className={styles.postTitle}>{post.title}</span><span className={styles.postTags}>
            <span className={styles.usageTag}><i style={{ background: usageColor(post.usage) }} />{t('usage.' + post.usage)}</span>
            {post.combo.map(key => <KeywordBadge key={key} keyword={key} />)}
            {post.support && <span className={styles.benchTag}>{t('bench')}</span>}
          </span></span>
          <ArrowUpRight className={styles.postArrow} size={18} />
        </Link></li>)}</ul>
        {!posts.length && <p className={styles.empty}>{t('noPosts')}</p>}
      </section>
    </motion.div>}
  </section>
}
