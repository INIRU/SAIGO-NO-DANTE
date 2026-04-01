'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { Check, AlertCircle, ChevronDown, ChevronUp, X, ArrowRight } from 'lucide-react'
import type { RunState, RunAction } from '@/lib/planner/run-types'
import type { MirrorDungeonEvent } from '@/components/mirror-dungeon/types'
import type { GiftData } from '@/lib/planner/types'
import BaseModal from '@/components/ui/BaseModal'
import ImageWithFallback from '@/components/ui/ImageWithFallback'
import { BLUR_PLACEHOLDER } from '@/lib/utils/images'
import { colorizeEventText, replaceEventPlaceholders, getOptionEffects } from '@/lib/utils/event-text'

interface Props {
  state: RunState
  dispatch: React.Dispatch<RunAction>
  events: MirrorDungeonEvent[]
  giftMap: Map<number, GiftData>
}

// colorizeEventText, replaceEventPlaceholders는 @/lib/utils/event-text에서 import

export default function EventSection({ state, dispatch, events, giftMap }: Props) {
  const currentLog = state.floorLogs[state.currentFloor - 1]
  const themeId = currentLog?.themeId ? Number(currentLog.themeId) : null
  const [selectedEvent, setSelectedEvent] = useState<MirrorDungeonEvent | null>(null)
  const [search, setSearch] = useState('')

  const allRootEvents = useMemo(() => {
    if (!themeId) return []
    const seen = new Set<string>()
    return events.filter(e => {
      if (e.parent_id != null) return false
      if (!e.theme_ids?.includes(themeId)) return false
      const key = e.desc_text || String(e.id)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [events, themeId])

  const rootEvents = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allRootEvents
    return allRootEvents.filter(ev => {
      if (ev.name?.toLowerCase().includes(q) || ev.desc_text?.toLowerCase().includes(q)) return true
      if (ev.options?.some((o: { message: string; messageDesc?: string }) => o.message?.toLowerCase().includes(q) || o.messageDesc?.toLowerCase().includes(q))) return true
      if (ev.gift_ids?.some(gid => { const g = giftMap.get(gid); return g && g.name.toLowerCase().includes(q) })) return true
      if (ev.option_gifts?.some((gids: number[]) => gids?.some(gid => { const g = giftMap.get(gid); return g && g.name.toLowerCase().includes(q) }))) return true
      return false
    })
  }, [allRootEvents, search, giftMap])

  const childMap = useMemo(() => {
    const map = new Map<number, MirrorDungeonEvent[]>()
    for (const e of events) {
      if (e.parent_id != null) {
        if (!map.has(e.parent_id)) map.set(e.parent_id, [])
        map.get(e.parent_id)!.push(e)
      }
    }
    return map
  }, [events])

  const isSelected = (eventId: number, optIdx: number) =>
    currentLog?.selectedEventOptions.some(o => o.eventId === eventId && o.optionIndex === optIdx) ?? false

  const handleSelect = (event: MirrorDungeonEvent, optIdx: number) => {
    const rewardGiftIds: string[] = []
    if (event.option_gifts?.[optIdx]) {
      for (const gid of event.option_gifts[optIdx]) {
        rewardGiftIds.push(String(gid))
      }
    }
    dispatch({ type: 'SELECT_EVENT_OPTION', eventId: event.id, optionIndex: optIdx, rewardGiftIds })
  }

  if (!themeId) {
    return (
      <div className="flex items-center gap-2" style={{ color: '#666', fontSize: '0.875rem', padding: '2rem 0' }}>
        <AlertCircle style={{ width: '1rem', height: '1rem' }} />
        테마팩을 먼저 선택하세요
      </div>
    )
  }

  if (allRootEvents.length === 0) {
    return <p style={{ color: '#666', fontSize: '0.8125rem', padding: '2rem 0' }}>이 테마팩에 연결된 이벤트가 없습니다</p>
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2" style={{ marginBottom: '0.75rem' }}>
        <h3 className="shrink-0" style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#999' }}>
          이벤트 ({rootEvents.length}{search ? ` / ${allRootEvents.length}` : ''})
        </h3>
        <div className="relative" style={{ maxWidth: '14rem', flex: 1 }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="이벤트 · 기프트 검색..."
            className="w-full rounded"
            style={{ padding: '0.5rem', background: '#1a1510', border: '1px solid #2a2015', color: '#e8e0d0', fontSize: '0.75rem', outline: 'none', minHeight: '2.25rem' }}
          />
        </div>
      </div>

      {/* 이벤트 카드 그리드 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {rootEvents.map(ev => {
          const evGifts = (ev.gift_ids || []).map(gid => giftMap.get(gid)).filter(Boolean) as GiftData[]
          const childCount = childMap.get(ev.id)?.length ?? 0
          const isExpanded = selectedEvent?.id === ev.id
          const hasSelected = currentLog?.selectedEventOptions.some(o => o.eventId === ev.id)

          return (
            <button
              key={ev.id}
              onClick={() => setSelectedEvent(isExpanded ? null : ev)}
              className="group text-left overflow-hidden transition-all"
              style={{
                background: hasSelected ? 'rgba(200,144,10,0.08)' : '#1a1714',
                border: `1px solid ${hasSelected ? 'rgba(200,144,10,0.3)' : isExpanded ? 'rgba(200,144,10,0.2)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: '0.375rem', cursor: 'pointer',
              }}
            >
              {ev.image_url ? (
                <div className="relative w-full" style={{ aspectRatio: '1' }}>
                  <ImageWithFallback src={ev.image_url} alt="" fill fallbackType="default" sizes="(max-width:640px) 50vw, 25vw"
                    className="object-cover transition-transform group-hover:scale-105" style={{ opacity: 0.8 }}
                    placeholder="blur" blurDataURL={BLUR_PLACEHOLDER} />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(13,11,8,0.9) 0%, transparent 60%)' }} />
                  <div className="absolute bottom-0 left-0 right-0" style={{ padding: '0 0.5rem 0.5rem' }}>
                    <p className="font-serif leading-tight line-clamp-2" style={{ color: '#e8d8c0', fontSize: '0.6875rem', textShadow: '0 0.0625rem 0.25rem rgba(0,0,0,0.8)' }}>
                      {ev.name || replaceEventPlaceholders(ev.desc_text?.split('\n')[0]?.slice(0, 30)) || `이벤트 #${ev.id}`}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {evGifts.length > 0 && <span style={{ color: '#c8900a', fontSize: '0.5rem', fontFamily: 'var(--font-mono)' }}>{evGifts.length}종</span>}
                      {ev.options && <span style={{ color: '#888', fontSize: '0.5rem', fontFamily: 'var(--font-mono)' }}>선택지 {ev.options.length}</span>}
                      {childCount > 0 && <span style={{ color: '#a08860', fontSize: '0.5rem', fontFamily: 'var(--font-mono)' }}>+{childCount}</span>}
                      {hasSelected && <Check style={{ width: '0.5rem', height: '0.5rem', color: '#c8900a' }} />}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '0.625rem' }}>
                  <p className="font-serif leading-tight line-clamp-2" style={{ color: '#ccc', fontSize: '0.6875rem', marginBottom: '0.375rem' }}>
                    {ev.name || replaceEventPlaceholders(ev.desc_text?.split('\n')[0]?.slice(0, 40)) || `이벤트 #${ev.id}`}
                  </p>
                  <div className="flex items-center gap-1">
                    {evGifts.length > 0 && <span style={{ color: '#c8900a', fontSize: '0.5rem', fontFamily: 'var(--font-mono)' }}>{evGifts.length}종</span>}
                    {ev.options && <span style={{ color: '#888', fontSize: '0.5rem', fontFamily: 'var(--font-mono)' }}>선택지 {ev.options.length}</span>}
                    {childCount > 0 && <span style={{ color: '#a08860', fontSize: '0.5rem', fontFamily: 'var(--font-mono)' }}>+{childCount}</span>}
                    {hasSelected && <Check style={{ width: '0.5rem', height: '0.5rem', color: '#c8900a' }} />}
                  </div>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* ════════ 이벤트 상세 모달 ════════ */}
      <BaseModal open={!!selectedEvent} onClose={() => setSelectedEvent(null)} padding="calc(env(safe-area-inset-top) + 1rem) calc(env(safe-area-inset-right) + 1rem) calc(env(safe-area-inset-bottom) + 1rem) calc(env(safe-area-inset-left) + 1rem)">
        {selectedEvent && (() => {
          const ev = selectedEvent
          const children = childMap.get(ev.id) ?? []
          return (
          <div className="relative w-full overflow-hidden" style={{ maxHeight: '85vh', borderRadius: '0.75rem', background: '#131110', border: '1px solid rgba(200,144,10,0.12)', boxShadow: '0 0 3rem rgba(200,144,10,0.06), 0 1.5rem 4rem rgba(0,0,0,0.6)' }}>
            {/* 닫기 */}
            <button onClick={() => setSelectedEvent(null)} className="absolute top-2 right-2 z-30 flex items-center justify-center transition-all"
              style={{ color: 'rgba(255,255,255,0.4)', width: '2.75rem', height: '2.75rem', borderRadius: '50%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
              <X style={{ width: '1.125rem', height: '1.125rem' }} />
            </button>
            <div style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            {/* 헤더 */}
            {ev.image_url ? (
              <div className="relative" style={{ height: '10rem' }}>
                <ImageWithFallback src={ev.image_url} alt="" fill fallbackType="default" sizes="40rem" className="object-cover" style={{ opacity: 0.4 }}
                  placeholder="blur" blurDataURL={BLUR_PLACEHOLDER} />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #131110 0%, rgba(19,17,16,0.5) 50%, rgba(19,17,16,0.25) 100%)' }} />
                <div className="absolute bottom-0 left-0 right-0" style={{ padding: '0 1.25rem 1rem' }}>
                  <h3 className="font-serif" style={{ fontSize: '1.125rem', color: '#e8d0a0', textShadow: '0 0.125rem 0.5rem rgba(200,144,10,0.2)' }}>
                    {ev.name || replaceEventPlaceholders(ev.desc_text?.split('\n')[0]?.slice(0, 50)) || `이벤트 #${ev.id}`}
                  </h3>
                </div>
              </div>
            ) : (
              <div style={{ padding: '1.25rem', borderBottom: '1px solid rgba(200,144,10,0.08)' }}>
                <h3 className="font-serif" style={{ fontSize: '1.125rem', color: '#e8d0a0' }}>
                  {ev.name || replaceEventPlaceholders(ev.desc_text?.split('\n')[0]?.slice(0, 50)) || `이벤트 #${ev.id}`}
                </h3>
              </div>
            )}

            {/* 이벤트 서술 (컬러 코딩) */}
            {ev.desc_text && (
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <p style={{ fontSize: '0.8125rem', color: '#9a8a70', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                  {colorizeEventText(ev.desc_text)}
                </p>
              </div>
            )}

            {/* ── 선택지 섹션 ── */}
            {ev.options && ev.options.length > 0 && (
              <div style={{ padding: '1rem 1.25rem' }}>
                <p style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#666', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>선택지</p>
                <div className="space-y-3">
                  {ev.options.map((option: { message: string; messageDesc?: string; result?: string[] }, optIdx: number) => {
                    const selected = isSelected(ev.id, optIdx)
                    const rewardGifts = ev.option_gifts?.[optIdx]?.map((gid: number) => giftMap.get(gid)).filter(Boolean) as GiftData[] | undefined
                    const optionChildren = children.filter(c => c.option_index === optIdx)
                    const hasResult = option.result && option.result.length > 0
                    const hasBottom = hasResult || (rewardGifts && rewardGifts.length > 0)

                    return (
                      <div key={optIdx}>
                        {/* 선택지 헤더 */}
                        <button
                          onClick={() => handleSelect(ev, optIdx)}
                          className="w-full text-left transition-all"
                          style={{
                            padding: '0.75rem 1rem',
                            minHeight: '2.75rem',
                            background: selected ? 'rgba(200,144,10,0.12)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${selected ? 'rgba(200,144,10,0.35)' : 'rgba(255,255,255,0.06)'}`,
                            borderBottom: hasBottom ? 'none' : undefined,
                            borderRadius: hasBottom ? '0.375rem 0.375rem 0 0' : '0.375rem',
                          }}
                        >
                          <div className="flex items-start gap-2">
                            {selected && <Check style={{ width: '0.75rem', height: '0.75rem', color: '#c8900a', flexShrink: 0, marginTop: '0.125rem' }} />}
                            <div className="flex-1 min-w-0">
                              <p style={{ fontSize: '0.8125rem', color: selected ? '#e8b030' : '#d8c8a8', fontWeight: 500 }}>
                                {colorizeEventText(option.message)}
                              </p>
                              {option.messageDesc && (
                                <p style={{ fontSize: '0.6875rem', marginTop: '0.25rem', color: '#8a7a60', lineHeight: 1.5 }}>
                                  {colorizeEventText(option.messageDesc)}
                                </p>
                              )}
                            </div>
                          </div>
                        </button>

                        {/* 결과 텍스트 + 보상 */}
                        {hasBottom && (
                          <div style={{
                            padding: '0.625rem 1rem',
                            background: selected ? 'rgba(200,144,10,0.05)' : 'rgba(255,255,255,0.015)',
                            border: `1px solid ${selected ? 'rgba(200,144,10,0.2)' : 'rgba(255,255,255,0.04)'}`,
                            borderTop: 'none',
                            borderRadius: '0 0 0.375rem 0.375rem',
                          }}>
                            {option.result?.map((resultText, ri) => (
                              <p key={ri} style={{
                                fontSize: '0.75rem', color: '#7a6a50', lineHeight: 1.7,
                                whiteSpace: 'pre-line', marginBottom: '0.375rem',
                              }}>
                                {colorizeEventText(resultText)}
                              </p>
                            ))}

                            {/* 게임 효과 텍스트 (옵션별 + 전투) */}
                            {(() => {
                              const allEff = getOptionEffects(ev.id, optIdx)
                              if (allEff.length === 0) return null
                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem' }}>
                                  {allEff.map((eff, ei) => (
                                    <div key={ei} style={{
                                      padding: '0.375rem 0.625rem',
                                      background: 'rgba(200,144,10,0.04)',
                                      border: '1px solid rgba(200,144,10,0.1)',
                                      borderLeft: '0.1875rem solid rgba(200,144,10,0.35)',
                                      borderRadius: '0.25rem',
                                      fontSize: '0.6875rem', lineHeight: 1.5,
                                    }}>
                                      {eff}
                                    </div>
                                  ))}
                                </div>
                              )
                            })()}

                            {rewardGifts && rewardGifts.length > 0 && (
                              <div className="flex flex-wrap gap-1.5" style={{ marginTop: '0.5rem' }}>
                                {rewardGifts.map(gift => (
                                  <span key={gift.game_id} className="inline-flex items-center gap-1.5 rounded" style={{
                                    background: 'rgba(252,186,3,0.08)', padding: '0.25rem 0.5rem',
                                    border: '1px solid rgba(252,186,3,0.15)',
                                  }}>
                                    {gift.image_url && <Image src={gift.image_url} alt="" width={18} height={18} style={{ width: '1rem', height: '1rem', objectFit: 'contain' }} />}
                                    <span style={{ fontSize: '0.625rem', color: '#fcba03', fontWeight: 500 }}>{gift.name}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* 하위 이벤트 */}
                        {optionChildren.length > 0 && (
                          <ChildEventTree events={optionChildren} childMap={childMap} giftMap={giftMap} state={state} dispatch={dispatch} isSelected={isSelected} handleSelect={handleSelect} depth={0} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 선택지 없는 자식 이벤트 */}
            {children.filter(c => c.option_index == null).length > 0 && (
              <div style={{ padding: '0 1.25rem 1rem' }}>
                <ChildEventTree events={children.filter(c => c.option_index == null)} childMap={childMap} giftMap={giftMap} state={state} dispatch={dispatch} isSelected={isSelected} handleSelect={handleSelect} depth={0} />
              </div>
            )}
            </div>
          </div>
          )
        })()}
      </BaseModal>
    </div>
  )
}

// ── 연계 이벤트 트리 (스레드 라인 UI) ──────────────────────────────────────

function ChildEventTree({ events: childEvents, childMap, giftMap, state, dispatch, isSelected, handleSelect, depth }: {
  events: MirrorDungeonEvent[]
  childMap: Map<number, MirrorDungeonEvent[]>
  giftMap: Map<number, GiftData>
  state: RunState
  dispatch: React.Dispatch<RunAction>
  isSelected: (eventId: number, optIdx: number) => boolean
  handleSelect: (event: MirrorDungeonEvent, optIdx: number) => void
  depth: number
}) {
  const [expanded, setExpanded] = useState(depth < 1)
  const maxDepth = 3

  if (depth >= maxDepth) {
    return (
      <div style={{ marginLeft: '1rem', marginTop: '0.25rem', fontSize: '0.625rem', color: '#555' }}>
        (연계 이벤트 {childEvents.length}개 — 최대 깊이 도달)
      </div>
    )
  }

  return (
    <div style={{ marginTop: '0.5rem', position: 'relative' }}>
      {/* 연계 이벤트 토글 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 transition-colors"
        style={{
          fontSize: '0.6875rem', color: '#a08860', padding: '0.375rem 0.5rem',
          background: 'rgba(200,144,10,0.06)', borderRadius: '0.25rem',
          border: '1px solid rgba(200,144,10,0.1)', cursor: 'pointer',
          marginLeft: depth > 0 ? '1rem' : 0,
        }}
      >
        <ArrowRight style={{
          width: '0.625rem', height: '0.625rem',
          transform: expanded ? 'rotate(90deg)' : 'none',
          transition: 'transform 0.15s',
        }} />
        연계 이벤트 ({childEvents.length})
        {expanded
          ? <ChevronUp style={{ width: '0.5rem', height: '0.5rem' }} />
          : <ChevronDown style={{ width: '0.5rem', height: '0.5rem' }} />}
      </button>

      {expanded && (
        <div style={{ marginLeft: depth > 0 ? '1rem' : 0 }}>
          {childEvents.map((child, idx) => {
            const grandChildren = childMap.get(child.id) ?? []
            const isLast = idx === childEvents.length - 1

            return (
              <div key={child.id} className="relative" style={{ display: 'flex', marginTop: '0.375rem' }}>
                {/* 스레드 라인 */}
                <div style={{ width: '1.25rem', flexShrink: 0, position: 'relative' }}>
                  <div style={{
                    position: 'absolute', left: '0.5rem', top: 0,
                    width: '1px', height: isLast ? '0.875rem' : '100%',
                    background: 'rgba(200,144,10,0.2)',
                  }} />
                  <div style={{
                    position: 'absolute', left: '0.5rem', top: '0.875rem',
                    width: '0.5rem', height: '1px',
                    background: 'rgba(200,144,10,0.2)',
                  }} />
                  <div style={{
                    position: 'absolute', left: '0.8125rem', top: '0.6875rem',
                    width: '0.375rem', height: '0.375rem',
                    borderRadius: '50%', background: '#a08860', opacity: 0.5,
                  }} />
                </div>

                {/* 이벤트 카드 */}
                <div className="flex-1 min-w-0 rounded" style={{
                  background: 'rgba(200,144,10,0.03)',
                  border: '1px solid rgba(200,144,10,0.08)',
                  padding: '0.625rem 0.75rem',
                  marginTop: '0.125rem',
                }}>
                  <p style={{ fontSize: '0.75rem', color: '#d0c0a0', fontWeight: 500, marginBottom: '0.25rem' }}>
                    {child.name || replaceEventPlaceholders(child.desc_text?.split('\n')[0]?.slice(0, 50)) || `이벤트 #${child.id}`}
                  </p>

                  {child.desc_text && (
                    <p style={{ fontSize: '0.6875rem', color: '#8a7a60', lineHeight: 1.6, whiteSpace: 'pre-line', marginBottom: '0.375rem' }}>
                      {colorizeEventText(child.desc_text)}
                    </p>
                  )}

                  {/* 자식의 선택지 */}
                  {child.options?.map((opt: { message: string; messageDesc?: string; result?: string[] }, oi: number) => {
                    const sel = isSelected(child.id, oi)
                    const optGifts = child.option_gifts?.[oi]?.map((gid: number) => giftMap.get(gid)).filter(Boolean) as GiftData[] | undefined

                    return (
                      <div key={oi} style={{ marginTop: '0.375rem' }}>
                        <button
                          onClick={() => handleSelect(child, oi)}
                          className="w-full text-left rounded transition-all"
                          style={{
                            padding: '0.5rem 0.625rem', fontSize: '0.6875rem',
                            background: sel ? 'rgba(200,144,10,0.08)' : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${sel ? 'rgba(200,144,10,0.25)' : 'rgba(255,255,255,0.04)'}`,
                            color: sel ? '#e8b030' : '#a0907a',
                          }}
                        >
                          <div className="flex items-start gap-1.5">
                            {sel && <Check style={{ width: '0.625rem', height: '0.625rem', color: '#c8900a', flexShrink: 0, marginTop: '0.0625rem' }} />}
                            <div className="flex-1 min-w-0">
                              <span>{colorizeEventText(opt.message)}</span>
                              {opt.messageDesc && (
                                <span style={{ fontSize: '0.625rem', color: '#6a6050', marginLeft: '0.375rem' }}>
                                  — {colorizeEventText(opt.messageDesc)}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>

                        {/* 결과 텍스트 */}
                        {opt.result && opt.result.length > 0 && (
                          <div style={{
                            padding: '0.375rem 0.625rem', marginTop: '0.125rem',
                            background: 'rgba(255,255,255,0.01)', borderRadius: '0 0 0.25rem 0.25rem',
                          }}>
                            {opt.result.map((r, ri) => (
                              <p key={ri} style={{ fontSize: '0.625rem', color: '#5a5040', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                                {colorizeEventText(r)}
                              </p>
                            ))}
                          </div>
                        )}

                        {optGifts && optGifts.length > 0 && (
                          <div className="flex flex-wrap gap-1" style={{ marginTop: '0.375rem', padding: '0 0.625rem' }}>
                            {optGifts.map(gift => (
                              <span key={gift.game_id} className="inline-flex items-center gap-1 rounded" style={{
                                background: 'rgba(252,186,3,0.06)', padding: '0.125rem 0.375rem',
                                border: '1px solid rgba(252,186,3,0.12)',
                              }}>
                                {gift.image_url && <Image src={gift.image_url} alt="" width={14} height={14} style={{ width: '0.75rem', height: '0.75rem', objectFit: 'contain' }} />}
                                <span style={{ fontSize: '0.5625rem', color: '#fcba03' }}>{gift.name}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {grandChildren.length > 0 && (
                    <ChildEventTree events={grandChildren} childMap={childMap} giftMap={giftMap} state={state} dispatch={dispatch} isSelected={isSelected} handleSelect={handleSelect} depth={depth + 1} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
