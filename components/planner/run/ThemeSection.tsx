'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { Check, Star } from 'lucide-react'
import type { RunState, RunAction } from '@/lib/planner/run-types'
import type { ThemeData, GiftData, IdentityData } from '@/lib/planner/types'
import { DIFFICULTY_FLOOR_KEY } from '@/lib/planner/types'
import { getAvailableThemes } from '@/lib/planner/fusion'
import { normalizeThemeKeyword } from '@/lib/constants/keywords'
import GiftCard from '@/components/planner/gift-plan/GiftCard'
import ImageWithFallback from '@/components/ui/ImageWithFallback'
import { BLUR_PLACEHOLDER } from '@/lib/utils/images'

interface Props {
  state: RunState
  dispatch: React.Dispatch<RunAction>
  themes: ThemeData[]
  gifts: GiftData[]
  giftMap: Map<number, GiftData>
  identities: IdentityData[]
}

export default function ThemeSection({ state, dispatch, themes, gifts, giftMap, identities }: Props) {
  const currentLog = state.floorLogs[state.currentFloor - 1]
  const diffKey = DIFFICULTY_FLOOR_KEY[state.difficulty]
  const [showGifts, setShowGifts] = useState(true)

  const available = useMemo(
    () => getAvailableThemes(themes, diffKey, state.currentFloor),
    [themes, diffKey, state.currentFloor]
  )

  const ownedSet = useMemo(() => new Set(state.giftInventory.map(Number)), [state.giftInventory])

  // 키워드 카운트
  const { formKw, allKw } = useMemo(() => {
    const form: Record<string, number> = {}
    const all: Record<string, number> = {}
    for (const slot of state.identitySlots) {
      const normalized = new Set(slot.keywords.map(normalizeThemeKeyword))
      for (const kw of normalized) {
        all[kw] = (all[kw] ?? 0) + 1
        if (slot.slot_order < 7) form[kw] = (form[kw] ?? 0) + 1
      }
    }
    return { formKw: form, allKw: all }
  }, [state.identitySlots])

  const selectedTheme = currentLog?.themeId ? themes.find(t => t.id === currentLog.themeId) : null
  const themeGifts = useMemo(() => {
    if (!selectedTheme) return []
    const specificIds = selectedTheme.specific_ego_gift_ids ?? []
    return specificIds.map(id => giftMap.get(id)).filter(Boolean) as GiftData[]
  }, [selectedTheme, giftMap])

  // 조건 체크 (GiftPlanTab 패턴)
  function getConditionStatus(gift: GiftData): { level: 'warn' | 'unmet'; text: string } | null {
    const cond = gift.activation_condition
    if (!cond || !cond.count) return null
    let formHave = 0, allHave = 0, label = ''
    if (cond.type === 'keyword' && cond.keyword) {
      formHave = formKw[cond.keyword] ?? 0; allHave = allKw[cond.keyword] ?? 0; label = cond.keyword
    } else if (cond.type === 'multi_keyword' && cond.keywords) {
      formHave = cond.keywords.reduce((s: number, kw: string) => s + (formKw[kw] ?? 0), 0)
      allHave = cond.keywords.reduce((s: number, kw: string) => s + (allKw[kw] ?? 0), 0)
      label = cond.keywords.join('+')
    } else { return null }
    if (formHave >= cond.count) return null
    if (allHave >= cond.count) return { level: 'warn', text: `${label} ${formHave}/${cond.count}` }
    return { level: 'unmet', text: `${label} ${allHave}/${cond.count}` }
  }

  // 기프트 정렬: 보유 → 하단
  const sortedGifts = useMemo(() => {
    return [...themeGifts].sort((a, b) => {
      const aOwned = ownedSet.has(a.game_id) ? 1 : 0
      const bOwned = ownedSet.has(b.game_id) ? 1 : 0
      return aOwned - bOwned
    })
  }, [themeGifts, ownedSet])

  return (
    <div>
      {/* 테마팩 선택 — 카드 그리드 (거던 페이지 패턴) */}
      <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.75rem', color: '#999' }}>
        테마팩 선택 ({available.length}개)
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2" style={{ marginBottom: '1.5rem' }}>
        {available.map(theme => {
          const isSelected = currentLog?.themeId === theme.id
          const giftCount = (theme.specific_ego_gift_ids ?? []).length
          return (
            <button
              key={theme.id}
              onClick={() => dispatch({ type: 'SET_FLOOR_THEME', themeId: theme.id })}
              className="group relative rounded-lg overflow-hidden text-left transition-all"
              style={{
                aspectRatio: '380/500',
                border: `2px solid ${isSelected ? '#c8900a' : 'rgba(255,255,255,0.06)'}`,
                boxShadow: isSelected ? '0 0 1rem rgba(200,144,10,0.3)' : 'none',
                background: '#1a1714',
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = 'rgba(200,144,10,0.25)' }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
            >
              {/* 테마팩 이미지 */}
              {theme.image_url && (
                <ImageWithFallback src={theme.image_url} alt={theme.name} fill fallbackType="default" sizes="(max-width:640px) 50vw, (max-width:768px) 33vw, 20vw"
                  className="object-cover transition-transform group-hover:scale-105" style={{ opacity: isSelected ? 0.9 : 0.7 }}
                  placeholder="blur" blurDataURL={BLUR_PLACEHOLDER} />
              )}

              {/* 보스 이미지 — 가운데 (거던 페이지 패턴) */}
              {theme.boss_image_url && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[2]">
                  <div className="relative w-full" style={{ aspectRatio: '391/432' }}>
                    <ImageWithFallback src={theme.boss_image_url} alt="" fill fallbackType="default" sizes="(max-width:640px) 50vw, (max-width:768px) 33vw, 20vw"
                      className="object-contain drop-shadow-lg transition-transform group-hover:scale-105" />
                  </div>
                </div>
              )}

              {/* 하단 그래디언트 + 정보 */}
              <div className="absolute inset-0 z-[3]" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.3) 40%, transparent 70%)' }} />
              <div className="absolute bottom-0 left-0 right-0 z-[4]" style={{ padding: '0 0.625rem 0.5rem' }}>
                <p className="font-serif leading-tight" style={{ color: '#e8d8c0', fontSize: '0.75rem', fontWeight: 600, textShadow: '0 0.0625rem 0.25rem rgba(0,0,0,0.8)', marginBottom: '0.25rem' }}>
                  {theme.name}
                </p>
                <div className="flex items-center gap-2">
                  {giftCount > 0 && (
                    <span style={{ color: '#c8900a', fontSize: '0.5625rem', fontFamily: 'var(--font-mono)' }}>
                      기프트 {giftCount}종
                    </span>
                  )}
                </div>
              </div>

              {/* 선택 체크 */}
              {isSelected && (
                <div className="absolute top-0 left-0 right-0 z-[5] flex items-center justify-center" style={{ padding: '0.375rem', background: 'rgba(200,144,10,0.15)' }}>
                  <Check style={{ width: '0.875rem', height: '0.875rem', color: '#c8900a' }} />
                  <span style={{ color: '#c8900a', fontSize: '0.625rem', fontWeight: 700, marginLeft: '0.25rem' }}>선택됨</span>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* 선택된 테마 전용 기프트 — GiftCard 사용 */}
      {selectedTheme && sortedGifts.length > 0 && (
        <div>
          <button onClick={() => setShowGifts(!showGifts)} className="flex items-center gap-1" style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#c8900a', marginBottom: '0.75rem', minHeight: '2.75rem', padding: '0.5rem 0' }}>
            <Star style={{ width: '0.875rem', height: '0.875rem' }} />
            전용 기프트 ({sortedGifts.length})
            <span style={{ color: '#555', fontSize: '0.6875rem', fontWeight: 400, marginLeft: '0.25rem' }}>{showGifts ? '▲' : '▼'}</span>
          </button>
          {showGifts && (
            <div className="flex flex-wrap gap-2 sm:gap-3" style={{ position: 'relative', zIndex: 0 }}>
              {sortedGifts.map(gift => {
                const owned = ownedSet.has(gift.game_id)
                return (
                  <GiftCard
                    key={gift.game_id}
                    gift={gift}
                    isSelected={owned}
                    onClick={() => dispatch({ type: owned ? 'REMOVE_GIFT' : 'ACQUIRE_GIFT', giftId: String(gift.game_id) })}
                    conditionStatus={!owned ? getConditionStatus(gift) : null}
                  />
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
