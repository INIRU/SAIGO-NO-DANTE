'use client'

import { notePlainText } from '@/lib/notes/blocks'

import { getIdentityPortraitUrl } from '@/lib/utils/images'
import { memo, useEffect, useMemo, useState } from 'react'
import { Link } from '@/lib/i18n/navigation'
import Image from 'next/image'
import { Heart, Eye, MessageCircle } from 'lucide-react'
import { DIFFICULTY_CONFIG, type Difficulty } from '@/lib/planner/types'
import { DEFAULT_AVATAR_URL } from '@/lib/constants/game'
import { useKeywordData, useKeywords } from '@/components/providers/KeywordProvider'
import { useLocale, useTranslations } from 'next-intl'
import { localizeDeckKeyword } from '@/components/decks/decks-types'
import type { SupportedLang } from '@/lib/i18n'
import { normalizePlannerListKeywords } from '@/lib/planner/stripPlanForList'

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
  /** Pre-computed server-side: identity name_kr values for search */
  identity_names?: string[]
}

const DIFFICULTY_STYLE: Record<Difficulty, { bg: string; color: string; border: string }> = {
  normal:  { bg: 'rgba(74,152,104,0.12)',  color: '#4a9868', border: 'rgba(74,152,104,0.3)' },
  hard:    { bg: 'rgba(200,144,10,0.12)',  color: '#e8b030', border: 'rgba(200,144,10,0.3)' },
  overlap: { bg: 'rgba(72,152,176,0.12)',  color: '#48b0c0', border: 'rgba(72,152,176,0.3)' },
  extreme: { bg: 'rgba(200,48,48,0.12)',   color: '#e05050', border: 'rgba(200,48,48,0.3)' },
}

type CardDifficultyBadge = {
  key: Difficulty | 'normal-hard'
  styleKey: Difficulty
  labelKeys: Difficulty[]
}

function getCardDifficultyBadge(plan: PlanSummary): CardDifficultyBadge {
  const summary = plan.difficulty_summary?.filter(segment => Object.values(segment.counts).some(count => (count ?? 0) > 0)) ?? []
  if (summary.length === 0) return { key: plan.difficulty, styleKey: plan.difficulty, labelKeys: [plan.difficulty] }

  if (summary.some(segment => segment.key === '11-15' && (segment.counts.extreme ?? 0) > 0)) {
    return { key: 'extreme', styleKey: 'extreme', labelKeys: ['extreme'] }
  }

  if (summary.some(segment => segment.key === '6-10' && (segment.counts.overlap ?? 0) > 0)) {
    return { key: 'overlap', styleKey: 'overlap', labelKeys: ['overlap'] }
  }

  let hasNormal = false
  let hasHard = false

  for (const segment of summary) {
    if (segment.key === '1-5') {
      hasNormal ||= (segment.counts.normal ?? 0) > 0
      hasHard ||= (segment.counts.hard ?? 0) > 0
    }
  }

  if (hasNormal && hasHard) return { key: 'normal-hard', styleKey: 'hard', labelKeys: ['normal', 'hard'] }
  if (hasNormal) return { key: 'normal', styleKey: 'normal', labelKeys: ['normal'] }
  if (hasHard) return { key: 'hard', styleKey: 'hard', labelKeys: ['hard'] }

  return { key: plan.difficulty, styleKey: plan.difficulty, labelKeys: [plan.difficulty] }
}

function PlannerRelativeTime({
  date,
  localized = false,
  style,
}: {
  date: string
  localized?: boolean
  style?: React.CSSProperties
}) {
  const t = useTranslations('planner.communityBoard.relativeTime')
  const [text, setText] = useState<string | null>(null)

  useEffect(() => {
    const format = () => {
      const diff = Date.now() - new Date(date).getTime()
      const mins = Math.floor(diff / 60000)
      if (mins < 1) return localized ? t('now') : '방금 전'
      if (mins < 60) return localized ? t('minutes', { count: mins }) : `${mins}분 전`
      const hours = Math.floor(mins / 60)
      if (hours < 24) return localized ? t('hours', { count: hours }) : `${hours}시간 전`
      const days = Math.floor(hours / 24)
      if (days < 30) return localized ? t('days', { count: days }) : `${days}일 전`
      const months = Math.floor(days / 30)
      if (months < 12) return localized ? t('months', { count: months }) : `${months}달 전`
      const years = Math.floor(months / 12)
      return localized ? t('years', { count: years }) : `${years}년 전`
    }

    setText(format())
    const id = setInterval(() => setText(format()), 60_000)
    return () => clearInterval(id)
  }, [date, localized, t])

  return <span style={style}>{text}</span>
}


function PortraitSlot({ slot }: { slot: PlanSummary['deck'] extends (infer T)[] | null ? T : never }) {
  const [failed, setFailed] = useState(false)
  if (!slot?.game_id || !slot?.folder_name || !slot?.sinner_id || failed) {
    return <div className="w-full h-full" style={{ background: 'repeating-linear-gradient(45deg, #0d0b08 0px, #0d0b08 2px, #0a0806 2px, #0a0806 6px)' }} />
  }
  const url = getIdentityPortraitUrl(slot.sinner_id, slot.folder_name, slot.game_id, false)
  return (
    <Image src={url} alt="" fill sizes="(max-width: 768px) 17vw, 8vw" quality={60}
      style={{ objectFit: 'cover', objectPosition: 'center top' }}
      onError={() => setFailed(true)} />
  )
}

function PlanCard({
  plan,
  localized = false,
  onKeywordToggle,
}: {
  plan: PlanSummary
  localized?: boolean
  onKeywordToggle?: (keyword: string) => void
}) {
  const { getIconUrl } = useKeywordData()
  const keywords = useKeywords()
  const locale = useLocale() as SupportedLang
  const t = useTranslations('planner.communityBoard.card')
  const difficultyT = useTranslations('planner.communityBoard.difficulty')
  const diffStyle = DIFFICULTY_STYLE[plan.difficulty]
  const username = plan.profiles?.username ?? (localized ? t('anonymous') : '익명')
  const avatarUrl = plan.profiles?.avatar_url ?? DEFAULT_AVATAR_URL

  const slots = useMemo(() => {
    const deckArr = Array.isArray(plan.deck) ? plan.deck : []
    const sorted = [...deckArr].sort((a, b) => {
      const ao = a.slot_order ?? 99, bo = b.slot_order ?? 99
      if (ao === 99 && bo !== 99) return 1
      if (bo === 99 && ao !== 99) return -1
      return ao - bo
    })
    return Array.from({ length: 12 }, (_, i) => sorted[i] ?? null)
  }, [plan.deck])

  // 자동 키워드 태그: API에서 서버사이드로 계산된 값 우선 사용
  const topKeywords = normalizePlannerListKeywords((plan.selected_keywords && plan.selected_keywords.length > 0)
    ? plan.selected_keywords
    : (plan.theme_keywords ?? []))
  const difficultyBadge = getCardDifficultyBadge(plan)
  const visibleKeywords = topKeywords.slice(0, 3)
  const hiddenKeywordCount = Math.max(0, topKeywords.length - visibleKeywords.length)

  return (
    <article
      className="group relative flex flex-col h-full overflow-hidden"
      style={{ background: '#1a1510', border: '1px solid #222', borderRadius: '0.375rem' }}
    >
      <div className="h-px w-0 transition-[width] duration-300 group-hover:w-full" style={{ background: `linear-gradient(to right, ${diffStyle.color}, transparent)` }} />

      <Link href={`/planner/community/${plan.id}`} className="flex flex-col flex-1">
        {/* 인격 포트레이트 6x2 그리드 */}
        <div className="grid grid-cols-6" style={{ borderBottom: '1px solid rgba(58,42,21,0.4)' }}>
          {slots.map((slot, i) => (
            <div key={i} className="relative overflow-hidden" style={{ aspectRatio: '3/4', background: '#0a0806' }}>
              {slot ? <PortraitSlot slot={slot} /> : (
                <div className="w-full h-full" style={{ background: 'repeating-linear-gradient(45deg, #0d0b08 0px, #0d0b08 2px, #0a0806 2px, #0a0806 6px)' }} />
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-col flex-1 p-4">
          {/* 제목 */}
          <h3 className="font-[family-name:var(--font-paperlogy)] font-bold tracking-[-0.015em] mb-1.5 leading-snug line-clamp-1 transition-colors duration-200 group-hover:text-yellow-300"
            style={{ fontSize: '0.9375rem', color: '#e8dcc8' }}>
            {plan.title}
          </h3>

          {/* 설명 */}
          {plan.description ? (
            <p className="mb-2 line-clamp-2 flex-1" style={{ fontSize: '0.6875rem', color: '#555', lineHeight: 1.6, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {notePlainText(plan.description)}
            </p>
          ) : <div className="flex-1" />}

          {/* 하단: 작성자 + 통계 */}
          <div className="flex items-center justify-between pt-2 mt-auto" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="flex items-center gap-1.5">
              <div className="relative overflow-hidden rounded-full" style={{ width: '1.125rem', height: '1.125rem', flexShrink: 0, border: '1px solid rgba(200,144,10,0.2)' }}>
                <Image src={avatarUrl} alt={username} width={18} height={18} style={{ width: '1.125rem', height: '1.125rem', objectFit: 'cover' }} />
              </div>
              <span style={{ fontSize: '0.6875rem', color: '#8a7a60' }}>{username}</span>
              <PlannerRelativeTime localized={localized} date={plan.created_at} style={{ fontSize: '0.5625rem', color: '#333' }} />
            </div>
            <div className="flex items-center gap-2.5">
              <span className="flex items-center gap-0.5" style={{ fontSize: '0.625rem', color: plan.vote_count > 0 ? '#c8900a' : '#333' }}>
                <Heart style={{ width: '0.625rem', height: '0.625rem' }} fill={plan.vote_count > 0 ? 'currentColor' : 'none'} /> {plan.vote_count}
              </span>
              <span className="flex items-center gap-0.5" style={{ fontSize: '0.625rem', color: '#333' }}>
                <Eye style={{ width: '0.625rem', height: '0.625rem' }} /> {plan.view_count}
              </span>
              {plan.comment_count > 0 && (
                <span className="flex items-center gap-0.5" style={{ fontSize: '0.625rem', color: '#555' }}>
                  <MessageCircle style={{ width: '0.625rem', height: '0.625rem' }} /> {plan.comment_count}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
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
              {difficultyBadge.labelKeys.map(difficulty => localized ? difficultyT(difficulty) : DIFFICULTY_CONFIG[difficulty].label).join('/')}
          </span>
        </div>
        {visibleKeywords.length > 0 && (
          <div className="flex min-w-0 max-w-[58%] items-center justify-end gap-1 overflow-hidden">
            {visibleKeywords.map(kw => {
              const iconUrl = getIconUrl(kw)
              const label = localized ? localizeDeckKeyword(kw, keywords[kw], locale) : kw
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
                  className="flex min-h-8 min-w-0 items-center gap-1 transition-colors hover:border-[#8a6010] hover:text-[#c8900a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c8900a]"
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
              <span style={{ flexShrink: 0, fontSize: '0.875rem', color: '#5d4d38' }}>
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
