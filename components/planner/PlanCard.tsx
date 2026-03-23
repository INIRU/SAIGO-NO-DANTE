'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Heart, Eye, MessageCircle } from 'lucide-react'
import RelativeTime from '@/components/ui/RelativeTime'
import { DIFFICULTY_CONFIG, type Difficulty } from '@/lib/planner/types'
import { STORAGE_BASE, DEFAULT_AVATAR_URL } from '@/lib/constants/game'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { THEME_KEYWORDS, normalizeThemeKeyword } from '@/lib/constants/keywords'

const THEME_KW_SET = new Set<string>(THEME_KEYWORDS)

export type PlanSummary = {
  id: string
  title: string
  description: string | null
  difficulty: Difficulty
  deck: { identity_id?: string; sinner_id?: string; name_kr?: string; game_id?: string | null; folder_name?: string | null; keywords?: string[]; slot_order?: number }[] | null
  egos: { ego_id?: string; sinner_id?: string; name_kr?: string; grade?: string }[] | null
  tags: string[] | null
  vote_count: number
  view_count: number
  comment_count: number
  created_at: string
  profiles: { username: string | null; avatar_url: string | null } | null
}

const DIFFICULTY_STYLE: Record<Difficulty, { bg: string; color: string; border: string }> = {
  normal:  { bg: 'rgba(74,152,104,0.12)',  color: '#4a9868', border: 'rgba(74,152,104,0.3)' },
  hard:    { bg: 'rgba(200,144,10,0.12)',  color: '#e8b030', border: 'rgba(200,144,10,0.3)' },
  overlap: { bg: 'rgba(72,152,176,0.12)',  color: '#48b0c0', border: 'rgba(72,152,176,0.3)' },
  extreme: { bg: 'rgba(200,48,48,0.12)',   color: '#e05050', border: 'rgba(200,48,48,0.3)' },
}


function PortraitSlot({ slot }: { slot: PlanSummary['deck'] extends (infer T)[] | null ? T : never }) {
  const [failed, setFailed] = useState(false)
  if (!slot?.game_id || !slot?.folder_name || !slot?.sinner_id || failed) {
    return <div className="w-full h-full" style={{ background: 'repeating-linear-gradient(45deg, #0d0b08 0px, #0d0b08 2px, #0a0806 2px, #0a0806 6px)' }} />
  }
  const folder = encodeURIComponent(slot.folder_name)
  const url = `${STORAGE_BASE}/sinners/${slot.sinner_id}/identities/${folder}/${slot.game_id}_normal_info.webp`
  return (
    <Image src={url} alt="" fill sizes="80px" quality={25}
      style={{ objectFit: 'cover', objectPosition: 'center top' }}
      onError={() => setFailed(true)} />
  )
}

export default function PlanCard({ plan }: { plan: PlanSummary }) {
  const { getIconUrl } = useKeywordData()
  const diffConfig = DIFFICULTY_CONFIG[plan.difficulty]
  const diffStyle = DIFFICULTY_STYLE[plan.difficulty]
  const username = plan.profiles?.username ?? '익명'
  const avatarUrl = plan.profiles?.avatar_url ?? DEFAULT_AVATAR_URL

  const deckArr = Array.isArray(plan.deck) ? plan.deck : []
  const sorted = [...deckArr].sort((a, b) => {
    const ao = a.slot_order ?? 99, bo = b.slot_order ?? 99
    if (ao === 99 && bo !== 99) return 1
    if (bo === 99 && ao !== 99) return -1
    return ao - bo
  })
  const slots = Array.from({ length: 12 }, (_, i) => sorted[i] ?? null)

  // 자동 키워드 태그 (편성 인격 기준)
  const topKeywords = (() => {
    const formed = sorted.filter(s => s && (s.slot_order ?? 99) < 99 && s.keywords)
    const total = formed.length
    if (total === 0) return []
    const freq: Record<string, number> = {}
    for (const slot of formed) {
      const normalized = new Set((slot!.keywords ?? []).map(normalizeThemeKeyword))
      for (const kw of normalized) {
        if (THEME_KW_SET.has(kw)) freq[kw] = (freq[kw] ?? 0) + 1
      }
    }
    const minCount = total <= 1 ? 1 : Math.max(2, Math.ceil(total * 0.4))
    return Object.entries(freq)
      .filter(([, n]) => n >= minCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([kw]) => kw)
  })()

  return (
    <div
      className="group relative flex flex-col transition-all duration-200 overflow-hidden"
      style={{ background: '#1a1510', border: '1px solid #222', borderRadius: '0.375rem' }}
    >
      <div className="h-px w-0 group-hover:w-full transition-all duration-300" style={{ background: `linear-gradient(to right, ${diffStyle.color}, transparent)` }} />

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
          <h3 className="font-serif font-light mb-1.5 leading-snug line-clamp-1 transition-colors duration-200 group-hover:text-yellow-300"
            style={{ fontSize: '0.9375rem', color: '#e8dcc8' }}>
            {plan.title}
          </h3>

          {/* 설명 */}
          {plan.description ? (
            <p className="mb-2 line-clamp-2 flex-1" style={{ fontSize: '0.6875rem', color: '#555', lineHeight: 1.6, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {plan.description}
            </p>
          ) : <div className="flex-1" />}

          {/* 난이도 + 자동 키워드 태그 */}
          <div className="flex flex-wrap gap-1 mb-2.5">
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '0.125rem 0.5rem',
              background: diffStyle.bg, color: diffStyle.color, border: `1px solid ${diffStyle.border}`,
              borderRadius: '2rem', fontFamily: 'var(--font-heading)',
              fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.05em',
            }}>
              {diffConfig.label}
            </span>
            {topKeywords.map(kw => {
              const iconUrl = getIconUrl(kw)
              return (
                <span key={kw} className="flex items-center gap-0.5" style={{
                  padding: '0.125rem 0.375rem',
                  background: 'rgba(200,144,10,0.08)', border: '1px solid rgba(200,144,10,0.18)',
                  borderRadius: '2rem', fontSize: '0.5625rem', color: '#c8900a',
                }}>
                  {iconUrl && <Image src={iconUrl} alt="" width={10} height={10} style={{ width: '0.625rem', height: '0.625rem' }} />}
                  {kw}
                </span>
              )
            })}
          </div>

          {/* 하단: 작성자 + 통계 */}
          <div className="flex items-center justify-between pt-2 mt-auto" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="flex items-center gap-1.5">
              <div className="relative overflow-hidden rounded-full" style={{ width: '1.125rem', height: '1.125rem', flexShrink: 0, border: '1px solid rgba(200,144,10,0.2)' }}>
                <Image src={avatarUrl} alt={username} width={18} height={18} style={{ width: '1.125rem', height: '1.125rem', objectFit: 'cover' }} />
              </div>
              <span style={{ fontSize: '0.6875rem', color: '#8a7a60' }}>{username}</span>
              <RelativeTime date={plan.created_at} style={{ fontSize: '0.5625rem', color: '#333' }} />
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
    </div>
  )
}
