'use client'

import { notePreviewText } from '@/lib/notes/blocks'
import { NoteRenderer, useNoteGiftLookup } from '@/components/decks/NoteChips'

import FormationThumbnail from '@/components/ui/FormationThumbnail'
import RelativeTime from '@/components/ui/RelativeTime'
import { memo } from 'react'
import IntentLink from '@/components/ui/IntentLink'
import Image from 'next/image'
import { Heart, Eye, MessageCircle } from 'lucide-react'
import type { Difficulty } from '@/lib/planner/types'
import { DEFAULT_AVATAR_URL } from '@/lib/constants/game'
import { useKeywordData, useKeywords } from '@/components/providers/KeywordProvider'
import { useLocale, useTranslations } from 'next-intl'
import { localizeDeckKeyword } from '@/components/decks/decks-types'
import type { SupportedLang } from '@/lib/i18n'
import { normalizePlannerListKeywords, planDifficultyBadge } from '@/lib/planner/stripPlanForList'
import { guestAuthorName } from '@/lib/guest/copy'
import OwnedBadge, { useMissingSinners } from '@/features/tools/components/OwnedBadge'

export type PlanSummary = {
  id: string
  title: string
  description: string | null
  difficulty: Difficulty
  deck: { identity_id?: string; sinner_id?: string; name_kr?: string; game_id?: string | null; folder_name?: string | null; slot_order?: number }[] | null
  egos: { ego_id?: string }[] | null
  tags: string[] | null
  vote_count: number
  view_count: number
  comment_count: number
  created_at: string
  lang?: 'ko' | 'en' | 'ja' | null
  profiles: { username: string | null; avatar_url: string | null } | null
  guest_tag?: string | null
  /** Pre-computed server-side: theme keywords extracted from deck */
  theme_keywords?: string[]
  /** Pre-computed server-side: theme + combat keywords used by board filters */
  filter_keywords?: string[]
  /** Planner-selected main keywords stored through tags for schema compatibility */
  selected_keywords?: string[]
  /** Compact server-side floor difficulty summary for list cards */
  difficulty_summary?: {
    key: '1-5' | '6-10' | '11-15'
    start: number
    end: number
    counts: Partial<Record<Difficulty, number>>
  }[]
  /** Pre-computed server-side: gifts the plan aims for (floor picks and final gifts) and the theme packs it routes through */
  gift_ids?: number[]
  theme_ids?: number[]
  /** Pre-computed server-side: identity name_kr values for search */
  identity_names?: string[]
}

const DIFFICULTY_STYLE: Record<Difficulty, { bg: string; color: string; border: string }> = {
  normal:  { bg: 'rgba(74,152,104,0.12)',  color: '#4a9868', border: 'rgba(74,152,104,0.3)' },
  hard:    { bg: 'rgba(200,144,10,0.12)',  color: '#e8b030', border: 'rgba(200,144,10,0.3)' },
  overlap: { bg: 'rgba(72,152,176,0.12)',  color: '#48b0c0', border: 'rgba(72,152,176,0.3)' },
  extreme: { bg: 'rgba(200,48,48,0.12)',   color: '#ec6a5e', border: 'rgba(200,48,48,0.3)' },
}

function PlanCard({
  plan,
  onKeywordToggle,
}: {
  plan: PlanSummary
  onKeywordToggle?: (keyword: string) => void
}) {
  const { getIconUrl } = useKeywordData()
  const keywords = useKeywords()
  const locale = useLocale() as SupportedLang
  const t = useTranslations('planner.communityBoard.card')
  const difficultyT = useTranslations('planner.communityBoard.difficulty')
  const missing = useMissingSinners(Array.isArray(plan.deck) ? plan.deck.map(slot => ({ id: slot.identity_id, sinnerId: slot.sinner_id, slot_order: slot.slot_order })) : [])
  const diffStyle = DIFFICULTY_STYLE[plan.difficulty]
  const username = plan.profiles?.username ?? guestAuthorName(plan.guest_tag, locale) ?? t('anonymous')
  const avatarUrl = plan.profiles?.avatar_url ?? DEFAULT_AVATAR_URL
  const preview = plan.description ? notePreviewText(plan.description) : ''
  const giftLookup = useNoteGiftLookup(preview)

  // 자동 키워드 태그: API에서 서버사이드로 계산된 값 우선 사용
  const topKeywords = normalizePlannerListKeywords((plan.selected_keywords && plan.selected_keywords.length > 0)
    ? plan.selected_keywords
    : (plan.theme_keywords ?? []))
  const difficultyBadge = planDifficultyBadge(plan.difficulty, plan.difficulty_summary)
  const visibleKeywords = topKeywords.slice(0, 3)
  const hiddenKeywordCount = Math.max(0, topKeywords.length - visibleKeywords.length)

  return (
    <article
      className="board-card group relative flex flex-col h-full overflow-hidden"
    >
      <IntentLink href={`/planner/community/${plan.id}`} className="flex flex-col flex-1">
        <FormationThumbnail slots={Array.isArray(plan.deck) ? plan.deck : []} missing={missing} />
        <OwnedBadge missing={missing} />

        <div className="flex flex-col flex-1 p-4">
          {/* 제목 */}
          <h3 className="font-[family-name:var(--font-paperlogy)] font-bold tracking-[-0.015em] mb-1.5 leading-snug line-clamp-1 transition-colors duration-200 group-hover:text-[var(--gold-light)]"
            style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
            {plan.title}
          </h3>

          {/* 설명 */}
          {plan.description ? (
            <p className="mb-3 line-clamp-2 flex-1" style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <NoteRenderer text={preview} egoGiftLookup={giftLookup} giftLabel inline />
            </p>
          ) : <div className="flex-1" />}

          {/* 하단: 작성자 + 통계 */}
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="flex min-w-0 items-center gap-1.5">
              <div className="relative overflow-hidden rounded-full" style={{ width: '1.125rem', height: '1.125rem', flexShrink: 0, border: '1px solid rgba(200,144,10,0.2)' }}>
                <Image src={avatarUrl} alt={username} width={18} height={18} style={{ width: '1.125rem', height: '1.125rem', objectFit: 'cover' }} />
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{username}</span>
              <RelativeTime date={plan.created_at} style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }} />
            </div>
            <div className="ml-auto flex items-center gap-2.5">
              <span className="flex items-center gap-0.5" style={{ fontSize: '0.75rem', color: plan.vote_count > 0 ? 'var(--gold)' : 'var(--text-muted)' }}>
                <Heart style={{ width: '0.625rem', height: '0.625rem' }} fill={plan.vote_count > 0 ? 'currentColor' : 'none'} /> {plan.vote_count}
              </span>
              <span className="flex items-center gap-0.5" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <Eye style={{ width: '0.625rem', height: '0.625rem' }} /> {plan.view_count}
              </span>
              {plan.comment_count > 0 && (
                <span className="flex items-center gap-0.5" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <MessageCircle style={{ width: '0.625rem', height: '0.625rem' }} /> {plan.comment_count}
                </span>
              )}
            </div>
          </div>
        </div>
      </IntentLink>
      <div
        data-planner-card-meta="true"
        className="flex items-center gap-1.5 px-4 pb-3"
        style={{ minHeight: '2.75rem' }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          <span key={difficultyBadge.key} style={{
              display: 'inline-flex', alignItems: 'center', flexShrink: 0,
              padding: '0.125rem 0.4375rem',
              background: DIFFICULTY_STYLE[difficultyBadge.styleKey].bg, color: DIFFICULTY_STYLE[difficultyBadge.styleKey].color, border: `1px solid ${DIFFICULTY_STYLE[difficultyBadge.styleKey].border}`,
              borderRadius: '0.25rem', fontFamily: 'var(--font-body)',
              fontSize: '0.8125rem', fontWeight: 700,
            }}>
              {difficultyBadge.labelKeys.map(difficulty => difficultyT(difficulty)).join('/')}
          </span>
        </div>
        {visibleKeywords.length > 0 && (
          <div className="flex min-w-0 max-w-[58%] items-center justify-end gap-1 overflow-hidden">
            {visibleKeywords.map(kw => {
              const iconUrl = getIconUrl(kw)
              const label = localizeDeckKeyword(kw, keywords[kw], locale)
              const commonStyle = {
                padding: '0.125rem 0.25rem',
                background: 'transparent',
                border: '1px solid transparent',
                borderRadius: '0.25rem',
                fontSize: '0.875rem',
                color: '#9f8b68',
              } satisfies React.CSSProperties
              const content = (
                <>
                  {iconUrl && <Image src={iconUrl} alt="" width={14} height={14} style={{ width: '0.875rem', height: '0.875rem', flexShrink: 0 }} />}
                  <span className="truncate">{label}</span>
                </>
              )
              return onKeywordToggle ? (
                <button
                  key={kw}
                  type="button"
                  onClick={() => onKeywordToggle(kw)}
                  className="flex min-h-8 min-w-0 items-center gap-1 transition-colors hover:border-[var(--gold-dim)] hover:text-[var(--gold)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
                  style={commonStyle}
                  aria-label={t('toggleKeyword', { keyword: label })}
                >
                  {content}
                </button>
              ) : (
                <span key={kw} className="flex min-h-8 min-w-0 items-center gap-1" style={commonStyle}>
                  {content}
                </span>
              )
            })}
            {hiddenKeywordCount > 0 && (
              <span style={{ flexShrink: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                +{hiddenKeywordCount}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  )
}

export default memo(PlanCard)
