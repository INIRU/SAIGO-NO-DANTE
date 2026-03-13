'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import KeywordChips from './KeywordChips'
import type { KeywordCondition } from '@/lib/random/engine'

type Props = {
  identityEnabled: boolean
  egoEnabled: boolean
  collectionEnabled: boolean
  collectionCode: string
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
    <div className="rounded-lg border border-[#8a6010]/30 bg-[#1a1510] mb-[1.5rem]">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-[1rem] py-[0.75rem] text-[#c8900a] hover:bg-[#241c12] transition-colors rounded-t-lg"
      >
        <span className="font-serif text-[1.125rem]">옵션</span>
        {collapsed ? <ChevronDown style={{ width: '1.25rem', height: '1.25rem' }} /> : <ChevronUp style={{ width: '1.25rem', height: '1.25rem' }} />}
      </button>

      {!collapsed && (
        <div className="px-[1rem] pb-[1rem] space-y-[0.75rem]">
          <div className="flex flex-wrap gap-[0.75rem] items-center">
            <ToggleChip label="인격" active={props.identityEnabled} onClick={props.onIdentityToggle} />
            <ToggleChip label="E.G.O" active={props.egoEnabled} onClick={props.onEgoToggle} />
            <div className="h-[1.25rem] w-px bg-[#8a6010]/30" />
            <ToggleChip label="컬렉션 연동" active={props.collectionEnabled} onClick={props.onCollectionToggle} />
            {props.collectionEnabled && (
              <input
                type="text"
                placeholder="컬렉션 코드 붙여넣기"
                value={props.collectionCode}
                onChange={e => props.onCollectionCodeChange(e.target.value)}
                className="bg-[#0d0b08] border border-[#8a6010]/40 rounded px-[0.5rem] py-[0.25rem] text-[0.8125rem] text-white placeholder-[#5a5040] flex-1 min-w-[10rem] focus:border-[#c8900a] focus:outline-none"
              />
            )}
          </div>

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
      className={`rounded-full px-[0.75rem] py-[0.25rem] text-[0.8125rem] border transition-colors ${
        active
          ? 'border-[#c8900a] bg-[#c8900a]/20 text-[#e8b030]'
          : 'border-[#8a6010]/30 bg-transparent text-[#5a5040]'
      }`}
    >
      {label}
    </button>
  )
}
