'use client'

import { useCallback, useRef } from 'react'
import { useLocale } from 'next-intl'
import { Archive, Layers, Map as MapIcon, Medal, Settings, Users } from 'lucide-react'
import { getCommunityCopy } from '@/lib/community/copy'
import styles from '../mypage.module.css'

export type MypageTab = 'badges' | 'decks' | 'planner' | 'collection' | 'follows' | 'profile'
export const MYPAGE_TABS: MypageTab[] = ['badges', 'decks', 'planner', 'collection', 'follows', 'profile']

const ICONS: Record<MypageTab, typeof Medal> = { badges: Medal, decks: Layers, planner: MapIcon, collection: Archive, follows: Users, profile: Settings }

export default function MypageTabs({ activeTab, onTabChange, counts }: {
  activeTab: MypageTab
  onTabChange: (tab: MypageTab) => void
  counts: Partial<Record<MypageTab, string | number>>
}) {
  const t = getCommunityCopy(useLocale())
  const listRef = useRef<HTMLDivElement>(null)
  // Arrow keys move between tabs (both directions work in the row and the vertical list).
  const onKeyDown = useCallback((event: React.KeyboardEvent) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const next = (MYPAGE_TABS.indexOf(activeTab) + step + MYPAGE_TABS.length) % MYPAGE_TABS.length
    onTabChange(MYPAGE_TABS[next])
    listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }, [activeTab, onTabChange])
  return (
    <div ref={listRef} role="tablist" aria-label={t.mypage} aria-orientation="vertical" className={styles.nav} onKeyDown={onKeyDown}>
      {MYPAGE_TABS.map(key => {
        const Icon = ICONS[key]
        const selected = activeTab === key
        return (
          <button key={key} type="button" role="tab" id={`tab-${key}`} aria-selected={selected} aria-controls={`panel-${key}`} tabIndex={selected ? 0 : -1}
            className={styles.navItem} onClick={() => onTabChange(key)}>
            <Icon aria-hidden="true" />
            {t[key]}
            {counts[key] !== undefined && <span className={styles.navCount}>{counts[key]}</span>}
          </button>
        )
      })}
    </div>
  )
}
