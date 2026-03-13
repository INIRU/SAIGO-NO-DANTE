'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ChevronDown, ChevronUp, Check, Settings2 } from 'lucide-react'
import { RARITY_ICON_MAP, RARITY_COLORS } from '@/lib/constants/game'
import KeywordChips from './KeywordChips'
import type { KeywordCondition } from '@/lib/random/engine'

type Props = {
  identityEnabled: boolean
  egoEnabled: boolean
  collectionEnabled: boolean
  collectionCode: string
  collectionDecoded: boolean
  keywords: KeywordCondition[]
  rarityFilter: Set<number> | null
  onIdentityToggle: () => void
  onEgoToggle: () => void
  onCollectionToggle: () => void
  onCollectionCodeChange: (code: string) => void
  onKeywordsChange: (keywords: KeywordCondition[]) => void
  onKeywordMaxExceeded: () => void
  onRarityFilterChange: (filter: Set<number> | null) => void
}

export default function OptionPanel(props: Props) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div
      className="rounded-[0.375rem] mb-[1.5rem] overflow-hidden"
      style={{
        border: '1px solid rgba(138,96,16,0.15)',
        background: 'linear-gradient(160deg, #16120d 0%, #0f0c08 100%)',
        boxShadow: '0 0.25rem 1rem rgba(0,0,0,0.2)',
      }}
    >
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-[1rem] py-[0.75rem] transition-colors hover:bg-[#1a1510]/50"
      >
        <div className="flex items-center gap-[0.5rem]">
          <Settings2 style={{ width: '0.875rem', height: '0.875rem', color: '#5a4830' }} />
          <span className="font-serif text-[1rem] text-[#8a6010]">옵션</span>
        </div>
        {collapsed
          ? <ChevronDown style={{ width: '1rem', height: '1rem', color: '#5a4830' }} />
          : <ChevronUp style={{ width: '1rem', height: '1rem', color: '#5a4830' }} />
        }
      </button>

      {!collapsed && (
        <div className="px-[1rem] pb-[1rem] space-y-[0.875rem]" style={{ borderTop: '1px solid rgba(138,96,16,0.1)' }}>
          {/* Toggles row */}
          <div className="flex flex-wrap gap-[0.5rem] items-center pt-[0.75rem]">
            <ToggleChip label="인격" active={props.identityEnabled} onClick={props.onIdentityToggle} />
            <ToggleChip label="E.G.O" active={props.egoEnabled} onClick={props.onEgoToggle} />

            <div className="h-[1rem] w-px bg-[#8a6010]/20 mx-[0.25rem]" />

            <ToggleChip label="컬렉션 연동" active={props.collectionEnabled} onClick={props.onCollectionToggle} />

            {props.collectionEnabled && props.collectionDecoded && (
              <span className="flex items-center gap-[0.25rem] text-[0.6875rem] text-[#50b878]">
                <Check style={{ width: '0.75rem', height: '0.75rem' }} />
                연동됨
              </span>
            )}
          </div>

          {/* Collection code input */}
          {props.collectionEnabled && (
            <div>
              <input
                type="text"
                placeholder="컬렉션 코드 또는 URL을 붙여넣기"
                value={props.collectionCode}
                onChange={e => {
                  let val = e.target.value
                  const match = val.match(/[?&]code=([^&]+)/)
                  if (match) val = decodeURIComponent(match[1])
                  props.onCollectionCodeChange(val)
                }}
                className="w-full bg-[#0a0806] rounded-[0.375rem] px-[0.75rem] py-[0.4375rem] text-[0.8125rem] text-[#e8e4d8] placeholder-[#3a3020] focus:outline-none transition-all"
                style={{
                  border: '1px solid rgba(138,96,16,0.2)',
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(200,144,10,0.4)'; e.currentTarget.style.boxShadow = 'inset 0 1px 3px rgba(0,0,0,0.3), 0 0 0.5rem rgba(200,144,10,0.08)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(138,96,16,0.2)'; e.currentTarget.style.boxShadow = 'inset 0 1px 3px rgba(0,0,0,0.3)' }}
              />
              <p className="text-[0.6875rem] text-[#3a3020] mt-[0.25rem]">
                보유 현황 페이지의 공유 URL 또는 코드를 입력하세요
              </p>
            </div>
          )}

          {/* Rarity filter */}
          <div className="space-y-[0.375rem]">
            <span className="text-[0.6875rem] text-[#5a4830]" style={{ letterSpacing: '0.06em' }}>등급 필터</span>
            <div className="flex flex-wrap gap-[0.375rem] items-center">
              {[1, 2, 3].map(rarity => {
                const allSelected = props.rarityFilter === null
                const isActive = allSelected || props.rarityFilter!.has(rarity)
                const colors = RARITY_COLORS[rarity] ?? RARITY_COLORS[1]

                return (
                  <button
                    key={rarity}
                    onClick={() => {
                      if (props.rarityFilter === null) {
                        // All selected → deselect this one (keep the other two)
                        const next = new Set([1, 2, 3].filter(r => r !== rarity))
                        props.onRarityFilterChange(next.size === 3 ? null : next)
                      } else if (props.rarityFilter.has(rarity)) {
                        // Deselect (but don't allow empty)
                        if (props.rarityFilter.size <= 1) return
                        const next = new Set(props.rarityFilter)
                        next.delete(rarity)
                        props.onRarityFilterChange(next)
                      } else {
                        // Select
                        const next = new Set(props.rarityFilter)
                        next.add(rarity)
                        props.onRarityFilterChange(next.size === 3 ? null : next)
                      }
                    }}
                    className="flex items-center gap-[0.25rem] rounded-full px-[0.625rem] py-[0.1875rem] text-[0.75rem] transition-all duration-200"
                    style={isActive ? {
                      border: `1px solid ${colors.border}88`,
                      background: `${colors.border}20`,
                      color: colors.border,
                      boxShadow: `0 0 0.5rem ${colors.glow}20`,
                    } : {
                      border: '1px solid rgba(138,96,16,0.15)',
                      background: 'rgba(20,16,10,0.5)',
                      color: '#5a5040',
                      opacity: 0.6,
                    }}
                  >
                    {RARITY_ICON_MAP[rarity] && (
                      <Image
                        src={RARITY_ICON_MAP[rarity]}
                        alt={`${rarity}성`}
                        width={16}
                        height={16}
                        unoptimized
                        style={{ height: '0.875rem', width: 'auto', opacity: isActive ? 1 : 0.4 }}
                      />
                    )}
                  </button>
                )
              })}
              {props.rarityFilter !== null && (
                <button
                  onClick={() => props.onRarityFilterChange(null)}
                  className="text-[0.6875rem] px-[0.5rem] py-[0.125rem] rounded-full transition-colors"
                  style={{ color: '#5a4830', border: '1px solid rgba(138,96,16,0.15)' }}
                >
                  전체
                </button>
              )}
            </div>
          </div>

          {/* Keywords */}
          <KeywordChips
            keywords={props.keywords}
            onChange={props.onKeywordsChange}
            onMaxExceeded={props.onKeywordMaxExceeded}
          />
        </div>
      )}
    </div>
  )
}

function ToggleChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-[0.75rem] py-[0.25rem] text-[0.8125rem] transition-all duration-200"
      style={active ? {
        border: '1px solid rgba(200,144,10,0.5)',
        background: 'linear-gradient(135deg, rgba(200,144,10,0.15), rgba(200,144,10,0.08))',
        color: '#e8b030',
        boxShadow: '0 0 0.75rem rgba(200,144,10,0.1), inset 0 0 0.5rem rgba(200,144,10,0.05)',
      } : {
        border: '1px solid rgba(138,96,16,0.15)',
        background: 'rgba(20,16,10,0.5)',
        color: '#5a5040',
      }}
    >
      {label}
    </button>
  )
}
