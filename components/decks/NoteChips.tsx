'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import NoteBlockViewer from '@/components/notes/NoteBlockViewer'
import { parseBlockDocument, NOTE_PREFIX } from '@/lib/notes/blocks'
import { parseNoteImage } from '@/lib/notes/images'
import IdentitySkillFrameCard from '@/components/identity/IdentitySkillFrameCard'
import { PassiveNoteRow } from '@/components/passive/PassiveEffect'
import GiftCard from '@/components/ui/GiftCard'
import type { GiftConditionStatus } from '@/lib/planner/gift-condition-status'
import { useFormatSkillDesc, useKeywords, useKeywordData } from '@/components/sinners/KeywordTooltip'
import {
  SIN_COLORS,
  GRADE_COLORS, SIN_ICON_MAP, ATK_TYPE_ICON_MAP,
  normalizeSin, getSkillOrderLabel,
  type SinType,
  type Identity,
  type Skill,
  type ActivationCondition,
} from '@/lib/data/sinners'
import { useTranslations, useLocale } from 'next-intl'
import { getLocalizedKeywordName, getLocalizedKeywordDesc } from '@/lib/i18n'
import type { SupportedLang } from '@/lib/i18n/types'
import { localizeDeckKeyword } from '@/components/decks/decks-types'

function sinColorOf(sin: string | null): string {
  const en = normalizeSin(sin)
  return en ? (SIN_COLORS[en] ?? '#888888') : '#888888'
}

/** 게임 스타일 칩 공통 인라인 스타일 (clipPath 테두리 = outline 기법) */
function chipStyle(color: string): React.CSSProperties {
  const c = 5
  const clip = `polygon(${c}px 0, calc(100% - ${c}px) 0, 100% ${c}px, 100% calc(100% - ${c}px), calc(100% - ${c}px) 100%, ${c}px 100%, 0 calc(100% - ${c}px), 0 ${c}px)`
  return {
    display: 'inline-flex', alignItems: 'center', gap: 3, verticalAlign: 'middle',
    background: `linear-gradient(135deg, ${color}28 0%, ${color}10 100%)`,
    clipPath: clip,
    padding: '0.125rem 0.5rem', margin: '0 0.125rem', cursor: 'default', position: 'relative' as const,
    filter: `drop-shadow(0 0 2px ${color}40)`,
    lineHeight: 1.45,
  }
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
  skill?: Skill
  skills?: Skill[]
  identity?: Pick<Identity, 'sinner_id' | 'game_id'>
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
  activation_condition?: ActivationCondition | null
}

function resolveSkillFrameEntry(
  skillLookup: Record<string, NoteSkillEntry>,
  tokenKey: string,
): NoteSkillEntry | undefined {
  const direct = skillLookup[tokenKey]
  if (direct) return direct
  const parts = tokenKey.split(':')
  if (parts.length !== 3) return undefined
  const humanVariant = Number(parts[2])
  if (!Number.isInteger(humanVariant) || humanVariant <= 1) return undefined
  return skillLookup[`${parts[0]}:${parts[1]}:${humanVariant - 1}`]
}

function SkillFramePlaceholder({
  entry,
  lang,
  allowedKeywords,
}: {
  entry: NoteSkillEntry
  lang: string
  allowedKeywords?: Set<string>
}) {
  if (!entry.skill || !entry.skills || !entry.identity) {
    return <FallbackChip type="s" tokenKey={`${entry.sinnerName}:${entry.skill_order}`} />
  }

  return (
    <div
      style={{
        margin: '0.75rem 0',
        width: '100%',
        maxWidth: '44rem',
      }}
    >
      <IdentitySkillFrameCard
        skill={entry.skill}
        skills={entry.skills}
        identity={entry.identity}
        lang={lang}
        size="4.5rem"
        allowedKeywords={allowedKeywords}
        className="rounded-md p-2.5"
        style={{
          background: 'rgba(12,10,7,0.9)',
          border: `1px solid ${sinColorOf(entry.sin_affinity)}33`,
        }}
      />
    </div>
  )
}

function PassiveBlockPlaceholder({ entry }: { entry: NotePassiveEntry }) {
  return (
    <div style={{ margin: '0.75rem 0' }}>
      <PassiveNoteRow
        passive={{
          identity_id: entry.sinnerName,
          name: entry.name,
          passive_type: 'battle',
          sin_affinity: entry.sin_affinity,
          sin_count: entry.sin_count,
          active_cond: entry.active_cond,
          description: entry.description,
        }}
        imageUrl={entry.imageUrl}
      />
    </div>
  )
}

function GiftCardPlaceholder({
  entry,
  conditionStatus,
}: {
  entry: NoteEgoGiftEntry
  conditionStatus?: GiftConditionStatus | null
}) {
  return (
    <div
      style={{
        display: 'inline-block',
        width: '4.75rem',
        margin: '0.75rem 0',
        verticalAlign: 'top',
      }}
    >
      <GiftCard gift={entry} onClick={() => undefined} conditionStatus={conditionStatus} />
    </div>
  )
}

// ── SkillChip ───────────────────────────────────────────────────────────
export function SkillChip({ entry, interactive = true }: { entry: NoteSkillEntry; interactive?: boolean }) {
  const formatSkillDesc = useFormatSkillDesc()
  const t = useTranslations()
  const ref = useRef<HTMLSpanElement>(null)
  const { rect, show, scheduleHide, cancelHide, toggle } = useTooltip(ref)
  const atkIcon = ATK_TYPE_ICON_MAP[entry.skill_type]
  const sc = sinColorOf(entry.sin_affinity)
  const [imgSrc, setImgSrc] = useState(entry.iconUrl)
  useEffect(() => { setImgSrc(entry.iconUrl) }, [entry.iconUrl])
  return (
    <span
      ref={ref}
      onMouseEnter={interactive ? show : undefined}
      onMouseLeave={interactive ? scheduleHide : undefined}
      onClick={interactive ? toggle : undefined}
      style={chipStyle(sc)}
    >
      <span style={{ position: 'relative', width: 20, height: 20, flexShrink: 0, display: 'inline-block' }}>
        {imgSrc && <Image src={imgSrc} alt="" width={20} height={20} style={{ borderRadius: '50%' }} onError={() => { if (entry.iconFallbackUrl && imgSrc !== entry.iconFallbackUrl) setImgSrc(entry.iconFallbackUrl) }} />}
        {atkIcon && <Image src={atkIcon} alt="" width={10} height={10} style={{ position: 'absolute', bottom: -1, right: -1 }} />}
      </span>
      <span style={{ color: sc, fontSize: '0.75rem', fontWeight: 600 }}>{entry.name}</span>

      {interactive && rect && createPortal(
        <TooltipPopup rect={rect} minWidth={220} maxWidth={340} onMouseEnter={cancelHide} onMouseLeave={scheduleHide}>
          <div style={{ color: sc, fontSize: '0.8125rem', fontWeight: 700, marginBottom: 4 }}>
            {entry.sinnerName} · {entry.identityName} · {(['evade', 'defense', 'counter'].includes(entry.skill_type) ? t('identity.skillType.defense') : getSkillOrderLabel(entry.skill_order, entry.skill_type))}
          </div>
          {atkIcon && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <Image src={atkIcon} alt="" width={12} height={12} />
              <span style={{ color: '#666677', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>{t(`identity.skillType.${entry.skill_type}` as Parameters<typeof t>[0]) ?? entry.skill_type}</span>
            </div>
          )}
          {entry.description && (
            <div style={{ color: '#aaa', fontSize: '0.75rem', lineHeight: 1.7 }}>
              {entry.description.split('\n').map((line, li) => {
                const isCoinStart = /^\[(코인|Coin|コイン)\s?\d/.test(line)
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
export function PassiveChip({ entry, interactive = true }: { entry: NotePassiveEntry; interactive?: boolean }) {
  const formatSkillDesc = useFormatSkillDesc()
  const t = useTranslations()
  const ref = useRef<HTMLSpanElement>(null)
  const { rect, show, scheduleHide, cancelHide, toggle } = useTooltip(ref)
  const sinList = entry.sin_affinity
    ? entry.sin_affinity.split(',').map(s => normalizeSin(s.trim())).filter(Boolean) as SinType[]
    : []
  const sc = sinList[0] ? (SIN_COLORS[sinList[0]] ?? '#888888') : '#888888'
  return (
    <span
      ref={ref}
      onMouseEnter={interactive ? show : undefined}
      onMouseLeave={interactive ? scheduleHide : undefined}
      onClick={interactive ? toggle : undefined}
      style={chipStyle(sc)}
    >
      {entry.imageUrl && (
        <Image src={entry.imageUrl} alt="" width={12} height={18} quality={50} style={{ width: '12px', height: '18px', borderRadius: 2, objectFit: 'cover', objectPosition: 'top', flexShrink: 0 }} />
      )}
      {sinList.map((st, i) => <Image key={i} src={SIN_ICON_MAP[st]} alt="" width={14} height={14} />)}
      <span style={{ color: sc, fontSize: '0.75rem', fontWeight: 600 }}>{entry.name}</span>

      {interactive && rect && createPortal(
        <TooltipPopup rect={rect} onMouseEnter={cancelHide} onMouseLeave={scheduleHide}>
          <div style={{ color: sc, fontSize: '0.8125rem', fontWeight: 700, marginBottom: 4 }}>{entry.name}</div>
          {sinList.length > 0 && entry.sin_count && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 4 }}>
              {sinList.map((st, i) => <Image key={i} src={SIN_ICON_MAP[st]} alt="" width={14} height={14} />)}
              <span style={{ color: sc, fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}>
                {entry.sin_count} {entry.active_cond ? t(`identity.passives.${entry.active_cond}` as Parameters<typeof t>[0]) : ''}
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
export function EgoChip({ entry, interactive = true }: { entry: NoteEgoEntry; interactive?: boolean }) {
  const t = useTranslations()
  const ref = useRef<HTMLSpanElement>(null)
  const { rect, show, scheduleHide, cancelHide, toggle } = useTooltip(ref)
  const sinEn = normalizeSin(entry.sin_affinity)
  const sc = sinEn ? (SIN_COLORS[sinEn] ?? '#667788') : '#667788'
  const gc = GRADE_COLORS[entry.grade] ?? '#667788'
  return (
    <span
      ref={ref}
      onMouseEnter={interactive ? show : undefined}
      onMouseLeave={interactive ? scheduleHide : undefined}
      onClick={interactive ? toggle : undefined}
      style={chipStyle(gc)}
    >
      {entry.image_url && (
        <Image src={entry.image_url} alt="" width={16} height={16} style={{ borderRadius: '50%', objectFit: 'cover' }} />
      )}
      <span style={{ color: '#888899', fontSize: '0.75rem' }}>{entry.sinnerName}</span>
      <span style={{ color: gc, fontSize: '0.75rem', fontWeight: 600 }}>{entry.name}</span>

      {interactive && rect && createPortal(
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
              <span style={{ color: sc, fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}>{sinEn ? t(`sin.${sinEn}`) : (entry.sin_affinity ?? '')}</span>
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
  const t = useTranslations()
  const locale = useLocale()
  const keywords = useKeywords()
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
      style={chipStyle(sc)}
    >
      {entry.imageUrl && (
        <Image src={entry.imageUrl} alt="" width={16} height={16} style={{ width: '1rem', height: '1rem', borderRadius: '50%', objectFit: 'cover' }} />
      )}
      <span style={{ color: '#888899', fontSize: '0.75rem' }}>{entry.sinnerName}</span>
      <span style={{ color: sc, fontSize: '0.75rem', fontWeight: 600 }}>{entry.name}</span>

      {rect && createPortal(
        <TooltipPopup rect={rect} minWidth={180} maxWidth={280} onMouseEnter={cancelHide} onMouseLeave={scheduleHide}>
          <div style={{ color: sc, fontSize: '0.8125rem', fontWeight: 700, marginBottom: 4 }}>
            {entry.sinnerName} <span style={{ fontFamily: 'sans-serif' }}>·</span> {t(`identity.rarity.${entry.rarity}` as Parameters<typeof t>[0])}
          </div>
          <div style={{ color: '#c8a450', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 4 }}>
            {entry.name}
          </div>
          {entry.keywords && entry.keywords.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {entry.keywords.map((kw, idx) => {
                const kwSin = kwSinMap[kw]
                const kwColor = kwSin ? (SIN_COLORS[kwSin] ?? '#888') : '#888'
                const localKwName = localizeDeckKeyword(kw, keywords[kw], locale as SupportedLang)
                return (
                  <span key={`${kw}-${idx}`} style={{ color: kwColor, fontSize: '0.75rem', fontWeight: 600 }}>{localKwName}</span>
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
  const t = useTranslations()
  const locale = useLocale()
  const keywords = useKeywords()
  const { sinMap: kwSinMap, getIconUrl } = useKeywordData()
  const ref = useRef<HTMLSpanElement>(null)
  const { rect, show, scheduleHide, cancelHide, toggle } = useTooltip(ref)
  const iconUrl = getIconUrl(keyword)
  const sinType = kwSinMap[keyword]
  const sc = sinType ? (SIN_COLORS[sinType] ?? '#c8900a') : '#c8900a'
  const info = keywords[keyword]
  const localName = localizeDeckKeyword(keyword, info, locale as SupportedLang)
  return (
    <span
      ref={ref}
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
      onClick={toggle}
      style={chipStyle(sc)}
    >
      {iconUrl && <Image src={iconUrl} alt="" width={16} height={16} />}
      <span style={{ color: sc, fontSize: '0.75rem', fontWeight: 600 }}>{localName}</span>

      {rect && createPortal(
        <TooltipPopup rect={rect} onMouseEnter={cancelHide} onMouseLeave={scheduleHide}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: info ? 4 : 0 }}>
            {iconUrl && <Image src={iconUrl} alt="" width={14} height={14} />}
            <span style={{ color: sc, fontSize: '0.8125rem', fontWeight: 700 }}>{localName}</span>
          </div>
          {info && (
            <div style={{ color: '#aaa', fontSize: '0.75rem', lineHeight: 1.55 }}>
              {getLocalizedKeywordDesc(info.desc, info, locale as SupportedLang)}
              {info.maxStack != null && (
                <span style={{ display: 'block', marginTop: 2, color: '#999', fontSize: '0.8125rem' }}>
                  {t('keyword.maxStack')} {info.maxStack}
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
  const locale = useLocale()
  const keywords = useKeywords()
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
      style={chipStyle(sc)}
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
            <span style={{ color: '#555', fontSize: '0.8125rem' }}>{localizeDeckKeyword(entry.keyword, keywords[entry.keyword], locale as SupportedLang)} {entry.grade}</span>
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
  g: { color: '#d0a020', bg: 'rgba(208,160,32,0.08)', border: 'rgba(208,160,32,0.22)' },
}

function FallbackChip({ type, tokenKey }: { type: string; tokenKey: string }) {
  const s = FALLBACK_STYLE[type] ?? FALLBACK_STYLE.s
  const parts = tokenKey.split(':')
  // s → "수감자 S{order}[-variant]", p → "패시브명", e → "수감자 EGO명"
  const display = type === 's' && parts.length >= 2
    ? `${parts[0]} ${parts.length >= 3
        ? `${getSkillOrderLabel(Number(parts[1]))}-${Number(parts[2])}`
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
  egoGiftConditionLookup = {},
  inline,
  allowedKeywords,
  textScale = 'default',
}: {
  text: string
  skillLookup?: Record<string, NoteSkillEntry>
  passiveLookup?: Record<string, NotePassiveEntry>
  egoLookup?: Record<string, NoteEgoEntry>
  identityLookup?: Record<string, NoteIdentityEntry>
  egoGiftLookup?: Record<string, NoteEgoGiftEntry>
  egoGiftConditionLookup?: Record<string, GiftConditionStatus | null>
  inline?: boolean
  allowedKeywords?: Set<string>
  textScale?: 'default' | 'comfortable'
}) {
  const formatSkillDesc = useFormatSkillDesc()
  const locale = useLocale()
  if (!text.trim()) return null
  const doc = parseBlockDocument(text)
  if (doc) return <NoteBlockViewer doc={doc} renderText={value => <NoteRenderer text={value} skillLookup={skillLookup} passiveLookup={passiveLookup} egoLookup={egoLookup} identityLookup={identityLookup} egoGiftLookup={egoGiftLookup} allowedKeywords={allowedKeywords} inline />} />
  if (text.startsWith(NOTE_PREFIX)) return null

  const renderMarkdownInline = (value: string, keyPrefix: string): React.ReactNode[] => {
    const nodes: React.ReactNode[] = []
    const inlineRe = /(\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)|\*\*[^*\n]+?\*\*|\*[^*\n]+?\*|_[^_\n]+?_|`[^`\n]+?`)/g
    let last = 0
    let m: RegExpExecArray | null
    while ((m = inlineRe.exec(value)) !== null) {
      if (m.index > last) {
        nodes.push(
          <span key={`${keyPrefix}-t${last}`}>
            {formatSkillDesc(value.slice(last, m.index), '#b0a898', undefined, allowedKeywords)}
          </span>
        )
      }
      const matched = m[0]
      if (m[2] && m[3]) {
        nodes.push(
          <a
            key={`${keyPrefix}-a${m.index}`}
            href={m[3]}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#e8b030', textDecoration: 'underline', textUnderlineOffset: '0.1875rem' }}
          >
            {formatSkillDesc(m[2], '#e8b030', undefined, allowedKeywords)}
          </a>
        )
      } else if (matched.startsWith('**')) {
        nodes.push(
          <strong key={`${keyPrefix}-b${m.index}`} style={{ color: '#d9d0bf', fontWeight: 700 }}>
            {formatSkillDesc(matched.slice(2, -2), '#d9d0bf', undefined, allowedKeywords)}
          </strong>
        )
      } else if (matched.startsWith('*') || matched.startsWith('_')) {
        nodes.push(
          <em key={`${keyPrefix}-i${m.index}`} style={{ color: '#d2c7b5', fontStyle: 'italic' }}>
            {formatSkillDesc(matched.slice(1, -1), '#d2c7b5', undefined, allowedKeywords)}
          </em>
        )
      } else {
        nodes.push(
          <code
            key={`${keyPrefix}-c${m.index}`}
            style={{
              color: '#e8b030',
              background: 'rgba(200,144,10,0.12)',
              border: '1px solid rgba(200,144,10,0.18)',
              borderRadius: 3,
              padding: '0.0625rem 0.25rem',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {matched.slice(1, -1)}
          </code>
        )
      }
      last = m.index + matched.length
    }
    if (last < value.length) {
      nodes.push(
        <span key={`${keyPrefix}-tend`}>
          {formatSkillDesc(value.slice(last), '#b0a898', undefined, allowedKeywords)}
        </span>
      )
    }
    return nodes
  }

  const renderInline = (value: string, keyPrefix: string): React.ReactNode[] => {
    const tokenRe = /\[s:((?:[^\[\]]|\[[^\]]*\])+?)\s*\]|\[p:((?:[^\[\]]|\[[^\]]*\])+?)\s*\]|\[e:((?:[^\[\]]|\[[^\]]*\])+?)\s*\]|\[k:((?:[^\[\]]|\[[^\]]*\])+?)\s*\]|\[i:((?:[^\[\]]|\[[^\]]*\])+?)\s*\]|\[g:((?:[^\[\]]|\[[^\]]*\])+?)\s*\]/g
    const elements: React.ReactNode[] = []
    let last = 0
    let m: RegExpExecArray | null
    while ((m = tokenRe.exec(value)) !== null) {
      for (let gi = 1; gi <= 6; gi++) { if (m[gi]) m[gi] = m[gi].trim() }
      if (m.index > last) elements.push(...renderMarkdownInline(value.slice(last, m.index), `${keyPrefix}-t${last}`))
      if (m[1]) {
        // 변형 스킬 fallback: "돈키호테:1" → "돈키호테:1:1" 시도
        const e = skillLookup[m[1]] ?? skillLookup[`${m[1]}:1`]
        elements.push(e
          ? <SkillChip key={`${keyPrefix}-s${m.index}`} entry={e} />
          : <FallbackChip key={`${keyPrefix}-s${m.index}`} type="s" tokenKey={m[1]} />
        )
      } else if (m[2]) {
        const e = passiveLookup[m[2]]
        elements.push(e
          ? <PassiveChip key={`${keyPrefix}-p${m.index}`} entry={e} />
          : <FallbackChip key={`${keyPrefix}-p${m.index}`} type="p" tokenKey={m[2]} />
        )
      } else if (m[3]) {
        const e = egoLookup[m[3]]
        elements.push(e
          ? <EgoChip key={`${keyPrefix}-e${m.index}`} entry={e} />
          : <FallbackChip key={`${keyPrefix}-e${m.index}`} type="e" tokenKey={m[3]} />
        )
      } else if (m[4]) {
        elements.push(<KeywordChip key={`${keyPrefix}-k${m.index}`} keyword={m[4]} />)
      } else if (m[5]) {
        const e = identityLookup[m[5]]
        elements.push(e
          ? <IdentityChip key={`${keyPrefix}-i${m.index}`} entry={e} />
          : <FallbackChip key={`${keyPrefix}-i${m.index}`} type="i" tokenKey={m[5]} />
        )
      } else if (m[6]) {
        const e = egoGiftLookup[m[6]]
        elements.push(e
          ? <EgoGiftChip key={`${keyPrefix}-g${m.index}`} entry={e} />
          : <FallbackChip key={`${keyPrefix}-g${m.index}`} type="g" tokenKey={m[6]} />
        )
      }
      last = m.index + m[0].length
    }
    if (last < value.length) elements.push(...renderMarkdownInline(value.slice(last), `${keyPrefix}-tend`))
    return elements
  }

  const renderBlockPlaceholder = (value: string, keyPrefix: string): React.ReactNode | null => {
    const skillMatch = value.trim().match(/^\{\{skill:([^:{}]+):(\d+)(?::(\d+))?\}\}$/)
    if (skillMatch) {
      const tokenKey = skillMatch[3]
        ? `${skillMatch[1]}:${skillMatch[2]}:${skillMatch[3]}`
        : `${skillMatch[1]}:${skillMatch[2]}`
      const entry = resolveSkillFrameEntry(skillLookup, tokenKey)
      return entry
        ? (
            <SkillFramePlaceholder
              key={`${keyPrefix}-skill`}
              entry={entry}
              lang={locale}
              allowedKeywords={allowedKeywords}
            />
          )
        : <FallbackChip key={`${keyPrefix}-skill-fallback`} type="s" tokenKey={tokenKey} />
    }

    const passiveMatch = value.trim().match(/^\{\{passive:([^{}]+)\}\}$/)
    if (passiveMatch) {
      const tokenKey = passiveMatch[1].trim()
      const entry = passiveLookup[tokenKey]
      return entry
        ? <PassiveBlockPlaceholder key={`${keyPrefix}-passive`} entry={entry} />
        : <FallbackChip key={`${keyPrefix}-passive-fallback`} type="p" tokenKey={tokenKey} />
    }

    const giftMatch = value.trim().match(/^\{\{gift:([^{}:]+)(?::(true))?\}\}$/)
    if (giftMatch) {
      const tokenKey = giftMatch[1].trim()
      const entry = egoGiftLookup[tokenKey]
      const showCondition = giftMatch[2] === 'true' && Boolean(entry?.activation_condition)
      return entry
        ? <GiftCardPlaceholder key={`${keyPrefix}-gift`} entry={entry} conditionStatus={showCondition ? egoGiftConditionLookup[tokenKey] : null} />
        : <FallbackChip key={`${keyPrefix}-gift-fallback`} type="g" tokenKey={tokenKey} />
    }

    return null
  }

  const renderMixedBlockLine = (value: string, keyPrefix: string): React.ReactNode[] | null => {
    const blockTokenRe = /\{\{skill:[^{}\n]+:\d+(?::\d+)?\}\}|\{\{passive:[^{}\n]+\}\}|\{\{gift:[^{}\n:]+(?::true)?\}\}/g
    const nodes: React.ReactNode[] = []
    let last = 0
    let found = false
    let m: RegExpExecArray | null
    while ((m = blockTokenRe.exec(value)) !== null) {
      found = true
      const before = value.slice(last, m.index).trim()
      if (before) {
        nodes.push(
          <p key={`${keyPrefix}-p${last}`} style={{ margin: '0.375rem 0' }}>
            {renderInline(before, `${keyPrefix}-p${last}`)}
          </p>
        )
      }
      const placeholder = renderBlockPlaceholder(m[0], `${keyPrefix}-b${m.index}`)
      if (placeholder) nodes.push(placeholder)
      last = m.index + m[0].length
    }
    const rest = value.slice(last).trim()
    if (rest) {
      nodes.push(
        <p key={`${keyPrefix}-pend`} style={{ margin: '0.375rem 0' }}>
          {renderInline(rest, `${keyPrefix}-pend`)}
        </p>
      )
    }
    return found ? nodes : null
  }

  const elements = renderInline(text, 'inline')
  if (inline) return <span style={{ fontSize: '0.875rem', color: '#b0a898', lineHeight: 1.65 }}>{elements}</span>

  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const blocks: React.ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const image = parseNoteImage(line)
    if (image) {
      blocks.push(<figure key={`image-${i}`} className="my-4"><Image src={image.src} alt={image.alt} width={1920} height={1920} unoptimized className="h-auto max-h-[70dvh] w-auto max-w-full rounded-sm object-contain" /></figure>)
      i += 1
      continue
    }
    if (!line.trim()) {
      blocks.push(<div key={`blank-${i}`} style={{ height: '0.5rem' }} />)
      i += 1
      continue
    }

    const blockPlaceholder = renderBlockPlaceholder(line, `block-${i}`)
    if (blockPlaceholder) {
      blocks.push(blockPlaceholder)
      i += 1
      continue
    }

    const mixedBlockLine = renderMixedBlockLine(line, `mixed-${i}`)
    if (mixedBlockLine) {
      blocks.push(...mixedBlockLine)
      i += 1
      continue
    }

    const heading = line.match(/^(#{1,2})\s+(.+)$/)
    if (heading) {
      const level = heading[1].length
      const Tag = (level === 1 ? 'h3' : 'h4') as 'h3' | 'h4'
      blocks.push(
        <Tag
          key={`h-${i}`}
          style={{
            color: '#d9d0bf',
            fontSize: level === 1 ? '1rem' : '0.9375rem',
            fontWeight: 700,
            lineHeight: 1.45,
            margin: i === 0 ? '0 0 0.5rem' : '1rem 0 0.5rem',
            textWrap: 'balance',
          }}
        >
          {renderInline(heading[2], `h-${i}`)}
        </Tag>
      )
      i += 1
      continue
    }

    const quote = line.match(/^>\s?(.*)$/)
    if (quote) {
      const quoteLines: string[] = [quote[1]]
      let j = i + 1
      while (j < lines.length) {
        const next = lines[j].match(/^>\s?(.*)$/)
        if (!next) break
        quoteLines.push(next[1])
        j += 1
      }
      blocks.push(
        <blockquote
          key={`q-${i}`}
          style={{
            borderLeft: '0.1875rem solid rgba(200,144,10,0.45)',
            padding: '0.5rem 0 0.5rem 0.875rem',
            margin: '0.75rem 0',
            color: '#c8c0b0',
            background: 'rgba(200,144,10,0.055)',
            borderRadius: '0 0.375rem 0.375rem 0',
          }}
        >
          {quoteLines.map((quoteLine, idx) => (
            <div key={idx}>{renderInline(quoteLine, `q-${i}-${idx}`)}</div>
          ))}
        </blockquote>
      )
      i = j
      continue
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/)
    const ordered = line.match(/^\s*\d+\.\s+(.+)$/)
    if (unordered || ordered) {
      const orderedList = Boolean(ordered)
      const items: string[] = [unordered?.[1] ?? ordered?.[1] ?? '']
      let j = i + 1
      while (j < lines.length) {
        const item = orderedList
          ? lines[j].match(/^\s*\d+\.\s+(.+)$/)
          : lines[j].match(/^\s*[-*]\s+(.+)$/)
        if (!item) break
        items.push(item[1])
        j += 1
      }
      const ListTag = (orderedList ? 'ol' : 'ul') as 'ol' | 'ul'
      blocks.push(
        <ListTag
          key={`list-${i}`}
          style={{
            margin: '0.5rem 0 0.75rem 1.25rem',
            padding: 0,
            listStyleType: orderedList ? 'decimal' : 'disc',
          }}
        >
          {items.map((item, idx) => (
            <li key={idx} style={{ paddingLeft: '0.25rem', margin: '0.25rem 0' }}>
              {renderInline(item, `list-${i}-${idx}`)}
            </li>
          ))}
        </ListTag>
      )
      i = j
      continue
    }

    const paragraphLines = [line.trim()]
    let j = i + 1
    while (j < lines.length) {
      const next = lines[j]
      if (!next.trim() || parseNoteImage(next)) break
      if (
        next.match(/^(#{1,2})\s+(.+)$/) ||
        next.match(/^>\s?(.*)$/) ||
        next.match(/^\s*[-*]\s+(.+)$/) ||
        next.match(/^\s*\d+\.\s+(.+)$/) ||
        renderBlockPlaceholder(next, `probe-${j}`)
      ) {
        break
      }
      paragraphLines.push(next.trim())
      j += 1
    }
    blocks.push(
      <p key={`p-${i}`} style={{ margin: '0.375rem 0' }}>
        {renderInline(paragraphLines.join(' '), `p-${i}`)}
      </p>
    )
    i = j
  }

  return (
    <div
      style={{
        fontSize: textScale === 'comfortable' ? '1rem' : '0.9375rem',
        color: '#b0a898',
        lineHeight: textScale === 'comfortable' ? 1.8 : 1.85,
        maxWidth: '72ch',
      }}
    >
      {blocks}
    </div>
  )
}
