'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Search, X, User, Swords, Brain, Tags } from 'lucide-react'
import { STORAGE_BASE } from '@/lib/constants/game'

interface SearchResult {
  identities: { id: string; name_kr: string; rarity: number; game_id: string; folder_name: string; sinner_id: number; sinners: { id: string; name_kr: string } }[]
  ego: { id: string; name_kr: string; grade: string; folder_name: string; sinner_id: number; sinners: { id: string; name_kr: string } }[]
  sinners: { id: string; name_kr: string; name_en: string; sinner_id: number }[]
  keywords: { name: string; description: string | null; icon_slug: string | null }[]
}

type FlatItem = {
  type: 'sinner' | 'identity' | 'ego' | 'keyword'
  label: string
  sublabel: string
  href: string
  icon?: string
}

function flatten(data: SearchResult): FlatItem[] {
  const items: FlatItem[] = []

  for (const s of data.sinners) {
    items.push({
      type: 'sinner',
      label: s.name_kr,
      sublabel: s.name_en,
      href: `/sinners/${s.id}`,
      icon: `${STORAGE_BASE}/icons/Sinners/${s.sinner_id}.webp`,
    })
  }

  for (const i of data.identities) {
    const sinner = Array.isArray(i.sinners) ? i.sinners[0] : i.sinners
    items.push({
      type: 'identity',
      label: i.name_kr,
      sublabel: `${sinner?.name_kr ?? ''} · ${'★'.repeat(i.rarity)}`,
      href: `/sinners/${sinner?.id}/identities/${i.id}`,
      icon: `${STORAGE_BASE}/sinners/${i.sinner_id}/identities/${i.folder_name}/${i.game_id}_normal.webp`,
    })
  }

  for (const e of data.ego) {
    const sinner = Array.isArray(e.sinners) ? e.sinners[0] : e.sinners
    items.push({
      type: 'ego',
      label: e.name_kr,
      sublabel: `${sinner?.name_kr ?? ''} · ${e.grade}`,
      href: `/sinners/${sinner?.id}/ego/${e.id}`,
      icon: `${STORAGE_BASE}/sinners/${e.sinner_id}/ego/${e.folder_name}/profile.webp`,
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

  return items
}

const TYPE_ICON = {
  sinner: User,
  identity: Swords,
  ego: Brain,
  keyword: Tags,
} as const

const TYPE_LABEL = {
  sinner: '수감자',
  identity: '인격',
  ego: 'E.G.O',
  keyword: '키워드',
} as const

const TYPE_COLOR = {
  sinner: '#c8a450',
  identity: '#4ade80',
  ego: '#a78bfa',
  keyword: '#60a5fa',
} as const

interface Props {
  open: boolean
  onClose: () => void
}

export default function SearchModal({ open, onClose }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FlatItem[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setActiveIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Debounced search
  const search = useCallback(async (q: string) => {
    if (q.length < 1) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data: SearchResult = await res.json()
        setResults(flatten(data))
        setActiveIndex(0)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!query.trim()) {
      setResults([])
      return
    }
    timerRef.current = setTimeout(() => search(query.trim()), 250)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query, search])

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault()
      navigate(results[activeIndex].href)
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

  if (!open) return null

  return (
    <div
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
          <Search size={16} style={{ color: '#666', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="인격, EGO, 수감자, 키워드 검색..."
            className="flex-1 py-3.5 text-sm outline-none"
            style={{
              background: 'transparent',
              color: '#e8dcc8',
              fontFamily: 'var(--font-body)',
            }}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); inputRef.current?.focus() }}
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
              fontSize: '0.625rem',
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

          {!loading && query.trim() && results.length === 0 && (
            <div className="py-8 text-center" style={{ color: '#555', fontSize: '0.8125rem' }}>
              검색 결과가 없습니다
            </div>
          )}

          {results.map((item, idx) => {
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
                    <span style={{
                      color,
                      fontSize: '0.5625rem',
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: '0.05em',
                      opacity: 0.7,
                    }}>
                      {TYPE_LABEL[item.type]}
                    </span>
                  </div>
                  {item.sublabel && (
                    <p style={{
                      color: '#666',
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
                      fontSize: '0.5625rem',
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
        {results.length > 0 && (
          <div
            className="flex items-center justify-between px-4 py-2"
            style={{ borderTop: '1px solid var(--border)', color: '#444', fontSize: '0.625rem' }}
          >
            <span>{results.length}개 결과</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>↑↓ 이동 · Enter 선택</span>
          </div>
        )}
      </div>
    </div>
  )
}
