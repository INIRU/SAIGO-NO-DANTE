'use client'

import GiftGrade from '@/components/ui/GiftGrade'

import { GIFT_BG_URL } from '@/lib/constants/gift'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { ChevronUp, X, Beaker } from 'lucide-react'
import type { RunState, RunAction } from '@/lib/planner/run-types'
import type { GiftData, RecipeData } from '@/lib/planner/types'
import { findAvailableFusions, computeKeywordDistribution } from '@/lib/planner/fusion'
import { getGiftActivationConditionStatus, getGiftConditionCountsForSlots, getIdentityGiftConditionKeywords } from '@/lib/planner/gift-condition-status'
import KeywordChart from '@/components/planner/KeywordChart'
import { } from '@/lib/constants/game'
import { BLUR_PLACEHOLDER } from '@/lib/utils/images'
import { getKeywordSlug, getKeywordIconUrl, OCTAGON_CLIP, } from '@/components/planner/gift-plan/constants'
const PlannerGiftModal = dynamic(() => import('@/components/planner/PlannerGiftModal'), { ssr: false })

interface Props {
  state: RunState
  dispatch: React.Dispatch<RunAction>
  gifts: GiftData[]
  giftMap: Map<number, GiftData>
  recipes: RecipeData[]
}

export default function InventoryPanel({ state, dispatch, giftMap, recipes }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [modalGift, setModalGift] = useState<GiftData | null>(null)

  const inventoryGifts = useMemo(() =>
    state.giftInventory.map(id => giftMap.get(Number(id))).filter(Boolean) as GiftData[]
  , [state.giftInventory, giftMap])

  const keywordDist = useMemo(() =>
    computeKeywordDistribution(state.identitySlots.map(getIdentityGiftConditionKeywords))
  , [state.identitySlots])

  const craftable = useMemo(() =>
    findAvailableFusions(state.giftInventory, recipes, giftMap).filter(f => f.canCraft)
  , [state.giftInventory, recipes, giftMap])

  const conditionCounts = useMemo(
    () => getGiftConditionCountsForSlots(state.identitySlots),
    [state.identitySlots],
  )

  function getConditionStatus(gift: GiftData): { level: 'warn' | 'unmet'; text: string } | null {
    return getGiftActivationConditionStatus({ gift, ...conditionCounts })
  }

  // ── 공유 콘텐츠 ──
  const content = (
    <>
      <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#999', marginBottom: '0.5rem' }}>
        보유 기프트 ({inventoryGifts.length})
      </p>
      {inventoryGifts.length === 0 ? (
        <p style={{ fontSize: '0.6875rem', color: '#555', padding: '0.5rem 0' }}>기프트 없음</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.75rem' }}>
          {inventoryGifts.map((gift, i) => {
            const cond = getConditionStatus(gift)
            return (
              <div key={`${gift.game_id}-${i}`} className="group relative cursor-pointer" onClick={() => setModalGift(gift)}
                title={`${gift.name}${cond ? ` (${cond.level === 'unmet' ? '조건 미달' : '조건 주의'}: ${cond.text})` : ''}`}
                style={{ width: '2.5rem', flexShrink: 0 }}>
                <div style={{
                  position: 'relative', width: '100%', aspectRatio: '1',
                  clipPath: OCTAGON_CLIP, overflow: 'hidden',
                  backgroundImage: `url(${GIFT_BG_URL})`,
                  backgroundSize: 'contain', backgroundPosition: 'center',
                }}>
                  <GiftGrade grade={gift.grade} style={{
                    position: 'absolute', top: '3%', left: '4%', zIndex: 10,
                    fontFamily: "'Bebas Neue', var(--font-title), sans-serif",
                    fontWeight: 700, fontSize: '0.875rem', lineHeight: 1,
                    color: gift.grade === 'EX' ? '#c6ff2e' : '#fbb72e',
                    textShadow: '0 0 0.25rem rgba(0,0,0,0.8)',
                  }} />
                  <div style={{ position: 'absolute', inset: '15%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {gift.image_url ? (
                      <Image src={gift.image_url} alt={gift.name} fill style={{ objectFit: 'contain' }} sizes="48px" placeholder="blur" blurDataURL={BLUR_PLACEHOLDER} />
                    ) : (
                      <div style={{ width: '60%', height: '60%', background: '#333', borderRadius: '50%' }} />
                    )}
                  </div>
                  {(() => {
                    const kwSlug = getKeywordSlug(gift.keyword ?? null)
                    const kwUrl = kwSlug ? getKeywordIconUrl(kwSlug) : null
                    return kwUrl ? (
                      <div style={{ position: 'absolute', bottom: 0, right: 0, zIndex: 10, width: '30%', height: '30%' }}>
                        <Image src={kwUrl} alt="" fill sizes="24px" style={{ objectFit: 'contain' }} />
                      </div>
                    ) : null
                  })()}
                  {cond && (
                    <div style={{
                      position: 'absolute', inset: 0, zIndex: 15,
                      background: cond.level === 'unmet' ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontSize: '0.4375rem', fontWeight: 700, color: cond.level === 'unmet' ? '#ef4444' : '#e8b030', textShadow: '0 0 0.25rem rgba(0,0,0,0.9)' }}>
                        {cond.level === 'unmet' ? '미달' : '주의'}
                      </span>
                    </div>
                  )}
                </div>
                <button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'REMOVE_GIFT', giftId: String(gift.game_id) }) }}
                  className="absolute opacity-0 group-hover:opacity-100 transition-opacity z-20"
                  style={{ top: '-0.125rem', right: '-0.125rem', width: '0.75rem', height: '0.75rem', borderRadius: '50%', background: 'rgba(220,38,38,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X style={{ width: '0.375rem', height: '0.375rem', color: '#fff' }} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {keywordDist.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#999', marginBottom: '0.5rem' }}>키워드 분포</p>
          <KeywordChart distribution={keywordDist} />
        </div>
      )}

      {craftable.length > 0 && (
        <div className="rounded-lg" style={{ background: 'rgba(200,144,10,0.08)', border: '1px solid rgba(200,144,10,0.25)', padding: '0.625rem' }}>
          <p className="flex items-center gap-1" style={{ fontSize: '0.75rem', fontWeight: 600, color: '#e8b030', marginBottom: '0.5rem' }}>
            <Beaker style={{ width: '0.75rem', height: '0.75rem' }} /> 조합 가능 ({craftable.length})
          </p>
          <div className="space-y-2">
            {craftable.slice(0, 5).map(fusion => (
              <div key={fusion.recipe.id} className="flex items-center gap-1 flex-wrap" style={{ fontSize: '0.5625rem' }}>
                <div className="flex gap-0.5 shrink-0">
                  {fusion.materials.map(m => m.image_url ? <Image key={m.game_id} src={m.image_url} alt="" width={20} height={20} style={{ width: '1.125rem', height: '1.125rem', objectFit: 'contain' }} /> : null)}
                </div>
                <span style={{ color: '#666' }}>→</span>
                {fusion.result && (
                  <div className="flex items-center gap-1 min-w-0">
                    {fusion.result.image_url && <Image src={fusion.result.image_url} alt="" width={20} height={20} style={{ width: '1.125rem', height: '1.125rem', objectFit: 'contain', flexShrink: 0 }} />}
                    <span className="truncate" style={{ color: '#ccc' }}>{fusion.result.name}</span>
                  </div>
                )}
                <button onClick={() => dispatch({ type: 'CRAFT_FUSION', materialIds: fusion.materials.map(m => String(m.game_id)), resultId: fusion.result ? String(fusion.result.game_id) : '' })}
                  className="ml-auto rounded shrink-0" style={{ background: 'rgba(200,144,10,0.2)', padding: '0.375rem 0.5rem', color: '#e8b030', fontSize: '0.5625rem', fontWeight: 600, minHeight: '1.75rem' }}>
                  조합
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )

  return (
    <>
      {/* 모바일: 하단 고정 바 + 오버레이 바텀시트 */}
      <div className="lg:hidden">
        {/* 오버레이 배경 */}
        {expanded && <div className="fixed inset-0 z-30" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setExpanded(false)} />}
        {/* 바텀시트 */}
        <div className="fixed bottom-0 left-0 right-0 z-40 transition-transform" style={{
          background: '#1a1510', borderTop: '1px solid #2a2015', borderRadius: expanded ? '0.75rem 0.75rem 0 0' : '0',
          transform: expanded ? 'translateY(0)' : 'translateY(calc(100% - 2.75rem))',
          maxHeight: '75vh', transition: 'transform 0.3s ease',
        }}>
          <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-center gap-2"
            style={{ minHeight: '2.75rem', borderBottom: expanded ? '1px solid #2a2015' : 'none' }}>
            <ChevronUp style={{ width: '1rem', height: '1rem', color: '#c8900a', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#e8dcc8' }}>인벤토리 ({inventoryGifts.length})</span>
          </button>
          <div style={{ padding: '0.75rem', maxHeight: 'calc(75vh - 2.75rem)', overflowY: 'auto' }}>
            {content}
          </div>
        </div>
      </div>

      {/* 데스크톱: 사이드바 */}
      <div className="hidden lg:block w-80 max-w-80 overflow-hidden shrink-0" style={{ padding: '0.75rem' }}>
        {content}
      </div>

      {/* 기프트 상세 모달 */}
      {modalGift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)', padding: 'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)' }} onClick={() => setModalGift(null)}>
          <div onClick={e => e.stopPropagation()} className="max-w-full" style={{ margin: '0 1rem' }}>
            <PlannerGiftModal gift={modalGift} onClose={() => setModalGift(null)} conditionStatus={getConditionStatus(modalGift)} />
          </div>
        </div>
      )}
    </>
  )
}
