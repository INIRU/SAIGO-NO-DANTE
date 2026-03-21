'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Heart, Eye, MessageCircle } from 'lucide-react'
import { STORAGE_BASE } from '@/lib/data/sinners'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { NoteRenderer } from '@/components/decks/NoteChips'

// 덱 테마를 정의하는 핵심 상태이상 키워드만 표시
import { THEME_KEYWORDS, normalizeThemeKeyword } from '@/lib/constants/keywords'
const THEME_KW_SET = new Set<string>(THEME_KEYWORDS)

type IdentityPreview = {
  slot_order: number
  gacksung: boolean
  identities: {
    id: string
    sinner_id: string
    folder_name: string | null
    game_id: string | null
    keywords: string[] | null
  } | null
}

export type DeckSummary = {
  id: string
  title: string
  description: string | null
  tags: string[]
  content_type?: string
  vote_count: number
  view_count: number
  comment_count?: number
  created_at: string
  username?: string
  deck_identities?: IdentityPreview[]
  deck_egos?: { ego_id: string }[]
}

const CONTENT_TYPE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  '스토리':   { bg: 'rgba(80,120,200,0.15)', color: '#6090d0', border: 'rgba(80,120,200,0.35)' },
  '거던5층':  { bg: 'rgba(60,160,100,0.15)', color: '#50b878', border: 'rgba(60,160,100,0.35)' },
  '거던10층': { bg: 'rgba(60,160,100,0.15)', color: '#50b878', border: 'rgba(60,160,100,0.35)' },
  '거던15층': { bg: 'rgba(60,160,100,0.15)', color: '#50b878', border: 'rgba(60,160,100,0.35)' },
  '거굴철':   { bg: 'rgba(200,70,70,0.15)', color: '#d06060', border: 'rgba(200,70,70,0.35)' },
}

interface DeckCardProps {
  deck: DeckSummary
  onTagClick?: (tag: string) => void
}

function identityPortraitUrl(id: IdentityPreview, gacksung?: boolean): string {
  const { identities: id_ } = id
  if (!id_?.game_id || !id_?.folder_name) return ''
  const prefix = (gacksung ?? id.gacksung) ? 'gacksung' : 'normal'
  const folder = encodeURIComponent(id_.folder_name)
  return `${STORAGE_BASE}/sinners/${id_.sinner_id}/identities/${folder}/${id_.game_id}_${prefix}_info.webp`
}

function PortraitSlot({ slot }: { slot: IdentityPreview }) {
  const [fallback, setFallback] = useState(false)
  const [failed, setFailed] = useState(false)
  const url = identityPortraitUrl(slot, fallback ? false : undefined)
  if (!url || failed) {
    const initial = (slot.identities?.sinner_id || '?')[0].toUpperCase()
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg, #1e1810, #0d0a06)' }}>
        <span className="font-serif font-bold" style={{ fontSize: '1.25rem', color: '#c8900a80' }}>{initial}</span>
      </div>
    )
  }

  return (
    <>
      <Image
        src={url}
        alt=""
        fill
        sizes="80px"
        quality={25}
        style={{ objectFit: 'cover', objectPosition: 'center top' }}
        onError={() => {
          if (slot.gacksung && !fallback) setFallback(true)
          else setFailed(true)
        }}
      />
      {slot.gacksung && (
        <div style={{ position: 'absolute', top: 2, right: 2, width: 4, height: 4, borderRadius: '50%', background: 'var(--gold)', zIndex: 1 }} />
      )}
    </>
  )
}

export default function DeckCard({ deck, onTagClick }: DeckCardProps) {
  const { getIconUrl } = useKeywordData()
  const date = new Date(deck.created_at).toLocaleDateString('ko-KR', {
    month: 'short', day: 'numeric',
  })

  // 슬롯 순서로 정렬, slot_order=99는 뒤로
  const sorted = [...(deck.deck_identities ?? [])].sort((a, b) => {
    if (a.slot_order === 99 && b.slot_order !== 99) return 1
    if (b.slot_order === 99 && a.slot_order !== 99) return -1
    return a.slot_order - b.slot_order
  })

  // 12칸 고정 (빈 슬롯 포함)
  const slots = Array.from({ length: 12 }, (_, i) => sorted[i] ?? null)

  const showContentType = !!(deck.content_type && deck.content_type !== '없음' && CONTENT_TYPE_COLORS[deck.content_type])

  // 편성(slot_order<99) 인격 기준 키워드 비율 집계
  const topKeywords = (() => {
    const formed = sorted.filter(s => s && s.slot_order < 99 && s.identities)
    const total = formed.length
    if (total === 0) return []

    const freq: Record<string, number> = {}
    for (const slot of formed) {
      for (const kw of slot!.identities!.keywords ?? []) {
        const normalized = normalizeThemeKeyword(kw)
        if (THEME_KW_SET.has(normalized)) {
          freq[normalized] = (freq[normalized] ?? 0) + 1
        }
      }
    }

    // 1명: 해당 인격 키워드 표시, 2명+: 40% 이상 & 최소 2명 공유
    const minCount = total <= 1 ? 1 : Math.max(2, Math.ceil(total * 0.4))
    return Object.entries(freq)
      .filter(([, n]) => n >= minCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([kw]) => kw)
  })()

  return (
    <div
      className="group relative flex flex-col transition-all duration-200"
      style={{
        background: '#120e09',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--gold-dim)'
        ;(e.currentTarget as HTMLElement).style.background = '#1a1510'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
        ;(e.currentTarget as HTMLElement).style.background = '#120e09'
      }}
    >
      {/* 상단 골드 라인 */}
      <div
        className="h-px w-0 group-hover:w-full transition-all duration-300"
        style={{ background: 'linear-gradient(to right, var(--gold-dim), transparent)' }}
      />

      <Link href={`/decks/${deck.id}`} className="flex flex-col flex-1">
        {/* 인격 포트레이트 그리드 (2×6) */}
        <div className="grid grid-cols-6" style={{ borderBottom: '1px solid rgba(58,42,21,0.4)' }}>
          {slots.map((slot, i) => (
            <div
              key={i}
              className="relative overflow-hidden"
              style={{ aspectRatio: '3/4', background: '#0a0806' }}
            >
              {slot ? (
                <PortraitSlot slot={slot} />
              ) : (
                <div style={{ width: '100%', height: '100%', background: 'repeating-linear-gradient(45deg, #0d0b08 0px, #0d0b08 2px, #0a0806 2px, #0a0806 6px)' }} />
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-col flex-1 p-4">
        {/* 제목 */}
        <h3
          className="font-serif font-bold text-sm mb-1.5 leading-snug line-clamp-1 transition-colors duration-200 group-hover:text-yellow-300"
          style={{ color: '#e8e4d8' }}
        >
          {deck.title}
        </h3>

        {/* 설명 */}
        {deck.description ? (
          <div className="text-xs mb-2 flex-1" style={{ color: '#6a6480', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', paddingTop: 2, paddingBottom: 2, minWidth: 0, maxWidth: '100%' }}>
            <NoteRenderer text={deck.description} skillLookup={{}} passiveLookup={{}} egoLookup={{}} inline />
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {/* 콘텐츠 유형 + 자동 키워드 (한 줄) */}
        {(showContentType || topKeywords.length > 0) && (
          <div className="flex flex-wrap gap-1 mb-2">
            {showContentType && (
              <span
                className="flex items-center px-2 py-0.5 rounded"
                style={{
                  background: CONTENT_TYPE_COLORS[deck.content_type!].bg,
                  color: CONTENT_TYPE_COLORS[deck.content_type!].color,
                  border: `1px solid ${CONTENT_TYPE_COLORS[deck.content_type!].border}`,
                  fontFamily: 'var(--font-heading)',
                  fontSize: '0.75rem',
                  letterSpacing: '0.03em',
                }}
              >
                {deck.content_type}
              </span>
            )}
            {topKeywords.map(kw => {
              const iconUrl = getIconUrl(kw)
              return (
                <span
                  key={kw}
                  className="flex items-center gap-1 px-2 py-0.5 rounded"
                  style={{
                    background: 'rgba(136,88,40,0.15)',
                    color: '#c8a450',
                    border: '1px solid rgba(136,88,40,0.3)',
                    fontFamily: 'var(--font-heading)',
                    fontSize: '0.75rem',
                    letterSpacing: '0.03em',
                  }}
                >
                  {iconUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={iconUrl} alt="" width={11} height={11} style={{ flexShrink: 0 }} />
                  )}
                  {kw}
                </span>
              )
            })}
          </div>
        )}

        {/* 태그 */}
        {deck.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {deck.tags.slice(0, 3).map(tag => (
              <button
                key={tag}
                onClick={e => {
                  e.preventDefault()
                  onTagClick?.(tag)
                }}
                className="text-xs px-2 py-0.5 rounded-full transition-all duration-150 hover:opacity-80"
                style={{
                  background: 'rgba(200,144,10,0.08)',
                  color: 'var(--gold-dim)',
                  border: '1px solid rgba(200,144,10,0.18)',
                  fontFamily: 'var(--font-body)',
                  cursor: onTagClick ? 'pointer' : 'default',
                }}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}

        {/* 하단 메타 */}
        <div
          className="flex items-center justify-between pt-2.5"
          style={{ borderTop: '1px solid rgba(58,42,21,0.5)' }}
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs" style={{ color: '#8a80a0' }}>
              <Heart size={10} fill="currentColor" stroke="none" />
              {deck.vote_count}
            </span>
            <span className="flex items-center gap-1 text-xs" style={{ color: '#8a80a0' }}>
              <Eye size={10} />
              {deck.view_count}
            </span>
            {(deck.comment_count ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-xs" style={{ color: '#8a80a0' }}>
                <MessageCircle size={10} />
                {deck.comment_count}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs" style={{ color: '#8a80a0' }}>
            {deck.username && (
              <>
                <span style={{ color: '#6a6080' }}>{deck.username}</span>
                <span style={{ color: '#8a8095', fontFamily: 'sans-serif' }}>·</span>
              </>
            )}
            <span>{date}</span>
          </div>
        </div>
        </div>
      </Link>
    </div>
  )
}
