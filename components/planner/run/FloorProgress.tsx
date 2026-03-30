'use client'

import { memo, useEffect, useMemo, useRef } from 'react'
import { ChevronRight, Check } from 'lucide-react'
import type { RunState, RunAction } from '@/lib/planner/run-types'
import type { ThemeData } from '@/lib/planner/types'

interface Props {
  state: RunState
  dispatch: React.Dispatch<RunAction>
  themes: ThemeData[]
}

export default memo(function FloorProgress({ state, dispatch, themes }: Props) {
  const isLastFloor = state.currentFloor >= state.maxFloors
  const containerRef = useRef<HTMLDivElement>(null)
  const prevFloor = useRef(state.currentFloor)

  // GSAP: 층 전환 시 현재 층 노드 펄스 애니메이션
  useEffect(() => {
    if (prevFloor.current === state.currentFloor) return
    prevFloor.current = state.currentFloor
    ;(async () => {
      const gsap = (await import('gsap')).default
      const el = containerRef.current?.querySelector(`[data-floor="${state.currentFloor}"]`)
      if (el) {
        gsap.fromTo(el, { scale: 1.3, opacity: 0.5 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(2)' })
      }
    })()
  }, [state.currentFloor])

  // GSAP: 초기 로드 시 스태거 애니메이션
  useEffect(() => {
    ;(async () => {
      const gsap = (await import('gsap')).default
      const nodes = containerRef.current?.querySelectorAll('[data-floor]')
      if (nodes?.length) {
        gsap.fromTo(nodes, { x: -10, opacity: 0 }, { x: 0, opacity: 1, duration: 0.3, stagger: 0.05, ease: 'power2.out' })
      }
    })()
  }, [])

  const completedCount = useMemo(() => state.floorLogs.filter(l => l.completedAt).length, [state.floorLogs])
  const progress = completedCount / state.maxFloors

  return (
    <div ref={containerRef}>
      {/* 헤더 + 진행률 */}
      <div style={{ marginBottom: '0.75rem' }}>
        <p className="font-serif" style={{ fontSize: '0.75rem', color: '#c8900a', marginBottom: '0.375rem' }}>
          층 진행
        </p>
        {/* 미니 프로그레스 바 */}
        <div style={{ height: '0.1875rem', background: '#2a2015', borderRadius: '0.09375rem', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${progress * 100}%`,
            background: 'linear-gradient(90deg, #8a6010, #c8900a, #e8b030)',
            borderRadius: '0.09375rem',
            transition: 'width 0.5s ease',
          }} />
        </div>
        <p style={{ fontSize: '0.5rem', color: '#555', marginTop: '0.1875rem', textAlign: 'right' }}>
          {completedCount}/{state.maxFloors}
        </p>
      </div>

      {/* 타임라인 — 노드 중심 = left 0.5625rem (원 1.125rem / 2) */}
      <div className="relative">
        {/* 세로 연결선 — 노드 중심 관통 */}
        <div className="absolute" style={{
          left: '0.53125rem', top: '0.875rem', bottom: '0.875rem', width: '0.0625rem',
          background: 'linear-gradient(to bottom, #2a2015, rgba(200,144,10,0.2), #2a2015)',
        }} />

        <div className="flex flex-col" style={{ gap: '0.125rem' }}>
          {state.floorLogs.map(log => {
            const isCurrent = log.floor === state.currentFloor
            const isCompleted = !!log.completedAt
            const theme = log.themeId ? themes.find(t => t.id === log.themeId) : null

            return (
              <button
                key={log.floor}
                data-floor={log.floor}
                onClick={() => dispatch({ type: 'GO_TO_FLOOR', floor: log.floor })}
                className="flex items-center gap-1.5 w-full text-left transition-all relative"
                style={{
                  padding: '0.375rem 0',
                  borderRadius: '0.25rem',
                  background: isCurrent ? 'rgba(200,144,10,0.08)' : 'transparent',
                  minHeight: '1.75rem',
                }}
              >
                {/* 노드 원 — 중심이 세로선과 일치 */}
                <span style={{
                  width: '1.125rem', height: '1.125rem', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: isCompleted ? 'rgba(34,197,94,0.2)' : isCurrent ? '#c8900a' : '#1a1510',
                  border: `0.09375rem solid ${isCompleted ? 'rgba(34,197,94,0.6)' : isCurrent ? '#e8b030' : '#333'}`,
                  color: isCompleted ? '#4ade80' : isCurrent ? '#0d0b08' : '#555',
                  fontSize: '0.4375rem', fontWeight: 700,
                  boxShadow: isCurrent ? '0 0 0.5rem rgba(200,144,10,0.5)' : 'none',
                  transition: 'all 0.3s ease',
                  zIndex: 2,
                }}>
                  {isCompleted ? <Check style={{ width: '0.5rem', height: '0.5rem' }} /> : log.floor}
                </span>

                {/* 텍스트 */}
                <div className="flex-1 min-w-0">
                  <span className="block truncate" style={{
                    fontSize: isCurrent ? '0.6875rem' : '0.5625rem',
                    fontWeight: isCurrent ? 700 : 400,
                    color: isCompleted ? '#4ade80' : isCurrent ? '#e8dcc8' : '#555',
                    transition: 'all 0.3s ease',
                  }}>
                    {theme ? theme.name : `${log.floor}층`}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 다음 층 / 완료 버튼 */}
      <button
        onClick={() => dispatch({ type: isLastFloor ? 'COMPLETE_RUN' : 'NEXT_FLOOR' })}
        className="w-full rounded-lg mt-3 flex items-center justify-center gap-1 transition-all"
        style={{
          padding: '0.5rem', fontSize: '0.75rem', fontWeight: 600,
          background: isLastFloor ? 'rgba(34,197,94,0.15)' : 'rgba(200,144,10,0.15)',
          border: `1px solid ${isLastFloor ? 'rgba(34,197,94,0.3)' : 'rgba(200,144,10,0.3)'}`,
          color: isLastFloor ? '#4ade80' : '#e8b030',
        }}
      >
        {isLastFloor ? '런 완료' : '다음 층'}
        <ChevronRight style={{ width: '0.75rem', height: '0.75rem' }} />
      </button>
    </div>
  )
})
