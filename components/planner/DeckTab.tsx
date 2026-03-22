'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { X } from 'lucide-react'
import { type PlannerState, type PlannerAction, type IdentityData, type SinnerData, type ThemeData, type GiftData, DIFFICULTY_FLOOR_KEY } from '@/lib/planner/types'
import { computeKeywordDistribution, getGiftsFromThemes } from '@/lib/planner/fusion'
import { getIdentityProfileUrl } from '@/lib/data/sinners'
import KeywordChart from './KeywordChart'

interface Props {
  state: PlannerState
  dispatch: React.Dispatch<PlannerAction>
  identities: IdentityData[]
  sinners: SinnerData[]
  themes: ThemeData[]
  gifts: GiftData[]
  giftMap: Map<number, GiftData>
}

export default function DeckTab({ state, dispatch, identities, sinners, themes, gifts, giftMap }: Props) {
  const [selectedSinner, setSelectedSinner] = useState<string | null>(null)

  // 수감자별 인격 그룹
  const sinnerIdentities = useMemo(() => {
    const map = new Map<string, IdentityData[]>()
    for (const ident of identities) {
      if (!map.has(ident.sinner_id)) map.set(ident.sinner_id, [])
      map.get(ident.sinner_id)!.push(ident)
    }
    return map
  }, [identities])

  // 선택된 인격들의 키워드 분포
  const keywordDist = useMemo(() => {
    const allKeywords = state.identitySlots.map(s => s.keywords)
    return computeKeywordDistribution(allKeywords)
  }, [state.identitySlots])

  // 테마팩 기프트 중 활성화될 기프트 (floor plan 기반)
  const activatedGifts = useMemo(() => {
    const selectedThemeIds = state.floorPlan.map(f => f.theme_id)
    return getGiftsFromThemes(selectedThemeIds, themes, giftMap)
  }, [state.floorPlan, themes, giftMap])

  // 현재 수감자에 선택된 인격 찾기
  const getSelectedIdentity = (sinnerId: string) =>
    state.identitySlots.find(s => s.sinner_id === sinnerId)

  return (
    <div>
      {/* 수감자 12인 그리드 */}
      <div className="grid grid-cols-4 md:grid-cols-6 gap-3 mb-8">
        {sinners.map(sinner => {
          const selected = getSelectedIdentity(sinner.id)
          const isOpen = selectedSinner === sinner.id
          return (
            <div key={sinner.id} className="relative">
              <button
                onClick={() => setSelectedSinner(isOpen ? null : sinner.id)}
                className="w-full rounded-lg p-3 text-center transition-all hover:scale-[1.02]"
                style={{
                  background: selected ? '#c8900a15' : '#1a1510',
                  border: `1px solid ${selected ? '#c8900a40' : '#222'}`,
                  cursor: 'pointer',
                }}
              >
                <Image
                  src={`https://lpgqcleszdlldneiwgep.supabase.co/storage/v1/object/public/limbus-assets/icons/Sinners/${sinner.id}.webp`}
                  alt={sinner.name_kr}
                  width={40} height={40}
                  className="mx-auto rounded-full mb-1"
                  style={{ width: '2.5rem', height: '2.5rem', objectFit: 'contain' }}
                />
                <div style={{ fontSize: '0.6875rem', color: selected ? '#e8dcc8' : '#666' }}>
                  {sinner.name_kr}
                </div>
                {selected && (
                  <div style={{ fontSize: '0.5625rem', color: '#c8900a', marginTop: '0.125rem' }}>
                    {selected.name_kr}
                  </div>
                )}
              </button>

              {/* 인격 선택 드롭다운 */}
              {isOpen && (
                <div
                  className="absolute top-full left-0 right-0 mt-1 rounded-lg overflow-hidden z-20"
                  style={{ background: '#1a1510', border: '1px solid #333', maxHeight: '15rem', overflowY: 'auto' }}
                >
                  {/* 선택 해제 */}
                  {selected && (
                    <button
                      onClick={() => { dispatch({ type: 'REMOVE_IDENTITY', sinnerId: sinner.id }); setSelectedSinner(null) }}
                      className="w-full text-left px-3 py-2 transition-colors hover:bg-[#222]"
                      style={{ color: '#c83030', fontSize: '0.75rem', borderBottom: '1px solid #222' }}
                    >
                      <X style={{ width: '0.75rem', height: '0.75rem', display: 'inline', marginRight: '0.25rem' }} />
                      선택 해제
                    </button>
                  )}
                  {(sinnerIdentities.get(sinner.id) ?? []).map(ident => {
                    const isSelected = selected?.identity_id === ident.id
                    return (
                      <button
                        key={ident.id}
                        onClick={() => {
                          dispatch({
                            type: 'ADD_IDENTITY',
                            slot: {
                              identity_id: ident.id,
                              sinner_id: ident.sinner_id,
                              name_kr: ident.name_kr,
                              rarity: ident.rarity,
                              keywords: ident.keywords ?? [],
                              game_id: ident.game_id,
                              folder_name: ident.folder_name,
                              slot_order: state.identitySlots.length,
                            },
                          })
                          setSelectedSinner(null)
                        }}
                        className="w-full text-left px-3 py-2 transition-colors hover:bg-[#222]"
                        style={{
                          background: isSelected ? '#c8900a15' : 'transparent',
                          borderBottom: '1px solid #1a1510',
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span style={{ color: '#c8900a', fontSize: '0.6875rem', fontWeight: 600 }}>{ident.rarity}성</span>
                          <span style={{ color: isSelected ? '#e8dcc8' : '#aaa', fontSize: '0.75rem' }}>{ident.name_kr}</span>
                        </div>
                        {ident.keywords && ident.keywords.length > 0 && (
                          <div style={{ fontSize: '0.5625rem', color: '#555', marginTop: '0.125rem' }}>
                            {ident.keywords.join(' · ')}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 하단: 키워드 차트 + 활성 기프트 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="font-serif mb-3" style={{ color: '#e8dcc8', fontSize: '1rem' }}>키워드 분포</h3>
          {keywordDist.length > 0 ? (
            <KeywordChart distribution={keywordDist} />
          ) : (
            <p style={{ color: '#444', fontSize: '0.8125rem' }}>인격을 선택하면 키워드 분포가 표시됩니다.</p>
          )}
        </div>
        <div>
          <h3 className="font-serif mb-3" style={{ color: '#e8dcc8', fontSize: '1rem' }}>편성 요약</h3>
          <div className="rounded-lg p-4" style={{ background: '#1a1510', border: '1px solid #222' }}>
            <div style={{ color: '#888', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>
              선택: {state.identitySlots.length} / 12
            </div>
            {state.identitySlots.length === 0 ? (
              <p style={{ color: '#444', fontSize: '0.75rem' }}>수감자를 클릭하여 인격을 선택하세요.</p>
            ) : (
              <div className="space-y-1">
                {state.identitySlots.map(s => (
                  <div key={s.sinner_id} className="flex items-center justify-between" style={{ fontSize: '0.75rem' }}>
                    <span style={{ color: '#b0a898' }}>{s.name_kr}</span>
                    <span style={{ color: '#c8900a', fontSize: '0.625rem' }}>{s.rarity}성</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
