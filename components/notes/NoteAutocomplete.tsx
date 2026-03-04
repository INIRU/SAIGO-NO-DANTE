'use client'

import { useState, useMemo, useCallback, type RefObject } from 'react'
import Image from 'next/image'
import {
  KEYWORD_ICON_MAP,
  KEYWORD_SIN_MAP,
  SIN_COLORS,
  getKeywordIconUrl,
} from '@/lib/data/sinners'

// ── 타입 ─────────────────────────────────────────────────────────────────
export type AutocompleteSuggestion = {
  label: string
  type: 'keyword' | 'skill' | 'identity' | 'ego' | 'passive' | 'egogift'
  typeLabel?: string
  color: string
  iconUrl?: string
  imageUrl?: string
  token: string
}

// ── 키워드 풀 생성 헬퍼 ──────────────────────────────────────────────────
export function buildKeywordPool(): AutocompleteSuggestion[] {
  return Object.keys(KEYWORD_ICON_MAP).map(kw => {
    const sinType = KEYWORD_SIN_MAP[kw]
    const sc = sinType ? (SIN_COLORS[sinType] ?? '#c8900a') : '#c8900a'
    return {
      label: kw,
      type: 'keyword' as const,
      color: sc,
      iconUrl: getKeywordIconUrl(kw) ?? undefined,
      token: `[k:${kw}]`,
    }
  })
}

// ── EGO 기프트 풀 생성 헬퍼 ──────────────────────────────────────────────
const EGO_GIFT_KW_COLORS: Record<string, string> = {
  화상: '#e85830', 출혈: '#c83030', 진동: '#d0a020', 파열: '#8040c0',
  침잠: '#3060b0', 호흡: '#40a060', 충전: '#e0c020', 참격: '#cc4444',
  관통: '#dd8833', 타격: '#cc8822', 공통: '#888888',
}

export function buildEgoGiftPool(
  gifts: { name: string; keyword: string; image_url: string | null }[]
): AutocompleteSuggestion[] {
  return gifts.map(g => ({
    label: g.name,
    type: 'egogift' as const,
    typeLabel: '기프트',
    color: EGO_GIFT_KW_COLORS[g.keyword] ?? '#888',
    imageUrl: g.image_url ?? undefined,
    token: `[g:${g.name}]`,
  }))
}

// ── useNoteAutocomplete 훅 ──────────────────────────────────────────────
export function useNoteAutocomplete({
  text,
  setText,
  textareaRef,
  pool,
}: {
  text: string
  setText: (v: string) => void
  textareaRef: RefObject<HTMLTextAreaElement | null>
  pool: AutocompleteSuggestion[]
}) {
  const [cursorPos, setCursorPos] = useState(0)
  const [selectedIdx, setSelectedIdx] = useState(-1)
  const [isOpen, setIsOpen] = useState(true)

  const currentWord = useMemo(() => {
    if (!isOpen) return ''
    const before = text.slice(0, cursorPos)
    const match = before.match(/(\S+)$/)
    return match ? match[1] : ''
  }, [text, cursorPos, isOpen])

  const suggestions = useMemo((): AutocompleteSuggestion[] => {
    if (currentWord.length < 1) return []
    const starts = pool.filter(s => s.label.startsWith(currentWord))
    const contains = pool.filter(s => !s.label.startsWith(currentWord) && s.label.includes(currentWord))
    return [...starts, ...contains].slice(0, 10)
  }, [currentWord, pool])

  const select = useCallback((sugg: AutocompleteSuggestion) => {
    const ta = textareaRef.current
    if (!ta) return
    const before = text.slice(0, cursorPos)
    const match = before.match(/(\S+)$/)
    if (!match) return
    const wordStart = cursorPos - match[1].length
    const newText = text.slice(0, wordStart) + sugg.token + text.slice(cursorPos)
    setText(newText)
    const newPos = wordStart + sugg.token.length
    setCursorPos(newPos)
    setSelectedIdx(-1)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(newPos, newPos)
    })
  }, [text, setText, textareaRef, cursorPos])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(i => Math.max(i - 1, 0))
    } else if ((e.key === 'Enter' || e.key === 'Tab') && selectedIdx >= 0) {
      e.preventDefault()
      select(suggestions[selectedIdx])
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }, [suggestions, selectedIdx, select])

  const onTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCursorPos(e.target.selectionStart)
    setIsOpen(true)
    setSelectedIdx(-1)
  }, [])

  const onTextSelect = useCallback((e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    setCursorPos((e.target as HTMLTextAreaElement).selectionStart)
  }, [])

  /** 커서 위치에 토큰 삽입 (수동 버튼용) */
  const insertToken = useCallback((token: string) => {
    const ta = textareaRef.current
    if (!ta) { setText(text + token); return }
    const start = ta.selectionStart ?? text.length
    const end = ta.selectionEnd ?? text.length
    const newText = text.slice(0, start) + token + text.slice(end)
    setText(newText)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start + token.length, start + token.length)
    })
  }, [text, setText, textareaRef])

  return {
    suggestions,
    selectedIdx,
    setSelectedIdx,
    select,
    handleKeyDown,
    onTextChange,
    onTextSelect,
    insertToken,
    closeDropdown: () => setIsOpen(false),
  }
}

// ── 자동완성 드롭다운 UI ─────────────────────────────────────────────────
export function NoteAutocompleteDropdown({
  suggestions,
  selectedIdx,
  onSelect,
  onHover,
}: {
  suggestions: AutocompleteSuggestion[]
  selectedIdx: number
  onSelect: (sugg: AutocompleteSuggestion) => void
  onHover: (idx: number) => void
}) {
  if (suggestions.length === 0) return null
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: '100%', marginBottom: -1,
      background: '#151210', border: '1px solid rgba(200,144,10,0.2)',
      borderRadius: '4px 4px 0 0', padding: '6px 4px',
      boxShadow: '0 -4px 12px rgba(0,0,0,0.4)', zIndex: 10,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '0 6px 4px', borderBottom: '1px solid rgba(200,144,10,0.08)', marginBottom: 4,
      }}>
        <span style={{ color: '#555570', fontSize: '0.5rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>자동완성</span>
        <span style={{ color: '#252530', fontSize: '0.5rem' }}>↑↓ 이동 · Enter/Tab 선택 · Esc 닫기</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {suggestions.map((sugg, i) => {
          const isSelected = i === selectedIdx
          return (
            <button
              key={sugg.token}
              onMouseDown={e => { e.preventDefault(); onSelect(sugg) }}
              onMouseEnter={() => onHover(i)}
              className="flex items-center gap-2 px-2 py-1 rounded text-left"
              style={{
                background: isSelected ? 'rgba(200,144,10,0.12)' : 'transparent',
                border: 'none', cursor: 'pointer', width: '100%',
              }}
            >
              {/* 아이콘/이미지 영역 */}
              {sugg.imageUrl ? (
                <Image src={sugg.imageUrl} alt="" width={18} height={18} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              ) : sugg.iconUrl ? (
                <Image src={sugg.iconUrl} alt="" width={14} height={14} style={{ flexShrink: 0 }} />
              ) : sugg.typeLabel ? (
                <span style={{ fontSize: '0.5625rem', color: '#555', fontFamily: 'var(--font-mono)', flexShrink: 0, minWidth: 28, textAlign: 'center' }}>{sugg.typeLabel}</span>
              ) : (
                <span style={{ width: 14, flexShrink: 0 }} />
              )}
              {/* 라벨 */}
              <span style={{ color: sugg.color, fontSize: '0.6875rem', fontWeight: 600, flex: 1 }}>{sugg.label}</span>
              {/* 타입 표시 (아이콘이 있을 때만 우측에) */}
              {sugg.typeLabel && (sugg.imageUrl || sugg.iconUrl) && (
                <span style={{ color: '#333', fontSize: '0.5625rem', flexShrink: 0 }}>{sugg.typeLabel}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
