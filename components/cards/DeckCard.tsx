'use client'

import { notePreviewText } from '@/lib/notes/blocks'

import FormationThumbnail from '@/components/cards/FormationThumbnail'
import { memo, useMemo } from 'react'
import { Link } from '@/lib/i18n/navigation'
import IntentLink from '@/components/ui/IntentLink'
import Image from 'next/image'
import { Heart, Eye, MessageCircle } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useKeywordData, useKeywords } from '@/components/providers/KeywordProvider'
import type { NotePreviewComponent } from '@/components/cards/note-preview'
import { CONTENT_TYPE_COLORS } from '@/lib/constants/deck-tokens'
import { contentTypeMessageKey, localizeDeckKeyword } from '@/lib/decks/decks-types'
import type { SupportedLang } from '@/lib/i18n'
import { guestAuthorName } from '@/lib/guest/copy'
import { computeDeckMainKeywordsFromSlots, normalizeDeckMainKeyword } from '@/lib/decks/keyword-rules'
import OwnedBadge, { useMissingSinners } from '@/components/cards/OwnedBadge'
import { DEFAULT_AVATAR_URL } from '@/lib/constants/game'

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

type DeckLanguage = 'ko' | 'en' | 'ja'

export type DeckSummary = {
  id: string
  user_id?: string
  title: string
  description: string | null
  tags: string[]
  content_type?: string | null
  lang?: DeckLanguage
  vote_count: number
  view_count: number
  comment_count?: number
  created_at: string
  username?: string
  avatar_url?: string | null
  /** False when the author keeps their profile page private: the name is shown without a link to it. */
  profile_public?: boolean
  guest_tag?: string | null
  main_keywords?: string[] | null
  deck_identities?: IdentityPreview[]
  deck_egos?: { ego_id: string; grade?: string | null }[]
}

interface DeckCardProps {
  deck: DeckSummary
  onTagClick?: (tag: string) => void
  /** 설명 한 줄을 그리는 컴포넌트. 없으면 글만 보인다. */
  NotePreview?: NotePreviewComponent
}

function DeckCard({ deck, onTagClick, NotePreview }: DeckCardProps) {
  const locale = useLocale() as SupportedLang
  const t = useTranslations('decks')
  const preview = deck.description ? notePreviewText(deck.description) : ''
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

  const thumbnailSlots = useMemo(() => sorted.map(slot => ({ ...slot.identities, slot_order: slot.slot_order, gacksung: slot.gacksung })), [sorted])
  const missing = useMissingSinners(useMemo(() => sorted.map(slot => ({ id: slot.identities?.id, sinnerId: slot.identities?.sinner_id, slot_order: slot.slot_order })), [sorted]))

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
    <div className="board-card group relative flex flex-col h-full overflow-hidden">
      <div className="relative flex flex-col flex-1">
        <IntentLink href={`/decks/${deck.id}`} locale={locale} aria-label={deck.title} className="absolute inset-0 z-[1]" />
        <FormationThumbnail slots={thumbnailSlots} missing={missing} />
        <OwnedBadge missing={missing} />

        <div className="flex flex-col flex-1" style={{ padding: '0.875rem' }}>
          {/* 제목 */}
          <h3
            className="mb-1.5 leading-snug line-clamp-1"
            style={{
              fontFamily: 'var(--font-paperlogy)',
              fontWeight: 700,
              letterSpacing: '-0.015em',
              fontSize: '1rem',
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
                fontSize: '0.8125rem',
                color: 'var(--text-secondary)',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                minWidth: 0,
                maxWidth: '100%',
              }}
            >
              {NotePreview ? <NotePreview text={preview} /> : preview}
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
                    fontSize: '0.75rem',
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
                      fontSize: '0.75rem',
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
                    fontSize: '0.75rem',
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
                  className="relative z-10"
                  onClick={e => {
                    e.preventDefault()
                    onTagClick?.(tag)
                  }}
                  style={{
                    fontSize: '0.75rem',
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
            className="flex flex-wrap items-center justify-between gap-2"
            style={{ borderTop: '1px solid rgba(58,42,21,0.5)', paddingTop: '0.625rem' }}
          >
            {/* 왼쪽: 작성자 · 날짜 */}
            <div
              className="flex min-w-0 items-center"
              style={{ gap: '0.25rem', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}
            >
              {(deck.username || deck.guest_tag) && (
                <>
                  {/* The author's avatar, as the plan cards show it. */}
                  <span className="relative shrink-0 overflow-hidden rounded-full" style={{ width: '1.125rem', height: '1.125rem', marginRight: '0.125rem', border: '1px solid rgba(200,144,10,0.2)' }}>
                    <Image src={deck.avatar_url || DEFAULT_AVATAR_URL} alt="" width={18} height={18} style={{ width: '1.125rem', height: '1.125rem', objectFit: 'cover' }} />
                  </span>
                  {deck.username && deck.user_id && deck.profile_public !== false
                    ? <Link href={`/users/${deck.user_id}`} className="hit-target relative z-10 hover:text-[var(--gold)] hover:underline">{deck.username}</Link>
                    : <span>{deck.username ?? guestAuthorName(deck.guest_tag, locale)}</span>}
                  <span style={{ color: 'var(--text-tertiary)' }}>·</span>
                </>
              )}
              <span style={{ color: 'var(--text-tertiary)' }}>{date}</span>
            </div>

            {/* 오른쪽: 투표 · 조회 · 댓글 */}
            <div
              className="ml-auto flex items-center"
              style={{ gap: '0.625rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}
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
      </div>
    </div>
  )
}

export default memo(DeckCard)
