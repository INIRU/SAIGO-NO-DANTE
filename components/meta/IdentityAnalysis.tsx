'use client'

import Image from 'next/image'
import { motion, useReducedMotion } from 'motion/react'
import { smoothTransition } from '@/lib/animations'
import { getSinnerLogoUrl, getIdentityPortraitUrl } from '@/lib/utils/images'
import { useState, type ReactNode } from 'react'
import styles from '@/styles/components/MetaAnalysis.module.css'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowUpRight, Layers3, Search, X, ChevronsUpDown } from 'lucide-react'
import { Link } from '@/lib/i18n/navigation'
import { isBaseEgo, type MetaData } from '@/lib/meta/types'
import type { Identity } from '@/lib/types'
import type { SupportedLang } from '@/lib/i18n/types'
import BaseModal from '@/components/ui/BaseModal'
import IdentityCard from '@/components/sinners/IdentityCard'
import FormationBoard from '@/components/decks/FormationBoard'
import EgoDisplayCard from '@/components/sinners/EgoDisplayCard'
import { Toggle } from '@/components/tools/LunacyControls'
import IdentityInterest from './IdentityInterest'
import KeywordBadge from './KeywordBadge'

const panel = styles.panel
export default function IdentityAnalysis({ data, summary }: { data: MetaData; summary: ReactNode }) {
  const t = useTranslations('meta.analysis')
  const reduceMotion = useReducedMotion()
  const [visibleCount, setVisibleCount] = useState(36)
  const locale = useLocale() as SupportedLang
  const [selected, setSelected] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [sinner, setSinner] = useState('')
  const rootT = useTranslations()
  const [keyword, setKeyword] = useState('')
  const [excludeBase, setExcludeBase] = useState(true)
  const identityId = data.battleIdentityStats.some(row => row.identity_id === selected) ? selected : data.battleIdentityStats[0]?.identity_id ?? ''
  const insight = data.identityInsights?.[identityId]
  const name = (row: { name_kr: string; name_en?: string | null; name_jp?: string | null }) => (locale === 'en' ? row.name_en : locale === 'ja' ? row.name_jp : row.name_kr) || row.name_kr
  if (!data.battleIdentityStats.length) return <div className={styles.panel}>{summary}<p className={styles.empty}>{t('empty')}</p></div>
  const identity = data.battleIdentityStats.find(row => row.identity_id === identityId)!
  const egos = insight?.egos.filter(ego => !excludeBase || !isBaseEgo(ego.game_id)) ?? []
  const companions = (insight?.companions ?? []).flatMap(row => {
    const companion = data.battleIdentityStats.find(identity => identity.identity_id === row.identity_id)
    return companion ? [{ ...companion, count: row.count }] : []
  })
  const activeKeyword = insight?.keywords.some(row => row.keyword === keyword) ? keyword : ''
  const posts = insight?.posts.filter(post => !activeKeyword || post.keywords.includes(activeKeyword)) ?? []
  const percent = (count: number) => (count / (insight?.count || 1) * 100).toFixed(1)
  const cardIdentity = (row: typeof identity): Identity => ({ ...row, id: row.identity_id, name: name(row), tier: row.rarity, hp: 0, speed_min: 0, speed_max: 0, def_level: 0 })
  const filtered = data.battleIdentityStats.filter(row => (!sinner || row.sinner_id === sinner) && `${name(row)} ${rootT(`sinner.${row.sinner_id}`)}`.toLocaleLowerCase(locale).includes(search.trim().toLocaleLowerCase(locale)))
  return <section className={styles.analysis} data-identity-analysis>
    <div className={styles.subject} data-analysis-subject>
      <div className={styles.subjectCard}><IdentityCard identity={cardIdentity(identity)} compact board showName={false} disableHoverEffects /></div>
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-xs text-[var(--gold-dim)]">{rootT(`sinner.${identity.sinner_id}`)}</p>
        <h2 className={styles.subjectName}>{name(identity)}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => { setSearch(''); setSinner(''); setVisibleCount(36); setPickerOpen(true) }} aria-haspopup="dialog" className="flex min-h-10 items-center gap-3 rounded-sm border border-[var(--gold-dim)] bg-[rgba(200,144,10,.1)] px-3 text-sm text-[var(--gold)] hover:bg-[rgba(200,144,10,.2)] focus-visible:outline-2 focus-visible:outline-[var(--gold)]">{t('change')}<ChevronsUpDown size={15} /></button>
          <Link href={`/sinners/${identity.sinner_id}/identities/${identityId}`} className={styles.detailLink}>{t('detail')}<ArrowUpRight size={14} /></Link>
        </div>
        <div className={styles.subjectSummary}>{summary}</div>
      </div>
    </div>
    <BaseModal open={pickerOpen} onClose={() => setPickerOpen(false)} title={t('identity')} maxWidth="58rem">
      <div className="flex max-h-[82dvh] flex-col overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg-panel)] shadow-2xl" data-analysis-picker>
        <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border)] px-4 py-3">
          <h2 className="flex-1 font-[family-name:var(--font-heading)] text-lg text-[var(--gold)]">{t('identity')}</h2>
          <span className="tabular-nums text-xs text-[var(--text-muted)]">{filtered.length} / {data.battleIdentityStats.length}</span>
          <button type="button" onClick={() => setPickerOpen(false)} aria-label={t('close')} className="flex h-10 w-10 items-center justify-center text-[var(--text-muted)] hover:text-[var(--gold)] focus-visible:outline-2 focus-visible:outline-[var(--gold)]"><X size={20} /></button>
        </div>
        <div className="shrink-0 space-y-3 border-b border-[var(--border)] p-4">
          <label className="flex items-center gap-3 border-b border-[var(--gold-dim)] bg-[var(--bg-deep)] px-3 text-[var(--gold)]"><Search size={18} /><input autoFocus aria-label={t('search')} placeholder={t('search')} value={search} onChange={e => { setSearch(e.target.value); setVisibleCount(36) }} className="min-h-11 min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]" /></label>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('sinner')}>
            {['', ...new Set(data.battleIdentityStats.map(row => row.sinner_id))].map(id => <button type="button" key={id} aria-pressed={sinner === id} onClick={() => { setSinner(id); setVisibleCount(36) }} className={`inline-flex min-h-10 items-center gap-2 rounded-sm border px-2.5 font-[family-name:var(--font-body)] text-xs focus-visible:outline-2 focus-visible:outline-[var(--gold)] ${sinner === id ? 'border-[var(--gold)] bg-[rgba(200,144,10,.15)] text-[var(--gold)]' : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--gold)]'}`}>{id && <Image src={getSinnerLogoUrl(id)} alt="" width={22} height={22} className="h-[1.375rem] w-[1.375rem] object-contain" />}<span>{id ? rootT(`sinner.${id}`) : t('all')}</span></button>)}
          </div>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5" data-analysis-picker-results>
          <motion.div key={`${search}:${sinner}`} initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .18 }}>
          <FormationBoard slots={filtered.slice(0, visibleCount).map(row => ({ key: row.identity_id, identity: cardIdentity(row), slotOrder: null, selected: identityId === row.identity_id, ariaLabel: name(row), onClick: () => { setSelected(row.identity_id); setKeyword(''); setPickerOpen(false) } }))} />
          {filtered.length > visibleCount && <button type="button" onClick={() => setVisibleCount(n => n + 36)} className="mt-5 min-h-11 w-full border border-[var(--border)] text-sm text-[var(--gold)] hover:border-[var(--gold)]">{t('more')}</button>}
          {!filtered.length && <p className="py-12 text-center text-sm text-[var(--text-muted)]">{t('noMatches')}</p>}
          </motion.div>
        </div>
      </div>
    </BaseModal>
    {!insight ? <p>{t('empty')}</p> : <motion.div key={identityId} className="space-y-6" initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={smoothTransition}>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={panel}><h3 className="mb-5 font-[family-name:var(--font-heading)] text-base text-[var(--gold)]">{t('order')}</h3>
          <ul className="space-y-4">{Object.entries(insight.orders).sort((a, b) => Number(a[0]) - Number(b[0])).map(([order, count]) => <li key={order}>
            <div className="mb-2 flex items-center justify-between gap-3"><span className="border-l-2 border-[var(--gold)] bg-[rgba(200,144,10,.1)] px-3 py-1 text-sm">{t('position', { order })}</span><span className="tabular-nums text-sm text-[var(--gold-light)]">{percent(count)}% <small className="text-[var(--text-muted)]">({count})</small></span></div>
            <div className="h-1 overflow-hidden rounded-full bg-white/5"><div className="h-full bg-gradient-to-r from-[var(--gold-dim)] to-[var(--gold)]" style={{ width: `${percent(count)}%` }} /></div>
          </li>)}</ul>
        </div>
        <div className={panel}><h3 className="mb-3 font-[family-name:var(--font-heading)] text-base text-[var(--gold)]">{t('purpose')}</h3>
          <p className="mb-4 text-xs leading-5 text-[var(--text-muted)]">{t('purposeHint')}</p>
          <ul className="space-y-4">{insight.keywords.map(row => <li key={row.keyword}><div className="mb-2 flex items-center justify-between gap-3"><KeywordBadge keyword={row.keyword} /><span className="tabular-nums text-sm">{percent(row.count)}% <small className="text-[var(--text-muted)]">({row.count})</small></span></div><div className="h-1 rounded-full bg-white/5"><div className="h-full rounded-full bg-[var(--gold-dim)]" style={{ width: `${percent(row.count)}%` }} /></div></li>)}</ul>
          {!insight.keywords.length && <p className="text-sm text-[var(--text-muted)]">{t('unclassified')}</p>}
        </div>
      </div>
      <section className={panel} aria-labelledby="companion-heading" data-meta-companions>
        <h3 id="companion-heading">{t('companions')}</h3>
        <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{t('companionsHint', { count: insight.count })}</p>
        {companions.length ? <ul className={styles.companions}>
          {companions.map(row => <li key={row.identity_id} className={styles.companion}>
            {row.game_id && row.folder_name ? <Image src={getIdentityPortraitUrl(row.sinner_id, row.folder_name, row.game_id, false)} alt="" width={48} height={48} className={styles.companionPortrait} /> : <span className={styles.companionPortrait} aria-hidden="true" />}
            <div className={styles.companionInfo}>
              <div className={styles.companionLabel}><Link href={`/sinners/${row.sinner_id}/identities/${row.identity_id}`} className={styles.companionName}>{name(row)}<small>{rootT(`sinner.${row.sinner_id}`)}</small></Link><span className={styles.companionPercent}>{percent(row.count)}<small>%</small></span></div>
              <div className={styles.companionTrack} aria-hidden="true"><div style={{ width: `${percent(row.count)}%` }} /></div>
              <p className={styles.companionCount}>{t('companionCount', { count: row.count, total: insight.count })}</p>
            </div>
          </li>)}
        </ul> : <p className={styles.empty}>{t('noCompanions')}</p>}
      </section>
      <div className={panel}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h3 className="font-[family-name:var(--font-heading)] text-base text-[var(--gold)]">{t('egos')}</h3><Toggle label={t('excludeBase')} checked={excludeBase} onChange={setExcludeBase} showState /></div>
        <p className="mb-4 text-xs leading-6 text-[var(--text-muted)]">{t('method', { count: insight.count })}</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">{egos.map(ego => <div key={ego.ego_id} className="min-w-0" data-meta-ego>
          <EgoDisplayCard ego={ego} name={name(ego)} sinnerId={ego.sinner_id} lang={locale} href={`/sinners/${ego.sinner_id}/ego/${ego.ego_id}`} />
          <div className="mt-2 flex items-baseline justify-between border-t border-[var(--border)] px-1 pt-2 tabular-nums"><span className="text-base text-[var(--gold)]">{percent(ego.count)}<small className="ml-0.5 text-xs">%</small></span><span className="text-xs text-[var(--text-muted)]">{ego.count}</span></div>
        </div>)}</div>
        {!egos.length && <div className="flex min-h-28 items-center justify-center gap-3 px-5 text-sm text-[var(--text-muted)]"><Layers3 size={24} className="shrink-0 opacity-40" /><p>{excludeBase && insight.egos.length ? t('baseOnly') : t('empty')}</p></div>}
      </div>
      <IdentityInterest id={identityId} />
      <div className={panel}><h3 className="mb-3 font-[family-name:var(--font-heading)] text-base text-[var(--gold)]">{t('decks')}</h3>
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label={t('keyword')}>{['', ...insight.keywords.map(row => row.keyword)].map(value => <button type="button" key={value} aria-pressed={activeKeyword === value} onClick={() => setKeyword(value)} className={`min-h-10 rounded border px-3 py-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-[var(--gold)] ${activeKeyword === value ? 'border-[var(--gold)] bg-[rgba(200,144,10,.12)] text-[var(--gold)]' : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--gold-dim)]'}`}>{value ? <KeywordBadge keyword={value} /> : t('all')}</button>)}</div>
        <ul className="grid gap-3 md:grid-cols-2">{posts.map(post => <li key={`${post.source}:${post.id}`}><Link className="group flex h-full items-center justify-between gap-3 rounded border border-[var(--border)] bg-[var(--bg-elevated)] p-4 hover:border-[var(--gold)]" href={post.source === 'decks' ? `/decks/${post.id}` : `/planner/community/${post.id}`}><div className="min-w-0"><span className="break-words text-sm">{post.title}</span><span className="mt-3 flex flex-wrap gap-2">{post.keywords.map(key => <KeywordBadge key={key} keyword={key} />)}</span></div><ArrowUpRight className="shrink-0 text-[var(--gold-dim)] group-hover:text-[var(--gold)]" size={18} /></Link></li>)}</ul>
      </div>
    </motion.div>}
  </section>
}
