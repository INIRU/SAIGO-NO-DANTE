'use client'

import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import { ArrowUpRight, Eye, Heart, MessageCircle } from 'lucide-react'
import { Link, useRouter } from '@/lib/i18n/navigation'
import { getIdentityPortraitUrl, getSinnerLogoUrl } from '@/lib/utils/images'
import { SINNER_SLUGS } from '@/lib/constants/game'
import { isBaseEgo, type IdentityStat, type MetaData, type MetaInsightPost, type MetaPlanSummary } from '@/lib/meta/types'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import GiftCard from '@/components/ui/GiftCard'
import ThemePackCard from '@/components/ui/ThemePackCard'
import EgoDisplayCard from '@/components/sinners/EgoDisplayCard'
import { Toggle } from '@/components/tools/LunacyControls'
import DonutChart, { usageColor } from './DonutChart'
import KeywordBadge from './KeywordBadge'
import styles from '@/styles/components/MetaAnalysis.module.css'

type Named = { name_kr: string; name_en?: string | null; name_jp?: string | null }
type Pictured = { sinner_id: string; folder_name: string | null; game_id: string | null }

export const DIFFICULTY_COLORS: Record<string, string> = { normal: '#9c8b73', hard: '#c8900a', extreme: '#9b2c23' }

function useName() {
  const locale = useLocale() as SupportedLang
  return (row: Named) => (locale === 'en' ? row.name_en : locale === 'ja' ? row.name_jp : row.name_kr) || row.name_kr
}

export function Portrait({ row, size, className }: { row: Pictured; size: number; className: string }) {
  return row.game_id && row.folder_name
    ? <Image src={getIdentityPortraitUrl(row.sinner_id, row.folder_name, row.game_id, false)} alt="" width={size} height={size} className={className} />
    : <span className={className} aria-hidden="true" />
}

function Share({ value }: { value: number }) {
  return <span className={styles.share}>{value.toFixed(1)}<small>%</small></span>
}

/** Each sinner's most used identity, as a share of the posts that field that sinner (bench included on request). */
export function SinnerLeaders({ data, onSelect }: { data: MetaData; onSelect: (identityId: string) => void }) {
  const t = useTranslations('meta.analysis')
  const rootT = useTranslations()
  const name = useName()
  const [formationOnly, setFormationOnly] = useState(true)
  const fielded = new Set(data.battleIdentityStats.map(row => row.identity_id))
  const merged = new Map<string, IdentityStat>(data.battleIdentityStats.map(row => [row.identity_id, row]))
  if (!formationOnly) for (const row of data.supportIdentityStats) {
    const existing = merged.get(row.identity_id)
    merged.set(row.identity_id, existing ? { ...existing, count: existing.count + row.count } : row)
  }
  const bySinner = new Map<string, IdentityStat[]>()
  for (const row of [...merged.values()].sort((a, b) => b.count - a.count || a.identity_id.localeCompare(b.identity_id))) bySinner.set(row.sinner_id, [...bySinner.get(row.sinner_id) ?? [], row])
  const sinners = SINNER_SLUGS.filter(slug => bySinner.has(slug))
  if (!sinners.length) return null
  return <section className={styles.panel} aria-labelledby="sinner-leaders-heading" data-meta-sinners>
    <div className={styles.sectionHead}><h3 id="sinner-leaders-heading">{t('sinnerLeaders')}</h3><span>{t(formationOnly ? 'sinnerLeadersBasis' : 'sinnerLeadersBasisAll')}</span>
      <Toggle label={t('formationOnly')} checked={formationOnly} onChange={setFormationOnly} showState /></div>
    <ul className={styles.sinnerGrid}>{sinners.map(slug => {
      const rows = bySinner.get(slug)!
      const total = rows.reduce((sum, row) => sum + row.count, 0)
      const [top, ...rest] = rows
      const tied = rest.filter(row => row.count === top.count).length
      return <li key={slug}>
        <button type="button" className={styles.sinnerCell} disabled={!fielded.has(top.identity_id)} onClick={() => onSelect(top.identity_id)} aria-label={rootT('sinner.' + slug) + ' ' + name(top) + ' ' + (top.count / total * 100).toFixed(1) + '%'}>
          <span className={styles.sinnerHead}><Image src={getSinnerLogoUrl(slug)} alt="" width={20} height={20} className={styles.sinnerLogo} />{rootT('sinner.' + slug)}<em>{t('count', { count: total })}</em></span>
          <span className={styles.sinnerTop}>
            <Portrait row={top} size={64} className={styles.sinnerPortrait} />
            <span className={styles.sinnerTopText}><span className={styles.sinnerName}>{name(top)}</span>
              <span className={styles.sinnerShare}><Share value={top.count / total * 100} />{tied > 0 && <em className={styles.tieTag}>{t('tiedFirst', { count: tied + 1 })}</em>}</span></span>
          </span>
          <span className={styles.sinnerRest}>{rest.slice(0, 3).map(row => <span key={row.identity_id} title={name(row)}>
            <Portrait row={row} size={28} className={styles.sinnerRestPortrait} /><em data-tie={row.count === top.count ? '' : undefined}>{(row.count / total * 100).toFixed(1)}%</em>
          </span>)}</span>
        </button>
      </li>
    })}</ul>
  </section>
}

/** Most equipped E.G.O across all formations, starting ZAYIN excluded. */
export function EgoLeaders({ data }: { data: MetaData }) {
  const t = useTranslations('meta.analysis')
  const locale = useLocale() as SupportedLang
  const name = useName()
  const egos = data.egoStats.filter(ego => !isBaseEgo(ego.game_id)).slice(0, 8)
  return <section className={styles.panel} aria-labelledby="ego-leaders-heading">
    <div className={styles.sectionHead}><h3 id="ego-leaders-heading">{t('egoLeaders')}</h3><span>{t('egoLeadersBasis')}</span></div>
    {egos.length ? <div className={styles.egoLeaderGrid}>{egos.map(ego => <div key={ego.ego_id} className="min-w-0">
      <EgoDisplayCard ego={ego} name={name(ego)} sinnerId={ego.sinner_id} lang={locale} href={'/sinners/' + ego.sinner_id + '/ego/' + ego.ego_id} />
      <div className={styles.egoStat}><Share value={ego.count / (data.sampleCount || 1) * 100} /><span className={styles.legendCount}>{t('count', { count: ego.count })}</span></div>
    </div>)}</div> : <p className={styles.empty}>{t('empty')}</p>}
  </section>
}

/** Identity pairs most often fielded together. */
export function PairLeaders({ data, onSelect }: { data: MetaData; onSelect: (identityId: string) => void }) {
  const t = useTranslations('meta.analysis')
  const rootT = useTranslations()
  const name = useName()
  const lookup = new Map(data.battleIdentityStats.map(row => [row.identity_id, row]))
  const pairs = data.synergies.slice(0, 6).flatMap(pair => {
    const a = lookup.get(pair.a_id), b = lookup.get(pair.b_id)
    return a && b ? [{ a, b, count: pair.count }] : []
  })
  return <section className={styles.panel} aria-labelledby="pair-heading">
    <div className={styles.sectionHead}><h3 id="pair-heading">{t('pairs')}</h3><span>{t('pairsBasis')}</span></div>
    {pairs.length ? <ol className={styles.pairs}>{pairs.map(({ a, b, count }) => <li key={a.identity_id + b.identity_id}>
      <button type="button" onClick={() => onSelect(a.identity_id)} className={styles.pair}>
        <span className={styles.pairPortraits}><Portrait row={a} size={40} className={styles.pairPortrait} /><Portrait row={b} size={40} className={styles.pairPortrait} /></span>
        <span className={styles.pairNames}>
          <span>{name(a)}<small>{rootT('sinner.' + a.sinner_id)}</small></span>
          <span>{name(b)}<small>{rootT('sinner.' + b.sinner_id)}</small></span>
        </span>
        <Share value={count / (data.sampleCount || 1) * 100} />
        <span className={styles.legendCount}>{t('count', { count })}</span>
      </button>
    </li>)}</ol> : <p className={styles.empty}>{t('empty')}</p>}
  </section>
}

/** A deck or plan as a row: its board, title, what it is for and how it was received (the board cards' icons). Opens the post. */
export function PostRow({ post }: { post: MetaInsightPost }) {
  const t = useTranslations('meta.analysis')
  const rootT = useTranslations()
  return <Link className={styles.post} href={post.source === 'decks' ? '/decks/' + post.id : '/planner/community/' + post.id}>
    <span className={styles.postSource}>{t('sourceTag.' + post.source)}</span>
    <span className={styles.postBody}><span className={styles.postTitle}>{post.title}</span><span className={styles.postTags}>
      <span className={styles.usageTag}><i style={{ background: usageColor(post.usage) }} />{t('usage.' + post.usage)}</span>
      {post.combo.map(key => <KeywordBadge key={key} keyword={key} />)}
      {post.support && <span className={styles.benchTag}>{t('bench')}</span>}
    </span><span className={styles.postStats}>
      <span><Heart fill="currentColor" stroke="none" aria-hidden="true" /><span className="sr-only">{rootT('deck.votes')}</span>{post.votes}</span>
      <span><Eye aria-hidden="true" /><span className="sr-only">{rootT('deck.views')}</span>{post.views}</span>
      {post.comments > 0 && <span><MessageCircle aria-hidden="true" /><span className="sr-only">{rootT('deck.comments')}</span>{post.comments}</span>}
    </span></span>
    <ArrowUpRight className={styles.postArrow} size={18} />
  </Link>
}

/** The most popular decks and plans in scope, side by side. A board with none is left out. */
export function PopularPosts({ data, sources = ['decks', 'planner'] }: { data: MetaData; sources?: MetaInsightPost['source'][] }) {
  const t = useTranslations('meta.analysis')
  const panels = sources.filter(source => data.topPosts?.[source]?.length).map(source => <section key={source} className={styles.panel} aria-labelledby={'popular-' + source + '-heading'} data-meta-popular={source}>
    <div className={styles.sectionHead}><h3 id={'popular-' + source + '-heading'}>{t('popular.' + source)}</h3></div>
    <ul className={styles.posts}>{data.topPosts[source].map(post => <li key={post.id}><PostRow post={post} /></li>)}</ul>
  </section>)
  return panels.length > 1 ? <div className={styles.halfRow}>{panels}</div> : panels[0] ?? null
}

/** Difficulty, planned gifts and theme packs of the plans in scope. Gifts and packs open the plan board filtered to them. */
export function PlanInsights({ summary, data, identityId, headingId }: { summary: MetaPlanSummary | undefined; data: MetaData; identityId?: string; headingId: string }) {
  const t = useTranslations('meta.analysis')
  const rootT = useTranslations()
  const locale = useLocale() as SupportedLang
  const router = useRouter()
  const [difficulty, setDifficulty] = useState<string | null>(null)
  if (!summary?.count) return null
  const board = (param: string, value: string) => '/planner/community?browse=all&' + param + '=' + value + (identityId ? '&ids=' + identityId : '')
  const gifts = summary.gifts.flatMap(row => data.giftCatalog?.[row.key] ? [{ ...row, gift: data.giftCatalog[row.key] }] : [])
  const themes = summary.themes.flatMap(row => data.themeCatalog?.[row.key] ? [{ ...row, theme: data.themeCatalog[row.key] }] : [])
  return <section className={styles.panel} aria-labelledby={headingId} data-meta-plans>
    <div className={styles.sectionHead}>
      <h3 id={headingId}>{t(identityId ? 'plansOfIdentity' : 'plans')}</h3>
      <span>{t('plansBasis', { count: summary.count })}</span>
      <Link href={identityId ? '/planner/community?ids=' + identityId : '/planner/community?browse=all'} className={styles.clearFilter}>{t('openPlans')}<ArrowUpRight size={14} /></Link>
    </div>
    <div className={styles.planGrid}>
      {summary.difficulty.length > 0 && <div className={styles.chartBlock}><h4>{t('difficulty')}</h4>
        <DonutChart label={t('difficulty')} active={difficulty} onSelect={setDifficulty}
          segments={summary.difficulty.map(row => ({ key: row.key, count: row.count, colors: [DIFFICULTY_COLORS[row.key] ?? '#6a6058'], label: rootT('planner.difficultyValues.' + row.key) }))} /></div>}
      {themes.length > 0 && <div className={styles.chartBlock}><h4>{t('plannedThemes')}</h4>
        <ul className={styles.themeGrid}>{themes.map(({ key, count, theme }) => <li key={key}>
          <ThemePackCard theme={theme} sizes="8rem" imageSurface="bare" lang={locale} ariaLabel={getLocalizedName({ name_kr: theme.name, name_en: theme.name_en, name_jp: theme.name_jp }, locale) + ' ' + (count / summary.count * 100).toFixed(1) + '%'} onClick={() => router.push(board('tp', key))} />
          <div className={styles.egoStat}><Share value={count / summary.count * 100} /><span className={styles.legendCount}>{t('count', { count })}</span></div>
        </li>)}</ul></div>}
    </div>
    {gifts.length > 0 && <div className={styles.chartBlock + ' ' + styles.planGifts}><h4>{t('plannedGifts')}</h4>
      <ul className={styles.giftGrid}>{gifts.map(({ key, count, gift }) => {
        const giftName = getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, locale)
        return <li key={key}>
          <GiftCard gift={{ ...gift, name: giftName }} showName onClick={() => router.push(board('gf', key))} ariaLabel={giftName + ' ' + (count / summary.count * 100).toFixed(1) + '%'} />
          <div className={styles.egoStat}><Share value={count / summary.count * 100} /><span className={styles.legendCount}>{t('count', { count })}</span></div>
        </li>
      })}</ul></div>}
  </section>
}
