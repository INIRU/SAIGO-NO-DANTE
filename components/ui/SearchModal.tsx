'use client'

import { useState, useEffect, useRef, useCallback, type KeyboardEvent } from 'react'
import { useRouter } from '@/lib/i18n/navigation'
import Image from 'next/image'
import { Search, X, User, Swords, Brain, Tags, Gift } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { STORAGE_BASE } from '@/lib/constants/game'
import { useDebounce } from '@/hooks/useDebounce'
import { resolveKeywordIconUrl } from '@/components/providers/KeywordProvider'
import { useTranslations } from 'next-intl'

// Korean consonant (초성) list for fuzzy search
const CHOSUNG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ']

function getChosung(str: string): string {
  return [...str].map(ch => {
    const code = ch.charCodeAt(0) - 0xAC00
    if (code < 0 || code > 11171) return ch
    return CHOSUNG[Math.floor(code / 588)]
  }).join('')
}

function fuzzyMatch(text: string, query: string): boolean {
  // Exact substring match (case-sensitive)
  if (text.includes(query)) return true
  // Case-insensitive match
  if (text.toLowerCase().includes(query.toLowerCase())) return true
  // 초성 search: all chars in query are Korean consonants → match against extracted 초성
  if (/^[ㄱ-ㅎ]+$/.test(query) && getChosung(text).includes(query)) return true
  return false
}

const RARITY_ICONS: Record<number, string> = {
  1: `${STORAGE_BASE}/icons/Rarity/1star.webp`,
  2: `${STORAGE_BASE}/icons/Rarity/2star.webp`,
  3: `${STORAGE_BASE}/icons/Rarity/3star.webp`,
}

const GRADE_COLORS: Record<string, string> = {
  ZAYIN: '#667788', TETH: '#4898b0', HE: '#88a830', WAW: '#c8900a', ALEPH: '#c83040',
}

const GRADE_ICONS: Record<string, string> = {
  ZAYIN: `${STORAGE_BASE}/icons/grade/ZAYIN.webp`,
  TETH: `${STORAGE_BASE}/icons/grade/TETH.webp`,
  HE: `${STORAGE_BASE}/icons/grade/HE.webp`,
  WAW: `${STORAGE_BASE}/icons/grade/WAW.webp`,
}

type IdentityResult = { id: string; name_kr: string; rarity: number; game_id: string; folder_name: string; sinner_id: string; sinners: { id: string; name_kr: string } }

interface SearchResult {
  identities: IdentityResult[]
  ego: { id: string; name_kr: string; grade: string; image_url: string | null; sinners: { id: string; name_kr: string } }[]
  sinners: { id: string; name: string; name_kr: string; order_num: number }[]
  keywords: { name: string; description: string | null; icon_slug: string | null }[]
  egoGifts: { name: string; keyword: string | null; grade: string | null; image_url: string | null }[]
  suggestions?: IdentityResult[]
}

type FlatItem = {
  type: 'sinner' | 'identity' | 'ego' | 'keyword' | 'egoGift'
  label: string
  sublabel: string
  href: string
  icon?: string
  rarity?: number
  grade?: string
}

function flatten(data: SearchResult, labels: { egoGift: string }): FlatItem[] {
  const items: FlatItem[] = []

  for (const s of data.sinners) {
    items.push({
      type: 'sinner',
      label: s.name_kr,
      sublabel: s.name,
      href: `/sinners/${s.id}`,
      icon: `${STORAGE_BASE}/icons/Sinners/${s.id}.webp`,
    })
  }

  for (const i of data.identities) {
    const sinner = Array.isArray(i.sinners) ? i.sinners[0] : i.sinners
    items.push({
      type: 'identity',
      label: i.name_kr,
      sublabel: sinner?.name_kr ?? '',
      href: `/sinners/${sinner?.id}/identities/${i.id}`,
      icon: `${STORAGE_BASE}/sinners/${i.sinner_id}/identities/${i.folder_name}/${i.game_id}_normal.webp`,
      rarity: i.rarity,
    })
  }

  for (const e of data.ego) {
    const sinner = Array.isArray(e.sinners) ? e.sinners[0] : e.sinners
    items.push({
      type: 'ego',
      label: e.name_kr,
      sublabel: sinner?.name_kr ?? '',
      href: `/sinners/${sinner?.id}/ego/${e.id}`,
      icon: e.image_url ?? undefined,
      grade: e.grade,
    })
  }

  for (const k of data.keywords) {
    items.push({
      type: 'keyword',
      label: k.name,
      sublabel: k.description?.slice(0, 50) ?? '',
      href: `/mirror-dungeon?keyword=${encodeURIComponent(k.name)}`,
      icon: resolveKeywordIconUrl(k.name, k.icon_slug) ?? undefined,
    })
  }

  for (const g of (data.egoGifts ?? [])) {
    items.push({
      type: 'egoGift',
      label: g.name,
      sublabel: g.keyword ? `${labels.egoGift} - ${g.keyword}` : labels.egoGift,
      href: `/mirror-dungeon?q=${encodeURIComponent(g.name)}`,
      icon: g.image_url ?? undefined,
    })
  }

  return items
}

const TYPE_ICON = {
  sinner: User,
  identity: Swords,
  ego: Brain,
  keyword: Tags,
  egoGift: Gift,
} as const

const TYPE_COLOR = {
  sinner: '#c8a450',
  identity: '#7fa36a',
  ego: '#b86a3a',
  keyword: '#5f9aa8',
  egoGift: '#c8900a',
} as const

interface Props {
  open: boolean
  onClose: () => void
}

export default function SearchModal({ open, onClose }: Props) {
  const router = useRouter()
  const t = useTranslations('globalSearch')
  const reduceMotion = useReducedMotion()
  const inputRef = useRef<HTMLInputElement>(null)
  const [rawQuery, setRawQuery] = useState('')
  const query = useDebounce(rawQuery, 300)
  const [results, setResults] = useState<FlatItem[]>([])
  const [suggestions, setSuggestions] = useState<FlatItem[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setRawQuery('')
      setResults([])
      setSuggestions([])
      setActiveIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Search fires on debounced query change
  const search = useCallback(async (q: string) => {
    if (q.length < 1) {
      setResults([])
      setSuggestions([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data: SearchResult & { suggestions?: IdentityResult[] } = await res.json()
        const flat = flatten(data, { egoGift: t('types.egoGift') })
        // Client-side fuzzy filter on top of server results
        const filtered = flat.filter(item =>
          fuzzyMatch(item.label, q) || fuzzyMatch(item.sublabel, q)
        )
        setResults(filtered)
        setActiveIndex(0)
        // 결과 없으면 suggestions를 FlatItem으로 변환
        if (filtered.length === 0 && data.suggestions?.length) {
          const sugItems: FlatItem[] = data.suggestions.map(i => {
            const sinner = Array.isArray(i.sinners) ? i.sinners[0] : i.sinners
            return {
              type: 'identity' as const,
              label: i.name_kr,
              sublabel: sinner?.name_kr ?? '',
              href: `/sinners/${sinner?.id}/identities/${i.id}`,
              icon: `${STORAGE_BASE}/sinners/${i.sinner_id}/identities/${i.folder_name}/${i.game_id}_normal.webp`,
              rarity: i.rarity,
            }
          })
          setSuggestions(sugItems)
        } else {
          setSuggestions([])
        }
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [t])

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      setSuggestions([])
      return
    }
    search(trimmed)
  }, [query, search])

  const displayItems = results.length > 0 ? results : suggestions
  const typeLabel: Record<FlatItem['type'], string> = {
    sinner: t('types.sinner'),
    identity: t('types.identity'),
    ego: t('types.ego'),
    keyword: t('types.keyword'),
    egoGift: t('types.egoGift'),
  }

  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => displayItems.length > 0 ? Math.min(i + 1, displayItems.length - 1) : 0)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && displayItems[activeIndex]) {
      e.preventDefault()
      navigate(displayItems[activeIndex].href)
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  // Scroll active item into view
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const active = list.querySelector<HTMLElement>(`[data-search-index="${activeIndex}"]`)
    active?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const navigate = (href: string) => {
    onClose()
    router.push(href)
  }

  // body scroll lock
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={t('ariaLabel')}
      className="fixed inset-0 z-[100] flex items-start justify-center px-3 pt-[4.75rem] sm:pt-[12vh]"
      style={{ background: 'rgba(5,4,3,0.76)', backdropFilter: 'blur(4px)' }}
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0 }}
      transition={{ duration: reduceMotion ? 0.08 : 0.16, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClose}
    >
      <motion.div
        className="flex max-h-[calc(100dvh-6rem)] w-full max-w-2xl origin-top flex-col overflow-hidden rounded-lg"
        style={{
          background: '#1a1510',
          border: '1px solid rgba(200,144,10,0.24)',
          boxShadow: '0 1.25rem 3rem rgba(0,0,0,0.52)',
        }}
        initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -10, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.99 }}
        transition={{ duration: reduceMotion ? 0.08 : 0.18, ease: [0.22, 1, 0.36, 1] }}
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex min-h-[3.5rem] items-center gap-3 px-3 sm:px-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <Search size={18} style={{ color: 'var(--gold)', flexShrink: 0, opacity: 0.76 }} />
          <input
            ref={inputRef}
            value={rawQuery}
            onChange={e => setRawQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('placeholder')}
            className="min-w-0 flex-1 py-3.5 text-[1rem] outline-none placeholder:text-[var(--text-muted)]"
            style={{
              background: 'transparent',
              color: '#e8dcc8',
              fontFamily: 'var(--font-body)',
            }}
          />
          {rawQuery && (
            <button
              type="button"
              aria-label={t('clear')}
              onClick={() => { setRawQuery(''); setResults([]); setSuggestions([]); inputRef.current?.focus() }}
              className="grid min-h-[2.75rem] min-w-[2.75rem] place-items-center rounded-md transition-colors hover:bg-[rgba(200,144,10,0.08)]"
              style={{ color: 'var(--text-tertiary)', cursor: 'pointer' }}
            >
              <X size={14} />
            </button>
          )}
          <kbd
            className="hidden sm:inline-block"
            style={{
              padding: '0.125rem 0.375rem',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '0.25rem',
              color: '#555',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-mono)',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="min-h-[12rem] flex-1"
          style={{ overflowY: 'auto' }}
        >
          {loading && results.length === 0 && (
            <div className="space-y-2 p-4" aria-live="polite" aria-label={t('loading')}>
              {[0, 1, 2].map(index => (
                <div key={index} className="flex items-center gap-3 border border-[rgba(200,144,10,0.08)] bg-[rgba(13,11,8,0.26)] p-3">
                  <div className="h-11 w-11 animate-pulse rounded-md bg-[rgba(200,144,10,0.08)]" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3 w-2/3 animate-pulse rounded-sm bg-[rgba(232,176,48,0.12)]" />
                    <div className="h-3 w-1/2 animate-pulse rounded-sm bg-[rgba(255,255,255,0.06)]" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && !rawQuery.trim() && (
            <div className="px-5 py-8 text-center">
              <div className="mx-auto grid h-11 w-11 place-items-center border border-[rgba(200,144,10,0.2)] bg-[rgba(200,144,10,0.06)] text-[var(--gold)]">
                <Search size={18} aria-hidden="true" />
              </div>
              <p className="mt-4 text-[1rem] text-[var(--text-secondary)]">{t('emptyPromptTitle')}</p>
              <p className="mx-auto mt-2 max-w-[28rem] text-[0.875rem] leading-relaxed text-[var(--text-tertiary)]">
                {t('emptyPromptDescription')}
              </p>
            </div>
          )}

          {!loading && rawQuery.trim() && results.length === 0 && suggestions.length === 0 && (
            <div className="px-5 py-8 text-center" aria-live="polite">
              <p className="text-[1rem] text-[var(--text-secondary)]">{t('noResultsTitle')}</p>
              <p className="mx-auto mt-2 max-w-[28rem] text-[0.875rem] leading-relaxed text-[var(--text-tertiary)]">
                {t('noResultsDescription')}
              </p>
            </div>
          )}

          {!loading && results.length === 0 && suggestions.length > 0 && (
            <div>
              <div className="border-b border-[rgba(200,144,10,0.12)] px-4 pb-2 pt-3 font-mono text-[0.75rem] uppercase tracking-[0.08em] text-[var(--gold-dim)]">
                {t('suggestionsTitle')}
              </div>
            </div>
          )}

          {displayItems.map((item, idx) => {
            const Icon = TYPE_ICON[item.type]
            const color = TYPE_COLOR[item.type]
            const isActive = idx === activeIndex

            return (
              <motion.button
                key={`${item.type}-${item.label}-${idx}`}
                data-search-index={idx}
                className="flex min-h-[4.75rem] w-full items-center gap-3 px-3 py-3 text-left transition-colors sm:px-4"
                style={{
                  background: isActive ? 'rgba(200,144,10,0.08)' : 'transparent',
                  borderLeft: isActive ? '2px solid var(--gold)' : '2px solid transparent',
                  borderBottom: '1px solid rgba(200,144,10,0.08)',
                  cursor: 'pointer',
                }}
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                transition={{ duration: 0.16, delay: Math.min(idx, 8) * 0.018, ease: [0.22, 1, 0.36, 1] }}
                onClick={() => navigate(item.href)}
                onMouseEnter={() => setActiveIndex(idx)}
              >
                {/* Icon / Portrait */}
                <div
                  className="flex items-center justify-center overflow-hidden"
                  style={{
                    width: '2.75rem',
                    height: '2.75rem',
                    borderRadius: item.type === 'keyword' ? '0.375rem' : '0.5rem',
                    background: item.icon ? '#0d0b08' : `${color}12`,
                    border: `1px solid ${item.icon ? 'rgba(255,255,255,0.08)' : `${color}25`}`,
                    flexShrink: 0,
                  }}
                >
                  {item.icon ? (
                    <Image src={item.icon} alt="" width={44} height={44} unoptimized style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                  ) : (
                    <Icon size={16} style={{ color }} />
                  )}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="min-w-0 truncate" style={{ color: '#e8dcc8', fontSize: '1rem', fontWeight: 500 }}>
                      {item.label}
                    </span>
                    {item.rarity && RARITY_ICONS[item.rarity] && (
                      <Image src={RARITY_ICONS[item.rarity]} alt={`${item.rarity}성`} width={20} height={20} unoptimized style={{ height: '16px', width: 'auto' }} />
                    )}
                    {item.grade && (
                      GRADE_ICONS[item.grade]
                        ? <Image src={GRADE_ICONS[item.grade]} alt={item.grade} width={36} height={16} unoptimized style={{ height: '16px', width: 'auto' }} />
                        : <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: GRADE_COLORS[item.grade] ?? '#888',
                            padding: '0 4px',
                            border: `1px solid ${(GRADE_COLORS[item.grade] ?? '#888')}40`,
                            borderRadius: 3,
                            lineHeight: '1.5',
                          }}>
                            {item.grade}
                          </span>
                    )}
                    <span style={{
                      color,
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: '0.05em',
                      opacity: 0.7,
                      border: `1px solid ${color}33`,
                      background: `${color}12`,
                      padding: '0.0625rem 0.375rem',
                      borderRadius: '0.25rem',
                    }}>
                      {typeLabel[item.type]}
                    </span>
                  </div>
                  {item.sublabel && (
                    <p style={{
                      color: 'var(--text-tertiary)',
                      fontSize: '0.875rem',
                      lineHeight: 1.45,
                      marginTop: '0.25rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {item.sublabel}
                    </p>
                  )}
                </div>

                {/* Enter hint for active */}
                {isActive && (
                  <kbd
                    className="hidden sm:inline-block"
                    style={{
                      padding: '1px 5px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 3,
                      color: 'var(--text-muted)',
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-mono)',
                      flexShrink: 0,
                    }}
                  >
                    Enter
                  </kbd>
                )}
              </motion.button>
            )
          })}
        </div>

        {/* Footer */}
        <div
          className="flex flex-col gap-2 border-t border-[var(--border)] px-3 py-2 text-[0.875rem] text-[var(--text-tertiary)] sm:flex-row sm:items-center sm:justify-between sm:px-4"
        >
          <span>
            {displayItems.length > 0
              ? t(results.length > 0 ? 'resultCount' : 'suggestionCount', { count: displayItems.length })
              : t('footerHint')}
          </span>
          <span className="flex flex-wrap items-center gap-1.5">
            <kbd className="rounded border border-white/10 bg-white/[0.04] px-1.5 font-mono text-[0.75rem] text-[var(--text-muted)]">↑↓</kbd>
            <span>{t('keyboard.move')}</span>
            <span className="font-sans text-[var(--text-muted)]">/</span>
            <kbd className="rounded border border-white/10 bg-white/[0.04] px-1.5 font-mono text-[0.75rem] text-[var(--text-muted)]">Enter</kbd>
            <span>{t('keyboard.select')}</span>
            <span className="font-sans text-[var(--text-muted)]">/</span>
            <kbd className="rounded border border-white/10 bg-white/[0.04] px-1.5 font-mono text-[0.75rem] text-[var(--text-muted)]">Esc</kbd>
            <span>{t('keyboard.close')}</span>
          </span>
        </div>
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>
  )
}
