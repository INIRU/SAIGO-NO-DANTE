'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Search } from 'lucide-react'
import type { RunState, RunAction } from '@/lib/planner/run-types'
import type { ThemeData, GiftData } from '@/lib/planner/types'
import { getGiftActivationConditionStatus, getGiftConditionCountsForSlots } from '@/lib/planner/gift-condition-status'
import { getGiftsFromThemes, themeExclusiveGiftIds } from '@/lib/planner/fusion'
import FloorGiftPickerModal from '@/components/planner/FloorGiftPickerModal'
import GiftCard from '@/components/ui/GiftCard'
import GiftArtwork from '@/components/ui/GiftArtwork'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'

interface Props {
  state: RunState
  dispatch: React.Dispatch<RunAction>
  gifts: GiftData[]
  giftMap: Map<number, GiftData>
  themes: ThemeData[]
  onChooseTheme: () => void
}

export default function GiftCheckSection({ state, dispatch, gifts, giftMap, themes, onChooseTheme }: Props) {
  const t = useTranslations('planner.run')
  const locale = useLocale() as SupportedLang
  const giftName = (gift: GiftData) => getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, locale)
  const currentLog = state.floorLogs[state.currentFloor - 1]
  const [targetSearch, setTargetSearch] = useState('')

  const ownedSet = useMemo(() => new Set(state.giftInventory.map(Number)), [state.giftInventory])
  const ownedIds = useMemo(() => new Set(state.giftInventory.map(String)), [state.giftInventory])

  const conditionCounts = useMemo(
    () => getGiftConditionCountsForSlots(state.identitySlots),
    [state.identitySlots],
  )

  // 조건 상태 체크 (GiftPlanTab 패턴)
  function getConditionStatus(gift: GiftData): { level: 'warn' | 'unmet'; text: string } | null {
    return getGiftActivationConditionStatus({ gift, ...conditionCounts })
  }

  const [pickerOpen, setPickerOpen] = useState(false)
  const currentTheme = currentLog?.themeId ? themes.find(theme => String(theme.id) === String(currentLog.themeId)) ?? null : null
  // 이번 층에서 얻을 수 있는 전체: 다른 테마팩 전용 기프트만 뺀다(합성·조합식 결과는 포함)
  const reachableGifts = useMemo(() => {
    const own = new Set(currentTheme ? themeExclusiveGiftIds(currentTheme) : [])
    const others = new Set(themes.flatMap(theme => themeExclusiveGiftIds(theme)).filter(id => !own.has(id)))
    return gifts.filter(gift => !others.has(gift.game_id))
  }, [currentTheme, gifts, themes])

  // 현재 테마에서 얻을 수 있는 기프트
  const themeGifts = useMemo(() => {
    const theme = currentTheme
    if (!theme) return []
    const list = getGiftsFromThemes([String(theme.id)], themes, giftMap)
    // 체크된건 하단 정렬
    return list.sort((a, b) => {
      const aOwned = ownedSet.has(a.game_id) ? 1 : 0
      const bOwned = ownedSet.has(b.game_id) ? 1 : 0
      return aOwned - bOwned
    })
  }, [currentTheme, themes, giftMap, ownedSet])

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
  const [showAllTargets, setShowAllTargets] = useState(false)
  const shownTargets = showAllTargets ? targetGiftList : targetGiftList.slice(0, 12)
  const hiddenTargetCount = targetGiftList.length - shownTargets.length

  // 목표 기프트 검색
  const targetSearchResults = useMemo(() => {
    if (!targetSearch.trim()) return []
    return gifts.filter(g => giftName(g).toLocaleLowerCase().includes(targetSearch.trim().toLocaleLowerCase()))
  }, [targetSearch, gifts, locale])

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <style jsx global>{`.run-gift-grid .gift-card > p { font-size: 0.6875rem !important; line-height: 1.35 !important; }`}</style>
      {/* 테마팩 기프트 — GiftCard 컴포넌트 사용 */}
      {themeGifts.length > 0 && (
        <section className="min-w-0 lg:col-start-1">
          <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.75rem', color: '#999' }}>
            {t('themeGiftsCount', { count: themeGifts.length })}
          </h3>
          <div role="region" aria-label={t('themeGiftsCount', { count: themeGifts.length })} className="run-gift-grid flex flex-wrap content-start gap-2 sm:gap-3" style={{ position: 'relative', zIndex: 0 }}>
            {themeGifts.map(gift => {
              const owned = ownedSet.has(gift.game_id)
              return (
                <GiftCard
                  key={gift.game_id}
                  gift={gift}
                  size="4.75rem"
                  isSelected={owned}
                  onClick={() => dispatch({ type: owned ? 'REMOVE_GIFT' : 'ACQUIRE_GIFT', giftId: String(gift.game_id) })}
                  conditionStatus={!owned ? getConditionStatus(gift) : null}
                />
              )
            })}
          </div>
        </section>
      )}

      {!currentLog?.themeId && <button type="button" onClick={onChooseTheme} className="min-h-10 rounded-md border border-[var(--border-gold)] px-3 text-xs font-bold text-[var(--gold-light)] hover:bg-[var(--bg-elevated)] focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]">{t('chooseThemeAction')}</button>}
      {currentLog?.themeId && themeGifts.length === 0 && <p style={{ color: '#888', fontSize: '0.8125rem' }}>{t('themeGiftsHint')}</p>}

      {/* 최종 기프트 (목표 기프트 — 항상 표시) */}
      {/* 탭 영역 하나만 스크롤한다: 목표 기프트는 오른쪽에 붙어 따라오고, 못 얻은 것부터 12개까지 보여 준다 */}
      <section className="min-w-0 border-t border-[var(--border)] pt-3 lg:sticky lg:top-0 lg:col-start-2 lg:row-span-4 lg:row-start-1 lg:self-start lg:border-t-0 lg:pt-0">
        <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.75rem', color: '#c8900a' }}>
          {t('targetGifts')}
          {targetGiftList.length > 0 && (
            <span style={{ color: '#888', fontWeight: 400, marginLeft: '0.5rem', fontSize: '0.6875rem' }}>
              {t('targetProgress', { acquired: targetGiftList.filter(g => ownedSet.has(g.game_id)).length, total: targetGiftList.length })}
            </span>
          )}
        </h3>

        {/* 목표 기프트 추가 검색 */}
        <div className="relative" style={{ marginBottom: '0.75rem', zIndex: 10 }}>
          <div className="relative">
            <Search className="absolute" style={{ left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '0.875rem', height: '0.875rem', color: '#555' }} />
            <input
              aria-label={t('addTargetGift')}
              value={targetSearch}
              onChange={e => setTargetSearch(e.target.value)}
              placeholder={t('addTargetGift')}
              className="w-full rounded-lg focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
              style={{ padding: '0.5rem 0.75rem 0.5rem 2.25rem', background: '#1a1510', border: '1px solid #2a2015', color: '#e8e0d0', fontSize: '0.8125rem', outline: 'none', minHeight: '2.75rem' }}
            />
          </div>
          {targetSearch.trim() && <p role="status" className="mt-1 text-xs text-[var(--text-tertiary)]">{t('giftSearchCount', { count: targetSearchResults.length })}</p>}
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
                    <span className="w-8 shrink-0"><GiftArtwork gift={gift} displayName={giftName(gift)} sizes="32px" /></span>
                    <span className="flex-1 truncate">{giftName(gift)}</span>
                    {gift.keyword && <span style={{ color: '#555', fontSize: '0.5625rem' }}>{gift.keyword}</span>}
                    {isTarget && <span style={{ color: '#c8900a', fontSize: '0.5625rem' }}>{t('added')}</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* 목표 기프트 그리드 */}
        <div role="region" aria-label={t('targetGifts')}>
        {targetGiftList.length > 0 ? (
          <>
          <div className="run-gift-grid flex flex-wrap content-start gap-2" style={{ position: 'relative', zIndex: 0 }}>
            {shownTargets.map(gift => {
              const owned = ownedSet.has(gift.game_id)
              return (
                <GiftCard
                  key={`target-${gift.game_id}`}
                  gift={gift}
                  size="4.75rem"
                  isSelected={owned}
                  onClick={() => dispatch({ type: owned ? 'REMOVE_GIFT' : 'ACQUIRE_GIFT', giftId: String(gift.game_id) })}
                  onRemove={() => dispatch({ type: 'REMOVE_TARGET_GIFT', giftId: String(gift.game_id) })}
                  conditionStatus={!owned ? getConditionStatus(gift) : null}
                />
              )
            })}
          </div>
          {hiddenTargetCount > 0 && (
            <button type="button" onClick={() => setShowAllTargets(true)} className="mt-2 min-h-9 w-full rounded-md border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-[var(--gold-light)] focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]">
              {t('showAllTargets', { count: hiddenTargetCount })}
            </button>
          )}
          </>
        ) : (
          <p style={{ color: '#555', fontSize: '0.75rem' }}>{t('noTargetsHint')}</p>
        )}
        </div>
      </section>

      {/* 기프트 추가: 플래너 층별 계획과 같은 선택 창. 기본은 이번 층 테마팩 기프트, 체크를 끄면 합성·조합식까지 전체 */}
      <section className="min-w-0 lg:col-start-1" aria-labelledby="run-add-gift-title">
        <h3 id="run-add-gift-title" style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem', color: '#999' }}>{t('addFinalGift')}</h3>
        <GiftCard gift={{ name: t('addGiftButton') }} variant="insert" size="4.75rem" showName ariaLabel={t('addFinalGift')} onClick={() => setPickerOpen(true)} />
        <FloorGiftPickerModal
          open={pickerOpen}
          title={t('floorGiftPickerTitle', { floor: state.currentFloor })}
          floorGifts={currentTheme ? themeGifts : null}
          allGifts={reachableGifts}
          selectedIds={ownedIds}
          onToggle={gift => dispatch({ type: ownedIds.has(String(gift.game_id)) ? 'REMOVE_GIFT' : 'ACQUIRE_GIFT', giftId: String(gift.game_id) })}
          onClose={() => setPickerOpen(false)}
        />
      </section>

    </div>
  )
}
