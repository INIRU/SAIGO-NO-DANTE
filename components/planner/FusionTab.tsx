'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import { ArrowRight, Search } from 'lucide-react'
import type { PlannerState, PlannerAction, RecipeData, GiftData } from '@/lib/planner/types'
import { findAvailableFusions, findRecipesFor } from '@/lib/planner/fusion'
import GiftInventory from './GiftInventory'

interface FusionTabProps {
  state: PlannerState
  dispatch: React.Dispatch<PlannerAction>
  recipes: RecipeData[]
  gifts: GiftData[]
  giftMap: Map<number, GiftData>
}

export default function FusionTab({ state, dispatch, recipes, gifts, giftMap }: FusionTabProps) {
  const [reverseQuery, setReverseQuery] = useState('')
  const [reverseResults, setReverseResults] = useState<ReturnType<typeof findRecipesFor>>([])
  const [showReverseSuggestions, setShowReverseSuggestions] = useState(false)

  const availableFusions = useMemo(
    () => findAvailableFusions(state.giftInventory, recipes, giftMap),
    [state.giftInventory, recipes, giftMap]
  )

  const reverseSuggestions = useMemo(() => {
    if (!reverseQuery.trim()) return []
    return gifts.filter(g => g.name.includes(reverseQuery)).slice(0, 6)
  }, [reverseQuery, gifts])

  function handleReverseSearch(gift: GiftData) {
    setReverseQuery(gift.name)
    setReverseResults(findRecipesFor(gift.name, recipes, giftMap))
    setShowReverseSuggestions(false)
  }

  function handleAdd(giftId: string) {
    dispatch({ type: 'ADD_GIFT', giftId })
  }
  function handleRemove(giftId: string) {
    dispatch({ type: 'REMOVE_GIFT', giftId })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Gift inventory */}
      <section style={{
        background: '#1a1510',
        border: '1px solid #222',
        borderRadius: '0.5rem',
        padding: '0.875rem 1rem',
      }}>
        <GiftInventory
          inventory={state.giftInventory}
          gifts={gifts}
          giftMap={giftMap}
          onAdd={handleAdd}
          onRemove={handleRemove}
        />
      </section>

      {/* Available fusions */}
      <section>
        <div style={{
          fontSize: '0.875rem',
          color: '#9ca3af',
          marginBottom: '0.625rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          조합 가능한 레시피
          <span style={{
            fontSize: '0.6875rem',
            background: 'rgba(200,144,10,0.12)',
            color: '#c8900a',
            padding: '0.0625rem 0.375rem',
            borderRadius: '0.25rem',
            border: '1px solid rgba(200,144,10,0.3)',
          }}>
            {availableFusions.filter(f => f.canCraft).length} / {availableFusions.length}
          </span>
        </div>

        {availableFusions.length === 0 ? (
          <div style={{
            padding: '2rem',
            textAlign: 'center',
            color: '#4b5563',
            fontSize: '0.8125rem',
            border: '1px dashed #222',
            borderRadius: '0.5rem',
          }}>
            조합 레시피가 없습니다
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {availableFusions.map(({ recipe, materials, result, canCraft }) => (
              <FusionCard
                key={recipe.id}
                materials={materials}
                result={result}
                canCraft={canCraft}
              />
            ))}
          </div>
        )}
      </section>

      {/* Reverse search */}
      <section style={{
        background: '#1a1510',
        border: '1px solid #222',
        borderRadius: '0.5rem',
        padding: '0.875rem 1rem',
      }}>
        <div style={{ fontSize: '0.875rem', color: '#9ca3af', marginBottom: '0.625rem' }}>
          역방향 검색 — 이 기프트를 만들려면?
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: '#0d0b08',
            border: '1px solid #333',
            borderRadius: '0.375rem',
            padding: '0.375rem 0.625rem',
          }}>
            <Search size={14} color="#6b7280" />
            <input
              type="text"
              placeholder="기프트명 검색..."
              value={reverseQuery}
              onChange={e => {
                setReverseQuery(e.target.value)
                setShowReverseSuggestions(true)
                if (!e.target.value.trim()) setReverseResults([])
              }}
              onFocus={() => setShowReverseSuggestions(true)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: '0.8125rem',
                color: '#e5e7eb',
              }}
            />
          </div>

          {showReverseSuggestions && reverseSuggestions.length > 0 && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 0.25rem)',
              left: 0,
              right: 0,
              background: '#1a1510',
              border: '1px solid #333',
              borderRadius: '0.375rem',
              zIndex: 50,
              overflow: 'hidden',
            }}>
              {reverseSuggestions.map(gift => (
                <button
                  key={gift.id}
                  onClick={() => handleReverseSearch(gift)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.625rem',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: '#e5e7eb',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(200,144,10,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {gift.image_url ? (
                    <Image src={gift.image_url} alt={gift.name} width={24} height={24}
                      style={{ width: '1.5rem', height: '1.5rem', objectFit: 'contain', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: '1.5rem', height: '1.5rem', background: '#222', borderRadius: '0.25rem', flexShrink: 0 }} />
                  )}
                  <span style={{ fontSize: '0.8125rem' }}>{gift.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {reverseResults.length > 0 && (
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {reverseResults.map(({ recipe, materials, result }) => (
              <FusionCard key={recipe.id} materials={materials} result={result} canCraft={false} />
            ))}
          </div>
        )}
        {reverseQuery.trim() && reverseResults.length === 0 && !showReverseSuggestions && (
          <div style={{ marginTop: '0.625rem', fontSize: '0.8125rem', color: '#4b5563' }}>
            해당 기프트를 만드는 레시피가 없습니다
          </div>
        )}
      </section>
    </div>
  )
}

interface FusionCardProps {
  materials: GiftData[]
  result: GiftData | null
  canCraft: boolean
}

function FusionCard({ materials, result, canCraft }: FusionCardProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      background: canCraft ? 'rgba(200,144,10,0.06)' : '#1a1510',
      border: `1px solid ${canCraft ? 'rgba(200,144,10,0.3)' : '#222'}`,
      borderRadius: '0.375rem',
      padding: '0.5rem 0.75rem',
    }}>
      {/* Materials */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flex: 1, flexWrap: 'wrap' }}>
        {materials.map((mat, i) => (
          <div key={mat.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            {i > 0 && <span style={{ fontSize: '0.6875rem', color: '#4b5563' }}>+</span>}
            <GiftChip gift={mat} />
          </div>
        ))}
      </div>

      {/* Arrow */}
      <ArrowRight size={14} color={canCraft ? '#c8900a' : '#4b5563'} style={{ flexShrink: 0 }} />

      {/* Result */}
      {result ? (
        <GiftChip gift={result} highlight={canCraft} />
      ) : (
        <div style={{ fontSize: '0.75rem', color: '#4b5563' }}>?</div>
      )}
    </div>
  )
}

function GiftChip({ gift, highlight = false }: { gift: GiftData; highlight?: boolean }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.25rem',
      background: highlight ? 'rgba(200,144,10,0.1)' : 'transparent',
      borderRadius: '0.25rem',
      padding: '0.125rem 0.25rem',
    }}>
      {gift.image_url ? (
        <Image
          src={gift.image_url}
          alt={gift.name}
          width={24}
          height={24}
          style={{ width: '1.5rem', height: '1.5rem', objectFit: 'contain', flexShrink: 0 }}
        />
      ) : (
        <div style={{ width: '1.5rem', height: '1.5rem', background: '#222', borderRadius: '0.25rem', flexShrink: 0 }} />
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: '0.6875rem',
          color: highlight ? '#e8b030' : '#e5e7eb',
          whiteSpace: 'nowrap',
          maxWidth: '5rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {gift.name}
        </div>
        {gift.keyword && (
          <div style={{ fontSize: '0.5625rem', color: '#8a6010', whiteSpace: 'nowrap' }}>
            {gift.keyword}
          </div>
        )}
      </div>
    </div>
  )
}
