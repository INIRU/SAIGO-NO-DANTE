'use client'

import { memo, useMemo, useState } from 'react'
import { Link } from '@/lib/i18n/navigation'
import Image from 'next/image'
import { Heart, Eye, MessageCircle } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { STORAGE_BASE } from '@/lib/data/sinners'
import { useKeywordData, useKeywords } from '@/components/providers/KeywordProvider'
import { NoteRenderer } from '@/components/decks/NoteChips'
import { CONTENT_TYPE_COLORS } from '@/lib/constants/deck-tokens'
import { contentTypeMessageKey, localizeDeckKeyword } from '@/components/decks/decks-types'
import type { SupportedLang } from '@/lib/i18n'
import { computeDeckMainKeywordsFromSlots, normalizeDeckMainKeyword } from '@/lib/decks/keyword-rules'
const EMPTY_NOTE_LOOKUP: Record<string, never> = Object.freeze({})

type IdentityPreview = {
  slot_order: number
  gacksung: boolean
  identities: {
    id: string
    sinner_id: string
    folder_name: string | null
    game_id: string | null
    keywords: string[] | null
    skill_keyword_list?: string[] | null
    name?: string | null
    name_kr: string | null
    name_en?: string | null
    name_jp?: string | null
  } | null
}

export type DeckLanguage = 'ko' | 'en' | 'ja'

export type DeckSummary = {
  id: string
  title: string
  description: string | null
  tags: string[]
  content_type?: string
  lang?: DeckLanguage
  vote_count: number
  view_count: number
  comment_count?: number
  created_at: string
  username?: string
  main_keywords?: string[] | null
  deck_identities?: IdentityPreview[]
  deck_egos?: { ego_id: string; grade?: string | null }[]
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
      <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'linear-gradient(160deg, #1e1810, #0d0a06)' }}>
        <span style={{ fontSize: '1.25rem', color: '#c8900a80', fontFamily: 'var(--font-heading)' }}>{initial}</span>
      </div>
    )
  }

  return (
    <>
      <Image
        src={url}
        alt=""
        fill
        sizes="(max-width: 640px) 17vw, (max-width: 1024px) 8vw, 6vw"
        quality={60}
        style={{ objectFit: 'cover', objectPosition: 'center top' }}
        onError={() => {
          if (slot.gacksung && !fallback) setFallback(true)
          else setFailed(true)
        }}
      />
      {slot.gacksung && (
        <div
          className="absolute top-0.5 right-0.5 z-[1]"
          style={{ width: '0.3125rem', height: '0.3125rem', borderRadius: '50%', background: 'var(--gold)' }}
        />
      )}
    </>
  )
}

function DeckCard({ deck, onTagClick }: DeckCardProps) {
  const locale = useLocale() as SupportedLang
  const t = useTranslations('decks')
  const { getIconUrl } = useKeywordData()
  const keywords = useKeywords()
  const date = useMemo(() => {
    const d = deck.created_at.slice(0, 10) // "YYYY-MM-DD"
    const [, mm, dd] = d.split('-')
    return t('card.date', { month: Number.parseInt(mm, 10), day: Number.parseInt(dd, 10) })
  }, [deck.created_at, t])

  // 슬롯 순서로 정렬, slot_order=99는 뒤로
  const sorted = useMemo(() => [...(deck.deck_identities ?? [])].sort((a, b) => {
    if (a.slot_order === 99 && b.slot_order !== 99) return 1
    if (b.slot_order === 99 && a.slot_order !== 99) return -1
    return a.slot_order - b.slot_order
  }), [deck.deck_identities])

  // 12칸 고정 (빈 슬롯 포함)
  const slots = useMemo(() => Array.from({ length: 12 }, (_, i) => sorted[i] ?? null), [sorted])

  const showContentType = !!(deck.content_type && deck.content_type !== '없음' && CONTENT_TYPE_COLORS[deck.content_type])

  // Persisted main keywords are canonical. Fallback only covers legacy rows where the column is absent/empty.
  const topKeywords = useMemo(() => {
    const persisted = (deck.main_keywords ?? [])
      .map(normalizeDeckMainKeyword)
      .filter((keyword): keyword is string => Boolean(keyword))
    if (persisted.length > 0) return persisted

    return computeDeckMainKeywordsFromSlots(sorted.filter((slot): slot is IdentityPreview => Boolean(slot)))
  }, [deck.main_keywords, sorted])

  // 키워드 최대 3개 + 넘치면 "+N" 뱃지
  const visibleKeywords = useMemo(() => topKeywords.slice(0, 3), [topKeywords])
  const overflowCount = topKeywords.length - visibleKeywords.length

  return (
    <div
      className="group relative flex flex-col h-full overflow-hidden"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget
        el.style.borderColor = 'var(--border-hover)'
        el.style.boxShadow = 'var(--shadow-glow-hover)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget
        el.style.borderColor = 'var(--border)'
        el.style.boxShadow = 'none'
      }}
    >
      {/* 상단 골드 라인 — 호버 시 펼쳐짐 */}
      <div
        className="h-px w-0 group-hover:w-full"
        style={{
          background: 'linear-gradient(to right, var(--gold-dim), transparent)',
          transition: 'width 0.3s ease',
        }}
      />

      <Link href={`/decks/${deck.id}`} locale={locale} className="flex flex-col flex-1">
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
                <div
                  className="w-full h-full"
                  style={{ background: 'repeating-linear-gradient(45deg, #0d0b08 0px, #0d0b08 2px, #0a0806 2px, #0a0806 6px)' }}
                />
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-col flex-1" style={{ padding: '0.875rem' }}>
          {/* 제목 */}
          <h3
            className="mb-1.5 leading-snug line-clamp-1"
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-primary)',
              transition: 'color 0.2s ease',
            }}
          >
            {deck.title}
          </h3>

          {/* 설명 */}
          {deck.description ? (
            <div
              className="flex-1 mb-2"
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-tertiary)',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                minWidth: 0,
                maxWidth: '100%',
              }}
            >
              <NoteRenderer
                text={deck.description}
                skillLookup={EMPTY_NOTE_LOOKUP}
                passiveLookup={EMPTY_NOTE_LOOKUP}
                egoLookup={EMPTY_NOTE_LOOKUP}
                identityLookup={EMPTY_NOTE_LOOKUP}
                egoGiftLookup={EMPTY_NOTE_LOOKUP}
                inline
              />
            </div>
          ) : (
            <div className="flex-1" />
          )}

          {/* 콘텐츠 유형 + 자동 키워드 (한 줄) */}
          {(showContentType || visibleKeywords.length > 0) && (
            <div className="flex flex-wrap items-center mb-2" style={{ gap: '0.25rem' }}>
              {showContentType && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0.125rem 0.5rem',
                    background: CONTENT_TYPE_COLORS[deck.content_type!].bg,
                    color: CONTENT_TYPE_COLORS[deck.content_type!].color,
                    border: `1px solid ${CONTENT_TYPE_COLORS[deck.content_type!].border}`,
                    borderRadius: 'var(--radius-sm)',
                    fontFamily: 'var(--font-heading)',
                    fontSize: 'var(--text-xs)',
                    letterSpacing: '0.03em',
                  }}
                >
                  {t(`contentTypes.${contentTypeMessageKey(deck.content_type)}`)}
                </span>
              )}
              {visibleKeywords.map(kw => {
                const iconUrl = getIconUrl(kw)
                return (
                  <span
                    key={kw}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.125rem 0.5rem',
                      background: 'rgba(136,88,40,0.15)',
                      color: '#c8a450',
                      border: '1px solid rgba(136,88,40,0.3)',
                      borderRadius: 'var(--radius-sm)',
                      fontFamily: 'var(--font-heading)',
                      fontSize: 'var(--text-xs)',
                      letterSpacing: '0.03em',
                    }}
                  >
                    {iconUrl && (
                      <Image
                        src={iconUrl}
                        alt=""
                        width={11}
                        height={11}
                        style={{ width: '0.6875rem', height: '0.6875rem', flexShrink: 0 }}
                      />
                    )}
                    {localizeDeckKeyword(kw, keywords[kw], locale)}
                  </span>
                )
              })}
              {overflowCount > 0 && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0.125rem 0.375rem',
                    background: 'rgba(136,88,40,0.08)',
                    color: 'var(--text-muted)',
                    border: '1px solid rgba(136,88,40,0.2)',
                    borderRadius: 'var(--radius-sm)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-xs)',
                  }}
                >
                  +{overflowCount}
                </span>
              )}
            </div>
          )}

          {/* 태그 */}
          {deck.tags.length > 0 && (
            <div className="flex flex-wrap mb-3" style={{ gap: '0.25rem' }}>
              {deck.tags.slice(0, 3).map(tag => (
                <button
                  key={tag}
                  onClick={e => {
                    e.preventDefault()
                    onTagClick?.(tag)
                  }}
                  style={{
                    fontSize: 'var(--text-xs)',
                    padding: '0.125rem 0.5rem',
                    background: 'rgba(200,144,10,0.08)',
                    color: 'var(--gold-dim)',
                    border: '1px solid rgba(200,144,10,0.18)',
                    borderRadius: 'var(--radius-full)',
                    fontFamily: 'var(--font-body)',
                    cursor: onTagClick ? 'pointer' : 'default',
                    transition: 'opacity 0.15s ease',
                  }}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}

          {/* 하단 메타 — 왼쪽: user · date / 오른쪽: ♡ N · 👁 N */}
          <div
            className="flex items-center justify-between"
            style={{ borderTop: '1px solid rgba(58,42,21,0.5)', paddingTop: '0.625rem' }}
          >
            {/* 왼쪽: 작성자 · 날짜 */}
            <div
              className="flex items-center"
              style={{ gap: '0.25rem', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}
            >
              {deck.username && (
                <>
                  <span style={{ color: 'var(--text-muted)' }}>{deck.username}</span>
                  <span style={{ color: 'var(--text-tertiary)' }}>·</span>
                </>
              )}
              <span style={{ color: 'var(--text-tertiary)' }}>{date}</span>
            </div>

            {/* 오른쪽: 투표 · 조회 · 댓글 */}
            <div
              className="flex items-center"
              style={{ gap: '0.625rem', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}
            >
              <span className="flex items-center" style={{ gap: '0.25rem' }}>
                <Heart style={{ width: '0.625rem', height: '0.625rem' }} fill="currentColor" stroke="none" />
                {deck.vote_count}
              </span>
              <span className="flex items-center" style={{ gap: '0.25rem' }}>
                <Eye style={{ width: '0.625rem', height: '0.625rem' }} />
                {deck.view_count}
              </span>
              {(deck.comment_count ?? 0) > 0 && (
                <span className="flex items-center" style={{ gap: '0.25rem' }}>
                  <MessageCircle style={{ width: '0.625rem', height: '0.625rem' }} />
                  {deck.comment_count}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </div>
  )
}

export default memo(DeckCard)
