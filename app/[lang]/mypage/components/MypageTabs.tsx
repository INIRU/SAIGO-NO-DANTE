'use client'

import { useRef, useCallback } from 'react'
import { User, Layers, Map, Archive } from 'lucide-react'

// Design Ref: §5.1 — 탭 네비게이션 UI
export type MypageTab = 'profile' | 'decks' | 'planner' | 'collection'

const TABS: { key: MypageTab; label: string; icon: typeof User }[] = [
  { key: 'profile', label: '프로필', icon: User },
  { key: 'decks', label: '덱', icon: Layers },
  { key: 'planner', label: '플래너', icon: Map },
  { key: 'collection', label: '컬렉션', icon: Archive },
]

type Props = {
  activeTab: MypageTab
  onTabChange: (tab: MypageTab) => void
  counts?: { deckCount?: number; planCount?: number }
}

export default function MypageTabs({ activeTab, onTabChange, counts }: Props) {
  const tablistRef = useRef<HTMLDivElement>(null)

  // Plan SC: SC-09 — 키보드 좌/우 화살표 탭 전환
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const idx = TABS.findIndex(t => t.key === activeTab)
    let next = idx
    if (e.key === 'ArrowRight') next = (idx + 1) % TABS.length
    else if (e.key === 'ArrowLeft') next = (idx - 1 + TABS.length) % TABS.length
    else return
    e.preventDefault()
    onTabChange(TABS[next].key)
    const btn = tablistRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]
    btn?.focus()
  }, [activeTab, onTabChange])

  return (
    <div
      ref={tablistRef}
      role="tablist"
      aria-label="마이페이지 탭"
      className="mypage-tabs flex gap-1 overflow-x-auto scrollbar-hide"
      style={{
        background: '#1a1510',
        border: '1px solid var(--border)',
        borderRadius: '0.5rem',
        padding: '0.25rem',
        opacity: 0,
      }}
      onKeyDown={handleKeyDown}
    >
      {TABS.map(({ key, label, icon: Icon }) => {
        const isActive = activeTab === key
        const count = key === 'decks' ? counts?.deckCount : key === 'planner' ? counts?.planCount : undefined
        return (
          <button
            key={key}
            role="tab"
            id={`tab-${key}`}
            aria-selected={isActive}
            aria-controls={`panel-${key}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onTabChange(key)}
            className="flex min-h-11 flex-shrink-0 items-center gap-2 rounded-md px-4 transition-all duration-200 whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
            style={{
              background: isActive ? 'rgba(200,144,10,0.1)' : 'transparent',
              color: isActive ? 'var(--gold)' : 'var(--text-tertiary)',
              fontSize: '0.9375rem',
              fontFamily: 'var(--font-body)',
              cursor: 'pointer',
              border: isActive ? '1px solid rgba(200,144,10,0.2)' : '1px solid transparent',
            }}
          >
            <Icon style={{ width: '1rem', height: '1rem' }} aria-hidden="true" />
            <span>{label}</span>
            {count !== undefined && count > 0 && (
              <span
                style={{
                  fontSize: '0.875rem',
                  fontFamily: 'var(--font-mono)',
                  color: isActive ? 'var(--gold)' : '#555',
                  background: isActive ? 'rgba(200,144,10,0.15)' : 'rgba(255,255,255,0.05)',
                  padding: '0 0.375rem',
                  borderRadius: '2rem',
                  lineHeight: '1.375rem',
                }}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
