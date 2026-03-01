'use client'

import { useState, useRef } from 'react'
import { formatSkillDesc } from '@/components/sinners/KeywordTooltip'
import {
  SIN_COLORS, type SinType,
  GRADE_COLORS, SIN_ICON_MAP, ATK_TYPE_ICON_MAP,
  SKILL_TYPE_LABELS, SIN_LABELS_KR,
  normalizeSin, getKeywordIconUrl, KEYWORD_SIN_MAP,
} from '@/lib/data/sinners'
import { KEYWORD_DESCRIPTIONS } from '@/lib/data/keyword-descriptions'

function sinColorOf(sin: string | null): string {
  const en = normalizeSin(sin)
  return en ? (SIN_COLORS[en] ?? '#888888') : '#888888'
}

// ── 엔트리 타입 ─────────────────────────────────────────────────────────
export type NoteSkillEntry = {
  name: string
  skill_type: string
  sin_affinity: string
  skill_order: number
  description?: string | null
  iconUrl?: string
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
  rarity: string
  imageUrl?: string
  sinnerName: string
  keywords?: string[]
}

// ── SkillChip ───────────────────────────────────────────────────────────
export function SkillChip({ entry }: { entry: NoteSkillEntry }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const atkIcon = ATK_TYPE_ICON_MAP[entry.skill_type]
  return (
    <span
      ref={ref}
      onMouseEnter={() => setRect(ref.current?.getBoundingClientRect() ?? null)}
      onMouseLeave={() => setRect(null)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, verticalAlign: 'middle', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '1px 6px', margin: '0 2px', cursor: 'default', position: 'relative' }}
    >
      <span style={{ position: 'relative', width: 20, height: 20, flexShrink: 0, display: 'inline-block' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {entry.iconUrl && <img src={entry.iconUrl} alt="" style={{ width: 20, height: 20, borderRadius: '50%' }} />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {atkIcon && <img src={atkIcon} alt="" style={{ position: 'absolute', bottom: -1, right: -1, width: 10, height: 10 }} />}
      </span>
      <span style={{ color: '#888899', fontSize: '10px' }}>{entry.sinnerName}</span>

      {rect && (
        <span className="pointer-events-none" style={{
          position: 'fixed',
          left: Math.min(rect.left, window.innerWidth - 300),
          ...(rect.top > 150
            ? { bottom: window.innerHeight - rect.top + 6 }
            : { top: rect.bottom + 6 }),
          zIndex: 200, background: '#1a1510', border: '1px solid #3a3020',
          borderRadius: 4, padding: '8px 10px', minWidth: '180px', maxWidth: '280px', whiteSpace: 'normal',
        }}>
          <div style={{ color: '#c8a450', fontSize: '11px', fontWeight: 700, marginBottom: 4 }}>
            {entry.sinnerName} · {entry.identityName} · 스킬 {entry.skill_order}
          </div>
          {atkIcon && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={atkIcon} alt="" style={{ width: 12, height: 12 }} />
              <span style={{ color: '#666677', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>{SKILL_TYPE_LABELS[entry.skill_type] ?? entry.skill_type}</span>
            </div>
          )}
          {entry.description && (
            <div style={{ color: '#888', fontSize: '10px', lineHeight: 1.55 }}>
              {formatSkillDesc(entry.description, '#c8a450')}
            </div>
          )}
        </span>
      )}
    </span>
  )
}

// ── PassiveChip ─────────────────────────────────────────────────────────
export function PassiveChip({ entry }: { entry: NotePassiveEntry }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const sinEn = normalizeSin(entry.sin_affinity)
  const sc = sinColorOf(entry.sin_affinity)
  return (
    <span
      ref={ref}
      onMouseEnter={() => setRect(ref.current?.getBoundingClientRect() ?? null)}
      onMouseLeave={() => setRect(null)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, verticalAlign: 'middle', background: `${sc}18`, border: `1px solid ${sc}35`, borderRadius: 4, padding: '1px 6px', margin: '0 2px', cursor: 'default', position: 'relative' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {sinEn && <img src={SIN_ICON_MAP[sinEn]} alt="" style={{ width: 11, height: 11 }} />}
      <span style={{ color: sc, fontSize: '10px', fontWeight: 600 }}>{entry.name}</span>

      {rect && (
        <span className="pointer-events-none" style={{
          position: 'fixed',
          left: Math.min(rect.left, window.innerWidth - 320),
          ...(rect.top > 150
            ? { bottom: window.innerHeight - rect.top + 6 }
            : { top: rect.bottom + 6 }),
          zIndex: 200, background: '#1a1510', border: '1px solid #3a3020',
          borderRadius: 4, padding: '8px 10px', minWidth: '200px', maxWidth: '300px', whiteSpace: 'normal',
        }}>
          <div style={{ color: sc, fontSize: '11px', fontWeight: 700, marginBottom: 4 }}>{entry.name}</div>
          {sinEn && entry.sin_count && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 4 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={SIN_ICON_MAP[sinEn]} alt="" style={{ width: 11, height: 11 }} />
              <span style={{ color: sc, fontSize: '9px', fontFamily: 'var(--font-mono)' }}>
                {entry.sin_count} {entry.active_cond}
              </span>
            </div>
          )}
          {entry.description && (
            <div style={{ color: '#888', fontSize: '10px', lineHeight: 1.55 }}>
              {formatSkillDesc(entry.description, sc)}
            </div>
          )}
        </span>
      )}
    </span>
  )
}

// ── EgoChip ─────────────────────────────────────────────────────────────
export function EgoChip({ entry }: { entry: NoteEgoEntry }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const sinEn = normalizeSin(entry.sin_affinity)
  const sc = sinEn ? (SIN_COLORS[sinEn] ?? '#667788') : '#667788'
  const gc = GRADE_COLORS[entry.grade] ?? '#667788'
  return (
    <span
      ref={ref}
      onMouseEnter={() => setRect(ref.current?.getBoundingClientRect() ?? null)}
      onMouseLeave={() => setRect(null)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, verticalAlign: 'middle', background: `${gc}18`, border: `1px solid ${gc}35`, borderRadius: 4, padding: '1px 6px', margin: '0 2px', cursor: 'default', position: 'relative' }}
    >
      {entry.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={entry.image_url} alt="" style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover' }} />
      )}
      <span style={{ color: '#888899', fontSize: '10px' }}>{entry.sinnerName}</span>
      <span style={{ color: gc, fontSize: '10px', fontWeight: 600 }}>{entry.name}</span>

      {rect && (
        <span className="pointer-events-none" style={{
          position: 'fixed',
          left: Math.min(rect.left, window.innerWidth - 300),
          ...(rect.top > 150
            ? { bottom: window.innerHeight - rect.top + 6 }
            : { top: rect.bottom + 6 }),
          zIndex: 200, background: '#1a1510', border: '1px solid #3a3020',
          borderRadius: 4, padding: '8px 10px', minWidth: '180px', maxWidth: '280px', whiteSpace: 'normal',
        }}>
          <div style={{ color: gc, fontSize: '11px', fontWeight: 700, marginBottom: 4 }}>
            {entry.sinnerName} · {entry.grade} E.G.O
          </div>
          <div style={{ color: '#c8a450', fontSize: '11px', fontWeight: 600, marginBottom: 4 }}>
            {entry.name}
          </div>
          {sinEn && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={SIN_ICON_MAP[sinEn]} alt="" style={{ width: 11, height: 11 }} />
              <span style={{ color: sc, fontSize: '9px', fontFamily: 'var(--font-mono)' }}>{sinEn ? (SIN_LABELS_KR[sinEn] ?? entry.sin_affinity) : entry.sin_affinity}</span>
            </div>
          )}
        </span>
      )}
    </span>
  )
}

// ── IdentityChip ────────────────────────────────────────────────────────
export function IdentityChip({ entry }: { entry: NoteIdentityEntry }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const mainKw = entry.keywords?.find(kw => KEYWORD_SIN_MAP[kw])
  const sinType = mainKw ? KEYWORD_SIN_MAP[mainKw] : undefined
  const sc = sinType ? (SIN_COLORS[sinType] ?? '#c8900a') : '#c8900a'
  return (
    <span
      ref={ref}
      onMouseEnter={() => setRect(ref.current?.getBoundingClientRect() ?? null)}
      onMouseLeave={() => setRect(null)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, verticalAlign: 'middle', background: `${sc}18`, border: `1px solid ${sc}35`, borderRadius: 4, padding: '1px 6px', margin: '0 2px', cursor: 'default', position: 'relative' }}
    >
      {entry.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={entry.imageUrl} alt="" style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover' }} />
      )}
      <span style={{ color: '#888899', fontSize: '10px' }}>{entry.sinnerName}</span>
      <span style={{ color: sc, fontSize: '10px', fontWeight: 600 }}>{entry.name}</span>

      {rect && (
        <span className="pointer-events-none" style={{
          position: 'fixed',
          left: Math.min(rect.left, window.innerWidth - 300),
          ...(rect.top > 150
            ? { bottom: window.innerHeight - rect.top + 6 }
            : { top: rect.bottom + 6 }),
          zIndex: 200, background: '#1a1510', border: '1px solid #3a3020',
          borderRadius: 4, padding: '8px 10px', minWidth: '180px', maxWidth: '280px', whiteSpace: 'normal',
        }}>
          <div style={{ color: sc, fontSize: '11px', fontWeight: 700, marginBottom: 4 }}>
            {entry.sinnerName} · {entry.rarity}
          </div>
          <div style={{ color: '#c8a450', fontSize: '11px', fontWeight: 600, marginBottom: 4 }}>
            {entry.name}
          </div>
          {entry.keywords && entry.keywords.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {entry.keywords.map(kw => {
                const kwSin = KEYWORD_SIN_MAP[kw]
                const kwColor = kwSin ? (SIN_COLORS[kwSin] ?? '#888') : '#888'
                return (
                  <span key={kw} style={{ color: kwColor, fontSize: '9px', fontFamily: 'var(--font-mono)' }}>{kw}</span>
                )
              })}
            </div>
          )}
        </span>
      )}
    </span>
  )
}

// ── KeywordChip ──────────────────────────────────────────────────────────
export function KeywordChip({ keyword }: { keyword: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const iconUrl = getKeywordIconUrl(keyword)
  const sinType = KEYWORD_SIN_MAP[keyword]
  const sc = sinType ? (SIN_COLORS[sinType] ?? '#c8900a') : '#c8900a'
  const info = KEYWORD_DESCRIPTIONS[keyword]
  return (
    <span
      ref={ref}
      onMouseEnter={() => setRect(ref.current?.getBoundingClientRect() ?? null)}
      onMouseLeave={() => setRect(null)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, verticalAlign: 'middle', background: `${sc}18`, border: `1px solid ${sc}35`, borderRadius: 4, padding: '1px 6px', margin: '0 2px', cursor: 'default', position: 'relative' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {iconUrl && <img src={iconUrl} alt="" style={{ width: 13, height: 13 }} />}
      <span style={{ color: sc, fontSize: '10px', fontWeight: 600 }}>{keyword}</span>

      {rect && (
        <span className="pointer-events-none" style={{
          position: 'fixed',
          left: Math.min(rect.left, window.innerWidth - 320),
          ...(rect.top > 150
            ? { bottom: window.innerHeight - rect.top + 6 }
            : { top: rect.bottom + 6 }),
          zIndex: 200, background: '#1a1510', border: '1px solid #3a3020',
          borderRadius: 4, padding: '8px 10px', minWidth: '200px', maxWidth: '300px', whiteSpace: 'normal',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: info ? 4 : 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {iconUrl && <img src={iconUrl} alt="" style={{ width: 14, height: 14 }} />}
            <span style={{ color: sc, fontSize: '11px', fontWeight: 700 }}>{keyword}</span>
          </div>
          {info && (
            <div style={{ color: '#888', fontSize: '10px', lineHeight: 1.55 }}>
              {info.desc}
              {info.maxStack != null && (
                <span style={{ display: 'block', marginTop: 2, color: '#666', fontSize: '9px' }}>
                  최대 {info.maxStack}
                </span>
              )}
            </div>
          )}
        </span>
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
  // s → "수감자 S{order}", p → "패시브명", e → "수감자 EGO명"
  const display = type === 's' && parts.length >= 2
    ? `${parts[0]} S${parts[1]}`
    : type === 'e' && parts.length >= 2
      ? `${parts[0]} ${parts[1]}`
      : tokenKey
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3, verticalAlign: 'middle',
      background: s.bg, border: `1px solid ${s.border}`, borderRadius: 4,
      padding: '1px 6px', margin: '0 2px', fontSize: '10px',
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
  inline,
}: {
  text: string
  skillLookup?: Record<string, NoteSkillEntry>
  passiveLookup?: Record<string, NotePassiveEntry>
  egoLookup?: Record<string, NoteEgoEntry>
  identityLookup?: Record<string, NoteIdentityEntry>
  inline?: boolean
}) {
  if (!text.trim()) return (
    <p style={{ color: '#2a2535', fontSize: '12px', fontStyle: 'italic' }}>내용이 없습니다.</p>
  )
  // [s:skill] [p:passive] [e:ego] [k:keyword] [i:identity]
  const tokenRe = /\[s:((?:[^\[\]]|\[[^\]]*\])+)\]|\[p:((?:[^\[\]]|\[[^\]]*\])+)\]|\[e:((?:[^\[\]]|\[[^\]]*\])+)\]|\[k:((?:[^\[\]]|\[[^\]]*\])+)\]|\[i:((?:[^\[\]]|\[[^\]]*\])+)\]/g
  const elements: React.ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = tokenRe.exec(text)) !== null) {
    if (m.index > last) elements.push(<span key={`t${last}`}>{formatSkillDesc(text.slice(last, m.index), '#b0a898')}</span>)
    if (m[1]) {
      const e = skillLookup[m[1]]
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
    }
    last = m.index + m[0].length
  }
  if (last < text.length) elements.push(<span key="tend">{formatSkillDesc(text.slice(last), '#b0a898')}</span>)
  if (inline) return <span style={{ fontSize: '11px', color: '#b0a898', lineHeight: 1.6 }}>{elements}</span>
  return <div style={{ fontSize: '13px', color: '#b0a898', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{elements}</div>
}
