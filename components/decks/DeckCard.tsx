'use client'

import Link from 'next/link'
import { Heart, Eye, MessageCircle } from 'lucide-react'
import { STORAGE_BASE, getKeywordIconUrl } from '@/lib/data/sinners'
import { NoteRenderer } from '@/components/decks/NoteChips'

// 덱 테마를 정의하는 핵심 상태이상 키워드만 표시
const THEME_KEYWORDS = new Set(['침잠', '출혈', '파열', '화상', '진동', '충전', '호흡'])

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
  vote_count: number
  view_count: number
  comment_count?: number
  created_at: string
  username?: string
  deck_identities?: IdentityPreview[]
  deck_egos?: { ego_id: string }[]
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

export default function DeckCard({ deck, onTagClick }: DeckCardProps) {
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

  // 덱 전체 키워드 빈도 집계
  // 편성 기준: 같은 상태이상 키워드를 가진 인격이 5명 이상일 때 표시
  const topKeywords = (() => {
    const freq: Record<string, number> = {}
    for (const slot of sorted) {
      for (const kw of slot?.identities?.keywords ?? []) {
        if (THEME_KEYWORDS.has(kw)) {
          freq[kw] = (freq[kw] ?? 0) + 1
        }
      }
    }
    return Object.entries(freq)
      .filter(([, n]) => n >= 5)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
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
          {slots.map((slot, i) => {
            const url = slot ? identityPortraitUrl(slot) : ''
            return (
              <div
                key={i}
                className="relative overflow-hidden"
                style={{ aspectRatio: '3/4', background: '#0a0806' }}
              >
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt=""
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: 'center top',
                      display: 'block',
                    }}
                    loading="lazy"
                    onError={e => {
                      // gacksung 이미지 없으면 normal로 폴백
                      if (slot?.gacksung) {
                        e.currentTarget.src = identityPortraitUrl(slot, false)
                      }
                    }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: 'repeating-linear-gradient(45deg, #0d0b08 0px, #0d0b08 2px, #0a0806 2px, #0a0806 6px)' }} />
                )}
                {/* 각성 표시 */}
                {slot?.gacksung && (
                  <div style={{ position: 'absolute', top: 2, right: 2, width: 4, height: 4, borderRadius: '50%', background: 'var(--gold)' }} />
                )}
              </div>
            )
          })}
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
          <div className="text-xs mb-2 flex-1" style={{ color: '#4a4460', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', paddingTop: 2, paddingBottom: 2, minWidth: 0, maxWidth: '100%' }}>
            <NoteRenderer text={deck.description} skillLookup={{}} passiveLookup={{}} egoLookup={{}} inline />
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {/* 자동 키워드 */}
        {topKeywords.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {topKeywords.map(kw => {
              const iconUrl = getKeywordIconUrl(kw)
              return (
                <span
                  key={kw}
                  className="flex items-center gap-1 px-2 py-0.5 rounded"
                  style={{
                    background: 'rgba(136,88,40,0.15)',
                    color: '#c8a450',
                    border: '1px solid rgba(136,88,40,0.3)',
                    fontFamily: 'var(--font-heading)',
                    fontSize: '10px',
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
            <span className="flex items-center gap-1 text-xs" style={{ color: '#3a3050' }}>
              <Heart size={10} fill="currentColor" stroke="none" />
              {deck.vote_count}
            </span>
            <span className="flex items-center gap-1 text-xs" style={{ color: '#3a3050' }}>
              <Eye size={10} />
              {deck.view_count}
            </span>
            {(deck.comment_count ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-xs" style={{ color: '#3a3050' }}>
                <MessageCircle size={10} />
                {deck.comment_count}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs" style={{ color: '#3a3050' }}>
            {deck.username && (
              <>
                <span style={{ color: '#4a4060' }}>{deck.username}</span>
                <span style={{ color: '#2a2035', fontFamily: 'sans-serif' }}>·</span>
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
