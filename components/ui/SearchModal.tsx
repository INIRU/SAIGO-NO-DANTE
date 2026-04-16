'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from '@/lib/i18n/navigation'
import Image from 'next/image'
import { Search, X, User, Swords, Brain, Tags, Gift } from 'lucide-react'
import { STORAGE_BASE } from '@/lib/constants/game'
import { useDebounce } from '@/hooks/useDebounce'

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
  type: 'sinner' | 'identity' | 'ego' | 'keyword'
  label: string
  sublabel: string
  href: string
  icon?: string
  rarity?: number
  grade?: string
}

function flatten(data: SearchResult): FlatItem[] {
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
      icon: k.icon_slug ? `${STORAGE_BASE}/icons/keywords/${k.icon_slug}.webp` : undefined,
    })
  }

  for (const g of (data.egoGifts ?? [])) {
    items.push({
      type: 'keyword',
      label: g.name,
      sublabel: g.keyword ? `EGO 기프트 - ${g.keyword}` : 'EGO 기프트',
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

const TYPE_LABEL = {
  sinner: '수감자',
  identity: '인격',
  ego: 'E.G.O',
  keyword: '키워드',
  egoGift: '기프트',
} as const

const TYPE_COLOR = {
  sinner: '#c8a450',
  identity: '#4ade80',
  ego: '#a78bfa',
  keyword: '#60a5fa',
  egoGift: '#f59e0b',
} as const

interface Props {
  open: boolean
  onClose: () => void
}

export default function SearchModal({ open, onClose }: Props) {
  const router = useRouter()
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
        const flat = flatten(data)
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
  }, [])

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

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, displayItems.length - 1))
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
    const active = list.children[activeIndex] as HTMLElement | undefined
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

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="전역 검색"
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg mx-4 rounded-lg overflow-hidden"
        style={{
          background: '#1a1510',
          border: '1px solid rgba(200,144,10,0.2)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 1px rgba(200,144,10,0.3)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <Search size={16} style={{ color: '#999', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={rawQuery}
            onChange={e => setRawQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="인격, EGO, 수감자, 키워드, 기프트 검색..."
            className="flex-1 py-3.5 text-sm outline-none"
            style={{
              background: 'transparent',
              color: '#e8dcc8',
              fontFamily: 'var(--font-body)',
            }}
          />
          {rawQuery && (
            <button
              onClick={() => { setRawQuery(''); inputRef.current?.focus() }}
              style={{ color: '#555', cursor: 'pointer', padding: 4 }}
            >
              <X size={14} />
            </button>
          )}
          <kbd
            className="hidden sm:inline-block"
            style={{
              padding: '2px 6px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 4,
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
          style={{ maxHeight: '50vh', overflowY: 'auto' }}
        >
          {loading && results.length === 0 && (
            <div className="flex items-center justify-center py-8" style={{ color: '#555' }}>
              <div className="animate-spin w-4 h-4 border-2 rounded-full" style={{ borderColor: '#555 transparent transparent transparent' }} />
            </div>
          )}

          {!loading && rawQuery.trim() && results.length === 0 && suggestions.length === 0 && (
            <div className="py-8 text-center" style={{ color: '#555', fontSize: '0.8125rem' }}>
              검색 결과가 없습니다
            </div>
          )}

          {!loading && results.length === 0 && suggestions.length > 0 && (
            <div>
              <div className="px-4 pt-3 pb-1" style={{ color: '#5a4838', fontSize: '0.6875rem', fontFamily: 'var(--font-heading)' }}>
                이런 결과를 찾으셨나요?
              </div>
            </div>
          )}

          {displayItems.map((item, idx) => {
            const Icon = TYPE_ICON[item.type]
            const color = TYPE_COLOR[item.type]
            const isActive = idx === activeIndex

            return (
              <button
                key={`${item.type}-${item.label}-${idx}`}
                className="flex items-center gap-3 w-full text-left px-4 py-2.5 transition-colors"
                style={{
                  background: isActive ? 'rgba(200,144,10,0.08)' : 'transparent',
                  borderLeft: isActive ? '2px solid var(--gold)' : '2px solid transparent',
                  cursor: 'pointer',
                }}
                onClick={() => navigate(item.href)}
                onMouseEnter={() => setActiveIndex(idx)}
              >
                {/* Icon / Portrait */}
                <div
                  className="flex items-center justify-center overflow-hidden"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: item.type === 'keyword' ? 6 : 8,
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
                  <div className="flex items-center gap-2">
                    <span style={{ color: '#e8dcc8', fontSize: '0.8125rem', fontWeight: 500 }}>
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
                    }}>
                      {TYPE_LABEL[item.type]}
                    </span>
                  </div>
                  {item.sublabel && (
                    <p style={{
                      color: '#999',
                      fontSize: '0.6875rem',
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
                      color: '#555',
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-mono)',
                      flexShrink: 0,
                    }}
                  >
                    Enter
                  </kbd>
                )}
              </button>
            )
          })}
        </div>

        {/* Footer */}
        {displayItems.length > 0 && (
          <div
            className="flex items-center justify-between px-4 py-2"
            style={{ borderTop: '1px solid var(--border)', color: '#999', fontSize: '0.75rem' }}
          >
            <span>{results.length > 0 ? `${results.length}개 결과` : `${suggestions.length}개 추천`}</span>
            <span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>↑↓</span>
              {' '}이동{' '}
              <span style={{ fontFamily: 'sans-serif' }}>·</span>
              {' '}
              <span style={{ fontFamily: 'var(--font-mono)' }}>Enter</span>
              {' '}선택
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
