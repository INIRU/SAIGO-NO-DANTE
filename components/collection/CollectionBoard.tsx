'use client'

import type { ReactNode } from 'react'
import Image from 'next/image'
import { useLocale } from 'next-intl'
import IdentityFrameCard from '@/components/ui/IdentityFrameCard'
import EgoDisplayCard from '@/components/sinners/EgoDisplayCard'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { SIN_COLORS } from '@/lib/constants/sin'
import { getSinnerLogoUrl } from '@/lib/utils/images'
import type { CollectionData, EGOInfo, IdentityInfo } from '@/lib/collection'
import type { SupportedLang } from '@/lib/i18n/types'
import styles from './CollectionBoard.module.css'

export const COLLECTION_ALL = 'all'
const KEYWORDS = ['화상', '출혈', '진동', '파열', '침잠', '호흡', '충전']
const GRADES = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH']

type Counts = Record<string, { owned: number; total: number } | undefined>
type Filtered = { identities: Record<string, IdentityInfo[]>; egos: Record<string, EGOInfo[]> }

/**
 * Collection board shared by the editor (my page, /collection) and the read-only shared view:
 * sinner strip with progress, keyword filter, then identity cards and E.G.O cards. Unowned items are dimmed.
 */
export default function CollectionBoard({ data, filtered, counts, owned, sinner, onSinner, keyword, onKeyword, showUnowned, onShowUnowned, onToggle, actions }: {
  data: CollectionData
  filtered: Filtered
  counts: Counts
  owned: Set<string>
  /** A sinner id or COLLECTION_ALL. */
  sinner: string
  onSinner: (id: string) => void
  keyword: string | null
  onKeyword: (keyword: string | null) => void
  showUnowned: boolean
  onShowUnowned: (show: boolean) => void
  /** Missing = read-only. */
  onToggle?: (id: string) => void
  actions?: ReactNode
}) {
  const lang = useLocale() as SupportedLang
  const { sinMap, getIconUrl } = useKeywordData()
  const shown = sinner === COLLECTION_ALL ? data.sinners : data.sinners.filter(s => s.id === sinner)
  const total = { owned: 0, total: 0 }
  for (const c of Object.values(counts)) { total.owned += c?.owned ?? 0; total.total += c?.total ?? 0 }
  const label = { ko: { all: '전체', unowned: '미보유도 보기', identities: '인격', egos: 'E.G.O', empty: '조건에 맞는 인격·E.G.O가 없습니다' }, en: { all: 'All', unowned: 'Show unowned', identities: 'Identities', egos: 'E.G.O', empty: 'Nothing matches these filters' }, ja: { all: 'すべて', unowned: '未所持も表示', identities: '人格', egos: 'E.G.O', empty: '条件に合う人格・E.G.Oがありません' } }[lang] ?? { all: '전체', unowned: '미보유도 보기', identities: '인격', egos: 'E.G.O', empty: '' }

  const sinnerTile = (id: string, name: string, c: { owned: number; total: number }, logo?: string) => (
    <button key={id} type="button" className={styles.sinner} aria-pressed={sinner === id} onClick={() => onSinner(id)} data-complete={c.total > 0 && c.owned === c.total || undefined}>
      {logo ? <Image src={logo} alt="" width={32} height={32} /> : <span className={styles.allMark} aria-hidden="true">{c.total ? Math.round((c.owned / c.total) * 100) : 0}%</span>}
      <span className={styles.sinnerName}>{name}</span>
      <span className={styles.bar}><span style={{ width: `${c.total ? (c.owned / c.total) * 100 : 0}%` }} /></span>
      <span className={styles.count}>{c.owned}/{c.total}</span>
    </button>
  )

  const item = (id: string, card: ReactNode) => (
    <li key={id} className={styles.item} data-owned={owned.has(id) || undefined}>
      {onToggle
        ? <button type="button" className={styles.toggle} aria-pressed={owned.has(id)} onClick={() => onToggle(id)}>{card}</button>
        : card}
    </li>
  )

  const sections = shown.map(s => {
    const ids = (filtered.identities[s.id] ?? []).filter(i => showUnowned || owned.has(i.id))
    const egos = (filtered.egos[s.id] ?? []).filter(e => showUnowned || owned.has(e.id))
    if (!ids.length && !egos.length) return null
    return (
      <section key={s.id} className={styles.section}>
        {sinner === COLLECTION_ALL && (
          <h3 className={styles.sinnerHead}>
            <Image src={getSinnerLogoUrl(s.id)} alt="" width={24} height={24} />{s.name_kr}
            <span>{(counts[s.id]?.owned ?? 0)}/{(counts[s.id]?.total ?? 0)}</span>
          </h3>
        )}
        {ids.length > 0 && (
          <>
            <p className={styles.kind}>{label.identities}<b>{ids.filter(i => owned.has(i.id)).length}/{ids.length}</b></p>
            <ul className={styles.identities}>
              {ids.map(identity => item(identity.id, <IdentityFrameCard identity={identity} name={identity.name_kr} sizes="(max-width: 40rem) 30vw, 9rem" />))}
            </ul>
          </>
        )}
        {egos.length > 0 && (
          <>
            <p className={styles.kind}>{label.egos}<b>{egos.filter(e => owned.has(e.id)).length}/{egos.length}</b></p>
            <ul className={styles.egos}>
              {GRADES.flatMap(grade => egos.filter(e => e.grade === grade)).map(ego => item(ego.id,
                <EgoDisplayCard displayOnly ego={{ grade: ego.grade, image_url: ego.image_url, sin_affinity: ego.sin_affinity }} name={ego.name_kr ?? ''} sinnerId={ego.sinner_id} lang={lang} />,
              ))}
            </ul>
          </>
        )}
      </section>
    )
  }).filter(Boolean)

  return (
    <div className={styles.board}>
      <div className={styles.sinners}>
        {sinnerTile(COLLECTION_ALL, label.all, total)}
        {data.sinners.map(s => sinnerTile(s.id, s.name_kr, counts[s.id] ?? { owned: 0, total: 0 }, getSinnerLogoUrl(s.id)))}
      </div>
      <div className={styles.filters}>
        <div className={styles.keywords}>
          <button type="button" className={styles.chip} aria-pressed={!keyword} onClick={() => onKeyword(null)}>{label.all}</button>
          {KEYWORDS.map(kw => {
            const icon = getIconUrl(kw)
            const sin = sinMap[kw]
            return (
              <button key={kw} type="button" className={styles.chip} aria-pressed={keyword === kw} onClick={() => onKeyword(keyword === kw ? null : kw)}
                style={sin ? { '--kw': SIN_COLORS[sin] } as React.CSSProperties : undefined}>
                {icon && <Image src={icon} alt="" width={16} height={16} />}{kw}
              </button>
            )
          })}
        </div>
        <label className={styles.switchRow}>
          {label.unowned}
          <input type="checkbox" role="switch" className={styles.switch} checked={showUnowned} onChange={event => onShowUnowned(event.target.checked)} />
        </label>
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
      {sections.length ? sections : <p className={styles.empty}>{label.empty}</p>}
    </div>
  )
}
