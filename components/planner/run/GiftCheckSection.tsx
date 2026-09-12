'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { Search } from 'lucide-react'
import type { RunState, RunAction } from '@/lib/planner/run-types'
import type { ThemeData, GiftData } from '@/lib/planner/types'
import { getGiftActivationConditionStatus, getGiftConditionCountsForSlots } from '@/lib/planner/gift-condition-status'
import GiftCard from '@/components/ui/GiftCard'

interface Props {
  state: RunState
  dispatch: React.Dispatch<RunAction>
  gifts: GiftData[]
  giftMap: Map<number, GiftData>
  themes: ThemeData[]
}

export default function GiftCheckSection({ state, dispatch, gifts, giftMap, themes }: Props) {
  const currentLog = state.floorLogs[state.currentFloor - 1]
  const [search, setSearch] = useState('')
  const [targetSearch, setTargetSearch] = useState('')

  const ownedSet = useMemo(() => new Set(state.giftInventory.map(Number)), [state.giftInventory])

  const conditionCounts = useMemo(
    () => getGiftConditionCountsForSlots(state.identitySlots),
    [state.identitySlots],
  )

  // 조건 상태 체크 (GiftPlanTab 패턴)
  function getConditionStatus(gift: GiftData): { level: 'warn' | 'unmet'; text: string } | null {
    return getGiftActivationConditionStatus({ gift, ...conditionCounts })
  }

  // 현재 테마 전용 기프트 (specific_ego_gift_ids = 이 층에서만 얻을 수 있는 기프트)
  const themeGifts = useMemo(() => {
    const theme = currentLog?.themeId ? themes.find(t => t.id === currentLog.themeId) : null
    if (!theme) return []
    const specificIds = theme.specific_ego_gift_ids ?? []
    const list = specificIds.map(id => giftMap.get(id)).filter(Boolean) as GiftData[]
    // 체크된건 하단 정렬
    return list.sort((a, b) => {
      const aOwned = ownedSet.has(a.game_id) ? 1 : 0
      const bOwned = ownedSet.has(b.game_id) ? 1 : 0
      return aOwned - bOwned
    })
  }, [currentLog?.themeId, themes, giftMap, ownedSet])

  // 검색 결과
  const searchResults = useMemo(() => {
    if (!search.trim()) return []
    return gifts.filter(g => g.name.includes(search.trim())).slice(0, 15)
  }, [search, gifts])

  // 이 층 획득
  const floorGifts = useMemo(() =>
    (currentLog?.acquiredGifts ?? []).map(id => giftMap.get(Number(id))).filter(Boolean) as GiftData[]
  , [currentLog?.acquiredGifts, giftMap])

  // 최종 기프트 (플래너에서 선정한 목표 기프트) — 먹은건 하단
  const targetSet = useMemo(() => new Set((state.targetGifts ?? []).map(Number)), [state.targetGifts])
  const targetGiftList = useMemo(() => {
    const list = (state.targetGifts ?? []).map(id => giftMap.get(Number(id))).filter(Boolean) as GiftData[]
    return list.sort((a, b) => {
      const aOwned = ownedSet.has(a.game_id) ? 1 : 0
      const bOwned = ownedSet.has(b.game_id) ? 1 : 0
      return aOwned - bOwned
    })
  }, [state.targetGifts, giftMap, ownedSet])

  // 목표 기프트 검색
  const targetSearchResults = useMemo(() => {
    if (!targetSearch.trim()) return []
    return gifts.filter(g => g.name.includes(targetSearch.trim())).slice(0, 15)
  }, [targetSearch, gifts])

  return (
    <div className="space-y-6">
      {/* 테마팩 기프트 — GiftCard 컴포넌트 사용 */}
      {themeGifts.length > 0 && (
        <section>
          <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.75rem', color: '#999' }}>
            테마팩 기프트 ({themeGifts.length})
          </h3>
          <div className="flex flex-wrap gap-2 sm:gap-3" style={{ position: 'relative', zIndex: 0 }}>
            {themeGifts.map(gift => {
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
        </section>
      )}

      {themeGifts.length === 0 && (
        <p style={{ color: '#555', fontSize: '0.8125rem' }}>테마팩을 먼저 선택하면 기프트가 표시됩니다</p>
      )}

      {/* 상점 구매 (자동완성 드롭다운) */}
      <section>
        <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.75rem', color: '#999' }}>상점 구매</h3>
        <div className="relative" style={{ zIndex: 20 }}>
          <Search className="absolute" style={{ left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '0.875rem', height: '0.875rem', color: '#555' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="기프트 이름 검색..."
            className="w-full rounded-lg"
            style={{ padding: '0.5rem 0.75rem 0.5rem 2.25rem', background: '#1a1510', border: '1px solid #2a2015', color: '#e8e0d0', fontSize: '0.8125rem', outline: 'none', minHeight: '2.75rem' }}
          />
          {/* 자동완성 드롭다운 */}
          {searchResults.length > 0 && (
            <div className="absolute left-0 right-0 z-30 rounded-lg overflow-hidden" style={{ top: '100%', marginTop: '0.25rem', background: '#1a1510', border: '1px solid #2a2015', maxHeight: '16rem', overflowY: 'auto', boxShadow: '0 0.5rem 1.5rem rgba(0,0,0,0.5)' }}>
              {searchResults.map(gift => {
                const owned = ownedSet.has(gift.game_id)
                const cond = getConditionStatus(gift)
                return (
                  <button
                    key={gift.id}
                    onClick={() => { dispatch({ type: 'ACQUIRE_GIFT', giftId: String(gift.game_id) }); setSearch('') }}
                    disabled={owned}
                    className="w-full flex items-center gap-2 transition-colors text-left"
                    style={{
                      padding: '0.5rem 0.75rem', fontSize: '0.6875rem',
                      minHeight: '2.75rem',
                      color: owned ? '#555' : '#ccc',
                      borderBottom: '1px solid #1a1208',
                      opacity: owned ? 0.5 : 1,
                    }}
                    onMouseEnter={e => { if (!owned) e.currentTarget.style.background = 'rgba(200,144,10,0.1)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    {gift.image_url && (
                      <Image src={gift.image_url} alt="" width={24} height={24} style={{ width: '1.5rem', height: '1.5rem', objectFit: 'contain', flexShrink: 0 }} />
                    )}
                    <span className="flex-1 truncate">{gift.name}</span>
                    {gift.keyword && <span style={{ color: '#555', fontSize: '0.5625rem', flexShrink: 0 }}>{gift.keyword}</span>}
                    {gift.grade && <span style={{ color: '#c8900a', fontSize: '0.5625rem', fontWeight: 700, flexShrink: 0 }}>{gift.grade === 'EX' ? 'EX' : `${gift.grade}등급`}</span>}
                    {cond && <span style={{ color: cond.level === 'unmet' ? '#ef4444' : '#eab308', fontSize: '0.5rem', flexShrink: 0 }}>{cond.level === 'unmet' ? '✕' : '⚠'}</span>}
                    {owned && <span style={{ color: '#4ade80', fontSize: '0.5625rem', flexShrink: 0 }}>보유</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* 이 층 획득 */}
      {floorGifts.length > 0 && (
        <section>
          <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.75rem', color: '#999' }}>
            이 층에서 획득 ({floorGifts.length})
          </h3>
          <div className="flex flex-wrap gap-3" style={{ position: 'relative', zIndex: 0 }}>
            {floorGifts.map((gift, i) => (
              <GiftCard
                key={`${gift.game_id}-${i}`}
                gift={gift}
                isSelected
                onClick={() => {}}
                onRemove={() => dispatch({ type: 'REMOVE_GIFT', giftId: String(gift.game_id) })}
              />
            ))}
          </div>
        </section>
      )}

      {/* 최종 기프트 (목표 기프트 — 항상 표시) */}
      <section style={{ borderTop: '1px solid #2a2015', paddingTop: '1rem' }}>
        <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.75rem', color: '#c8900a' }}>
          최종 기프트
          {targetGiftList.length > 0 && (
            <span style={{ color: '#888', fontWeight: 400, marginLeft: '0.5rem', fontSize: '0.6875rem' }}>
              {targetGiftList.filter(g => ownedSet.has(g.game_id)).length} / {targetGiftList.length} 획득
            </span>
          )}
        </h3>

        {/* 목표 기프트 추가 검색 */}
        <div className="relative" style={{ marginBottom: '0.75rem', zIndex: 10 }}>
          <Search className="absolute" style={{ left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '0.875rem', height: '0.875rem', color: '#555' }} />
          <input
            value={targetSearch}
            onChange={e => setTargetSearch(e.target.value)}
            placeholder="목표 기프트 추가..."
            className="w-full rounded-lg"
            style={{ padding: '0.5rem 0.75rem 0.5rem 2.25rem', background: '#1a1510', border: '1px solid #2a2015', color: '#e8e0d0', fontSize: '0.8125rem', outline: 'none', minHeight: '2.75rem' }}
          />
          {targetSearchResults.length > 0 && (
            <div className="absolute left-0 right-0 z-30 rounded-lg overflow-hidden" style={{ top: '100%', marginTop: '0.25rem', background: '#1a1510', border: '1px solid #2a2015', maxHeight: '12rem', overflowY: 'auto', boxShadow: '0 0.5rem 1.5rem rgba(0,0,0,0.5)' }}>
              {targetSearchResults.map(gift => {
                const isTarget = targetSet.has(gift.game_id)
                return (
                  <button key={gift.id} onClick={() => { dispatch({ type: 'ADD_TARGET_GIFT', giftId: String(gift.game_id) }); setTargetSearch('') }}
                    disabled={isTarget}
                    className="w-full flex items-center gap-2 transition-colors text-left"
                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.6875rem', minHeight: '2.75rem', color: isTarget ? '#555' : '#ccc', borderBottom: '1px solid #1a1208', opacity: isTarget ? 0.5 : 1 }}
                    onMouseEnter={e => { if (!isTarget) e.currentTarget.style.background = 'rgba(200,144,10,0.1)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    {gift.image_url && <Image src={gift.image_url} alt="" width={24} height={24} style={{ width: '1.5rem', height: '1.5rem', objectFit: 'contain', flexShrink: 0 }} />}
                    <span className="flex-1 truncate">{gift.name}</span>
                    {gift.keyword && <span style={{ color: '#555', fontSize: '0.5625rem' }}>{gift.keyword}</span>}
                    {isTarget && <span style={{ color: '#c8900a', fontSize: '0.5625rem' }}>추가됨</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* 목표 기프트 그리드 */}
        {targetGiftList.length > 0 ? (
          <div className="flex flex-wrap gap-3" style={{ position: 'relative', zIndex: 0 }}>
            {targetGiftList.map(gift => {
              const owned = ownedSet.has(gift.game_id)
              return (
                <GiftCard
                  key={`target-${gift.game_id}`}
                  gift={gift}
                  isSelected={owned}
                  onClick={() => dispatch({ type: owned ? 'REMOVE_GIFT' : 'ACQUIRE_GIFT', giftId: String(gift.game_id) })}
                  onRemove={() => dispatch({ type: 'REMOVE_TARGET_GIFT', giftId: String(gift.game_id) })}
                  conditionStatus={!owned ? getConditionStatus(gift) : null}
                />
              )
            })}
          </div>
        ) : (
          <p style={{ color: '#555', fontSize: '0.75rem' }}>플래너에서 선정한 기프트가 없습니다. 위 검색으로 목표 기프트를 추가하세요.</p>
        )}
      </section>
    </div>
  )
}
