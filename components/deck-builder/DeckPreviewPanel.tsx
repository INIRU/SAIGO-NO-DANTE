'use client'

import { memo } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import {
  Identity,
  ATK_TYPE_ICON_MAP,
  type ActivationCondition,
} from '@/lib/data/sinners'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { normalizeGiftAffiliationLabel } from '@/lib/decks/keyword-rules'
import { localizeDeckKeyword } from '@/components/decks/decks-types'
import { getLocalizedAffiliations } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'

interface GiftStatus {
  name: string
  keyword: string
  grade: string
  image_url: string | null
  effect_base: string | null
  condition: ActivationCondition
  current: number
  formationCurrent?: number
  allCurrent?: number
  met: boolean
  level?: 'met' | 'warn' | 'unmet'
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
  const locale = useLocale() as SupportedLang
  const t = useTranslations('decks.builder.gifts')
  const deckT = useTranslations('decks')
  const { getIconUrl, keywords } = useKeywordData()

  return (
    <>
      {/* ── 활성 가능 EGO 기프트 패널 (거던 유형만) ─────────────────────── */}
      {['거던5층', '거던10층', '거던15층'].includes(contentType) && (
        <div className="mt-4" style={{ border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
          <div className="flex items-center gap-3 px-4 py-2.5" style={{ background: 'rgba(10,8,5,0.5)' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', fontFamily: 'var(--font-mono)', flexShrink: 0, letterSpacing: '0.05em' }}>{t('panelTitle')}</span>
            {activatableGifts.length > 0 && (
              <span style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{activatableGifts.filter(g => g.met).length}</span>
                <span> {t('active')}</span>
              </span>
            )}
            <div className="flex-1" />
            <button
              onClick={onOpenGiftModal}
              className="min-h-11 rounded px-3 transition-all"
              style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)', background: 'transparent', flexShrink: 0, fontSize: '0.9375rem' }}
            >
              {t('openAll')}
            </button>
            <button
              onClick={() => setShowGiftPanel(v => !v)}
              className="min-h-11 rounded px-3 transition-all"
              aria-label={showGiftPanel ? t('collapse') : t('expand')}
              style={{ color: showGiftPanel ? 'var(--gold)' : 'var(--text-secondary)', border: `1px solid ${showGiftPanel ? 'var(--gold)' : 'var(--border)'}`, background: showGiftPanel ? 'rgba(200,144,10,0.08)' : 'transparent', flexShrink: 0, fontSize: '0.9375rem' }}
            >
              {showGiftPanel ? '▲' : '▼'}
            </button>
          </div>

          {showGiftPanel && (() => {
            const GIFT_KW_TABS = ['전체', '화상', '출혈', '진동', '파열', '침잠', '호흡', '충전', '참격', '관통', '타격', '공통'] as const
            const GIFT_GRADES = ['전체', '열쇠', '갈래', '징표', '화폐', '에고'] as const
            const STATUS_OPTS = [
              { value: 'all' as const, label: t('all') },
              { value: 'met' as const, label: t('active') },
              { value: 'unmet' as const, label: t('inactive') },
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
                      placeholder={t('searchPlaceholder')}
                      className="min-h-11 w-full rounded pl-3 pr-3 outline-none"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#ccc', fontSize: '0.9375rem', fontFamily: 'var(--font-body)' }}
                    />
                  </div>
                  <select
                    value={giftGradeFilter}
                    onChange={e => setGiftGradeFilter(e.target.value)}
                    className="min-h-11 rounded px-2 outline-none"
                    style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${giftGradeFilter !== '전체' ? 'rgba(200,144,10,0.4)' : 'rgba(255,255,255,0.08)'}`, color: giftGradeFilter !== '전체' ? 'var(--gold)' : '#888', fontSize: '0.9375rem', cursor: 'pointer' }}
                  >
                    {GIFT_GRADES.map(g => <option key={g} value={g}>{g === '전체' ? t('gradeFilter') : t(`grades.${g}`)}</option>)}
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
                          fontSize: '0.9375rem',
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
                    const kwLabel = kw === '전체' ? t('all') : localizeDeckKeyword(kw, keywords[kw], locale)
                    return (
                      <button
                        key={kw}
                        onClick={() => setGiftTabKw(kw)}
                        className="flex items-center gap-1 px-2 py-1 rounded transition-all"
                        style={{
                          fontSize: '0.9375rem', fontWeight: isActive ? 700 : 400,
                          color: isActive ? 'var(--gold)' : '#555',
                          background: isActive ? 'rgba(200,144,10,0.1)' : 'transparent',
                          border: `1px solid ${isActive ? 'rgba(200,144,10,0.25)' : 'rgba(255,255,255,0.04)'}`,
                        }}
                      >
                        {kwIcon && <Image src={kwIcon} alt="" width={11} height={11} />}
                        {kwLabel}
                        {metCount > 0 && <span style={{ color: 'var(--gold)', fontSize: '0.875rem' }}>{metCount}</span>}
                      </button>
                    )
                  })}
                </div>

                {/* 기프트 목록 */}
                <div style={{ padding: '6px 8px', maxHeight: '320px', overflowY: 'auto' }}>
                  {Object.values(deckSlots).filter(Boolean).length === 0 ? (
                    <p className="text-center py-4" style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>{t('selectIdentityFirst')}</p>
                  ) : filtered.length === 0 ? (
                    <p className="text-center py-3" style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>{t('noResults')}</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {filtered.map(g => {
                        const c = g.condition
                        const affiliations = c.affiliations ?? (c.affiliation ? [c.affiliation] : [])
                        const affiliationLabel = c.type === 'affiliation'
                          ? getLocalizedAffiliations(affiliations.map(normalizeGiftAffiliationLabel), locale).join('/')
                          : ''
                        const condLabel = c.type === 'keyword' ? deckT('egoGifts.conditionKeyword', { keyword: localizeDeckKeyword(c.keyword!, keywords[c.keyword!], locale), count: c.count })
                          : c.type === 'multi_keyword' ? deckT('egoGifts.conditionMultiKeyword', { keywords: c.keywords!.map(kw => localizeDeckKeyword(kw, keywords[kw], locale)).join('+'), count: c.count })
                          : c.type === 'affiliation' ? deckT('egoGifts.conditionAffiliation', { affiliation: affiliationLabel, count: c.count })
                          : deckT('egoGifts.conditionCount', { count: c.count })
                        const pct = Math.min(g.current / c.count, 1)
                        const kwIcon = getIconUrl(g.keyword) ?? ATK_TYPE_ICON_MAP[g.keyword] ?? null
                        const statusLevel = g.level ?? (g.met ? 'met' : 'unmet')
                        const statusColor = statusLevel === 'met' ? 'var(--gold)' : statusLevel === 'warn' ? '#d8b040' : '#777'
                        const statusBorder = statusLevel === 'met' ? 'rgba(200,144,10,0.2)' : statusLevel === 'warn' ? 'rgba(216,176,64,0.24)' : 'rgba(255,255,255,0.03)'
                        const statusBg = statusLevel === 'met' ? 'rgba(200,144,10,0.06)' : statusLevel === 'warn' ? 'rgba(216,176,64,0.05)' : 'rgba(255,255,255,0.01)'
                        const conditionProgress = statusLevel === 'warn' && g.formationCurrent !== undefined && g.allCurrent !== undefined
                          ? t('benchProgress', { formation: g.formationCurrent, all: g.allCurrent, count: c.count })
                          : `${g.current}/${c.count}`

                        return (
                          <div
                            key={g.name}
                            className="flex items-center gap-2.5 px-3 py-2 rounded"
                            style={{
                              background: statusBg,
                              border: `1px solid ${statusBorder}`,
                              opacity: statusLevel === 'unmet' ? 0.6 : 1,
                            }}
                          >
                            {g.image_url ? (
                              <Image src={g.image_url} alt="" width={28} height={28} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: statusLevel === 'met' ? '1.5px solid var(--gold)' : statusLevel === 'warn' ? '1.5px solid rgba(216,176,64,0.7)' : '1px solid rgba(255,255,255,0.08)' }} />
                            ) : (
                              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1a1510', flexShrink: 0 }} />
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="flex items-center gap-1.5">
                                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: statusColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</span>
                                <span style={{ fontSize: '0.875rem', color: '#666', flexShrink: 0 }}>{g.grade}</span>
                              </div>
                              <div className="flex items-center gap-1 mt-0.5">
                                {kwIcon && <Image src={kwIcon} alt="" width={10} height={10} style={{ flexShrink: 0 }} />}
                                <span style={{ fontSize: '0.875rem', color: statusLevel === 'met' ? '#88a830' : statusLevel === 'warn' ? '#b89540' : '#666' }}>
                                  {condLabel} ({conditionProgress})
                                </span>
                                <div style={{ width: 40, height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2, flexShrink: 0, marginLeft: 4 }}>
                                  <div style={{ width: `${pct * 100}%`, height: '100%', background: statusLevel === 'met' ? 'var(--gold)' : statusLevel === 'warn' ? '#d8b040' : '#555', borderRadius: 2, transition: 'width 0.3s' }} />
                                </div>
                              </div>
                            </div>
                            {statusLevel !== 'unmet' && (
                              <span style={{ fontSize: '0.875rem', color: statusColor, fontWeight: 700, fontFamily: 'var(--font-mono)', flexShrink: 0, letterSpacing: '0.05em' }}>{statusLevel === 'met' ? deckT('egoGifts.on') : t('warning')}</span>
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
