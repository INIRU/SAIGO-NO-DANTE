'use client'

import { memo } from 'react'
import Image from 'next/image'
import {
  Identity,
  ATK_TYPE_ICON_MAP,
  type ActivationCondition,
} from '@/lib/data/sinners'
import { useKeywordData } from '@/components/providers/KeywordProvider'

interface GiftStatus {
  name: string
  keyword: string
  grade: string
  image_url: string | null
  effect_base: string | null
  condition: ActivationCondition
  current: number
  met: boolean
}

interface Props {
  deckSlots: Record<string, Identity | undefined>
  activatableGifts: GiftStatus[]
  contentType: string
  showGiftPanel: boolean
  setShowGiftPanel: (v: boolean | ((prev: boolean) => boolean)) => void
  giftTabKw: string
  setGiftTabKw: (kw: string) => void
  giftSearch: string
  setGiftSearch: (v: string) => void
  giftGradeFilter: string
  setGiftGradeFilter: (v: string) => void
  giftStatusFilter: 'all' | 'met' | 'unmet'
  setGiftStatusFilter: (v: 'all' | 'met' | 'unmet') => void
  onOpenGiftModal: () => void
}

function DeckPreviewPanel({
  deckSlots, activatableGifts,
  contentType,
  showGiftPanel, setShowGiftPanel,
  giftTabKw, setGiftTabKw,
  giftSearch, setGiftSearch,
  giftGradeFilter, setGiftGradeFilter,
  giftStatusFilter, setGiftStatusFilter,
  onOpenGiftModal,
}: Props) {
  const { getIconUrl } = useKeywordData()

  return (
    <>
      {/* ── 활성 가능 EGO 기프트 패널 (거던 유형만) ─────────────────────── */}
      {['거던5층', '거던10층', '거던15층'].includes(contentType) && (
        <div className="mt-4" style={{ border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
          <div className="flex items-center gap-3 px-4 py-2.5" style={{ background: 'rgba(10,8,5,0.5)' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', flexShrink: 0, letterSpacing: '0.05em' }}>E.G.O 기프트</span>
            {activatableGifts.length > 0 && (
              <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{activatableGifts.filter(g => g.met).length}</span>
                <span> 활성</span>
              </span>
            )}
            <div className="flex-1" />
            <button
              onClick={onOpenGiftModal}
              className="text-xs px-2.5 py-1 rounded transition-all"
              style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)', background: 'transparent', flexShrink: 0 }}
            >
              전체 보기 →
            </button>
            <button
              onClick={() => setShowGiftPanel(v => !v)}
              className="text-xs px-2.5 py-1 rounded transition-all"
              style={{ color: showGiftPanel ? 'var(--gold)' : 'var(--text-secondary)', border: `1px solid ${showGiftPanel ? 'var(--gold)' : 'var(--border)'}`, background: showGiftPanel ? 'rgba(200,144,10,0.08)' : 'transparent', flexShrink: 0 }}
            >
              {showGiftPanel ? '▲' : '▼'}
            </button>
          </div>

          {showGiftPanel && (() => {
            const GIFT_KW_TABS = ['전체', '화상', '출혈', '진동', '파열', '침잠', '호흡', '충전', '참격', '관통', '타격', '공통'] as const
            const GIFT_GRADES = ['전체', '열쇠', '갈래', '징표', '화폐', '에고'] as const
            const STATUS_OPTS = [
              { value: 'all' as const, label: '전체' },
              { value: 'met' as const, label: '활성' },
              { value: 'unmet' as const, label: '미활성' },
            ]
            let filtered = giftTabKw === '전체'
              ? activatableGifts
              : activatableGifts.filter(g => g.keyword === giftTabKw)
            // 텍스트 검색
            if (giftSearch.trim()) {
              const q = giftSearch.trim().toLowerCase()
              filtered = filtered.filter(g => g.name.toLowerCase().includes(q))
            }
            // 등급 필터
            if (giftGradeFilter !== '전체') {
              filtered = filtered.filter(g => g.grade === giftGradeFilter)
            }
            // 활성 상태 필터
            if (giftStatusFilter === 'met') {
              filtered = filtered.filter(g => g.met)
            } else if (giftStatusFilter === 'unmet') {
              filtered = filtered.filter(g => !g.met)
            }
            const metByKw: Record<string, number> = {}
            for (const g of activatableGifts) {
              if (g.met) metByKw[g.keyword] = (metByKw[g.keyword] ?? 0) + 1
            }

            return (
              <div style={{ background: 'rgba(5,4,2,0.7)', borderTop: '1px solid var(--border)' }}>
                {/* 검색 + 필터 바 */}
                <div className="flex flex-wrap items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <div className="relative flex-1" style={{ minWidth: '7.5rem', maxWidth: '14rem' }}>
                    <input
                      type="text"
                      value={giftSearch}
                      onChange={e => setGiftSearch(e.target.value)}
                      placeholder="기프트 검색..."
                      className="w-full pl-2 pr-2 py-1 rounded text-xs outline-none"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#ccc', fontSize: '0.6875rem', fontFamily: 'var(--font-body)' }}
                    />
                  </div>
                  <select
                    value={giftGradeFilter}
                    onChange={e => setGiftGradeFilter(e.target.value)}
                    className="rounded text-xs py-1 px-2 outline-none"
                    style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${giftGradeFilter !== '전체' ? 'rgba(200,144,10,0.4)' : 'rgba(255,255,255,0.08)'}`, color: giftGradeFilter !== '전체' ? 'var(--gold)' : '#888', fontSize: '0.6875rem', cursor: 'pointer' }}
                  >
                    {GIFT_GRADES.map(g => <option key={g} value={g}>{g === '전체' ? '등급' : g}</option>)}
                  </select>
                  <div className="flex rounded overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                    {STATUS_OPTS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setGiftStatusFilter(opt.value)}
                        className="px-2 py-1 text-xs transition-colors"
                        style={{
                          background: giftStatusFilter === opt.value ? 'rgba(200,144,10,0.15)' : 'transparent',
                          color: giftStatusFilter === opt.value ? 'var(--gold)' : '#555',
                          fontSize: '0.625rem',
                          fontFamily: 'var(--font-heading)',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* 키워드 탭 */}
                <div className="flex flex-wrap gap-1 px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  {GIFT_KW_TABS.map(kw => {
                    const isActive = giftTabKw === kw
                    const kwIcon = kw !== '전체' ? (getIconUrl(kw) ?? ATK_TYPE_ICON_MAP[kw] ?? null) : null
                    const metCount = kw === '전체' ? activatableGifts.filter(g => g.met).length : (metByKw[kw] ?? 0)
                    const totalCount = kw === '전체' ? activatableGifts.length : activatableGifts.filter(g => g.keyword === kw).length
                    if (kw !== '전체' && totalCount === 0) return null
                    return (
                      <button
                        key={kw}
                        onClick={() => setGiftTabKw(kw)}
                        className="flex items-center gap-1 px-2 py-1 rounded transition-all"
                        style={{
                          fontSize: '0.75rem', fontWeight: isActive ? 700 : 400,
                          color: isActive ? 'var(--gold)' : '#555',
                          background: isActive ? 'rgba(200,144,10,0.1)' : 'transparent',
                          border: `1px solid ${isActive ? 'rgba(200,144,10,0.25)' : 'rgba(255,255,255,0.04)'}`,
                        }}
                      >
                        {kwIcon && <Image src={kwIcon} alt="" width={11} height={11} />}
                        {kw}
                        {metCount > 0 && <span style={{ color: 'var(--gold)', fontSize: '0.75rem' }}>{metCount}</span>}
                      </button>
                    )
                  })}
                </div>

                {/* 기프트 목록 */}
                <div style={{ padding: '6px 8px', maxHeight: '320px', overflowY: 'auto' }}>
                  {Object.values(deckSlots).filter(Boolean).length === 0 ? (
                    <p className="text-center py-4" style={{ color: 'var(--text-tertiary)', fontSize: '0.6875rem' }}>인격을 먼저 편성해주세요</p>
                  ) : filtered.length === 0 ? (
                    <p className="text-center py-3" style={{ color: 'var(--text-tertiary)', fontSize: '0.6875rem' }}>해당하는 기프트가 없습니다</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {filtered.map(g => {
                        const c = g.condition
                        const condLabel = c.type === 'keyword' ? `${c.keyword} ${c.count}인`
                          : c.type === 'multi_keyword' ? `${c.keywords!.join('+')} ${c.count}인`
                          : c.type === 'affiliation' ? `${c.affiliation ?? c.affiliations!.join('/')} ${c.count}인`
                          : `${c.count}인`
                        const pct = Math.min(g.current / c.count, 1)
                        const kwIcon = getIconUrl(g.keyword) ?? ATK_TYPE_ICON_MAP[g.keyword] ?? null

                        return (
                          <div
                            key={g.name}
                            className="flex items-center gap-2.5 px-3 py-2 rounded"
                            style={{
                              background: g.met ? 'rgba(200,144,10,0.06)' : 'rgba(255,255,255,0.01)',
                              border: `1px solid ${g.met ? 'rgba(200,144,10,0.2)' : 'rgba(255,255,255,0.03)'}`,
                              opacity: g.met ? 1 : 0.6,
                            }}
                          >
                            {g.image_url ? (
                              <Image src={g.image_url} alt="" width={28} height={28} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: g.met ? '1.5px solid var(--gold)' : '1px solid rgba(255,255,255,0.08)' }} />
                            ) : (
                              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1a1510', flexShrink: 0 }} />
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="flex items-center gap-1.5">
                                <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: g.met ? 'var(--gold)' : '#777', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</span>
                                <span style={{ fontSize: '0.75rem', color: '#444', flexShrink: 0 }}>{g.grade}</span>
                              </div>
                              <div className="flex items-center gap-1 mt-0.5">
                                {kwIcon && <Image src={kwIcon} alt="" width={10} height={10} style={{ flexShrink: 0 }} />}
                                <span style={{ fontSize: '0.75rem', color: g.met ? '#88a830' : '#666' }}>
                                  {condLabel} ({g.current}/{c.count})
                                </span>
                                <div style={{ width: 40, height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2, flexShrink: 0, marginLeft: 4 }}>
                                  <div style={{ width: `${pct * 100}%`, height: '100%', background: g.met ? 'var(--gold)' : '#555', borderRadius: 2, transition: 'width 0.3s' }} />
                                </div>
                              </div>
                            </div>
                            {g.met && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--gold)', fontWeight: 700, fontFamily: 'var(--font-mono)', flexShrink: 0, letterSpacing: '0.05em' }}>ON</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </>
  )
}

export default memo(DeckPreviewPanel)
