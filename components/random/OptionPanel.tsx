'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Check } from 'lucide-react'
import KeywordChips from './KeywordChips'
import type { KeywordCondition } from '@/lib/random/engine'

type Props = {
  identityEnabled: boolean
  egoEnabled: boolean
  collectionEnabled: boolean
  collectionCode: string
  collectionDecoded: boolean
  keywords: KeywordCondition[]
  onIdentityToggle: () => void
  onEgoToggle: () => void
  onCollectionToggle: () => void
  onCollectionCodeChange: (code: string) => void
  onKeywordsChange: (keywords: KeywordCondition[]) => void
  onKeywordMaxExceeded: () => void
}

export default function OptionPanel(props: Props) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="rounded-[0.25rem] mb-[1.5rem] overflow-hidden" style={{ border: '1px solid rgba(138,96,16,0.15)', background: 'linear-gradient(160deg, #16120d 0%, #0f0c08 100%)' }}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-[1rem] py-[0.75rem] transition-colors hover:bg-[#1a1510]/50"
      >
        <span className="font-serif text-[1rem] text-[#8a6010]">옵션</span>
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
                  // Auto-extract code from collection URL
                  const match = val.match(/[?&]code=([^&]+)/)
                  if (match) val = decodeURIComponent(match[1])
                  props.onCollectionCodeChange(val)
                }}
                className="w-full bg-[#0d0b08] rounded-[0.25rem] px-[0.75rem] py-[0.375rem] text-[0.8125rem] text-[#e8e4d8] placeholder-[#3a3020] focus:outline-none transition-colors"
                style={{ border: '1px solid rgba(138,96,16,0.2)', }}
              />
              <p className="text-[0.6875rem] text-[#3a3020] mt-[0.25rem]">
                보유 현황 페이지의 공유 URL 또는 코드를 입력하세요
              </p>
            </div>
          )}

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
        border: '1px solid rgba(200,144,10,0.6)',
        background: 'rgba(200,144,10,0.12)',
        color: '#e8b030',
        boxShadow: '0 0 0.5rem rgba(200,144,10,0.1)',
      } : {
        border: '1px solid rgba(138,96,16,0.2)',
        background: 'transparent',
        color: '#5a5040',
      }}
    >
      {label}
    </button>
  )
}
