'use client'

import { notePreviewText } from '@/lib/notes/blocks'
import type { NotePreviewComponent } from '@/components/cards/note-preview'

import FormationThumbnail from '@/components/cards/FormationThumbnail'
import RelativeTime from '@/components/ui/RelativeTime'
import { memo } from 'react'
import IntentLink from '@/components/ui/IntentLink'
import Image from 'next/image'
import { Heart, Eye, MessageCircle } from 'lucide-react'
import { DEFAULT_AVATAR_URL } from '@/lib/constants/game'
import { useLocale, useTranslations } from 'next-intl'
import type { SupportedLang } from '@/lib/i18n'
import { normalizePlannerListKeywords, type PlanSummary } from '@/lib/planner/strip-plan-for-list'
import PlanDifficulty from '@/components/cards/PlanDifficulty'
import CardKeywords from '@/components/cards/CardKeywords'
import { guestAuthorName } from '@/lib/guest/copy'
import OwnedBadge, { useMissingSinners } from '@/components/cards/OwnedBadge'

export type { PlanSummary }

function PlanCard({
  plan,
  NotePreview,
}: {
  plan: PlanSummary
  /** 설명 한 줄을 그리는 컴포넌트. 없으면 글만 보인다. */
  NotePreview?: NotePreviewComponent
}) {
  const locale = useLocale() as SupportedLang
  const t = useTranslations('planner.communityBoard.card')
  const missing = useMissingSinners(Array.isArray(plan.deck) ? plan.deck.map(slot => ({ id: slot.identity_id, sinnerId: slot.sinner_id, slot_order: slot.slot_order })) : [])
  const username = plan.profiles?.username ?? guestAuthorName(plan.guest_tag, locale) ?? t('anonymous')
  const avatarUrl = plan.profiles?.avatar_url ?? DEFAULT_AVATAR_URL
  const preview = plan.description ? notePreviewText(plan.description) : ''

  // 자동 키워드 태그: API에서 서버사이드로 계산된 값 우선 사용
  const topKeywords = normalizePlannerListKeywords((plan.selected_keywords && plan.selected_keywords.length > 0)
    ? plan.selected_keywords
    : (plan.theme_keywords ?? []))

  return (
    <article
      className="board-card group relative flex flex-col h-full overflow-hidden"
    >
      <IntentLink href={`/planner/community/${plan.id}`} className="flex flex-col flex-1">
        <FormationThumbnail slots={Array.isArray(plan.deck) ? plan.deck : []} missing={missing} />
        <OwnedBadge missing={missing} />

        <div className="flex flex-col flex-1 p-4">
          <PlanDifficulty difficulty={plan.difficulty} summary={plan.difficulty_summary} className="mb-1.5" />
          {/* 제목 */}
          <h3 className="font-[family-name:var(--font-paperlogy)] font-bold tracking-[-0.015em] mb-1.5 leading-snug line-clamp-1 transition-colors duration-200 group-hover:text-[var(--gold-light)]"
            style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
            {plan.title}
          </h3>

          {/* 설명 */}
          {plan.description ? (
            <p className="mb-3 line-clamp-2 flex-1" style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {NotePreview ? <NotePreview text={preview} /> : preview}
            </p>
          ) : <div className="flex-1" />}

          {topKeywords.length > 0 && <div className="mb-3 flex h-6 items-center gap-x-2.5 overflow-hidden"><CardKeywords keywords={topKeywords} /></div>}

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
    </article>
  )
}

export default memo(PlanCard)
