'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronUp, X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import GiftCard from '@/features/mirror-dungeon/components/GiftCard'
import GiftCatalog, { GiftGradeChip, GiftKeywordTab, giftKeywordIcon, giftKeywordLabel, toCatalogGift, useGiftCatalogFilters, type GiftCatalogCardProps } from '@/features/mirror-dungeon/components/GiftCatalog'
import { GIFT_KEYWORD_COLORS } from '@/lib/constants/gift'
import type { EgoGift } from '@/features/mirror-dungeon'
import FinalGiftTile from './FinalGiftTile'
import FinalGiftPresets from './FinalGiftPresets'
import { GRADE_ROMAN, SLUG_TO_KEYWORD, getKeywordSlug } from '@/lib/planner/gift-plan-constants'
import type { PlannerAction, GiftData, IdentitySlot, RecipeData } from '@/lib/planner/types'
import { deriveBlockedFinalFusionMaterialIds, findAvailableFusions, getFinalGiftVariantIds, parseFinalGiftIds } from '@/lib/planner/fusion'
import { finalEnhanceEdit, type FinalGift, type deriveFinalGifts } from '@/features/planner/lib/final-gifts'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import { getGiftActivationConditionStatus, getGiftConditionCountsForSlots, giftConditionKey } from '@/lib/planner/gift-condition-status'

// 미러 던전 기프트 목록과 같은 순서: 공통 → 키워드 → 참격/관통/타격, 등급은 Ⅰ → EX
const FINAL_KEYWORD_ORDER = ['general', 'burn', 'bleed', 'tremor', 'rupture', 'sinking', 'breath', 'charge', 'slash', 'pierce', 'blunt']
const FINAL_GIFT_GRADE_ORDER = ['1', '2', '3', '4', '5', 'EX']
// Below this many final gifts the keyword/grade filters are noise.
const FINAL_FILTER_MIN = 8

interface FinalGiftSectionProps {
  giftInventory: string[]
  identitySlots: IdentitySlot[]
  dispatch: React.Dispatch<PlannerAction>
  gifts: GiftData[]
  recipes: RecipeData[]
  giftMap: Map<number, GiftData>
  derivedFinal: ReturnType<typeof deriveFinalGifts>
  localizedGift: (gift: GiftData) => GiftData
}

/** The floor tab's final gifts: the picked set with its filters, the catalog to pick from, and the fusion suggestion card. */
export default function FinalGiftSection({ giftInventory, identitySlots, dispatch, gifts, recipes, giftMap, derivedFinal, localizedGift }: FinalGiftSectionProps) {
  const locale = useLocale() as SupportedLang
  const t = useTranslations('planner.floorTab')
  const [finalGiftKeyword, setFinalGiftKeyword] = useState<string | null>(null)
  const [finalGiftGrade, setFinalGiftGrade] = useState<string | null>(null)
  const [dismissedFusionIds, setDismissedFusionIds] = useState<Set<string>>(() => new Set())
  const [fusionCollapsed, setFusionCollapsed] = useState(false)

  // Stored picks (final_<id>[_plus|_plusplus]) versus the derived final set, which also holds start/observed gifts
  // and drops whatever a fusion result in it consumed.
  const storedFinalIds = useMemo(() => parseFinalGiftIds(giftInventory), [giftInventory])
  const { gifts: finalEntries, consumed: blockedFinalMaterialIds } = derivedFinal
  const finalEntryById = useMemo(() => new Map(finalEntries.map(entry => [entry.id, entry])), [finalEntries])
  const finalGiftIds = useMemo(() => new Set(finalEntryById.keys()), [finalEntryById])

  useEffect(() => {
    if (blockedFinalMaterialIds.size === 0) return

    for (const blockedId of blockedFinalMaterialIds) {
      if (!storedFinalIds.has(blockedId)) continue
      for (const giftId of getFinalGiftVariantIds(blockedId)) {
        dispatch({ type: 'REMOVE_GIFT', giftId })
      }
    }
  }, [blockedFinalMaterialIds, dispatch, storedFinalIds])

  // 편성으로 발동 조건을 못 채우는 기프트에 조건 미달/위험 덮개를 씌운다(기프트 탭과 같은 판정)
  const conditionCounts = useMemo(() => getGiftConditionCountsForSlots(identitySlots), [identitySlots])
  const conditionOf = useCallback((gift: GiftData | undefined) => gift ? getGiftActivationConditionStatus({
    gift,
    ...conditionCounts,
  }) : null, [conditionCounts])

  const finalFloorGifts = useMemo(() => {
    return finalEntries
      .map(entry => giftMap.get(entry.id))
      .filter(Boolean)
      .map(gift => localizedGift(gift as GiftData))
  }, [finalEntries, giftMap, localizedGift])
  const showFinalFilters = finalFloorGifts.length >= FINAL_FILTER_MIN

  const finalGiftKeywordCounts = useMemo(() => {
    const counts = new Map<string | null, number>()
    counts.set(null, finalFloorGifts.length)
    for (const gift of finalFloorGifts) {
      const slug = getKeywordSlug(gift.keyword)
      counts.set(slug, (counts.get(slug) ?? 0) + 1)
    }
    return counts
  }, [finalFloorGifts])

  const finalGiftGradeCounts = useMemo(() => {
    const counts = new Map<string | null, number>()
    counts.set(null, finalFloorGifts.length)
    for (const gift of finalFloorGifts) {
      const grade = gift.grade ?? '1'
      counts.set(grade, (counts.get(grade) ?? 0) + 1)
    }
    return counts
  }, [finalFloorGifts])

  const finalKeywordOptions = useMemo(() => {
    return Array.from(finalGiftKeywordCounts.entries())
      .filter(([slug, count]) => slug !== null && count > 0)
      .map(([slug, count]) => ({ slug: slug as string, count }))
      .sort((a, b) => FINAL_KEYWORD_ORDER.indexOf(a.slug) - FINAL_KEYWORD_ORDER.indexOf(b.slug))
  }, [finalGiftKeywordCounts])

  const filteredFinalGifts = useMemo(() => {
    const keyword = showFinalFilters ? finalGiftKeyword : null
    const gradeFilter = showFinalFilters ? finalGiftGrade : null
    return finalFloorGifts.filter(gift => {
      const slug = getKeywordSlug(gift.keyword)
      const grade = gift.grade ?? '1'
      if (keyword && slug !== keyword) return false
      if (gradeFilter && grade !== gradeFilter) return false
      return true
    })
  }, [finalFloorGifts, finalGiftGrade, finalGiftKeyword, showFinalFilters])

  const catalogFilters = useGiftCatalogFilters()
  const catalogGifts = useMemo(() => gifts.map(toCatalogGift), [gifts])
  const catalogSelectedIds = useMemo(() => new Set([...finalEntryById.keys()].map(String)), [finalEntryById])
  // Which picked result each blocked ingredient belongs to, for the disabled card's tooltip.
  const blockedBy = useMemo(() => {
    const map = new Map<number, string>()
    for (const entry of finalEntries) {
      const result = giftMap.get(entry.id)
      if (!result) continue
      for (const id of deriveBlockedFinalFusionMaterialIds({ selectedFinalGiftIds: [entry.id], recipes, giftMap })) {
        if (!map.has(id)) map.set(id, localizedGift(result).name)
      }
    }
    return map
  }, [finalEntries, giftMap, localizedGift, recipes])

  const craftableFusions = useMemo(() => {
    const inventory = Array.from(finalGiftIds).map(String)
    return findAvailableFusions(inventory, recipes, giftMap)
      .filter(fusion => (
        fusion.canCraft &&
        fusion.result &&
        !finalGiftIds.has(fusion.result.game_id) &&
        !dismissedFusionIds.has(fusion.result.game_id.toString())
      ))
  }, [dismissedFusionIds, finalGiftIds, giftMap, recipes])

  const suggestedFusion = craftableFusions[0]

  const applySuggestedFusion = useCallback(() => {
    if (!suggestedFusion?.result) return

    for (const material of suggestedFusion.materials) {
      for (const giftId of getFinalGiftVariantIds(material.game_id)) {
        dispatch({ type: 'REMOVE_GIFT', giftId })
      }
    }

    if (!finalGiftIds.has(suggestedFusion.result.game_id)) {
      dispatch({ type: 'ADD_GIFT', giftId: `final_${suggestedFusion.result.game_id}` })
    }
  }, [dispatch, finalGiftIds, suggestedFusion])

  const dismissSuggestedFusion = useCallback(() => {
    if (!suggestedFusion?.result) return
    const fusionId = suggestedFusion.result.game_id.toString()
    setDismissedFusionIds(prev => new Set(prev).add(fusionId))
  }, [suggestedFusion])

  const removeFinalGift = useCallback((giftGameId: number) => {
    for (const giftId of getFinalGiftVariantIds(giftGameId)) {
      dispatch({ type: 'REMOVE_GIFT', giftId })
    }
  }, [dispatch])

  const toggleFinalGift = useCallback((giftGameId: number) => {
    const entry = finalEntryById.get(giftGameId)
    if (entry) {
      // Start and observed gifts are set in the gift plan, not here.
      if (entry.source !== 'final') return
      removeFinalGift(giftGameId)
      return
    }
    if (blockedFinalMaterialIds.has(giftGameId)) return
    dispatch({ type: 'ADD_GIFT', giftId: `final_${giftGameId}` })
  }, [blockedFinalMaterialIds, dispatch, finalEntryById, removeFinalGift])

  // 전체 기프트에서 고르면 위의 최종 반영 목록이 늘거나 줄어 목록이 밀린다. 누르기 직전 목록 위치를 기억했다가
  // 그 변화가 화면에 그려지기 전(useLayoutEffect)에 같은 만큼 창을 옮겨, 누르던 칸이 손가락·마우스 아래 그대로 있게 한다.
  const catalogRef = useRef<HTMLDivElement>(null)
  const catalogTopBeforeRef = useRef<number | null>(null)
  const onCatalogGiftClick = useCallback((gift: EgoGift) => {
    catalogTopBeforeRef.current = catalogRef.current?.getBoundingClientRect().top ?? null
    toggleFinalGift(Number(gift.id))
  }, [toggleFinalGift])
  useLayoutEffect(() => {
    const before = catalogTopBeforeRef.current
    if (before === null || !catalogRef.current) return
    catalogTopBeforeRef.current = null
    const shift = catalogRef.current.getBoundingClientRect().top - before
    // instant: html의 scroll-behavior: smooth가 보정을 미끄러지는 움직임으로 바꾸지 않게
    if (Math.abs(shift) >= 1) window.scrollTo({ top: window.scrollY + shift, behavior: 'instant' })
  }, [finalFloorGifts])
  // 칸 속성은 (막힘 이유, 출처)가 같으면 같은 객체를 돌려준다: 448칸의 번역 호출과 비교를 누를 때마다 반복하지 않게
  const cardPropsCache = useMemo(() => new Map<string, GiftCatalogCardProps>(), [locale, t])
  const catalogCardProps = useCallback((gift: EgoGift): GiftCatalogCardProps => {
    const id = Number(gift.id)
    const blocked = blockedFinalMaterialIds.has(id)
    const source = finalEntryById.get(id)?.source
    const conditionStatus = blocked ? null : conditionOf(giftMap.get(id))
    const key = `${id}|${blocked ? blockedBy.get(id) ?? '' : '-'}|${source ?? ''}|${giftConditionKey(conditionStatus)}`
    const cached = cardPropsCache.get(key)
    if (cached) return cached
    const name = getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, locale)
    let props: GiftCatalogCardProps
    if (blocked) {
      const label = t('finalBlockedByRecipe', { gift: name, result: blockedBy.get(id) ?? '' })
      props = { disabled: true, title: label, ariaLabel: label }
    } else {
      const label = source === 'start' || source === 'observe'
        ? `${name}. ${t(source === 'start' ? 'finalAutoStart' : 'finalAutoObserve')}`
        : source ? t('removeAlreadyAddedGift', { gift: name }) : t('addFinalGift', { gift: name })
      props = { title: label, ariaLabel: label, conditionStatus, conditionDetail: false }
    }
    cardPropsCache.set(key, props)
    return props
  }, [blockedBy, blockedFinalMaterialIds, cardPropsCache, conditionOf, finalEntryById, giftMap, locale, t])

  // Keeps a pick's place in the inventory and swaps only its level suffix. 인벤토리는 ref로 읽어 함수가 바뀌지 않게 한다(타일 memo 유지).
  const inventoryRef = useRef(giftInventory)
  useLayoutEffect(() => { inventoryRef.current = giftInventory })
  const setFinalEnhance = useCallback((entry: FinalGift, level: number) => {
    const { oldId, newId } = finalEnhanceEdit(inventoryRef.current, entry, level)
    if (oldId && newId) dispatch({ type: 'REPLACE_GIFT', oldId, newId })
    else if (newId) dispatch({ type: 'ADD_GIFT', giftId: newId })
    else if (oldId) dispatch({ type: 'REMOVE_GIFT', giftId: oldId })
  }, [dispatch])

  return (
    <>
      <section id="plan-final" aria-labelledby="final-gifts-title" className="relative scroll-mt-[6rem] border-t pt-5 lg:-ml-[var(--planner-rail-w,0rem)]" style={{ borderColor: '#2e2417' }}>
        {/* 이 영역은 처음부터 목차 레일 자리까지 넓다. 여기에 오면 레일 대신 위쪽 가로 막대가 겹쳐 나타난다(PlannerClient가 관찰) */}
        <div data-final-gifts-start aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-px" />
        <div className="mb-1 flex items-baseline gap-2">
          <h3 id="final-gifts-title" className="text-[1.25rem] leading-tight" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>
            {t('finalGifts')}
          </h3>
          <span className="tabular-nums leading-none" style={{ fontFamily: 'var(--font-title)', fontSize: '1.25rem', color: 'var(--gold)' }}>
            <span aria-hidden="true">{finalFloorGifts.length}</span>
            <span className="sr-only">{t('finalGiftCount', { count: finalFloorGifts.length })}</span>
          </span>
          <FinalGiftPresets inventory={giftInventory} dispatch={dispatch} giftMap={giftMap} />
        </div>

        {showFinalFilters && (
          <div className="mb-3 sm:flex sm:items-center sm:border-b sm:border-[#2e2417]">
            {/* 미러 던전 기프트 목록의 도구줄과 같은 부품: 키워드 밑줄 탭 + 등급 칩, 수는 작고 흐리게 */}
            <div role="group" aria-label={t('keywordDistribution')} className="flex min-w-0 overflow-x-auto border-b border-[#2e2417] [scrollbar-width:none] sm:flex-1 sm:border-b-0 [&::-webkit-scrollbar]:hidden">
              {[{ slug: null as string | null, count: finalGiftKeywordCounts.get(null) ?? 0 }, ...finalKeywordOptions].map(({ slug, count }) => {
                const key = !slug ? '전체' : slug === 'general' ? '공통' : SLUG_TO_KEYWORD[slug] ?? slug
                return (
                  <GiftKeywordTab
                    key={slug ?? 'all'}
                    label={giftKeywordLabel(key, locale)}
                    iconUrl={slug ? giftKeywordIcon(key) : null}
                    color={slug ? GIFT_KEYWORD_COLORS[key] ?? '#9c8b73' : undefined}
                    active={(finalGiftKeyword ?? null) === slug}
                    count={count}
                    onClick={() => setFinalGiftKeyword(finalGiftKeyword === slug || !slug ? null : slug)}
                  />
                )
              })}
            </div>
            <div role="group" aria-label={t('finalGradeFilter')} className="mt-2 flex items-center gap-0.5 sm:ml-3 sm:mt-0 sm:shrink-0">
              {FINAL_GIFT_GRADE_ORDER.map(grade => {
                const count = finalGiftGradeCounts.get(grade) ?? 0
                if (count === 0) return null
                return (
                  <GiftGradeChip
                    key={grade}
                    grade={grade}
                    ariaLabel={`${t('finalGradeFilter')} ${GRADE_ROMAN[grade] ?? grade}`}
                    active={finalGiftGrade === grade}
                    count={count}
                    onClick={() => setFinalGiftGrade(finalGiftGrade === grade ? null : grade)}
                  />
                )
              })}
            </div>
          </div>
        )}

        {finalFloorGifts.length === 0 ? (
          <p className="border-y border-dashed py-5 text-center text-[0.9375rem]" style={{ borderColor: '#2e2417', color: '#9c8b73' }}>
            {t('finalGiftEmpty')}
          </p>
        ) : filteredFinalGifts.length === 0 ? (
          <p className="px-4 py-5 text-center text-[0.9375rem]" style={{ color: '#9c8b73' }}>{t('finalGiftNoResults')}</p>
        ) : (
          <ul aria-label={t('finalSelectedPanel')} className="grid grid-cols-[repeat(auto-fill,minmax(4rem,1fr))] justify-items-center gap-x-2.5 gap-y-3 pt-1 sm:grid-cols-[repeat(auto-fill,minmax(4.75rem,1fr))] sm:gap-x-3">
            {filteredFinalGifts.map(gift => {
              const entry = finalEntryById.get(gift.game_id)
              if (!entry) return null
              return (
                <FinalGiftTile
                  key={gift.game_id}
                  gift={gift}
                  entry={entry}
                  conditionStatus={conditionOf(giftMap.get(gift.game_id))}
                  onEnhance={setFinalEnhance}
                  onRemove={removeFinalGift}
                />
              )
            })}
          </ul>
        )}

        <div className="mt-5">
          <h4 className="mb-2 text-[0.9375rem]" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>{t('allGiftCatalog')}</h4>
          {/* 페이지 흐름 안에 둔다(스크롤은 창 하나). 도구줄은 사이트 메뉴와 플래너 가로 목차 아래에 붙고, 결과 칸은 필터를 바꿔도 페이지가 줄지 않게 한 화면 높이를 확보한다. */}
          <div
            ref={catalogRef}
            className="border-t px-0.5 pb-3"
            style={{
              borderColor: '#2e2417',
              '--gift-catalog-bg': 'var(--bg-deep)',
              '--gift-catalog-sticky-top': 'calc(var(--nav-height, 4rem) + var(--planner-bar-h, 0rem))',
              '--gift-catalog-min-h': 'calc(100dvh - var(--gift-catalog-sticky-top) - 6rem)',
            } as React.CSSProperties}
          >
            <GiftCatalog
              compact
              gifts={catalogGifts}
              getGiftKeywordIcon={giftKeywordIcon}
              filters={catalogFilters}
              selectedIds={catalogSelectedIds}
              onGiftClick={onCatalogGiftClick}
              cardProps={catalogCardProps}
            />
          </div>
        </div>
      </section>

      {suggestedFusion?.result && (() => {
        const result = localizedGift(suggestedFusion.result)
        const materials = suggestedFusion.materials.map(localizedGift)
        const applyLabel = t('fusionAlertApply', { gift: result.name })
        const iconButton = 'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded text-[#9c8b73] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--gold-light)]'
        return (
          // 페이지 이동 버튼(PageNavigation, 오른쪽 아래 2.75rem 폭) 바로 왼쪽에 붙는다: 오른쪽 여백 = 그 버튼 여백 + 폭 + 테두리 + 간격
          <aside
            aria-live="polite"
            aria-labelledby="fusion-alert-title"
            className={`fixed bottom-[max(0.875rem,env(safe-area-inset-bottom))] right-[calc(max(0.875rem,env(safe-area-inset-right))_+_3.375rem)] z-20 rounded-lg border ${fusionCollapsed ? '' : 'left-3 sm:left-auto sm:w-[20rem]'}`}
            style={{ background: '#17120c', borderColor: 'rgba(200,144,10,0.4)', boxShadow: '0 0.25rem 1rem #0009' }}
          >
            {fusionCollapsed ? (
              <div className="flex items-center pl-1.5">
                <span inert className="w-8" title={result.name}><GiftCard gift={result} size="100%" showName={false} onClick={applySuggestedFusion} /></span>
                <button
                  type="button"
                  data-fusion-toggle
                  aria-expanded={false}
                  title={t('fusionAlertExpand')}
                  onClick={() => setFusionCollapsed(false)}
                  className="flex h-11 items-center gap-2 rounded-r-lg pl-2 pr-2.5 text-[0.875rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--gold-light)]"
                  style={{ color: 'var(--gold-light)', fontFamily: 'var(--font-heading)' }}
                >
                  <span id="fusion-alert-title">{t('fusionAlertTitle')}</span>
                  {craftableFusions.length > 1 && <span className="tabular-nums" style={{ fontFamily: 'var(--font-title)', fontSize: '1rem', color: 'var(--gold)' }}>{craftableFusions.length}</span>}
                  <ChevronUp size={16} aria-hidden="true" className="text-[#9c8b73]" />
                </button>
              </div>
            ) : (
              <div className="pb-3 pl-3.5">
                <div className="flex items-center gap-2">
                  <h3 id="fusion-alert-title" className="min-w-0 flex-1 text-[0.9375rem]" style={{ color: 'var(--gold-light)', fontFamily: 'var(--font-heading)' }}>
                    {t('fusionAlertTitle')}
                    {craftableFusions.length > 1 && <span className="ml-1.5 tabular-nums" style={{ fontFamily: 'var(--font-title)', fontSize: '1.0625rem', color: 'var(--gold)' }}>{craftableFusions.length}</span>}
                  </h3>
                  <div className="flex">
                    <button type="button" data-fusion-toggle aria-expanded aria-label={t('fusionAlertCollapse')} title={t('fusionAlertCollapse')} onClick={() => setFusionCollapsed(true)} className={iconButton}>
                      <ChevronUp size={16} aria-hidden="true" className="rotate-180" />
                    </button>
                    <button type="button" onClick={dismissSuggestedFusion} aria-label={t('fusionAlertDismiss')} title={t('fusionAlertDismiss')} className={iconButton}>
                      <X size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* 재료 아이콘 + … = 결과. 아이콘은 보기 전용이고 반영은 아래 버튼 하나로 한다 */}
                <div className="flex items-center gap-2 pr-3.5">
                  <p className="sr-only">{t('fusionAlertMaterials')}: {materials.map(gift => gift.name).join(', ')}</p>
                  <ul inert className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1.5">
                    {materials.map((gift, index) => (
                      <li key={gift.game_id} className="flex items-center gap-1" title={gift.name}>
                        {index > 0 && <span aria-hidden="true" className="text-[0.8125rem] text-[var(--text-muted)]">+</span>}
                        <span className="w-11"><GiftCard gift={gift} size="100%" showName={false} onClick={applySuggestedFusion} /></span>
                      </li>
                    ))}
                  </ul>
                  <span aria-hidden="true" className="shrink-0 text-[1rem] text-[#9c8b73]">=</span>
                  <span inert className="w-14 shrink-0" title={result.name}><GiftCard gift={result} size="100%" showName={false} onClick={applySuggestedFusion} /></span>
                </div>

                <div className="mt-2.5 flex items-end gap-3 pr-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.9375rem] text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-heading)' }} title={result.name}>{result.name}</p>
                    <p className="mt-0.5 break-keep text-[0.75rem] leading-snug text-[#9c8b73]">{t('fusionAlertHint')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={applySuggestedFusion}
                    aria-label={applyLabel}
                    className="h-9 shrink-0 rounded px-3.5 text-[0.875rem] font-bold transition-colors hover:bg-[var(--gold-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-light)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#17120c]"
                    style={{ background: 'var(--gold)', color: 'var(--bg-deep)' }}
                  >
                    {t('fusionAlertApplyShort')}
                  </button>
                </div>
              </div>
            )}
          </aside>
        )
      })()}
    </>
  )
}
