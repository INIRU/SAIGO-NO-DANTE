'use client'

import { GIFT_KEYWORD_COLORS } from '@/lib/constants/gift'

import { useState, useMemo, useCallback, useRef, type CompositionEvent as ReactCompositionEvent, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import KeywordIcon from '@/components/ui/KeywordIcon'
import {
  SIN_COLORS,
} from '@/lib/data/sinners'
import { getKeywordIconUrl } from '@/lib/constants/keywords'
import type { KeywordInfo } from '@/components/providers/KeywordProvider'

// ── 타입 ─────────────────────────────────────────────────────────────────
export type AutocompleteSuggestion = {
  label: string
  type: 'keyword' | 'skill' | 'identity' | 'ego' | 'passive' | 'egogift'
  typeLabel?: string
  color: string
  iconUrl?: string
  iconFallbackUrl?: string
  imageUrl?: string
  token: string
  syntax?: 'inline' | 'block'
}

type TokenType = AutocompleteSuggestion['type']

export type CaretAnchor = {
  left: number
  top: number
  width?: number
}

type AutocompleteContext = {
  syntax: 'inline' | 'block' | 'word'
  mode: 'type' | 'value' | 'word' | 'closed'
  query: string
  replaceStart: number
  replaceEnd: number
  typeFilter?: TokenType
  blockFilter?: 'skill' | 'gift' | 'passive'
  sinnerName?: string
}

const TOKEN_TYPE_MAP: Record<string, TokenType> = {
  k: 'keyword',
  s: 'skill',
  i: 'identity',
  e: 'ego',
  p: 'passive',
  g: 'egogift',
}

const TOKEN_PREFIX_LABELS: Record<TokenType, string> = {
  keyword: '[k:',
  skill: '[s:',
  identity: '[i:',
  ego: '[e:',
  passive: '[p:',
  egogift: '[g:',
}

const TOKEN_TYPE_SUGGESTIONS: AutocompleteSuggestion[] = [
  { label: '인격', type: 'identity', typeLabel: '[i:', color: '#d0a85a', token: '[i:', syntax: 'inline' },
  { label: '스킬', type: 'skill', typeLabel: '[s:', color: '#d0a85a', token: '[s:', syntax: 'inline' },
  { label: '패시브', type: 'passive', typeLabel: '[p:', color: '#d0a85a', token: '[p:', syntax: 'inline' },
  { label: 'E.G.O', type: 'ego', typeLabel: '[e:', color: '#d0a85a', token: '[e:', syntax: 'inline' },
  { label: '키워드', type: 'keyword', typeLabel: '[k:', color: '#d0a85a', token: '[k:', syntax: 'inline' },
  { label: '기프트', type: 'egogift', typeLabel: '[g:', color: '#d0a85a', token: '[g:', syntax: 'inline' },
]

const BLOCK_TYPE_SUGGESTIONS: AutocompleteSuggestion[] = [
  { label: '스킬 프레임', type: 'skill', typeLabel: '{{skill:', color: '#d0a85a', token: '{{skill:', syntax: 'block' },
  { label: '패시브 설명', type: 'passive', typeLabel: '{{passive:', color: '#88a830', token: '{{passive:', syntax: 'block' },
  { label: '기프트 카드', type: 'egogift', typeLabel: '{{gift:', color: '#d0a85a', token: '{{gift:', syntax: 'block' },
]

const DROPDOWN_WIDTH_REM = 17.5
const DROPDOWN_MAX_HEIGHT_REM = 10

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min
  return Math.min(Math.max(value, min), max)
}

function getTokenParts(token: string): string[] {
  if (token.startsWith('{{skill:')) {
    return token.replace(/^\{\{skill:/, '').replace(/\}\}$/, '').split(':')
  }
  if (token.startsWith('{{gift:')) {
    return token.replace(/^\{\{gift:/, '').replace(/\}\}$/, '').split(':')
  }
  if (token.startsWith('{{passive:')) {
    return token.replace(/^\{\{passive:/, '').replace(/\}\}$/, '').split(':')
  }
  const body = token.replace(/^\[[a-z]:/, '').replace(/\]$/, '')
  return body.split(':')
}

export function getNoteAutocompleteContext(text: string, cursorPos: number): AutocompleteContext {
  const before = text.slice(0, cursorPos)
  const lastOpen = before.lastIndexOf('[')
  const lastClose = before.lastIndexOf(']')

  if (lastOpen >= 0) {
    const closeAfterOpen = text.indexOf(']', lastOpen + 1)
    if (closeAfterOpen >= 0 && cursorPos > lastOpen && cursorPos <= closeAfterOpen + 1) {
      return {
        mode: 'closed',
        syntax: 'inline',
        query: '',
        replaceStart: cursorPos,
        replaceEnd: cursorPos,
      }
    }
  }

  const lastBlockOpen = before.lastIndexOf('{{')
  const lastBlockClose = before.lastIndexOf('}}')

  if (lastBlockOpen >= 0) {
    const closeAfterOpen = text.indexOf('}}', lastBlockOpen + 2)
    if (closeAfterOpen >= 0 && cursorPos > lastBlockOpen && cursorPos <= closeAfterOpen + 2) {
      return {
        mode: 'closed',
        syntax: 'block',
        query: '',
        replaceStart: cursorPos,
        replaceEnd: cursorPos,
      }
    }
  }

  if (lastBlockOpen > lastBlockClose && lastBlockOpen > lastOpen) {
    const partial = before.slice(lastBlockOpen + 2)
    const typeQueryMatch = partial.match(/^([a-zA-Z]*)$/)
    if (typeQueryMatch) {
      return {
        mode: 'type',
        syntax: 'block',
        query: typeQueryMatch[1] ?? '',
        replaceStart: lastBlockOpen,
        replaceEnd: cursorPos,
      }
    }

    const tokenMatch = partial.match(/^(skill|passive|gift):([^{}\n]*)$/)
    if (tokenMatch) {
      const blockType = tokenMatch[1] as 'skill' | 'passive' | 'gift'
      const rawBody = tokenMatch[2]
      const bodyParts = rawBody.split(':')
      const query = bodyParts[bodyParts.length - 1] ?? ''
      return {
        mode: 'value',
        syntax: 'block',
        query,
        replaceStart: lastBlockOpen,
        replaceEnd: cursorPos,
        blockFilter: blockType,
        sinnerName: blockType === 'skill' && rawBody.includes(':') ? bodyParts[0]?.trim() : undefined,
      }
    }

    return {
      mode: 'closed',
      syntax: 'block',
      query: '',
      replaceStart: cursorPos,
      replaceEnd: cursorPos,
    }
  }

  if (lastOpen > lastClose && lastOpen > lastBlockOpen) {
    const partial = before.slice(lastOpen + 1)
    const typeQueryMatch = partial.match(/^([a-zA-Z.]*)$/)
    if (typeQueryMatch) {
      return {
        mode: 'type',
        syntax: 'inline',
        query: typeQueryMatch[1] ?? '',
        replaceStart: lastOpen,
        replaceEnd: cursorPos,
      }
    }

    const tokenMatch = partial.match(/^([speikg]):([^\]\n]*)$/)
    if (tokenMatch) {
      const tokenType = tokenMatch[1]
      const rawBody = tokenMatch[2]
      const bodyParts = rawBody.split(':')
      const query = bodyParts[bodyParts.length - 1] ?? ''
      return {
        mode: 'value',
        syntax: 'inline',
        query,
        replaceStart: lastOpen,
        replaceEnd: cursorPos,
        typeFilter: TOKEN_TYPE_MAP[tokenType],
        sinnerName: tokenType === 'i' && rawBody.includes(':') ? bodyParts[0]?.trim() : undefined,
      }
    }
  }

  const wordMatch = before.match(/(\S+)$/)
  const query = wordMatch ? wordMatch[1] : ''
  return {
    mode: 'word',
    syntax: 'word',
    query,
    replaceStart: cursorPos - query.length,
    replaceEnd: cursorPos,
  }
}

export function getNoteAutocompleteSuggestions(
  text: string,
  cursorPos: number,
  pool: AutocompleteSuggestion[],
): AutocompleteSuggestion[] {
  const currentContext = getNoteAutocompleteContext(text, cursorPos)
  if (currentContext.mode === 'closed') return []
  if (currentContext.mode === 'word') return []
  if (currentContext.mode === 'type') {
    const query = currentContext.query.toLowerCase()
    const source = currentContext.syntax === 'block' ? BLOCK_TYPE_SUGGESTIONS : TOKEN_TYPE_SUGGESTIONS
    if (!query) return source
    return source.filter(s =>
      s.label.toLowerCase().includes(query) ||
      s.typeLabel?.toLowerCase().includes(query) ||
      s.token.toLowerCase().includes(query)
    )
  }
  if (currentContext.query.length < 1 && !currentContext.typeFilter && !currentContext.blockFilter) return []
  const typedPool = currentContext.syntax === 'block'
    ? pool.filter(s => s.syntax === 'block' && (
        currentContext.blockFilter === 'skill'
          ? s.type === 'skill'
          : currentContext.blockFilter === 'passive'
            ? s.type === 'passive'
            : s.type === 'egogift'
      ))
    : currentContext.typeFilter
      ? pool.filter(s => s.syntax !== 'block' && s.type === currentContext.typeFilter)
      : pool.filter(s => s.syntax !== 'block')
  const matched = typedPool.filter(s => suggestionMatches(s, currentContext.query, currentContext.sinnerName))
  const starts = matched.filter(s => suggestionStartsWith(s, currentContext.query))
  const contains = matched.filter(s => !suggestionStartsWith(s, currentContext.query))
  return [...starts, ...contains].slice(0, 6)
}

function suggestionMatches(suggestion: AutocompleteSuggestion, query: string, sinnerName?: string): boolean {
  if (sinnerName) {
    const parts = getTokenParts(suggestion.token)
    if (parts[0] !== sinnerName) return false
  }
  if (!query) return true
  return suggestion.label.includes(query) || suggestion.token.includes(query)
}

function suggestionStartsWith(suggestion: AutocompleteSuggestion, query: string): boolean {
  if (!query) return true
  return suggestion.label.startsWith(query) || getTokenParts(suggestion.token).some(part => part.startsWith(query))
}

function getSuggestionMeta(suggestion: AutocompleteSuggestion): string | undefined {
  const parts = getTokenParts(suggestion.token)
  const typeLabel = suggestion.typeLabel ?? TOKEN_PREFIX_LABELS[suggestion.type]
  if (suggestion.type === 'identity' && parts.length >= 2) return `${parts[0]} · ${typeLabel}`
  if ((suggestion.type === 'skill' || suggestion.type === 'ego') && parts.length >= 2) return `${parts[0]} · ${typeLabel}`
  return typeLabel
}

function getCaretAnchor(textarea: HTMLTextAreaElement): CaretAnchor | null {
  if (typeof window === 'undefined') return null

  const style = window.getComputedStyle(textarea)
  const mirror = document.createElement('div')
  const span = document.createElement('span')
  const before = textarea.value.slice(0, textarea.selectionStart ?? 0)
  const placeholder = '\u200b'

  mirror.textContent = before
  span.textContent = placeholder
  mirror.appendChild(span)

  const copyProps = [
    'boxSizing', 'width', 'minHeight', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight',
    'textTransform', 'textIndent', 'tabSize',
  ] as const

  mirror.style.position = 'absolute'
  mirror.style.left = '-9999px'
  mirror.style.top = '0'
  mirror.style.visibility = 'hidden'
  mirror.style.whiteSpace = 'pre-wrap'
  mirror.style.overflowWrap = 'break-word'
  mirror.style.wordBreak = 'break-word'
  mirror.style.overflow = 'hidden'
  for (const prop of copyProps) {
    mirror.style[prop] = style[prop]
  }

  document.body.appendChild(mirror)
  const spanRect = span.getBoundingClientRect()
  const mirrorRect = mirror.getBoundingClientRect()
  document.body.removeChild(mirror)

  const taRect = textarea.getBoundingClientRect()
  const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.4 || 20
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 800
  const dropdownWidth = DROPDOWN_WIDTH_REM * Number.parseFloat(style.fontSize || '16')
  const rawViewportLeft = taRect.left + (spanRect.left - mirrorRect.left) - textarea.scrollLeft
  const lineViewportTop = taRect.top + (spanRect.top - mirrorRect.top) - textarea.scrollTop
  const rawViewportTop = lineViewportTop + lineHeight + 6
  const dropdownHeight = Math.min(DROPDOWN_MAX_HEIGHT_REM * Number.parseFloat(style.fontSize || '16'), viewportHeight - 16)
  const viewportLeft = clamp(rawViewportLeft, 8, viewportWidth - dropdownWidth - 8)
  const flippedTop = lineViewportTop - dropdownHeight - 4
  const viewportTop = clamp(
    rawViewportTop + dropdownHeight > viewportHeight - 8 ? flippedTop : rawViewportTop,
    8,
    viewportHeight - 56,
  )

  return {
    left: viewportLeft,
    top: viewportTop,
    width: dropdownWidth,
  }
}

// ── 키워드 풀 생성 헬퍼 ──────────────────────────────────────────────────
export function buildKeywordPool(kwContext: Record<string, KeywordInfo>): AutocompleteSuggestion[] {
  return Object.entries(kwContext).filter(([, info]) => info.iconSlug).map(([kw, info]) => {
    const sinType = info.sinAffinity
    const sc = sinType ? (SIN_COLORS[sinType as keyof typeof SIN_COLORS] ?? '#c8900a') : '#c8900a'
    const iconSlug = info.iconSlug
    return {
      label: kw,
      type: 'keyword' as const,
      color: sc,
      iconUrl: getKeywordIconUrl(kw, iconSlug) ?? undefined,
      token: `[k:${kw}]`,
      syntax: 'inline',
    }
  })
}

// ── EGO 기프트 풀 생성 헬퍼 ──────────────────────────────────────────────
const EGO_GIFT_KW_COLORS = GIFT_KEYWORD_COLORS

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
    syntax: 'inline',
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
  const [caretAnchor, setCaretAnchor] = useState<CaretAnchor | null>(null)
  const isComposingRef = useRef(false)

  const updateCaretAnchor = useCallback((target?: HTMLTextAreaElement | null) => {
    const ta = target ?? textareaRef.current
    setCaretAnchor(ta ? getCaretAnchor(ta) : null)
  }, [textareaRef])

  const syncContextFromTextarea = useCallback((target: HTMLTextAreaElement) => {
    const nextCursor = target.selectionStart
    const nextContext = getNoteAutocompleteContext(target.value, nextCursor)
    setCursorPos(nextCursor)
    setIsOpen(nextContext.mode !== 'closed')
    setSelectedIdx(-1)
    requestAnimationFrame(() => updateCaretAnchor(target))
  }, [updateCaretAnchor])

  const currentContext = useMemo(() => {
    if (!isOpen) return null
    return getNoteAutocompleteContext(text, cursorPos)
  }, [text, cursorPos, isOpen])

  const suggestions = useMemo((): AutocompleteSuggestion[] => {
    if (!currentContext) return []
    return getNoteAutocompleteSuggestions(text, cursorPos, pool)
  }, [currentContext, pool])

  const select = useCallback((sugg: AutocompleteSuggestion) => {
    if (isComposingRef.current) return
    const ta = textareaRef.current
    if (!ta) return
    const liveText = ta.value
    const liveCursor = ta.selectionStart ?? liveText.length
    const liveContext = getNoteAutocompleteContext(liveText, liveCursor)
    if (liveContext.mode === 'closed') return
    if (liveContext.syntax !== 'word' && sugg.syntax && liveContext.syntax !== sugg.syntax) return
    if (liveContext.mode === 'word' && currentContext?.mode !== 'word') return
    const newText = liveText.slice(0, liveContext.replaceStart) + sugg.token + liveText.slice(liveContext.replaceEnd)
    const newPos = liveContext.replaceStart + sugg.token.length
    setText(newText)
    setCursorPos(newPos)
    setSelectedIdx(-1)
    setIsOpen(sugg.token.endsWith(':'))
    const scrollX = window.scrollX
    const scrollY = window.scrollY
    requestAnimationFrame(() => {
      ta.focus({ preventScroll: true })
      ta.setSelectionRange(newPos, newPos)
      window.scrollTo(scrollX, scrollY)
      updateCaretAnchor(ta)
    })
  }, [setText, textareaRef, currentContext, updateCaretAnchor])

  const handleKeyDown = useCallback((e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    const maybeComposingEvent = e as ReactKeyboardEvent<HTMLTextAreaElement> & { isComposing?: boolean }
    if (maybeComposingEvent.isComposing || e.nativeEvent.isComposing || e.keyCode === 229 || isComposingRef.current) {
      if (e.key === 'Tab') {
        e.preventDefault()
        e.stopPropagation()
      }
      return
    }
    if (suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      if (e.key === 'Tab') e.stopPropagation()
      select(suggestions[Math.max(selectedIdx, 0)])
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }, [suggestions, selectedIdx, select])

  const onTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    syncContextFromTextarea(e.target)
  }, [syncContextFromTextarea])

  const onTextSelect = useCallback((e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement
    syncContextFromTextarea(target)
  }, [syncContextFromTextarea])

  const onCompositionStart = useCallback(() => {
    isComposingRef.current = true
  }, [])

  const onCompositionEnd = useCallback((e: ReactCompositionEvent<HTMLTextAreaElement>) => {
    isComposingRef.current = false
    const target = e.currentTarget
    requestAnimationFrame(() => syncContextFromTextarea(target))
  }, [syncContextFromTextarea])

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
      updateCaretAnchor(ta)
    })
  }, [text, setText, textareaRef, updateCaretAnchor])

  return {
    suggestions,
    selectedIdx,
    setSelectedIdx,
    select,
    handleKeyDown,
    onTextChange,
    onTextSelect,
    onCompositionStart,
    onCompositionEnd,
    updateCaretAnchor,
    caretAnchor,
    insertToken,
    closeDropdown: () => setIsOpen(false),
    pool,
  }
}

export type ReturnedNoteAc = ReturnType<typeof useNoteAutocomplete>

// ── 자동완성 드롭다운 UI ─────────────────────────────────────────────────
export function NoteAutocompleteDropdown({
  suggestions,
  selectedIdx,
  onSelect,
  onHover,
  anchor,
}: {
  suggestions: AutocompleteSuggestion[]
  selectedIdx: number
  onSelect: (sugg: AutocompleteSuggestion) => void
  onHover: (idx: number) => void
  anchor?: CaretAnchor | null
}) {
  if (suggestions.length === 0) return null
  const positionStyle: React.CSSProperties = anchor
    ? {
        left: anchor.left,
        top: anchor.top,
        width: anchor.width ? Math.min(anchor.width, 280) : undefined,
        maxWidth: 'calc(100vw - 1rem)',
      }
    : { left: 0, right: 0, bottom: '100%', marginBottom: -1 }
  const dropdown = (
    <div style={{
      position: anchor ? 'fixed' : 'absolute', ...positionStyle,
      background: 'rgba(18,15,11,0.98)',
      border: '1px solid rgba(200,144,10,0.2)',
      borderRadius: anchor ? '0.3125rem' : '0.3125rem 0.3125rem 0 0',
      padding: '0.1875rem',
      boxShadow: anchor ? '0 0.5rem 1.25rem rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.035)' : '0 -0.375rem 0.875rem rgba(0,0,0,0.32)',
      zIndex: 120,
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.0625rem', maxHeight: `${DROPDOWN_MAX_HEIGHT_REM}rem`, overflowY: 'auto', overscrollBehavior: 'contain' }}>
        {suggestions.map((sugg, i) => {
          const isSelected = i === Math.max(selectedIdx, 0)
          const Icon = sugg.type === 'keyword' ? KeywordIcon : Image
          const hasLeadingMeta = !sugg.imageUrl && !sugg.iconUrl && Boolean(sugg.typeLabel)
          const trailingMeta = hasLeadingMeta ? undefined : getSuggestionMeta(sugg)
          return (
            <button
              key={sugg.token}
              onMouseDown={e => { e.preventDefault(); onSelect(sugg) }}
              onMouseEnter={() => onHover(i)}
              className="flex items-center gap-1.5 rounded text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold"
              style={{
                background: isSelected ? 'rgba(200,144,10,0.1)' : 'transparent',
                border: '1px solid transparent',
                boxShadow: isSelected ? 'inset 0 0 0 1px rgba(200,144,10,0.12)' : 'none',
                cursor: 'pointer',
                width: '100%',
                minHeight: '2rem',
                padding: '0.125rem 0.375rem',
                lineHeight: 1.2,
              }}
            >
              {sugg.imageUrl ? (
                <span style={{ width: 24, height: 24, borderRadius: '0.1875rem', overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.055)' }}>
                  <Image src={sugg.imageUrl} alt="" width={24} height={24} style={{ width: 24, height: 24, objectFit: 'cover', objectPosition: 'top' }} unoptimized />
                </span>
              ) : sugg.iconUrl ? (
                <span style={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon src={sugg.iconUrl} alt="" width={15} height={15} style={{ width: 15, height: 15, objectFit: 'contain' }} unoptimized />
                </span>
              ) : sugg.typeLabel ? (
                <span style={{ fontSize: '0.75rem', color: '#b9aa90', fontFamily: 'var(--font-mono)', flexShrink: 0, minWidth: sugg.syntax === 'block' ? '4rem' : '1.75rem', textAlign: 'center' }}>{sugg.typeLabel}</span>
              ) : (
                <span style={{ width: 24, flexShrink: 0 }} />
              )}
              <span style={{ color: sugg.color, fontSize: '0.875rem', fontWeight: 650, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sugg.label}</span>
              {trailingMeta && (
                <span style={{
                  color: '#a79a86',
                  fontSize: '0.75rem',
                  flexShrink: 0,
                  padding: '0 0.125rem',
                  fontFamily: 'var(--font-mono)',
                }}>{trailingMeta}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
  if (anchor && typeof document !== 'undefined') return createPortal(dropdown, document.body)
  return dropdown
}
