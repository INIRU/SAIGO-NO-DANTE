'use client'

import type { CSSProperties } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import type { GiftData, PlannerAction } from '@/lib/planner/types'
import { getKeywordIconUrl, getKeywordSlug } from '@/lib/planner/gift-plan-constants'
import { groupStartGifts } from '@/features/planner/lib/gift-plan-selection'
import GiftCard from '@/features/mirror-dungeon/components/GiftCard'

/** 시작 탭의 키워드별 격자. 키워드를 위에 두고 그 기프트를 아래로 쌓아, 열 개 키워드가 넓은 화면에 한 줄로 들어간다. */
export default function GiftStartPicker({
  gifts,
  startIds,
  maxStartGifts,
  dispatch,
}: {
  gifts: GiftData[]
  startIds: Set<number>
  maxStartGifts: number
  dispatch: React.Dispatch<PlannerAction>
}) {
  const t = useTranslations('planner.giftTab')
  const keywordLabel = (slug: string | null) => t(`keywords.${slug ?? 'all'}`)
  const groups = groupStartGifts(gifts)

  return (
    <div className="planner-gift-start-main" style={{ flex: 1, minWidth: 0, containerType: 'inline-size' }}>
      {/* Keyword columns: the keyword on top and its gifts stacked under it, so all ten keywords fit across a wide screen. */}
      <div className="planner-gift-start-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '0.5rem' }}>
        {groups.map(({ keyword: kw, gifts: kwGifts }) => {
          const slug = getKeywordSlug(kw)
          const iconUrl = slug ? getKeywordIconUrl(slug) : null
          return (
            <section key={kw} aria-label={keywordLabel(slug)} className="planner-gift-start-group" style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', minWidth: 0,
              padding: '0.5rem 0.375rem 0.625rem',
              background: 'var(--bg-card)',
              border: '1px solid #2a2520',
              borderRadius: '0.5rem',
              '--gift-name-size': 'var(--text-xs)',
            } as CSSProperties}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', minHeight: '1.5rem' }}>
                {iconUrl && (
                  <Image src={iconUrl} alt="" width={18} height={18} style={{ width: '1.125rem', height: '1.125rem', objectFit: 'contain' }} />
                )}
                <span style={{ color: 'var(--text-primary)', fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{keywordLabel(slug)}</span>
              </div>
              {kwGifts.map(gift => {
                const isSelected = startIds.has(gift.game_id)
                return (
                  // The shared gift card: its own 선택됨 band marks a pick, like every other gift list.
                  <GiftCard
                    key={gift.id}
                    gift={gift}
                    size="min(100%, 4.5rem)"
                    isSelected={isSelected}
                    disabled={startIds.size >= maxStartGifts && !isSelected}
                    onClick={() => dispatch({ type: isSelected ? 'REMOVE_GIFT' : 'ADD_GIFT', giftId: 'start_' + gift.game_id })}
                  />
                )
              })}
            </section>
          )
        })}
      </div>
    </div>
  )
}
