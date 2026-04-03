'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { useFormatSkillDesc, useKeywords, useKeywordData } from '@/components/sinners/KeywordTooltip'
import {
  SIN_COLORS,
  GRADE_COLORS, SIN_ICON_MAP, ATK_TYPE_ICON_MAP,
  SKILL_TYPE_LABELS, SIN_LABELS_KR,
  normalizeSin, getSkillOrderLabel,
  type SinType,
} from '@/lib/data/sinners'

function sinColorOf(sin: string | null): string {
  const en = normalizeSin(sin)
  return en ? (SIN_COLORS[en] ?? '#888888') : '#888888'
}

// ── 툴팁 hover + 터치 관리 훅 ───────────────────────────────────────────
// 한 번에 하나의 칩 툴팁만 표시
let activeChipClose: (() => void) | null = null

function useTooltip(ref: React.RefObject<HTMLElement | null>) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const hideTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)

  const hide = useCallback(() => setRect(null), [])
  const show = useCallback(() => {
    if (activeChipClose && activeChipClose !== hide) activeChipClose()
    clearTimeout(hideTimeout.current)
    setRect(ref.current?.getBoundingClientRect() ?? null)
    activeChipClose = hide
  }, [ref, hide])

  const scheduleHide = useCallback(() => {
    hideTimeout.current = setTimeout(() => { setRect(null); if (activeChipClose === hide) activeChipClose = null }, 120)
  }, [hide])

  const cancelHide = useCallback(() => {
    clearTimeout(hideTimeout.current)
  }, [])

  // 모바일 터치 토글
  const toggle = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setRect(prev => {
      if (prev) { if (activeChipClose === hide) activeChipClose = null; return null }
      if (activeChipClose && activeChipClose !== hide) activeChipClose()
      activeChipClose = hide
      return ref.current?.getBoundingClientRect() ?? null
    })
  }, [ref, hide])

  // 외부 탭 시 닫기
  useEffect(() => {
    if (!rect) return
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setRect(null)
        if (activeChipClose === hide) activeChipClose = null
      }
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [rect, ref, hide])

  return { rect, show, scheduleHide, cancelHide, toggle }
}

// ── 공용 툴팁 래퍼 (스마트 포지셔닝 + 스크롤 + 페이드) ─────────────────
function TooltipPopup({
  rect, children, minWidth = 200, maxWidth = 300, onMouseEnter, onMouseLeave,
}: {
  rect: DOMRect
  children: React.ReactNode
  minWidth?: number
  maxWidth?: number
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [overflowing, setOverflowing] = useState(false)

  const spaceAbove = rect.top
  const spaceBelow = window.innerHeight - rect.bottom
  const showAbove = spaceAbove > spaceBelow
  const maxH = Math.min((showAbove ? spaceAbove : spaceBelow) - 20, window.innerHeight * 0.5)

  useEffect(() => {
    const el = contentRef.current
    if (el) setOverflowing(el.scrollHeight > el.clientHeight)
  }, [])

  return (
    <span
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'fixed',
        left: Math.min(rect.left, window.innerWidth - maxWidth - 10),
        ...(showAbove
          ? { bottom: window.innerHeight - rect.top + 6 }
          : { top: rect.bottom + 6 }),
        zIndex: 200,
        background: '#1a1510',
        border: '1px solid #3a3020',
        borderRadius: 4,
        minWidth, maxWidth,
        whiteSpace: 'normal',
        overflow: 'hidden',
      }}
    >
      <div
        ref={contentRef}
        style={{
          padding: '8px 10px',
          maxHeight: maxH,
          overflowY: overflowing ? 'auto' : 'hidden',
          overscrollBehavior: 'contain',
        }}
      >
        {children}
      </div>
      {overflowing && (
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0, height: 32,
          background: 'linear-gradient(to bottom, transparent, #1a1510)',
          borderRadius: '0 0 4px 4px',
          pointerEvents: 'none',
        }} />
      )}
    </span>
  )
}

// ── 엔트리 타입 ─────────────────────────────────────────────────────────
export type NoteSkillEntry = {
  name: string
  skill_type: string
  sin_affinity: string
  skill_order: number
  description?: string | null
  iconUrl?: string
  iconFallbackUrl?: string
  identityName: string
  sinnerName: string
}

export type NotePassiveEntry = {
  name: string
  sin_affinity: string | null
  sin_count: number | null
  active_cond: string | null
  description: string | null
  sinnerName: string
  imageUrl?: string
}

export type NoteEgoEntry = {
  name: string
  grade: string
  sin_affinity: string | null
  image_url?: string | null
  sinnerName: string
}

export type NoteIdentityEntry = {
  name: string
  rarity: number
  imageUrl?: string
  sinnerName: string
  keywords?: string[]
}

export type NoteEgoGiftEntry = {
  name: string
  keyword: string
  grade: string
  image_url?: string | null
  effect_base?: string | null
}

// ── SkillChip ───────────────────────────────────────────────────────────
export function SkillChip({ entry }: { entry: NoteSkillEntry }) {
  const formatSkillDesc = useFormatSkillDesc()
  const ref = useRef<HTMLSpanElement>(null)
  const { rect, show, scheduleHide, cancelHide, toggle } = useTooltip(ref)
  const atkIcon = ATK_TYPE_ICON_MAP[entry.skill_type]
  const sc = sinColorOf(entry.sin_affinity)
  const [imgSrc, setImgSrc] = useState(entry.iconUrl)
  useEffect(() => { setImgSrc(entry.iconUrl) }, [entry.iconUrl])
  return (
    <span
      ref={ref}
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
      onClick={toggle}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, verticalAlign: 'middle', background: `${sc}18`, border: `1px solid ${sc}35`, borderRadius: 4, padding: '1px 6px', margin: '0 2px', cursor: 'default', position: 'relative' }}
    >
      <span style={{ position: 'relative', width: 20, height: 20, flexShrink: 0, display: 'inline-block' }}>
        {imgSrc && <Image src={imgSrc} alt="" width={20} height={20} style={{ borderRadius: '50%' }} onError={() => { if (entry.iconFallbackUrl && imgSrc !== entry.iconFallbackUrl) setImgSrc(entry.iconFallbackUrl) }} />}
        {atkIcon && <Image src={atkIcon} alt="" width={10} height={10} style={{ position: 'absolute', bottom: -1, right: -1 }} />}
      </span>
      <span style={{ color: sc, fontSize: '0.75rem', fontWeight: 600 }}>{entry.name}</span>

      {rect && createPortal(
        <TooltipPopup rect={rect} minWidth={220} maxWidth={340} onMouseEnter={cancelHide} onMouseLeave={scheduleHide}>
          <div style={{ color: sc, fontSize: '0.8125rem', fontWeight: 700, marginBottom: 4 }}>
            {entry.sinnerName} · {entry.identityName} · {getSkillOrderLabel(entry.skill_order, entry.skill_type)}
          </div>
          {atkIcon && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <Image src={atkIcon} alt="" width={12} height={12} />
              <span style={{ color: '#666677', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>{SKILL_TYPE_LABELS[entry.skill_type] ?? entry.skill_type}</span>
            </div>
          )}
          {entry.description && (
            <div style={{ color: '#aaa', fontSize: '0.75rem', lineHeight: 1.7 }}>
              {entry.description.split('\n').map((line, li) => {
                const isCoinStart = /^\[코인\s?\d/.test(line)
                return (
                  <div key={li}>
                    {isCoinStart && li > 0 && (
                      <div style={{ borderTop: `1px solid ${sc}25`, margin: '4px 0' }} />
                    )}
                    {formatSkillDesc(line, sc)}
                  </div>
                )
              })}
            </div>
          )}
        </TooltipPopup>,
        document.body,
      )}
    </span>
  )
}

// ── PassiveChip ─────────────────────────────────────────────────────────
export function PassiveChip({ entry }: { entry: NotePassiveEntry }) {
  const formatSkillDesc = useFormatSkillDesc()
  const ref = useRef<HTMLSpanElement>(null)
  const { rect, show, scheduleHide, cancelHide, toggle } = useTooltip(ref)
  const sinList = entry.sin_affinity
    ? entry.sin_affinity.split(',').map(s => normalizeSin(s.trim())).filter(Boolean) as SinType[]
    : []
  const sc = sinList[0] ? (SIN_COLORS[sinList[0]] ?? '#888888') : '#888888'
  return (
    <span
      ref={ref}
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
      onClick={toggle}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, verticalAlign: 'middle', background: `${sc}18`, border: `1px solid ${sc}35`, borderRadius: 4, padding: '1px 6px', margin: '0 2px', cursor: 'default', position: 'relative' }}
    >
      {entry.imageUrl && (
        <Image src={entry.imageUrl} alt="" width={12} height={18} quality={20} style={{ width: '12px', height: '18px', borderRadius: 2, objectFit: 'cover', objectPosition: 'top', flexShrink: 0 }} />
      )}
      {sinList.map((st, i) => <Image key={i} src={SIN_ICON_MAP[st]} alt="" width={14} height={14} />)}
      <span style={{ color: sc, fontSize: '0.75rem', fontWeight: 600 }}>{entry.name}</span>

      {rect && createPortal(
        <TooltipPopup rect={rect} onMouseEnter={cancelHide} onMouseLeave={scheduleHide}>
          <div style={{ color: sc, fontSize: '0.8125rem', fontWeight: 700, marginBottom: 4 }}>{entry.name}</div>
          {sinList.length > 0 && entry.sin_count && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 4 }}>
              {sinList.map((st, i) => <Image key={i} src={SIN_ICON_MAP[st]} alt="" width={14} height={14} />)}
              <span style={{ color: sc, fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}>
                {entry.sin_count} {entry.active_cond}
              </span>
            </div>
          )}
          {entry.description && (
            <div style={{ color: '#aaa', fontSize: '0.75rem', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
              {formatSkillDesc(entry.description, sc)}
            </div>
          )}
        </TooltipPopup>,
        document.body,
      )}
    </span>
  )
}

// ── EgoChip ─────────────────────────────────────────────────────────────
export function EgoChip({ entry }: { entry: NoteEgoEntry }) {
  const ref = useRef<HTMLSpanElement>(null)
  const { rect, show, scheduleHide, cancelHide, toggle } = useTooltip(ref)
  const sinEn = normalizeSin(entry.sin_affinity)
  const sc = sinEn ? (SIN_COLORS[sinEn] ?? '#667788') : '#667788'
  const gc = GRADE_COLORS[entry.grade] ?? '#667788'
  return (
    <span
      ref={ref}
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
      onClick={toggle}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, verticalAlign: 'middle', background: `${gc}18`, border: `1px solid ${gc}35`, borderRadius: 4, padding: '1px 6px', margin: '0 2px', cursor: 'default', position: 'relative' }}
    >
      {entry.image_url && (
        <Image src={entry.image_url} alt="" width={16} height={16} style={{ borderRadius: '50%', objectFit: 'cover' }} />
      )}
      <span style={{ color: '#888899', fontSize: '0.75rem' }}>{entry.sinnerName}</span>
      <span style={{ color: gc, fontSize: '0.75rem', fontWeight: 600 }}>{entry.name}</span>

      {rect && createPortal(
        <TooltipPopup rect={rect} minWidth={180} maxWidth={280} onMouseEnter={cancelHide} onMouseLeave={scheduleHide}>
          <div style={{ color: gc, fontSize: '0.8125rem', fontWeight: 700, marginBottom: 4 }}>
            {entry.sinnerName} · {entry.grade} E.G.O
          </div>
          <div style={{ color: '#c8a450', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 4 }}>
            {entry.name}
          </div>
          {sinEn && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Image src={SIN_ICON_MAP[sinEn]} alt="" width={14} height={14} />
              <span style={{ color: sc, fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}>{sinEn ? (SIN_LABELS_KR[sinEn] ?? entry.sin_affinity) : entry.sin_affinity}</span>
            </div>
          )}
        </TooltipPopup>,
        document.body,
      )}
    </span>
  )
}

// ── IdentityChip ────────────────────────────────────────────────────────
export function IdentityChip({ entry }: { entry: NoteIdentityEntry }) {
  const { sinMap: kwSinMap } = useKeywordData()
  const ref = useRef<HTMLSpanElement>(null)
  const { rect, show, scheduleHide, cancelHide, toggle } = useTooltip(ref)
  const mainKw = entry.keywords?.find(kw => kwSinMap[kw])
  const sinType = mainKw ? kwSinMap[mainKw] : undefined
  const sc = sinType ? (SIN_COLORS[sinType] ?? '#c8900a') : '#c8900a'
  return (
    <span
      ref={ref}
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
      onClick={toggle}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, verticalAlign: 'middle', background: `${sc}18`, border: `1px solid ${sc}35`, borderRadius: 4, padding: '1px 6px', margin: '0 2px', cursor: 'default', position: 'relative' }}
    >
      {entry.imageUrl && (
        <Image src={entry.imageUrl} alt="" width={16} height={16} style={{ width: '1rem', height: '1rem', borderRadius: '50%', objectFit: 'cover' }} />
      )}
      <span style={{ color: '#888899', fontSize: '0.75rem' }}>{entry.sinnerName}</span>
      <span style={{ color: sc, fontSize: '0.75rem', fontWeight: 600 }}>{entry.name}</span>

      {rect && createPortal(
        <TooltipPopup rect={rect} minWidth={180} maxWidth={280} onMouseEnter={cancelHide} onMouseLeave={scheduleHide}>
          <div style={{ color: sc, fontSize: '0.8125rem', fontWeight: 700, marginBottom: 4 }}>
            {entry.sinnerName} <span style={{ fontFamily: 'sans-serif' }}>·</span> {entry.rarity}성
          </div>
          <div style={{ color: '#c8a450', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 4 }}>
            {entry.name}
          </div>
          {entry.keywords && entry.keywords.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {entry.keywords.map((kw, idx) => {
                const kwSin = kwSinMap[kw]
                const kwColor = kwSin ? (SIN_COLORS[kwSin] ?? '#888') : '#888'
                return (
                  <span key={`${kw}-${idx}`} style={{ color: kwColor, fontSize: '0.75rem', fontWeight: 600 }}>{kw}</span>
                )
              })}
            </div>
          )}
        </TooltipPopup>,
        document.body,
      )}
    </span>
  )
}

// ── KeywordChip ──────────────────────────────────────────────────────────
export function KeywordChip({ keyword }: { keyword: string }) {
  const keywords = useKeywords()
  const { sinMap: kwSinMap, getIconUrl } = useKeywordData()
  const ref = useRef<HTMLSpanElement>(null)
  const { rect, show, scheduleHide, cancelHide, toggle } = useTooltip(ref)
  const iconUrl = getIconUrl(keyword)
  const sinType = kwSinMap[keyword]
  const sc = sinType ? (SIN_COLORS[sinType] ?? '#c8900a') : '#c8900a'
  const info = keywords[keyword]
  return (
    <span
      ref={ref}
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
      onClick={toggle}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, verticalAlign: 'middle', background: `${sc}18`, border: `1px solid ${sc}35`, borderRadius: 4, padding: '1px 6px', margin: '0 2px', cursor: 'default', position: 'relative' }}
    >
      {iconUrl && <Image src={iconUrl} alt="" width={16} height={16} />}
      <span style={{ color: sc, fontSize: '0.75rem', fontWeight: 600 }}>{keyword}</span>

      {rect && createPortal(
        <TooltipPopup rect={rect} onMouseEnter={cancelHide} onMouseLeave={scheduleHide}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: info ? 4 : 0 }}>
            {iconUrl && <Image src={iconUrl} alt="" width={14} height={14} />}
            <span style={{ color: sc, fontSize: '0.8125rem', fontWeight: 700 }}>{keyword}</span>
          </div>
          {info && (
            <div style={{ color: '#aaa', fontSize: '0.75rem', lineHeight: 1.55 }}>
              {info.desc}
              {info.maxStack != null && (
                <span style={{ display: 'block', marginTop: 2, color: '#999', fontSize: '0.8125rem' }}>
                  최대 {info.maxStack}
                </span>
              )}
            </div>
          )}
        </TooltipPopup>,
        document.body,
      )}
    </span>
  )
}

// ── EgoGiftChip ─────────────────────────────────────────────────────────
const EGO_GIFT_KW_COLORS: Record<string, string> = {
  화상: '#e85830', 출혈: '#c83030', 진동: '#d0a020', 파열: '#8040c0',
  침잠: '#3060b0', 호흡: '#40a060', 충전: '#e0c020', 참격: '#cc4444',
  관통: '#dd8833', 타격: '#cc8822', 공통: '#888888',
}

export function EgoGiftChip({ entry }: { entry: NoteEgoGiftEntry }) {
  const formatSkillDesc = useFormatSkillDesc()
  const ref = useRef<HTMLSpanElement>(null)
  const { rect, show, scheduleHide, cancelHide, toggle } = useTooltip(ref)
  const sc = EGO_GIFT_KW_COLORS[entry.keyword] ?? '#888'
  return (
    <span
      ref={ref}
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
      onClick={toggle}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, verticalAlign: 'middle', background: `${sc}18`, border: `1px solid ${sc}35`, borderRadius: 4, padding: '1px 6px', margin: '0 2px', cursor: 'default', position: 'relative' }}
    >
      {entry.image_url && (
        <Image src={entry.image_url} alt="" width={16} height={16} style={{ objectFit: 'contain', flexShrink: 0 }} />
      )}
      <span style={{ color: sc, fontSize: '0.75rem', fontWeight: 600 }}>{entry.name}</span>

      {rect && createPortal(
        <TooltipPopup rect={rect} onMouseEnter={cancelHide} onMouseLeave={scheduleHide}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            {entry.image_url && (
              <Image src={entry.image_url} alt="" width={20} height={20} style={{ objectFit: 'contain' }} />
            )}
            <span style={{ color: sc, fontSize: '0.8125rem', fontWeight: 700 }}>{entry.name}</span>
            <span style={{ color: '#555', fontSize: '0.8125rem' }}>{entry.keyword} {entry.grade}</span>
          </div>
          {entry.effect_base && (
            <div style={{ color: '#aaa', fontSize: '0.75rem', lineHeight: 1.55 }}>
              {formatSkillDesc(entry.effect_base, sc)}
            </div>
          )}
        </TooltipPopup>,
        document.body,
      )}
    </span>
  )
}

// ── FallbackChip (lookup 없을 때 토큰 키를 파싱해서 미니 칩으로 표시) ──
const FALLBACK_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  s: { color: '#888899', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)' },
  p: { color: '#88a830', bg: 'rgba(136,168,48,0.08)', border: 'rgba(136,168,48,0.2)' },
  e: { color: '#c8900a', bg: 'rgba(200,144,10,0.08)', border: 'rgba(200,144,10,0.2)' },
  i: { color: '#6bbbff', bg: 'rgba(107,187,255,0.08)', border: 'rgba(107,187,255,0.2)' },
}

function FallbackChip({ type, tokenKey }: { type: string; tokenKey: string }) {
  const s = FALLBACK_STYLE[type] ?? FALLBACK_STYLE.s
  const parts = tokenKey.split(':')
  // s → "수감자 S{order}[-variant]", p → "패시브명", e → "수감자 EGO명"
  const display = type === 's' && parts.length >= 2
    ? `${parts[0]} ${parts.length >= 3
        ? `${getSkillOrderLabel(Number(parts[1]))}-${Number(parts[2]) + 1}`
        : getSkillOrderLabel(Number(parts[1]))}`
    : type === 'e' && parts.length >= 2
      ? `${parts[0]} ${parts[1]}`
      : tokenKey
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3, verticalAlign: 'middle',
      background: s.bg, border: `1px solid ${s.border}`, borderRadius: 4,
      padding: '1px 6px', margin: '0 2px', fontSize: '0.75rem',
    }}>
      <span style={{ color: s.color, fontWeight: 600 }}>{display}</span>
    </span>
  )
}

// ── NoteRenderer ────────────────────────────────────────────────────────
export function NoteRenderer({
  text,
  skillLookup = {},
  passiveLookup = {},
  egoLookup = {},
  identityLookup = {},
  egoGiftLookup = {},
  inline,
  allowedKeywords,
}: {
  text: string
  skillLookup?: Record<string, NoteSkillEntry>
  passiveLookup?: Record<string, NotePassiveEntry>
  egoLookup?: Record<string, NoteEgoEntry>
  identityLookup?: Record<string, NoteIdentityEntry>
  egoGiftLookup?: Record<string, NoteEgoGiftEntry>
  inline?: boolean
  allowedKeywords?: Set<string>
}) {
  const formatSkillDesc = useFormatSkillDesc()
  if (!text.trim()) return (
    <p style={{ color: '#2a2535', fontSize: '0.75rem', fontStyle: 'italic' }}>내용이 없습니다.</p>
  )
  // [s:skill] [p:passive] [e:ego] [k:keyword] [i:identity] [g:egogift]
  const tokenRe = /\[s:((?:[^\[\]]|\[[^\]]*\])+)\]|\[p:((?:[^\[\]]|\[[^\]]*\])+)\]|\[e:((?:[^\[\]]|\[[^\]]*\])+)\]|\[k:((?:[^\[\]]|\[[^\]]*\])+)\]|\[i:((?:[^\[\]]|\[[^\]]*\])+)\]|\[g:((?:[^\[\]]|\[[^\]]*\])+)\]/g
  const elements: React.ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = tokenRe.exec(text)) !== null) {
    if (m.index > last) elements.push(<span key={`t${last}`}>{formatSkillDesc(text.slice(last, m.index), '#b0a898', undefined, allowedKeywords)}</span>)
    if (m[1]) {
      // 변형 스킬 fallback: "돈키호테:1" → "돈키호테:1:1" 시도
      const e = skillLookup[m[1]] ?? skillLookup[`${m[1]}:1`]
      elements.push(e
        ? <SkillChip key={`s${m.index}`} entry={e} />
        : <FallbackChip key={`s${m.index}`} type="s" tokenKey={m[1]} />
      )
    } else if (m[2]) {
      const e = passiveLookup[m[2]]
      elements.push(e
        ? <PassiveChip key={`p${m.index}`} entry={e} />
        : <FallbackChip key={`p${m.index}`} type="p" tokenKey={m[2]} />
      )
    } else if (m[3]) {
      const e = egoLookup[m[3]]
      elements.push(e
        ? <EgoChip key={`e${m.index}`} entry={e} />
        : <FallbackChip key={`e${m.index}`} type="e" tokenKey={m[3]} />
      )
    } else if (m[4]) {
      elements.push(<KeywordChip key={`k${m.index}`} keyword={m[4]} />)
    } else if (m[5]) {
      const e = identityLookup[m[5]]
      elements.push(e
        ? <IdentityChip key={`i${m.index}`} entry={e} />
        : <FallbackChip key={`i${m.index}`} type="i" tokenKey={m[5]} />
      )
    } else if (m[6]) {
      const e = egoGiftLookup[m[6]]
      elements.push(e
        ? <EgoGiftChip key={`g${m.index}`} entry={e} />
        : <FallbackChip key={`g${m.index}`} type="g" tokenKey={m[6]} />
      )
    }
    last = m.index + m[0].length
  }
  if (last < text.length) elements.push(<span key="tend">{formatSkillDesc(text.slice(last), '#b0a898', undefined, allowedKeywords)}</span>)
  if (inline) return <span style={{ fontSize: '0.8125rem', color: '#b0a898', lineHeight: 1.6 }}>{elements}</span>
  return <div style={{ fontSize: '0.8125rem', color: '#b0a898', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{elements}</div>
}
