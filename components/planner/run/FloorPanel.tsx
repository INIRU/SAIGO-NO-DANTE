'use client'

import { useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { Users, Map, Calendar, Gift } from 'lucide-react'
import type { RunState, RunAction, FloorSubTab } from '@/lib/planner/run-types'
import type { ThemeData, GiftData, IdentityData, SinnerData, SkillSummary, EgoData, PassiveData } from '@/lib/planner/types'
import type { MirrorDungeonEvent } from '@/components/mirror-dungeon/types'
import DeckSection from './DeckSection'

const ThemeSection = dynamic(() => import('./ThemeSection'), { ssr: false })
const EventSection = dynamic(() => import('./EventSection'), { ssr: false })
const GiftCheckSection = dynamic(() => import('./GiftCheckSection'), { ssr: false })

interface Props {
  state: RunState
  dispatch: React.Dispatch<RunAction>
  themes: ThemeData[]
  gifts: GiftData[]
  giftMap: Map<number, GiftData>
  identities: IdentityData[]
  sinners: SinnerData[]
  skills: SkillSummary[]
  passives: PassiveData[]
  egos: EgoData[]
  events: MirrorDungeonEvent[]
}

const SUB_TABS: { key: FloorSubTab; label: string; icon: typeof Users }[] = [
  { key: 'deck', label: '덱 편성', icon: Users },
  { key: 'theme', label: '테마팩', icon: Map },
  { key: 'event', label: '이벤트', icon: Calendar },
  { key: 'gift', label: '기프트', icon: Gift },
]

export default function FloorPanel({ state, dispatch, themes, gifts, giftMap, identities, sinners, skills, passives, egos, events }: Props) {
  const currentLog = state.floorLogs[state.currentFloor - 1]
  const isLastFloor = state.currentFloor >= state.maxFloors
  const contentRef = useRef<HTMLDivElement>(null)
  const prevTab = useRef(state.activeSubTab)
  const prevFloor = useRef(state.currentFloor)

  // GSAP: 서브탭 전환 페이드
  useEffect(() => {
    if (prevTab.current === state.activeSubTab && prevFloor.current === state.currentFloor) return
    prevTab.current = state.activeSubTab
    prevFloor.current = state.currentFloor
    ;(async () => {
      const gsap = (await import('gsap')).default
      if (contentRef.current) {
        gsap.fromTo(contentRef.current, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' })
      }
    })()
  }, [state.activeSubTab, state.currentFloor])

  return (
    <div style={{ minHeight: '100%' }}>
      {/* 헤더 + 서브탭 */}
      <div className="hidden lg:flex items-center justify-between" style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid #2a2015' }}>
        <h2 className="font-serif" style={{ fontSize: '1.25rem' }}>
          <span style={{ color: '#888', fontSize: '0.875rem', marginRight: '0.5rem' }}>{state.currentFloor}층</span>
          {(() => {
            const log = state.floorLogs[state.currentFloor - 1]
            const theme = log?.themeId ? themes.find(t => t.id === log.themeId) : null
            return theme ? theme.name : '테마팩 미선택'
          })()}
        </h2>
        <button
          onClick={() => dispatch({ type: isLastFloor ? 'COMPLETE_RUN' : 'NEXT_FLOOR' })}
          className="rounded-lg transition-all"
          style={{ background: '#c8900a', color: '#0d0b08', padding: '0.375rem 1rem', fontSize: '0.8125rem', fontWeight: 600 }}
        >
          {isLastFloor ? '런 완료' : '다음 층 ▶'}
        </button>
      </div>

      {/* 서브탭 */}
      <div className="flex" style={{ borderBottom: '1px solid #2a2015', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
        {SUB_TABS.map(tab => {
          const active = state.activeSubTab === tab.key
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => dispatch({ type: 'SET_SUB_TAB', tab: tab.key })}
              className="flex items-center gap-1.5 transition-all shrink-0"
              style={{
                padding: '0.75rem 1rem',
                fontSize: '0.8125rem',
                fontWeight: active ? 700 : 400,
                color: active ? '#e8dcc8' : '#555',
                background: active ? 'rgba(200,144,10,0.05)' : 'transparent',
                borderBottom: `2px solid ${active ? '#c8900a' : 'transparent'}`,
                minHeight: '2.75rem',
              }}
            >
              <Icon style={{ width: '0.875rem', height: '0.875rem' }} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* 서브탭 컨텐츠 */}
      <div ref={contentRef} style={{ padding: '1rem' }}>
        {state.activeSubTab === 'deck' && (
          <DeckSection state={state} dispatch={dispatch} identities={identities} sinners={sinners} skills={skills} passives={passives} egos={egos} giftMap={giftMap} />
        )}
        {state.activeSubTab === 'theme' && (
          <ThemeSection state={state} dispatch={dispatch} themes={themes} gifts={gifts} giftMap={giftMap} identities={identities} />
        )}
        {state.activeSubTab === 'event' && (
          <EventSection state={state} dispatch={dispatch} events={events} giftMap={giftMap} />
        )}
        {state.activeSubTab === 'gift' && (
          <GiftCheckSection state={state} dispatch={dispatch} gifts={gifts} giftMap={giftMap} themes={themes} />
        )}
      </div>

      {/* 층 메모 */}
      <div style={{ padding: '0 1rem 1rem' }}>
        <textarea
          value={currentLog?.memo ?? ''}
          onChange={e => dispatch({ type: 'SET_FLOOR_MEMO', memo: e.target.value })}
          placeholder="이번 층 메모..."
          className="w-full rounded-lg resize-none"
          style={{
            background: '#1a1510', border: '1px solid #2a2015', color: '#ccc',
            padding: '0.625rem', fontSize: '0.75rem', minHeight: '3rem', outline: 'none',
          }}
        />
      </div>
    </div>
  )
}
