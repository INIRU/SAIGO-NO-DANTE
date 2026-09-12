'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQueryState, parseAsString } from 'nuqs'
import { Search, X, RotateCcw, LayoutList, Grid3X3 } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useLocale } from 'next-intl'
import { useFormatSkillDesc } from '@/components/providers/KeywordProvider'
import FilterSidebar from '@/components/browser/FilterSidebar'
import Dropdown, { type DropdownOption } from '@/components/ui/Dropdown'
import KeywordGrid from './KeywordGrid'
import KeywordModal from './KeywordModal'
import { translations } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'
import { getLocalizedName, getLocalizedKeywordName, getLocalizedKeywordDesc } from '@/lib/i18n/localize'
import { workbenchReveal } from '@/lib/animations'

/* ── 타입 ── */
interface Keyword {
  name: string
  description: string | null
  max_stack: number | null
  icon_slug: string | null
  sin_affinity: string | null
  category: string | null
  name_en?: string | null
  name_jp?: string | null
  description_en?: string | null
  description_jp?: string | null
}

interface Identity {
  id: string
  name: string
  name_kr: string
  name_en: string | null
  name_jp: string | null
  sinner_id: string
  keywords: string[] | null
  rarity: number
  game_id: string | null
  folder_name: string | null
}

interface Sinner {
  id: string
  name_kr: string
  name_en: string | null
  name_jp: string | null
}

interface EgoGift {
  name: string
  keyword: string
  grade: string
  image_url: string | null
  effect_base: string | null
  effect_plus: string | null
  effect_plusplus: string | null
}

interface EGO {
  id: string
  name: string
  name_kr: string | null
  name_en: string | null
  name_jp: string | null
  sinner_id: string
  grade: string
  sin_affinity: string | null
  keywords: string[] | null
  folder_name: string | null
  image_url: string | null
}

/* ── 상수 ── */
type KeywordCategory = '상태이상' | '버프' | '디버프' | '고유' | '기타'

type SortKey = 'default' | 'name'

export default function KeywordsClient({
  keywords, identities, sinners, gifts, egos,
}: {
  keywords: Keyword[]
  identities: Identity[]
  sinners: Sinner[]
  gifts: EgoGift[]
  egos: EGO[]
}) {
  const [selected, setSelected] = useState<Keyword | null>(null)
  const formatSkillDesc = useFormatSkillDesc()
  const shouldReduceMotion = useReducedMotion()

  const locale = useLocale()
  const lang = locale as SupportedLang
  const t = (key: string) => {
    const entry = translations[key as keyof typeof translations]
    if (!entry) return key
    return entry[lang] ?? entry['ko'] ?? key
  }

  const CATEGORIES = useMemo(() => [
    { value: '상태이상' as KeywordCategory, label: t('keyword.category.statusEffect'), color: '#e05050' },
    { value: '버프' as KeywordCategory, label: t('keyword.category.buff'), color: '#50b060' },
    { value: '디버프' as KeywordCategory, label: t('keyword.category.debuff'), color: '#7070c0' },
    { value: '고유' as KeywordCategory, label: t('keyword.category.unique'), color: '#c8900a' },
    { value: '기타' as KeywordCategory, label: t('keyword.category.other'), color: '#888888' },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [lang])

  const sortOptions: DropdownOption<SortKey>[] = useMemo(() => [
    { value: 'default', label: t('keyword.sort.frequency') },
    { value: 'name', label: t('keyword.sort.name') },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [lang])

  /* ── nuqs URL 상태 ── */
  const [viewMode, setViewMode] = useQueryState('view', parseAsString.withDefault('detail'))
  const [catParam, setCatParam] = useQueryState('cat', parseAsString.withDefault(''))
  const [search, setSearch] = useQueryState('q', parseAsString.withDefault(''))
  const [sortParam, setSortParam] = useQueryState('sort', parseAsString.withDefault('default'))

  const selectedCategories = useMemo(() => {
    if (!catParam) return new Set<KeywordCategory>()
    return new Set(catParam.split(',').filter(Boolean) as KeywordCategory[])
  }, [catParam])

  const sort = (sortParam as SortKey) || 'default'

  const toggleCategory = useCallback((cat: KeywordCategory) => {
    const next = new Set(selectedCategories)
    if (next.has(cat)) next.delete(cat)
    else next.add(cat)
    setCatParam(next.size > 0 ? Array.from(next).join(',') : null)
  }, [selectedCategories, setCatParam])

  const activeFilterCount = selectedCategories.size + (search ? 1 : 0)

  const resetAll = useCallback(() => {
    setCatParam(null)
    setSearch(null)
  }, [setCatParam, setSearch])

  /* ── 수감자 이름 맵 ── */
  const sinnerNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    sinners.forEach(s => { map[s.id] = getLocalizedName({ name_kr: s.name_kr, name_en: s.name_en, name_jp: s.name_jp }, lang) })
    return map
  }, [sinners, lang])

  /* ── 카운트 맵 ── */
  const identityCountMap = useMemo(() => {
    const map: Record<string, number> = {}
    identities.forEach(id => {
      (id.keywords ?? []).forEach(kw => { map[kw] = (map[kw] || 0) + 1 })
    })
    return map
  }, [identities])

  const egoCountMap = useMemo(() => {
    const map: Record<string, number> = {}
    egos.forEach(ego => {
      (ego.keywords ?? []).forEach(kw => { map[kw] = (map[kw] || 0) + 1 })
    })
    return map
  }, [egos])

  const giftCountMap = useMemo(() => {
    const map: Record<string, number> = {}
    // Count by keyword field (category)
    gifts.forEach(g => { map[g.keyword] = (map[g.keyword] || 0) + 1 })
    // Count by keyword names found in effect text
    const kwNames = keywords.map(k => k.name)
    gifts.forEach(g => {
      const effectText = [g.effect_base, g.effect_plus, g.effect_plusplus].filter(Boolean).join(' ')
      if (!effectText) return
      for (const kwName of kwNames) {
        if (effectText.includes(kwName) && kwName !== g.keyword) {
          map[kwName] = (map[kwName] || 0) + 1
        }
      }
    })
    return map
  }, [gifts, keywords])

  /* ── 카테고리별 카운트 ── */
  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {}
    keywords.forEach(kw => {
      const cat = kw.category || '기타'
      map[cat] = (map[cat] || 0) + 1
    })
    return map
  }, [keywords])

  /* ── 필터링 + 정렬 ── */
  const filtered = useMemo(() => {
    return keywords.filter(kw => {
      if (selectedCategories.size > 0 && !selectedCategories.has((kw.category || '기타') as KeywordCategory)) return false
      if (search) {
        const localName = getLocalizedKeywordName(kw.name, { nameEn: kw.name_en, nameJp: kw.name_jp, descEn: null, descJp: null }, lang)
        const localDesc = getLocalizedKeywordDesc(kw.description ?? '', { nameEn: null, nameJp: null, descEn: kw.description_en, descJp: kw.description_jp }, lang)
        if (!localName.toLowerCase().includes(search.toLowerCase()) && !localDesc.toLowerCase().includes(search.toLowerCase())) return false
      }
      return true
    }).sort((a, b) => {
      if (sort === 'name') {
        const aName = getLocalizedKeywordName(a.name, { nameEn: a.name_en, nameJp: a.name_jp, descEn: null, descJp: null }, lang)
        const bName = getLocalizedKeywordName(b.name, { nameEn: b.name_en, nameJp: b.name_jp, descEn: null, descJp: null }, lang)
        return aName.localeCompare(bName, lang === 'ja' ? 'ja' : lang === 'en' ? 'en' : 'ko')
      }
      const aCount = (identityCountMap[a.name] || 0) + (egoCountMap[a.name] || 0) + (giftCountMap[a.name] || 0)
      const bCount = (identityCountMap[b.name] || 0) + (egoCountMap[b.name] || 0) + (giftCountMap[b.name] || 0)
      return bCount - aCount
    })
  }, [keywords, selectedCategories, search, sort, identityCountMap, egoCountMap, giftCountMap, lang])

  /* ── 선택된 키워드의 관련 데이터 ── */
  const relatedIdentities = useMemo(() => {
    if (!selected) return []
    return identities.filter(id => (id.keywords ?? []).includes(selected.name))
  }, [selected, identities])

  const relatedEgos = useMemo(() => {
    if (!selected) return []
    return egos.filter(ego => (ego.keywords ?? []).includes(selected.name))
  }, [selected, egos])

  const relatedGifts = useMemo(() => {
    if (!selected) return []
    return gifts.filter(g => {
      if (g.keyword === selected.name) return true
      const effectText = [g.effect_base, g.effect_plus, g.effect_plusplus].filter(Boolean).join(' ')
      return effectText.includes(selected.name)
    })
  }, [selected, gifts])

  const handleClose = useCallback(() => setSelected(null), [])

  return (
    <div className="min-h-[100dvh] pt-24 pb-16 px-4 md:px-6 max-w-7xl mx-auto">
      {/* ── 헤더 ── */}
      <motion.div
        className="text-center mb-10"
        initial={shouldReduceMotion ? false : 'initial'}
        animate="animate"
        variants={shouldReduceMotion ? undefined : workbenchReveal}
      >
        <p className="font-mono text-[0.625rem] tracking-[0.3em] mb-2" style={{ color: '#c8900a' }}>
          {t('keyword.label')}
        </p>
        <h1 className="font-serif text-3xl md:text-4xl font-bold mb-2" style={{ color: '#e8dcc8' }}>
          {t('keyword.title')}
        </h1>
        <p className="text-[0.8125rem]" style={{ color: '#7a6845' }}>
          {t('keyword.subtitle').replace('{count}', String(keywords.length))}
        </p>
      </motion.div>

      {/* 장식선 */}
      <motion.div
        className="flex items-center justify-center gap-2 mb-8"
        initial={shouldReduceMotion ? false : 'initial'}
        animate="animate"
        variants={shouldReduceMotion ? undefined : workbenchReveal}
      >
        <div style={{ width: '4rem', height: '0.0625rem', background: 'linear-gradient(90deg, transparent, rgba(200,144,10,0.3))' }} />
        <div style={{ width: '0.25rem', height: '0.25rem', background: '#c8900a', transform: 'rotate(45deg)', opacity: 0.5 }} />
        <div style={{ width: '4rem', height: '0.0625rem', background: 'linear-gradient(90deg, rgba(200,144,10,0.3), transparent)' }} />
      </motion.div>

      {/* ── 사이드바 + 콘텐츠 ── */}
      <div className="flex gap-6">
        <motion.div
          className="shrink-0"
          initial={shouldReduceMotion ? false : 'initial'}
          animate="animate"
          variants={shouldReduceMotion ? undefined : workbenchReveal}
        >
          <FilterSidebar activeCount={activeFilterCount}>
            {/* 카테고리 필터 */}
            <div role="group" aria-label={t('keyword.filter.categoryAria')}>
              <div className="font-mono mb-2" style={{
                fontSize: '0.5625rem',
                letterSpacing: '0.15em',
                color: 'var(--gold-dim)',
                textTransform: 'uppercase',
              }}>
                {t('keyword.category.label')}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {CATEGORIES.map(cat => {
                  const active = selectedCategories.has(cat.value)
                  const count = categoryCounts[cat.value] || 0
                  return (
                    <motion.button
                      key={cat.value}
                      onClick={() => toggleCategory(cat.value)}
                      aria-pressed={active}
                      className="flex items-center justify-between rounded px-2.5 py-2 transition-[background,border-color,opacity,color] duration-200"
                      whileHover={shouldReduceMotion ? undefined : { y: -1 }}
                      whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.6 }}
                      style={{
                        cursor: 'pointer',
                        border: `1px solid ${active ? cat.color + '60' : 'rgba(255,255,255,0.08)'}`,
                        background: active ? cat.color + '15' : 'rgba(255,255,255,0.02)',
                        opacity: active ? 1 : 0.55,
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        <div
                          className="rounded-full"
                          style={{
                            width: '0.375rem', height: '0.375rem',
                            background: active ? cat.color : cat.color + '60',
                          }}
                        />
                        <span style={{
                          fontSize: '0.6875rem',
                          fontWeight: active ? 600 : 400,
                          color: active ? cat.color : '#888',
                        }}>
                          {cat.label}
                        </span>
                      </div>
                      <span style={{
                        fontSize: '0.5625rem',
                        color: active ? cat.color + 'aa' : '#555',
                        fontFamily: 'var(--font-mono)',
                      }}>
                        {count}
                      </span>
                    </motion.button>
                  )
                })}
              </div>
            </div>

          {/* 구분선 */}
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />

          {/* 검색 */}
          <div>
            <div className="font-mono mb-2" style={{
              fontSize: '0.5625rem',
              letterSpacing: '0.15em',
              color: 'var(--gold-dim)',
              textTransform: 'uppercase',
            }}>
              {t('keyword.search.label')}
            </div>
            <div
              className="relative flex items-center rounded-lg overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <Search size={14} className="absolute left-2.5" style={{ color: '#555' }} />
              <input
                value={search ?? ''}
                onChange={e => setSearch(e.target.value || null)}
                placeholder={t('keyword.search.placeholder')}
                className="w-full pl-8 pr-8 py-2 text-[0.75rem]"
                style={{ background: 'transparent', color: '#e8dcc8', outline: 'none' }}
                aria-label={t('keyword.search.aria')}
              />
              {search && (
                <button
                  onClick={() => setSearch(null)}
                  className="absolute right-2.5 hover:opacity-80 transition-opacity"
                  style={{ color: '#555', cursor: 'pointer' }}
                  aria-label={t('keyword.search.clearAria')}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* 필터 초기화 */}
          {activeFilterCount > 0 && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.5rem' }}>
              <button
                onClick={resetAll}
                className="flex items-center gap-1.5 w-full rounded px-3 py-2 text-xs transition-colors hover:bg-white/5"
                style={{
                  cursor: 'pointer',
                  color: '#999',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'transparent',
                }}
                aria-label={t('keyword.filter.resetAria')}
              >
                <RotateCcw size={12} />
                {t('keyword.filter.reset')} ({t('keyword.filter.active').replace('{count}', String(activeFilterCount))})
              </button>
            </div>
          )}
          </FilterSidebar>
        </motion.div>

        {/* ── 메인 콘텐츠 ── */}
        <div className="flex-1 min-w-0">
          {/* 카운트 + 뷰모드 + 정렬 */}
          <motion.div
            className="flex items-center justify-between mb-5"
            initial={shouldReduceMotion ? false : 'initial'}
            animate="animate"
            variants={shouldReduceMotion ? undefined : workbenchReveal}
          >
            <p aria-live="polite" style={{ color: '#888', fontSize: '0.8125rem' }}>
              {filtered.length !== keywords.length ? (
                <>{t('keyword.count.filtered').replace('{filtered}', String(filtered.length)).replace('{total}', String(keywords.length))}</>
              ) : (
                <>{t('keyword.count.total').replace('{count}', String(keywords.length))}</>
              )}
            </p>
            <div className="flex items-center gap-2">
              {/* 뷰 모드 토글 */}
              <div className="flex rounded overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                <button
                  onClick={() => setViewMode('detail')}
                  aria-label={t('keyword.view.detail')}
                  aria-pressed={viewMode === 'detail'}
                  className="p-1.5 transition-colors"
                  style={{
                    cursor: 'pointer',
                    background: viewMode === 'detail' ? 'rgba(200,144,10,0.15)' : 'transparent',
                    color: viewMode === 'detail' ? 'var(--gold)' : '#555',
                  }}
                >
                  <LayoutList size={15} />
                </button>
                <button
                  onClick={() => setViewMode('compact')}
                  aria-label={t('keyword.view.compact')}
                  aria-pressed={viewMode !== 'detail'}
                  className="p-1.5 transition-colors"
                  style={{
                    cursor: 'pointer',
                    background: viewMode !== 'detail' ? 'rgba(200,144,10,0.15)' : 'transparent',
                    color: viewMode !== 'detail' ? 'var(--gold)' : '#555',
                    borderLeft: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <Grid3X3 size={15} />
                </button>
              </div>
              <Dropdown
                value={sort}
                options={sortOptions}
                onChange={(v) => setSortParam(v === 'default' ? null : v)}
                prefix={t('keyword.sort.prefix')}
                defaultValue={'default' as SortKey}
              />
            </div>
          </motion.div>

          {/* 그리드 */}
          <motion.div
            key={`${viewMode}-${search}-${catParam}-${sortParam}`}
            initial={shouldReduceMotion ? false : 'initial'}
            whileInView={shouldReduceMotion ? undefined : 'animate'}
            viewport={shouldReduceMotion ? undefined : { once: true, margin: '-48px' }}
            variants={shouldReduceMotion ? undefined : workbenchReveal}
          >
            <KeywordGrid
              keywords={filtered}
              countMaps={{ identity: identityCountMap, ego: egoCountMap, gift: giftCountMap }}
              onSelect={(kw) => setSelected(kw as Keyword)}
              viewMode={viewMode === 'compact' ? 'compact' : 'detail'}
              lang={lang}
            />
          </motion.div>
        </div>
      </div>

      {/* 모달 */}
      {selected && (
        <KeywordModal
          keyword={selected}
          relatedIdentities={relatedIdentities}
          relatedEgos={relatedEgos}
          relatedGifts={relatedGifts}
          sinnerNameMap={sinnerNameMap}
          formatSkillDesc={formatSkillDesc}
          onClose={handleClose}
          lang={lang}
        />
      )}
    </div>
  )
}
