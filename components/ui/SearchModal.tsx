'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { Brain, Compass, CornerDownLeft, Gift, History, Layers, ScrollText, Search, Swords, Tags, User, X, type LucideIcon } from 'lucide-react'
import { useRouter } from '@/lib/i18n/navigation'
import BaseModal from './BaseModal'
import KeywordIcon from '@/components/ui/KeywordIcon'
import GiftArtwork from '@/components/ui/GiftArtwork'
import Skeleton, { SkeletonPage } from '@/components/ui/Skeleton'
import { localeHref } from '@/components/layout/nav-shared'
import { RARITY_ICON_MAP, SINNER_SLUGS } from '@/lib/constants/game'
import { getEgoGradeBannerUrl, getSinnerLogoUrl } from '@/lib/utils/images'
import { readHistory, remember } from '@/lib/discovery/history'
import { committedQuery, groupHits, markParts } from '@/lib/utils/global-search'
import { search, type Hit, type IndexEntry, type Reason, type SearchType } from '@/lib/search/engine'
import { useSearchIndex } from '@/hooks/useSearchIndex'
import styles from './SearchModal.module.css'

const EGO_GRADES = new Set(['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH'])
const TYPE_ORDER: SearchType[] = ['sinner', 'identity', 'ego', 'egoGift', 'keyword', 'themePack', 'event', 'page']
const TYPE_ICON: Record<SearchType, LucideIcon> = { sinner: User, identity: Swords, ego: Brain, egoGift: Gift, keyword: Tags, themePack: Layers, event: ScrollText, page: Compass }
// 전체 탭에서 종류마다 보여 줄 수: 그림 칸은 PC 한 줄(모바일 두 줄), 줄 목록은 4개
const TILE_TYPES = new Set<SearchType>(['identity', 'ego', 'egoGift', 'themePack'])
const groupLimit = (type: SearchType) => (TILE_TYPES.has(type) ? 6 : 4)
const PAGE = 60

type Tab = 'all' | SearchType
type Row = { kind: 'hit'; hit: Hit } | { kind: 'recent'; query: string } | { kind: 'sinner'; slug: string }

/** 근거 글자를 형광펜으로 칠한다 */
export function Marked({ text, ranges }: { text: string; ranges: [number, number][] }) {
  return <>{markParts(text, ranges).map((p, i) => p.marked ? <mark key={i} className={styles.mark}>{p.text}</mark> : p.text)}</>
}

const giftKeyword = (entry: IndexEntry) => entry.context?.find(c => c.field === 'keyword')?.text ?? null

function Thumb({ entry, large = false }: { entry: IndexEntry; large?: boolean }) {
  const Icon = TYPE_ICON[entry.type]
  const px = large ? 288 : 48
  if (entry.type === 'egoGift') return <span className={`${styles.thumb} ${styles.thumbGift}`}>
    <GiftArtwork gift={{ grade: entry.grade, keyword: giftKeyword(entry), image_url: entry.icon, name: entry.label }} displayName={entry.label} sizes={`${px}px`} />
  </span>
  if (entry.type === 'keyword' && entry.icon) return <span className={`${styles.thumb} ${styles.thumbKeyword}`}>
    <KeywordIcon src={entry.icon} alt="" width={px} height={px} unoptimized />
  </span>
  if (!entry.icon) return <span className={`${styles.thumb} ${styles.thumbIcon}`}><Icon aria-hidden="true" /></span>
  return <span className={`${styles.thumb} ${styles[`thumb_${entry.type}`] ?? ''}`}>
    <Image src={entry.icon} alt="" width={px} height={px} sizes={`${px}px`} />
  </span>
}

/** 부제(수감자, 기프트 키워드…). 근거가 부제와 같은 글이면 부제에 바로 칠한다 */
function Meta({ entry, ranges = [] }: { entry: IndexEntry; ranges?: [number, number][] }) {
  return <span className={styles.meta}>
    {entry.sinner && <Image src={getSinnerLogoUrl(entry.sinner)} alt="" width={16} height={16} unoptimized className={styles.metaLogo} />}
    {entry.sublabel && <span className={styles.metaText}><Marked text={entry.sublabel} ranges={ranges} /></span>}
  </span>
}

function Badge({ entry }: { entry: IndexEntry }) {
  if (entry.rarity && RARITY_ICON_MAP[entry.rarity]) return <Image src={RARITY_ICON_MAP[entry.rarity]} alt={`${entry.rarity}`} width={20} height={20} unoptimized className={styles.badge} />
  if (entry.type === 'ego' && entry.grade && EGO_GRADES.has(entry.grade)) return <Image src={getEgoGradeBannerUrl(entry.grade)} alt={entry.grade} width={36} height={16} unoptimized className={styles.badge} />
  return null
}

/** 표시 이름에 맞은 글자는 이름 위에, 다른 칸(영어 이름, 수감자, 키워드…)에 맞았으면 그 칸 이름과 글을 아래 줄에 칠해 보여 준다 */
function Reasons({ reasons, sublabel }: { reasons: Reason[]; sublabel?: string }) {
  const t = useTranslations('globalSearch')
  const others = reasons.filter(r => r.field !== 'label' && r.text !== sublabel)
  if (others.length === 0) return null
  return <>{others.map((r, i) => <span key={i} className={styles.reason}>
    <span className={styles.reasonField}>{t(`reasons.${r.field}`)}</span>
    <span className={styles.reasonText}><Marked text={r.text} ranges={r.ranges} /></span>
  </span>)}</>
}

const labelRanges = (hit: Hit) => hit.reasons.filter(r => r.field === 'label').flatMap(r => r.ranges)
const sublabelRanges = (hit: Hit) => hit.reasons.filter(r => r.field !== 'label' && r.text === hit.entry.sublabel).flatMap(r => r.ranges)

export function ResultRow({ hit, id, active, onChoose, onHover }: {
  hit: Hit; id: string; active: boolean; onChoose: () => void; onHover: () => void
}) {
  const { entry } = hit
  return <div id={id} data-row={id} role="option" aria-selected={active} data-active={active}
    className={styles.row} onClick={onChoose} onMouseMove={onHover}>
    <Thumb entry={entry} />
    <span className={styles.main}>
      <span className={styles.title}>
        <span className={styles.titleText}><Marked text={entry.label} ranges={labelRanges(hit)} /></span>
        <Badge entry={entry} />
      </span>
      <Meta entry={entry} ranges={sublabelRanges(hit)} />
      <Reasons reasons={hit.reasons} sublabel={entry.sublabel} />
    </span>
    {active && <CornerDownLeft size={15} aria-hidden="true" className={styles.enter} />}
  </div>
}

function ResultTile({ hit, id, active, onChoose, onHover }: { hit: Hit; id: string; active: boolean; onChoose: () => void; onHover: () => void }) {
  const { entry } = hit
  return <div id={id} data-row={id} role="option" aria-selected={active} data-active={active} className={styles.tile} onClick={onChoose} onMouseMove={onHover}>
    <span className={`${styles.tileArt} ${entry.type === 'themePack' ? styles.tileTall : ''}`}><Thumb entry={entry} large /></span>
    <span className={styles.tileTitle}><Marked text={entry.label} ranges={labelRanges(hit)} /></span>
    <span className={styles.tileMeta}><Meta entry={entry} ranges={sublabelRanges(hit)} /><Badge entry={entry} /></span>
    <Reasons reasons={hit.reasons} sublabel={entry.sublabel} />
  </div>
}

interface Props {
  open: boolean
  onClose: () => void
}

export default function SearchModal({ open, onClose }: Props) {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('globalSearch')
  const rootT = useTranslations()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  // rawQuery는 입력창 값, committed는 IME 조합이 끝난 검색어. 조합 중에는 검색하지 않는다
  const [rawQuery, setRawQuery] = useState('')
  const [committed, setCommitted] = useState('')
  const [tab, setTab] = useState<Tab>('all')
  const [activeIndex, setActiveIndex] = useState(0)
  const [visible, setVisible] = useState(PAGE)
  const [recent, setRecent] = useState<string[]>([])
  const { entries, failed, retry } = useSearchIndex(locale, open)

  const setText = (value: string) => { setRawQuery(value); setCommitted(value); setActiveIndex(0); setVisible(PAGE) }

  useEffect(() => {
    if (!open) return
    setText('')
    setTab('all')
    setRecent(readHistory().queries.slice(0, 5))
    const timer = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(timer)
  }, [open])

  const typing = committed.trim()
  const hits = useMemo(() => (entries && typing ? search(entries, typing) : []), [entries, typing])
  const counts = useMemo(() => {
    const map = new Map<SearchType, number>()
    for (const h of hits) map.set(h.entry.type, (map.get(h.entry.type) ?? 0) + 1)
    return map
  }, [hits])
  const activeTab: Tab = tab !== 'all' && counts.has(tab) ? tab : 'all'
  const tabs: Tab[] = ['all', ...TYPE_ORDER.filter(type => counts.has(type))]
  const groups = useMemo(() => groupHits(hits, groupLimit), [hits])
  const tabHits = useMemo(() => activeTab === 'all' ? [] : hits.filter(h => h.entry.type === activeTab).slice(0, visible), [hits, activeTab, visible])

  const rows: Row[] = typing
    ? (activeTab === 'all' ? groups.flatMap(g => g.hits) : tabHits).map(hit => ({ kind: 'hit' as const, hit }))
    : [...recent.map(query => ({ kind: 'recent' as const, query })), ...SINNER_SLUGS.map(slug => ({ kind: 'sinner' as const, slug }))]
  const rowIndex = new Map(rows.map((row, i) => [row.kind === 'hit' ? row.hit : row.kind === 'recent' ? row.query : row.slug, i]))
  const active = rows[Math.min(activeIndex, rows.length - 1)]

  const go = (href: string) => {
    if (typing) remember(typing)
    onClose()
    router.push(href)
  }
  const choose = (row: Row) => {
    if (row.kind === 'recent') { setText(row.query); inputRef.current?.focus(); return }
    go(row.kind === 'hit' ? row.hit.entry.href : `/sinners/${row.slug}`)
  }
  const pickTab = (next: Tab) => { setTab(next); setActiveIndex(0); setVisible(PAGE); listRef.current?.scrollTo({ top: 0 }) }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (rows.length === 0) return
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActiveIndex(i => (Math.min(i, rows.length - 1) + step + rows.length) % rows.length)
    } else if (e.key === 'Enter' && active) {
      e.preventDefault()
      choose(active)
    } else if (e.key === 'Tab' && typing && tabs.length > 1) {
      e.preventDefault()
      const at = tabs.indexOf(activeTab)
      pickTab(tabs[(at + (e.shiftKey ? -1 : 1) + tabs.length) % tabs.length])
    }
  }

  const rowId = (i: number) => `global-search-row-${i}`
  useEffect(() => {
    listRef.current?.querySelector(`[data-row="global-search-row-${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const props = (hit: Hit) => {
    const i = rowIndex.get(hit) ?? 0
    return { hit, id: rowId(i), active: i === activeIndex, onChoose: () => choose({ kind: 'hit', hit }), onHover: () => setActiveIndex(i) }
  }
  // 인격·E.G.O·기프트·테마팩은 그림 칸, 나머지는 줄 목록
  const renderHits = (list: Hit[]) => list.length > 0 && TILE_TYPES.has(list[0].entry.type)
    ? <div className={styles.tiles}>{list.map(hit => <ResultTile key={hit.entry.href} {...props(hit)} />)}</div>
    : list.map(hit => <ResultRow key={hit.entry.href} {...props(hit)} />)

  const loading = !!typing && !entries && !failed

  return (
    <BaseModal open={open} onClose={onClose} title={t('ariaLabel')} maxWidth="46rem" zIndex={100} padding="0.75rem">
      <div className={`popup-search ${styles.shell}`}>
        <div className={styles.bar}>
          <Search size={19} aria-hidden="true" className={styles.barIcon} />
          <input
            ref={inputRef}
            value={rawQuery}
            onChange={e => {
              const value = e.target.value
              setRawQuery(value)
              setCommitted(prev => committedQuery(prev, value, (e.nativeEvent as InputEvent).isComposing))
              setActiveIndex(0)
              setVisible(PAGE)
            }}
            onCompositionEnd={e => setCommitted(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('placeholder')}
            role="combobox"
            aria-expanded={rows.length > 0}
            aria-controls="global-search-list"
            aria-activedescendant={active ? rowId(rows.indexOf(active)) : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            className={styles.input}
          />
          {rawQuery && <button type="button" aria-label={t('clear')} onClick={() => { setText(''); inputRef.current?.focus() }} className={styles.iconButton}><X size={16} /></button>}
          <button type="button" onClick={onClose} className={styles.closeText}>{t('keyboard.close')}</button>
          <kbd className={`${styles.kbd} ${styles.escKey}`}>Esc</kbd>
        </div>

        {typing && tabs.length > 1 && (
          <div className={styles.tabs} role="tablist" aria-label={t('ariaLabel')}>
            {tabs.map(type => (
              <button key={type} type="button" role="tab" aria-selected={type === activeTab} className={styles.tab} onClick={() => { pickTab(type); inputRef.current?.focus() }}>
                {t(`types.${type}`)}
                <span className={styles.tabCount}>{type === 'all' ? hits.length : counts.get(type)}</span>
              </button>
            ))}
          </div>
        )}

        <div className={styles.body}>
          <div ref={listRef} id="global-search-list" role="listbox" aria-label={t('ariaLabel')} className={styles.list}
            onScroll={e => {
              const el = e.currentTarget
              if (activeTab !== 'all' && el.scrollTop + el.clientHeight > el.scrollHeight - 400) setVisible(n => n + PAGE)
            }}>
            {!typing && <>
              {recent.length > 0 && <section>
                <h3 className={styles.groupHead}>{t('recentTitle')}</h3>
                {recent.map(query => {
                  const i = rowIndex.get(query)!
                  return <div key={query} id={rowId(i)} data-row={rowId(i)} role="option" aria-selected={i === activeIndex} data-active={i === activeIndex}
                    className={`${styles.row} ${styles.recent}`} onClick={() => choose({ kind: 'recent', query })} onMouseMove={() => setActiveIndex(i)}>
                    <History size={16} aria-hidden="true" className={styles.recentIcon} />
                    <span className={styles.titleText}>{query}</span>
                  </div>
                })}
              </section>}
              <section>
                <h3 className={styles.groupHead}>{t('sinnersTitle')}</h3>
                <div className={styles.sinners}>
                  {SINNER_SLUGS.map(slug => {
                    const i = rowIndex.get(slug)!
                    return <a key={slug} id={rowId(i)} data-row={rowId(i)} role="option" aria-selected={i === activeIndex} data-active={i === activeIndex}
                      href={localeHref(locale, `/sinners/${slug}`)} className={styles.sinner}
                      onClick={e => { e.preventDefault(); choose({ kind: 'sinner', slug }) }} onMouseMove={() => setActiveIndex(i)}>
                      <Image src={getSinnerLogoUrl(slug)} alt="" width={40} height={40} unoptimized />
                      <span>{rootT(`sinner.${slug}`)}</span>
                    </a>
                  })}
                </div>
              </section>
            </>}

            {loading && <SkeletonPage className={styles.skeleton}>
              {[0, 1, 2, 3, 4, 5].map(n => <div key={n} className={styles.row}>
                <Skeleton className={styles.thumb} />
                <span className={styles.main}><Skeleton className="h-3.5" style={{ width: `${48 + (n % 3) * 14}%` }} /><Skeleton className="mt-1.5 h-3 w-1/4" /></span>
              </div>)}
            </SkeletonPage>}

            {typing && failed && <div className={styles.state} aria-live="polite">
              <p>{t('error')}</p>
              <button type="button" className={styles.retry} onClick={retry}>{t('retry')}</button>
            </div>}

            {typing && entries && hits.length === 0 && <p className={styles.state} aria-live="polite">{t('noResultsFor', { query: typing })}</p>}

            {typing && activeTab === 'all' && groups.map(group => (
              <section key={group.type}>
                <h3 className={styles.groupHead}>
                  <span>{t(`types.${group.type}`)}</span>
                  {group.total > group.hits.length && <button type="button" className={styles.more} onClick={() => { pickTab(group.type); inputRef.current?.focus() }}>{t('more', { count: group.total - group.hits.length })}</button>}
                </h3>
                {renderHits(group.hits)}
              </section>
            ))}

            {typing && activeTab !== 'all' && <section className={styles.tabSection}>{renderHits(tabHits)}</section>}
          </div>
        </div>

        <div className={styles.foot}>
          <span><kbd className={styles.kbd}>↑</kbd><kbd className={styles.kbd}>↓</kbd>{t('keyboard.move')}</span>
          <span><kbd className={styles.kbd}>Enter</kbd>{t('keyboard.select')}</span>
          <span><kbd className={styles.kbd}>Tab</kbd>{t('keyboard.type')}</span>
          <span><kbd className={styles.kbd}>Esc</kbd>{t('keyboard.close')}</span>
        </div>
      </div>
    </BaseModal>
  )
}
