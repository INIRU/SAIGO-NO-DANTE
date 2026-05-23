'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { Search, X } from 'lucide-react'
import BaseModal from '@/components/ui/BaseModal'
import { ATK_TYPE_ICON_MAP } from '@/lib/data/sinners'
import type { ActivationCondition } from '@/lib/data/sinners'
import { normalizeGiftAffiliationLabel } from '@/lib/decks/keyword-rules'
import { localizeDeckKeyword } from '@/components/decks/decks-types'
import { getLocalizedAffiliations } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import { useKeywordData } from '@/components/providers/KeywordProvider'

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

interface EgoGiftModalProps {
  open: boolean
  onClose: () => void
  activatableGifts: GiftStatus[]
  getIconUrl: (kw: string) => string | null
}

const GIFT_KW_TABS = ['전체', '화상', '출혈', '진동', '파열', '침잠', '호흡', '충전', '참격', '관통', '타격', '공통'] as const
const GIFT_GRADES = ['전체', '열쇠', '갈래', '징표', '화폐', '에고'] as const

export default function EgoGiftModal({ open, onClose, activatableGifts, getIconUrl }: EgoGiftModalProps) {
  const locale = useLocale() as SupportedLang
  const t = useTranslations('decks.builder.gifts')
  const deckT = useTranslations('decks')
  const { keywords } = useKeywordData()
  const [search, setSearch] = useState('')
  const [kwFilter, setKwFilter] = useState('전체')
  const [gradeFilter, setGradeFilter] = useState('전체')
  const [statusFilter, setStatusFilter] = useState<'all' | 'met' | 'unmet'>('all')

  const filtered = useMemo(() => {
    let list = activatableGifts

    if (kwFilter !== '전체') {
      list = list.filter(g => g.keyword === kwFilter)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(g => g.name.toLowerCase().includes(q))
    }
    if (gradeFilter !== '전체') {
      list = list.filter(g => g.grade === gradeFilter)
    }
    if (statusFilter === 'met') {
      list = list.filter(g => g.met)
    } else if (statusFilter === 'unmet') {
      list = list.filter(g => !g.met)
    }

    return list
  }, [activatableGifts, kwFilter, search, gradeFilter, statusFilter])

  const metCount = filtered.filter(g => g.met).length
  const unmetCount = filtered.length - metCount

  // 키워드별 카운트 (탭에 표시)
  const kwCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const g of activatableGifts) {
      counts[g.keyword] = (counts[g.keyword] ?? 0) + 1
    }
    return counts
  }, [activatableGifts])

  return (
    <BaseModal open={open} onClose={onClose} maxWidth="42rem" padding="1rem" title={t('modalTitle')}>
      <div
        data-deck-builder-modal="gift"
        className="flex flex-col w-full"
        style={{
          maxHeight: '85vh',
          background: 'var(--bg-card, #1a1510)',
          border: '1px solid var(--border)',
          borderRadius: '0.5rem',
          boxShadow: '0 1.5rem 4rem rgba(0,0,0,0.6)',
        }}
      >
        {/* 헤더 */}
        <div className="flex items-center gap-3 px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="font-serif font-light" style={{ color: 'var(--gold)', fontSize: '1.0625rem' }}>{t('modalHeading')}</span>
          <span style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
            {t('count', { count: activatableGifts.length })}
          </span>
          <div className="flex-1" />
          <button onClick={onClose} aria-label={t('close')} className="min-h-11 min-w-11" style={{ color: '#888', fontSize: '1.25rem', lineHeight: 1, padding: '0 0.25rem' }}>
            <X size={18} />
          </button>
        </div>

        {/* 검색 + 필터 */}
        <div className="px-4 py-3 flex flex-col gap-2.5 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
          {/* 검색 바 */}
          <div className="relative">
            <Search size={13} style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', color: '#555', pointerEvents: 'none' }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('searchNamePlaceholder')}
              className="min-h-11 w-full rounded pl-8 pr-3 outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#ccc', fontSize: '0.9375rem', fontFamily: 'var(--font-body)' }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label={t('clearSearch')}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded"
                style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: '#666', cursor: 'pointer' }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* 키워드 탭 */}
          <div className="flex flex-wrap gap-1">
            {GIFT_KW_TABS.map(kw => {
              const isActive = kwFilter === kw
              const kwIcon = kw !== '전체' ? (getIconUrl(kw) ?? (ATK_TYPE_ICON_MAP as Record<string, string>)[kw] ?? null) : null
              const count = kw === '전체' ? activatableGifts.length : (kwCounts[kw] ?? 0)
              if (kw !== '전체' && count === 0) return null
              return (
                <button
                  key={kw}
                  onClick={() => setKwFilter(kw)}
                  className="flex min-h-11 items-center gap-1 rounded px-2 transition-colors"
                style={{
                    fontSize: '0.9375rem',
                    fontWeight: isActive ? 700 : 400,
                    color: isActive ? 'var(--gold)' : '#555',
                    background: isActive ? 'rgba(200,144,10,0.1)' : 'transparent',
                    border: `1px solid ${isActive ? 'rgba(200,144,10,0.25)' : 'rgba(255,255,255,0.04)'}`,
                  }}
                >
                  {kwIcon && <Image src={kwIcon} alt="" width={11} height={11} style={{ width: '0.6875rem', height: '0.6875rem' }} unoptimized />}
                  {kw === '전체' ? t('all') : localizeDeckKeyword(kw, keywords[kw], locale)}
                </button>
              )
            })}
          </div>

          {/* 등급 + 상태 필터 */}
          <div className="flex items-center gap-2">
            <select
              value={gradeFilter}
              onChange={e => setGradeFilter(e.target.value)}
              className="min-h-11 rounded px-2 outline-none"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${gradeFilter !== '전체' ? 'rgba(200,144,10,0.4)' : 'rgba(255,255,255,0.08)'}`,
                color: gradeFilter !== '전체' ? 'var(--gold)' : '#888',
                fontSize: '0.9375rem',
                cursor: 'pointer',
              }}
            >
              {GIFT_GRADES.map(g => <option key={g} value={g}>{g === '전체' ? t('gradeAll') : t(`grades.${g}`)}</option>)}
            </select>

            <div className="flex rounded overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
              {([
                { value: 'all' as const, label: t('all') },
                { value: 'met' as const, label: t('active') },
                { value: 'unmet' as const, label: t('inactive') },
              ]).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className="min-h-11 px-2.5 transition-colors"
                  style={{
                    background: statusFilter === opt.value ? 'rgba(200,144,10,0.15)' : 'transparent',
                    color: statusFilter === opt.value ? 'var(--gold)' : '#555',
                    fontSize: '0.9375rem',
                    fontFamily: 'var(--font-heading)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex-1" />
            <span style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem', fontFamily: 'var(--font-mono)' }}>
              {metCount > 0 && <><span style={{ color: 'var(--gold)', fontWeight: 700 }}>{metCount}</span> {t('active')}</>}
              {metCount > 0 && unmetCount > 0 && ' / '}
              {unmetCount > 0 && <><span style={{ color: '#666' }}>{unmetCount}</span> {t('inactive')}</>}
            </span>
          </div>
        </div>

        {/* 기프트 목록 */}
        <div className="overflow-y-auto flex-1 px-4 py-3" style={{ minHeight: 0 }}>
          {filtered.length === 0 ? (
            <p className="text-center py-8" style={{ color: 'var(--text-tertiary)', fontSize: '0.9375rem' }}>
              {activatableGifts.length === 0 ? t('selectIdentityFirst') : t('noResults')}
            </p>
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
                const kwIcon = getIconUrl(g.keyword) ?? (ATK_TYPE_ICON_MAP as Record<string, string>)[g.keyword] ?? null
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
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded"
                    style={{
                      background: statusBg,
                      border: `1px solid ${statusBorder}`,
                      opacity: statusLevel === 'unmet' ? 0.7 : 1,
                    }}
                  >
                    {g.image_url ? (
                      <Image
                        src={g.image_url}
                        alt=""
                        width={32}
                        height={32}
                        style={{
                          width: '2rem', height: '2rem',
                          borderRadius: '50%', objectFit: 'cover', flexShrink: 0,
                          border: statusLevel === 'met' ? '1.5px solid var(--gold)' : statusLevel === 'warn' ? '1.5px solid rgba(216,176,64,0.7)' : '1px solid rgba(255,255,255,0.08)',
                        }}
                      />
                    ) : (
                      <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: '#1a1510', flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex items-center gap-1.5">
                        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: statusColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</span>
                        <span style={{ fontSize: '0.875rem', color: '#666', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>{g.grade}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {kwIcon && <Image src={kwIcon} alt="" width={10} height={10} style={{ flexShrink: 0, width: '0.625rem', height: '0.625rem' }} unoptimized />}
                        <span style={{ fontSize: '0.875rem', color: statusLevel === 'met' ? '#88a830' : statusLevel === 'warn' ? '#b89540' : '#666' }}>
                          {condLabel} ({conditionProgress})
                        </span>
                        <div style={{ width: '2.5rem', height: '0.1875rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.125rem', flexShrink: 0, marginLeft: '0.25rem' }}>
                          <div style={{ width: `${pct * 100}%`, height: '100%', background: statusLevel === 'met' ? 'var(--gold)' : statusLevel === 'warn' ? '#d8b040' : '#555', borderRadius: '0.125rem', transition: 'width 0.3s' }} />
                        </div>
                      </div>
                      {g.effect_base && (
                        <p style={{ fontSize: '0.875rem', color: '#777', marginTop: '0.1875rem', lineHeight: 1.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {g.effect_base}
                        </p>
                      )}
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
    </BaseModal>
  )
}
