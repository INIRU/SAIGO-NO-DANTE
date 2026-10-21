'use client'

import { useMemo } from 'react'
import Image from 'next/image'
import { Eye, Heart, MessageCircle } from 'lucide-react'
import { DEFAULT_AVATAR_URL } from '@/lib/constants/game'
import { useLocale, useTranslations } from 'next-intl'
import { useKeywordData, useKeywords } from '@/components/providers/KeywordProvider'
import { contentTypeMessageKey, localizeDeckKeyword } from '@/components/decks/decks-types'
import { CONTENT_TYPE_COLORS } from '@/lib/constants/deck-tokens'
import { normalizeDeckMainKeyword } from '@/lib/decks/keyword-rules'
import { normalizePlannerListKeywords, planDifficultyBadge } from '@/lib/planner/stripPlanForList'
import { guestAuthorName } from '@/lib/guest/copy'
import { noteSummaryText } from '@/lib/notes/blocks'
import type { DiscoveryKind } from '@/lib/discovery/recommend'
import type { SupportedLang } from '@/lib/i18n/types'

/** A board post (deck or plan) as the discovery feeds send it. */
export type RowPost = Record<string, any> & { id: string; title: string }

const DIFFICULTY_STYLE = {
  normal: { bg: 'rgba(74,152,104,0.12)', color: '#4a9868', border: 'rgba(74,152,104,0.3)' },
  hard: { bg: 'rgba(200,144,10,0.12)', color: '#e8b030', border: 'rgba(200,144,10,0.3)' },
  overlap: { bg: 'rgba(72,152,176,0.12)', color: '#48b0c0', border: 'rgba(72,152,176,0.3)' },
  extreme: { bg: 'rgba(200,48,48,0.12)', color: '#e05050', border: 'rgba(200,48,48,0.3)' },
} as const

const chipStyle = { display: 'inline-flex', flexShrink: 0, whiteSpace: 'nowrap', alignItems: 'center', gap: '0.25rem', padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-heading)', fontSize: '0.75rem', letterSpacing: '0.03em' } as const

/** The formation slots of a post, in the shape `formationThumbnail` and `FormationThumbnail` read. */
export function postSlots(kind: DiscoveryKind, post: RowPost) {
  return kind === 'deck'
    ? ((post.deck_identities ?? []) as { slot_order: number; identities: object | null }[]).map(slot => ({ ...slot.identities, slot_order: slot.slot_order }))
    : (Array.isArray(post.deck) ? post.deck : [])
}

/** The content type or difficulty and the main keywords of a post, in the chip style of its card. */
export function PostChips({ kind, post, max = 2, className = '', nowrap = false }: { kind: DiscoveryKind; post: RowPost; max?: number; className?: string; /** One line: what does not fit is cut off. */ nowrap?: boolean }) {
  const locale = useLocale() as SupportedLang
  const t = useTranslations('decks')
  const tPlan = useTranslations('planner.communityBoard')
  const { getIconUrl } = useKeywordData()
  const keywords = useKeywords()
  const tags = useMemo(() => {
    const raw = kind === 'deck'
      ? ((post.main_keywords ?? []) as string[]).flatMap(keyword => normalizeDeckMainKeyword(keyword) ?? [])
      : normalizePlannerListKeywords(post.selected_keywords?.length ? post.selected_keywords : post.theme_keywords ?? [])
    return raw.slice(0, max)
  }, [kind, max, post.main_keywords, post.selected_keywords, post.theme_keywords])
  const contentType = kind === 'deck' && post.content_type && CONTENT_TYPE_COLORS[post.content_type] ? post.content_type as string : null
  const badge = kind === 'planner' ? planDifficultyBadge(post.difficulty, post.difficulty_summary) : null
  if (!contentType && !badge && tags.length === 0) return null
  return (
    <div className={`flex items-center gap-1 ${nowrap ? 'h-6 flex-wrap overflow-hidden' : 'flex-wrap'} ${className}`}>
      {contentType && (
        <span style={{ ...chipStyle, background: CONTENT_TYPE_COLORS[contentType].bg, color: CONTENT_TYPE_COLORS[contentType].color, border: `1px solid ${CONTENT_TYPE_COLORS[contentType].border}` }}>
          {t(`contentTypes.${contentTypeMessageKey(contentType)}`)}
        </span>
      )}
      {badge && (
        <span style={{ ...chipStyle, fontFamily: 'var(--font-body)', fontWeight: 700, background: DIFFICULTY_STYLE[badge.styleKey].bg, color: DIFFICULTY_STYLE[badge.styleKey].color, border: `1px solid ${DIFFICULTY_STYLE[badge.styleKey].border}` }}>
          {badge.labelKeys.map(difficulty => tPlan(`difficulty.${difficulty}`)).join('/')}
        </span>
      )}
      {tags.map(keyword => {
        const iconUrl = getIconUrl(keyword)
        return (
          <span key={keyword} style={{ ...chipStyle, background: 'rgba(136,88,40,0.15)', color: '#c8a450', border: '1px solid rgba(136,88,40,0.3)' }}>
            {iconUrl && <Image src={iconUrl} alt="" width={11} height={11} style={{ width: '0.6875rem', height: '0.6875rem', flexShrink: 0 }} />}
            {localizeDeckKeyword(keyword, keywords[keyword], locale)}
          </span>
        )
      })}
    </div>
  )
}


/** Who wrote a post, as its card shows it. */
export function postAuthor(kind: DiscoveryKind, post: RowPost, locale: SupportedLang, anonymous: string): string {
  return kind === 'deck'
    ? post.username ?? guestAuthorName(post.guest_tag, locale) ?? ''
    : post.profiles?.username ?? guestAuthorName(post.guest_tag, locale) ?? anonymous
}

/** Likes and views in the small muted meta style of the cards. */
export function PostCounts({ post, className = '' }: { post: RowPost; className?: string }) {
  return (
    <span className={`flex shrink-0 items-center gap-2.5 text-[0.8125rem] tabular-nums text-[var(--text-tertiary)] ${className}`}>
      <span className="flex items-center gap-1"><Heart style={{ width: '0.6875rem', height: '0.6875rem' }} fill="currentColor" stroke="none" />{post.vote_count ?? 0}</span>
      <span className="flex items-center gap-1"><Eye style={{ width: '0.6875rem', height: '0.6875rem' }} />{post.view_count ?? 0}</span>
      {(post.comment_count ?? 0) > 0 && <span data-count="comments" className="flex items-center gap-1"><MessageCircle style={{ width: '0.6875rem', height: '0.6875rem' }} />{post.comment_count}</span>}
    </span>
  )
}

/** The memo's first words in one line under the title; an empty line of the same height keeps the cards even. */
export function PostSummary({ post }: { post: RowPost }) {
  const text = useMemo(() => typeof post.description === 'string' ? noteSummaryText(post.description) : '', [post.description])
  return <p className="h-5 truncate text-[0.8125rem] leading-5 text-[var(--text-secondary)]">{text}</p>
}

/** The author's avatar and name, as the cards show them: the avatar (or the default one) before the name. */
export function AuthorLine({ kind, post, locale, anonymous, className = '' }: { kind: DiscoveryKind; post: RowPost; locale: SupportedLang; anonymous: string; className?: string }) {
  const name = postAuthor(kind, post, locale, anonymous)
  if (!name) return null
  const avatar = (kind === 'deck' ? post.avatar_url : post.profiles?.avatar_url) || DEFAULT_AVATAR_URL
  return (
    <span className={`flex min-w-0 items-center gap-1.5 ${className}`}>
      <span className="relative shrink-0 overflow-hidden rounded-full" style={{ width: '1.125rem', height: '1.125rem', border: '1px solid rgba(200,144,10,0.2)' }}>
        <Image src={avatar} alt="" width={18} height={18} style={{ width: '1.125rem', height: '1.125rem', objectFit: 'cover' }} />
      </span>
      <span className="min-w-0 truncate text-[0.8125rem] text-[var(--text-tertiary)]">{name}</span>
    </span>
  )
}
