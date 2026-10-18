'use client'

import { useState, useEffect, useRef, type KeyboardEvent } from 'react'
import { useRouter } from '@/lib/i18n/navigation'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { Search, X, User, Swords, Brain, Tags, Gift, History, CornerDownLeft } from 'lucide-react'
import BaseModal from './BaseModal'
import KeywordIcon from '@/components/ui/KeywordIcon'
import { STORAGE_BASE } from '@/lib/constants/game'
import { getEgoGradeBannerUrl } from '@/lib/utils/images'
import { readHistory, remember } from '@/lib/discovery/history'
import { useDebounce } from '@/hooks/useDebounce'
import { committedQuery, splitMatch } from '@/lib/utils/global-search'
import Skeleton, { SkeletonPage } from '@/components/ui/Skeleton'
import type { SearchItem, SearchItemType } from '@/app/api/search/route'

const RARITY_ICONS: Record<number, string> = {
  1: `${STORAGE_BASE}/icons/Rarity/1star.webp`,
  2: `${STORAGE_BASE}/icons/Rarity/2star.webp`,
  3: `${STORAGE_BASE}/icons/Rarity/3star.webp`,
}
const EGO_GRADES = new Set(['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH'])
const TYPE_ICON = { sinner: User, identity: Swords, ego: Brain, keyword: Tags, egoGift: Gift } as const
const TYPE_ORDER: SearchItemType[] = ['sinner', 'identity', 'ego', 'keyword', 'egoGift']

type Row = { kind: 'result'; item: SearchItem } | { kind: 'recent'; query: string }

interface Props {
  open: boolean
  onClose: () => void
}

function Highlight({ text, query }: { text: string; query: string }) {
  const parts = splitMatch(text, query)
  if (!parts) return text
  return <>{parts[0]}<mark className="bg-transparent text-[var(--gold-light)]">{parts[1]}</mark>{parts[2]}</>
}

export default function SearchModal({ open, onClose }: Props) {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('globalSearch')
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  // rawQuery는 입력창 값, committed는 IME 조합이 끝난 검색어. 조합 중에는 검색하지 않는다
  const [rawQuery, setRawQuery] = useState('')
  const [committed, setCommitted] = useState('')
  const query = useDebounce(committed.trim(), 200)
  const setText = (value: string) => { setRawQuery(value); setCommitted(value) }
  const [items, setItems] = useState<SearchItem[]>([])
  const [suggestions, setSuggestions] = useState<SearchItem[]>([])
  const [searchedFor, setSearchedFor] = useState('')
  const [failed, setFailed] = useState(false)
  const [recent, setRecent] = useState<string[]>([])
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (!open) return
    setText('')
    setItems([])
    setSuggestions([])
    setSearchedFor('')
    setActiveIndex(0)
    setRecent(readHistory().queries.slice(0, 6))
    const timer = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!query) { setItems([]); setSuggestions([]); setSearchedFor(''); setFailed(false); return }
    const controller = new AbortController()
    fetch(`/api/search?q=${encodeURIComponent(query)}&lang=${locale}`, { signal: controller.signal })
      .then(res => res.ok ? res.json() : Promise.reject(new Error(String(res.status))))
      .then((data: { items: SearchItem[]; suggestions: SearchItem[] }) => {
        setItems(data.items)
        setSuggestions(data.suggestions)
        setFailed(false)
        setSearchedFor(query)
        setActiveIndex(0)
      })
      .catch(err => {
        if (controller.signal.aborted) return
        console.error('search failed', err)
        setItems([])
        setSuggestions([])
        setFailed(true)
        setSearchedFor(query)
      })
    return () => controller.abort()
  }, [query, locale])

  const typing = committed.trim()
  const loading = !!typing && searchedFor !== typing
  const shown = items.length > 0 ? items : suggestions
  // 결과는 종류별로 묶어 보여 주고, 키보드 순서도 같은 순서를 따른다
  const grouped = TYPE_ORDER.map(type => ({ type, items: shown.filter(i => i.type === type) })).filter(g => g.items.length > 0)
  const rows: Row[] = typing
    ? grouped.flatMap(g => g.items.map(item => ({ kind: 'result' as const, item })))
    : recent.map(q => ({ kind: 'recent' as const, query: q }))

  const choose = (row: Row) => {
    if (row.kind === 'recent') {
      setText(row.query)
      inputRef.current?.focus()
      return
    }
    remember(typing)
    onClose()
    router.push(row.item.href)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (rows.length === 0) return
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActiveIndex(i => (i + step + rows.length) % rows.length)
    } else if (e.key === 'Enter' && rows[activeIndex] && !loading) {
      e.preventDefault()
      choose(rows[activeIndex])
    }
  }

  useEffect(() => {
    listRef.current?.querySelector(`[data-row="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const typeLabel = (type: SearchItemType) => t(`types.${type}`)
  const rowId = (i: number) => `global-search-row-${i}`

  const rowClass = (active: boolean) =>
    `relative flex w-full cursor-pointer items-center gap-3 rounded-md px-3 text-left transition-colors duration-100 ${active ? 'bg-[rgba(200,144,10,0.1)]' : ''}`

  let index = -1

  return (
    <BaseModal open={open} onClose={onClose} title={t('ariaLabel')} maxWidth="40rem" zIndex={100} padding="0.75rem">
      <div className="popup-search flex h-[min(34rem,calc(100dvh-1.5rem))] flex-col overflow-hidden rounded-lg">
        <div className="p-3 pb-2">
          <div className="flex h-12 items-center gap-2.5 rounded-md border border-[var(--border)] bg-[var(--bg-deep)] pl-3.5 pr-1.5 transition-colors focus-within:border-[var(--gold)]">
            <Search size={18} aria-hidden="true" className="shrink-0 text-[var(--gold)]" />
            <input
              ref={inputRef}
              value={rawQuery}
              onChange={e => {
                const value = e.target.value
                setRawQuery(value)
                setCommitted(prev => committedQuery(prev, value, (e.nativeEvent as InputEvent).isComposing))
                setActiveIndex(0)
              }}
              onCompositionEnd={e => setCommitted(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('placeholder')}
              role="combobox"
              aria-expanded={rows.length > 0}
              aria-controls="global-search-list"
              aria-activedescendant={rows[activeIndex] ? rowId(activeIndex) : undefined}
              aria-autocomplete="list"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
              className="h-full min-w-0 flex-1 bg-transparent text-[1rem] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              style={{ outline: 'none', boxShadow: 'none', minHeight: 0 }}
            />
            {rawQuery && (
              <button
                type="button"
                aria-label={t('clear')}
                onClick={() => { setText(''); inputRef.current?.focus() }}
                className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              >
                <X size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="h-9 shrink-0 cursor-pointer rounded-md px-2.5 text-[0.875rem] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] sm:hidden"
            >
              {t('keyboard.close')}
            </button>
            <kbd className="mr-1.5 hidden shrink-0 rounded border border-[var(--border)] px-1.5 py-px font-sans text-[0.75rem] text-[var(--text-muted)] sm:block">Esc</kbd>
          </div>
        </div>

        <div ref={listRef} id="global-search-list" role="listbox" aria-label={t('ariaLabel')} className="min-h-[14rem] flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
          {!typing && recent.length > 0 && (
            <section>
              <h3 className="px-3 pt-2 pb-1 text-[0.8125rem] text-[var(--text-muted)]" style={{ fontFamily: 'var(--font-body)', fontWeight: 400 }}>{t('recentTitle')}</h3>
              {rows.map((row, i) => row.kind === 'recent' && (
                <div
                  key={row.query}
                  id={rowId(i)}
                  data-row={i}
                  role="option"
                  aria-selected={i === activeIndex}
                  className={`${rowClass(i === activeIndex)} min-h-11`}
                  onClick={() => choose(row)}
                  onMouseMove={() => setActiveIndex(i)}
                >
                  <History size={16} aria-hidden="true" className="shrink-0 text-[var(--text-muted)]" />
                  <span className="truncate text-[0.9375rem] text-[var(--text-secondary)]">{row.query}</span>
                </div>
              ))}
            </section>
          )}

          {!typing && recent.length === 0 && (
            <p className="px-4 py-10 text-center text-[0.9375rem] text-[var(--text-secondary)]">{t('emptyPromptTitle')}</p>
          )}

          {typing && loading && shown.length === 0 && (
            <SkeletonPage className="px-1 pt-3">
              {[0, 1, 2, 3, 4].map(n => (
                <div key={n} className="flex min-h-14 items-center gap-3 px-3 py-1.5">
                  <Skeleton className="h-10 w-10 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-3.5" style={{ width: `${55 + (n % 3) * 12}%` }} />
                    <Skeleton className="mt-1.5 h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </SkeletonPage>
          )}

          {typing && !loading && failed && (
            <p className="px-4 py-10 text-center text-[0.9375rem] text-[var(--text-secondary)]" aria-live="polite">{t('error')}</p>
          )}

          {typing && !loading && !failed && shown.length === 0 && (
            <p className="px-4 py-10 text-center text-[0.9375rem] text-[var(--text-secondary)]" aria-live="polite">{t('noResultsFor', { query: typing })}</p>
          )}

          {typing && items.length === 0 && suggestions.length > 0 && !loading && (
            <p className="px-3 pt-2 text-[0.875rem] text-[var(--text-secondary)]">{t('suggestionsTitle')}</p>
          )}

          {typing && grouped.map(group => (
            <section key={group.type} className={`transition-opacity duration-150 ${loading ? 'opacity-60' : ''}`}>
              <h3 className="px-3 pt-3 pb-1 text-[0.8125rem] text-[var(--text-muted)]" style={{ fontFamily: 'var(--font-body)', fontWeight: 400 }}>{typeLabel(group.type)}</h3>
              {group.items.map(item => {
                index += 1
                const i = index
                const active = i === activeIndex
                const Icon = TYPE_ICON[item.type]
                return (
                  <div
                    key={item.href + item.label}
                    id={rowId(i)}
                    data-row={i}
                    role="option"
                    aria-selected={active}
                    className={`${rowClass(active)} min-h-14 py-1.5`}
                    onClick={() => choose({ kind: 'result', item })}
                    onMouseMove={() => setActiveIndex(i)}
                  >
                    {active && <span aria-hidden="true" className="absolute left-0 top-2.5 bottom-2.5 w-0.5 rounded-full bg-[var(--gold)]" />}
                    <span className={`grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg-deep)] ${item.type === 'keyword' ? 'p-1.5' : ''}`}>
                      {item.type === 'keyword' && item.icon ? (
                        <KeywordIcon src={item.icon} alt="" width={28} height={28} unoptimized style={{ objectFit: 'contain', width: '100%', height: '100%' }} />
                      ) : item.icon ? (
                        <Image src={item.icon} alt="" width={40} height={40} style={{ objectFit: item.type === 'egoGift' ? 'contain' : 'cover', width: '100%', height: '100%' }} />
                      ) : (
                        <Icon size={16} aria-hidden="true" className="text-[var(--gold-dim)]" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={`truncate text-[0.9375rem] ${active ? 'text-[var(--gold-light)]' : 'text-[var(--text-primary)]'}`}><Highlight text={item.label} query={typing} /></span>
                        {item.rarity && RARITY_ICONS[item.rarity] && (
                          <Image src={RARITY_ICONS[item.rarity]} alt={`${item.rarity}`} width={20} height={20} unoptimized style={{ height: '0.875rem', width: 'auto' }} />
                        )}
                        {item.type === 'ego' && item.grade && EGO_GRADES.has(item.grade) && (
                          <Image src={getEgoGradeBannerUrl(item.grade)} alt={item.grade} width={36} height={16} unoptimized style={{ height: '0.875rem', width: 'auto' }} />
                        )}
                      </span>
                      {item.sublabel && <span className="mt-0.5 block truncate text-[0.8125rem] text-[var(--text-tertiary)]">{item.sublabel}</span>}
                    </span>
                    {active && <CornerDownLeft size={15} aria-hidden="true" className="hidden shrink-0 text-[var(--text-muted)] sm:block" />}
                  </div>
                )
              })}
            </section>
          ))}
        </div>

        <div className="hidden items-center gap-4 border-t border-[var(--border)] px-4 py-2.5 text-[0.8125rem] text-[var(--text-muted)] sm:flex">
          <span className="flex items-center gap-1.5"><kbd className="rounded border border-[var(--border)] px-1 font-sans">↑</kbd><kbd className="rounded border border-[var(--border)] px-1 font-sans">↓</kbd>{t('keyboard.move')}</span>
          <span className="flex items-center gap-1.5"><kbd className="rounded border border-[var(--border)] px-1 font-sans">Enter</kbd>{t('keyboard.select')}</span>
          <span className="flex items-center gap-1.5"><kbd className="rounded border border-[var(--border)] px-1 font-sans">Esc</kbd>{t('keyboard.close')}</span>
        </div>
      </div>
    </BaseModal>
  )
}
