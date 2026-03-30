'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { Check, AlertCircle, ChevronDown, ChevronUp, X } from 'lucide-react'
import type { RunState, RunAction } from '@/lib/planner/run-types'
import type { MirrorDungeonEvent } from '@/components/mirror-dungeon/types'
import type { GiftData } from '@/lib/planner/types'
import ImageWithFallback from '@/components/ui/ImageWithFallback'
import { BLUR_PLACEHOLDER } from '@/lib/utils/images'

interface Props {
  state: RunState
  dispatch: React.Dispatch<RunAction>
  events: MirrorDungeonEvent[]
  giftMap: Map<number, GiftData>
}

/** 이벤트 텍스트의 {0} 등 플레이스홀더 치환 */
function replacePlaceholders(text: string | null | undefined): string {
  if (!text) return ''
  return text.replace(/\{(\d+)\}/g, '???')
}

export default function EventSection({ state, dispatch, events, giftMap }: Props) {
  const currentLog = state.floorLogs[state.currentFloor - 1]
  const themeId = currentLog?.themeId ? Number(currentLog.themeId) : null
  const [selectedEvent, setSelectedEvent] = useState<MirrorDungeonEvent | null>(null)
  const [search, setSearch] = useState('')

  // 현재 테마팩 이벤트 (루트만)
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

  // 검색 필터링 (이벤트 이름/설명 + 선택지 + 보상 기프트 이름)
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

  // 자식 이벤트 맵
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

      {/* 이벤트 카드 그리드 (거던 페이지 패턴) */}
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
                      {replacePlaceholders(ev.desc_text?.split('\n')[0]?.slice(0, 30)) || `이벤트 #${ev.id}`}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {evGifts.length > 0 && <span style={{ color: '#c8900a', fontSize: '0.5rem', fontFamily: 'var(--font-mono)' }}>{evGifts.length}종</span>}
                      {ev.options && <span style={{ color: '#888', fontSize: '0.5rem', fontFamily: 'var(--font-mono)' }}>선택지 {ev.options.length}</span>}
                      {childCount > 0 && <span style={{ color: '#6090d0', fontSize: '0.5rem', fontFamily: 'var(--font-mono)' }}>+{childCount}</span>}
                      {hasSelected && <Check style={{ width: '0.5rem', height: '0.5rem', color: '#c8900a' }} />}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '0.625rem' }}>
                  <p className="font-serif leading-tight line-clamp-2" style={{ color: '#ccc', fontSize: '0.6875rem', marginBottom: '0.375rem' }}>
                    {replacePlaceholders(ev.desc_text?.split('\n')[0]?.slice(0, 40)) || `이벤트 #${ev.id}`}
                  </p>
                  <div className="flex items-center gap-1">
                    {evGifts.length > 0 && <span style={{ color: '#c8900a', fontSize: '0.5rem', fontFamily: 'var(--font-mono)' }}>{evGifts.length}종</span>}
                    {ev.options && <span style={{ color: '#888', fontSize: '0.5rem', fontFamily: 'var(--font-mono)' }}>선택지 {ev.options.length}</span>}
                    {childCount > 0 && <span style={{ color: '#6090d0', fontSize: '0.5rem', fontFamily: 'var(--font-mono)' }}>+{childCount}</span>}
                    {hasSelected && <Check style={{ width: '0.5rem', height: '0.5rem', color: '#c8900a' }} />}
                  </div>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* 이벤트 상세 모달 (거던 페이지 패턴) */}
      {selectedEvent && (() => {
        const ev = selectedEvent
        const children = childMap.get(ev.id) ?? []
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setSelectedEvent(null)} style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(0.5rem)', padding: 'calc(env(safe-area-inset-top) + 1rem) calc(env(safe-area-inset-right) + 1rem) calc(env(safe-area-inset-bottom) + 1rem) calc(env(safe-area-inset-left) + 1rem)' }}>
          <div onClick={e => e.stopPropagation()} className="relative w-full overflow-hidden" style={{ maxWidth: '36rem', maxHeight: '85vh', borderRadius: '0.75rem', background: '#131110', border: '1px solid rgba(200,144,10,0.12)', boxShadow: '0 0 3rem rgba(200,144,10,0.06), 0 1.5rem 4rem rgba(0,0,0,0.6)' }}>
            {/* 닫기 */}
            <button onClick={() => setSelectedEvent(null)} className="absolute top-2 right-2 z-30 flex items-center justify-center transition-all"
              style={{ color: 'rgba(255,255,255,0.4)', width: '2.75rem', height: '2.75rem', borderRadius: '50%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
              <X style={{ width: '1.125rem', height: '1.125rem' }} />
            </button>
            <div style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            {/* 헤더 */}
            {ev.image_url ? (
              <div className="relative" style={{ height: '8rem' }}>
                <ImageWithFallback src={ev.image_url} alt="" fill fallbackType="default" sizes="36rem" className="object-cover" style={{ opacity: 0.4 }}
                  placeholder="blur" blurDataURL={BLUR_PLACEHOLDER} />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #131110 0%, rgba(19,17,16,0.5) 50%, rgba(19,17,16,0.25) 100%)' }} />
                <div className="absolute bottom-0 left-0 right-0" style={{ padding: '0 1rem 0.75rem' }}>
                  <h3 className="font-serif" style={{ fontSize: '1rem', color: '#e8d0a0', textShadow: '0 0.125rem 0.5rem rgba(200,144,10,0.2)' }}>
                    {ev.name || replacePlaceholders(ev.desc_text?.split('\n')[0]?.slice(0, 50)) || `이벤트 #${ev.id}`}
                  </h3>
                </div>
              </div>
            ) : (
              <div style={{ padding: '1rem', borderBottom: '1px solid rgba(200,144,10,0.08)' }}>
                <h3 className="font-serif" style={{ fontSize: '1rem', color: '#e8d0a0' }}>
                  {ev.name || replacePlaceholders(ev.desc_text?.split('\n')[0]?.slice(0, 50)) || `이벤트 #${ev.id}`}
                </h3>
              </div>
            )}

            {/* 설명 */}
            {ev.desc_text && (
              <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <p style={{ fontSize: '0.75rem', color: '#999', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{replacePlaceholders(ev.desc_text)}</p>
              </div>
            )}

            {/* 선택지 */}
            {ev.options && ev.options.length > 0 && (
              <div style={{ padding: '0.75rem 1rem' }}>
                <p style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#888', marginBottom: '0.5rem' }}>선택지</p>
                <div className="space-y-2">
                  {ev.options.map((option: { message: string; messageDesc?: string; result?: string[] }, optIdx: number) => {
                    const selected = isSelected(ev.id, optIdx)
                    const rewardGifts = ev.option_gifts?.[optIdx]?.map((gid: number) => giftMap.get(gid)).filter(Boolean) as GiftData[] | undefined
                    // 이 선택지에 연결된 자식 이벤트
                    const optionChildren = children.filter(c => c.option_index === optIdx)
                    return (
                      <div key={optIdx}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSelect(ev, optIdx) }}
                          className="w-full text-left rounded transition-all"
                          style={{
                            padding: '0.75rem',
                            minHeight: '2.75rem',
                            background: selected ? 'rgba(200,144,10,0.1)' : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${selected ? 'rgba(200,144,10,0.35)' : 'rgba(255,255,255,0.06)'}`,
                          }}
                        >
                          <div className="flex items-start gap-2">
                            {selected && <Check style={{ width: '0.75rem', height: '0.75rem', color: '#c8900a', flexShrink: 0, marginTop: '0.0625rem' }} />}
                            <div className="flex-1 min-w-0">
                              <p style={{ fontSize: '0.75rem', color: selected ? '#e8b030' : '#ccc' }}>{replacePlaceholders(option.message)}</p>
                              {option.messageDesc && <p style={{ fontSize: '0.625rem', color: '#666', marginTop: '0.125rem' }}>{replacePlaceholders(option.messageDesc)}</p>}
                            </div>
                          </div>
                          {/* 보상 기프트 */}
                          {rewardGifts && rewardGifts.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {rewardGifts.map(gift => (
                                <span key={gift.game_id} className="inline-flex items-center gap-1 rounded" style={{ background: 'rgba(200,144,10,0.08)', padding: '0.125rem 0.375rem', border: '1px solid rgba(200,144,10,0.15)' }}>
                                  {gift.image_url && <Image src={gift.image_url} alt="" width={16} height={16} style={{ width: '0.875rem', height: '0.875rem', objectFit: 'contain' }} />}
                                  <span style={{ fontSize: '0.5625rem', color: '#c8900a' }}>{gift.name}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </button>

                        {/* 하위 이벤트 아코디언 */}
                        {optionChildren.length > 0 && (
                          <ChildEventAccordion events={optionChildren} childMap={childMap} giftMap={giftMap} state={state} dispatch={dispatch} isSelected={isSelected} handleSelect={handleSelect} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 선택지 없는 자식 이벤트 */}
            {children.filter(c => c.option_index == null).length > 0 && (
              <div style={{ padding: '0 1rem 0.75rem' }}>
                <ChildEventAccordion events={children.filter(c => c.option_index == null)} childMap={childMap} giftMap={giftMap} state={state} dispatch={dispatch} isSelected={isSelected} handleSelect={handleSelect} />
              </div>
            )}
            </div>
          </div>
          </div>
        )
      })()}
    </div>
  )
}

// ── 하위 이벤트 아코디언 ──────────────────────────────────────────────────

function ChildEventAccordion({ events: childEvents, childMap, giftMap, state, dispatch, isSelected, handleSelect }: {
  events: MirrorDungeonEvent[]
  childMap: Map<number, MirrorDungeonEvent[]>
  giftMap: Map<number, GiftData>
  state: RunState
  dispatch: React.Dispatch<RunAction>
  isSelected: (eventId: number, optIdx: number) => boolean
  handleSelect: (event: MirrorDungeonEvent, optIdx: number) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ marginLeft: '1rem', marginTop: '0.375rem' }}>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1 transition-colors" style={{ fontSize: '0.625rem', color: '#6090d0', padding: '0.5rem 0', minHeight: '2.75rem' }}>
        {open ? <ChevronUp style={{ width: '0.625rem', height: '0.625rem' }} /> : <ChevronDown style={{ width: '0.625rem', height: '0.625rem' }} />}
        연계 이벤트 ({childEvents.length})
      </button>
      {open && (
        <div className="space-y-2 mt-1">
          {childEvents.map(child => {
            const grandChildren = childMap.get(child.id) ?? []
            return (
              <div key={child.id} className="rounded" style={{ background: 'rgba(96,144,208,0.04)', border: '1px solid rgba(96,144,208,0.1)', padding: '0.5rem 0.625rem' }}>
                <p style={{ fontSize: '0.6875rem', color: '#aab8d0', marginBottom: '0.25rem' }}>
                  {child.name || replacePlaceholders(child.desc_text?.split('\n')[0]?.slice(0, 50)) || `이벤트 #${child.id}`}
                </p>
                {child.desc_text && (
                  <p style={{ fontSize: '0.5625rem', color: '#666', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{replacePlaceholders(child.desc_text)}</p>
                )}
                {/* 자식의 선택지 */}
                {child.options?.map((opt: { message: string }, oi: number) => {
                  const sel = isSelected(child.id, oi)
                  return (
                    <button key={oi} onClick={() => handleSelect(child, oi)}
                      className="w-full text-left rounded mt-1 transition-all" style={{
                        padding: '0.375rem 0.5rem', fontSize: '0.625rem',
                        background: sel ? 'rgba(200,144,10,0.08)' : 'transparent',
                        border: `1px solid ${sel ? 'rgba(200,144,10,0.25)' : 'rgba(255,255,255,0.04)'}`,
                        color: sel ? '#e8b030' : '#999',
                      }}>
                      {sel && <Check style={{ width: '0.5rem', height: '0.5rem', display: 'inline', marginRight: '0.25rem', color: '#c8900a' }} />}
                      {replacePlaceholders(opt.message)}
                    </button>
                  )
                })}
                {/* 손자 이벤트 */}
                {grandChildren.length > 0 && (
                  <ChildEventAccordion events={grandChildren} childMap={childMap} giftMap={giftMap} state={state} dispatch={dispatch} isSelected={isSelected} handleSelect={handleSelect} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
