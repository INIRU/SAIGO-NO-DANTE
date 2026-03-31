'use client'

import { useMemo, useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft, RotateCcw, ChevronRight, ChevronsRight, ChevronsLeft } from 'lucide-react'
import { type RunState } from '@/lib/planner/run-types'
import { buildGiftMap } from '@/lib/planner/fusion'
import { saveRunToHistory, decodePlan, loadPlanForRun } from '@/lib/planner/encoder'
import { useRunStore } from '@/lib/stores/run'
import { type ThemeData, type GiftData, type RecipeData, type IdentityData, type SinnerData, type SkillSummary, type EgoData, type PassiveData } from '@/lib/planner/types'
import type { MirrorDungeonEvent } from '@/components/mirror-dungeon/types'
import dynamic from 'next/dynamic'
import RunSetup from '@/components/planner/run/RunSetup'
import FloorProgress from '@/components/planner/run/FloorProgress'
import FloorPanel from '@/components/planner/run/FloorPanel'

const InventoryPanel = dynamic(() => import('@/components/planner/run/InventoryPanel'), { ssr: false })

interface Props {
  themes: ThemeData[]
  gifts: GiftData[]
  recipes: RecipeData[]
  identities: IdentityData[]
  sinners: SinnerData[]
  skills: SkillSummary[]
  passives: PassiveData[]
  egos: EgoData[]
  events: MirrorDungeonEvent[]
}

export default function RunClient({ themes, gifts, recipes, identities, sinners, skills, passives, egos, events }: Props) {
  const state = useRunStore()
  const dispatch = useRunStore(s => s.dispatch)
  const giftMap = useMemo(() => buildGiftMap(gifts), [gifts])

  // 트리거 모드: Navbar, Footer 숨김
  useEffect(() => {
    document.documentElement.classList.add('trigger-mode')
    return () => { document.documentElement.classList.remove('trigger-mode') }
  }, [])

  // URL 파라미터 처리
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    // ?from-plan=1: localStorage에서 full state 로드 (slot_order 보존)
    if (params.get('from-plan') === '1') {
      const planState = loadPlanForRun()
      if (planState) {
        dispatch({ type: 'LOAD_FROM_PLAN', planState })
      }
      return
    }

    // ?plan=<encoded>: URL 인코딩된 플랜 (legacy, slot_order 미보존)
    const planParam = params.get('plan')
    if (planParam) {
      decodePlan(planParam).then(decoded => {
        const slots = decoded.identityIds.map((id, i) => {
          const ident = identities.find(x => x.id === id)
          if (!ident) return null
          return {
            identity_id: id, sinner_id: ident.sinner_id, name_kr: ident.name_kr,
            rarity: ident.rarity, keywords: ident.keywords ?? [],
            game_id: ident.game_id, folder_name: ident.folder_name, slot_order: i,
          }
        }).filter(Boolean) as any[]

        const egoSlots = decoded.egoIds.map(id => {
          const ego = egos.find(x => x.id === id)
          if (!ego) return null
          return { ego_id: id, sinner_id: ego.sinner_id, name_kr: ego.name_kr ?? ego.name, grade: ego.grade, sin_affinity: ego.sin_affinity }
        }).filter(Boolean) as any[]

        dispatch({
          type: 'LOAD_FROM_PLAN',
          planState: {
            difficulty: decoded.difficulty,
            identitySlots: slots,
            egoSlots,
            floorPlan: decoded.floorThemeIds.map((tid, i) => ({ floor: i + 1, theme_id: tid, gift_ids: [] as string[], memo: '' })),
            giftInventory: decoded.giftIds,
          },
        })
      }).catch(() => { /* invalid */ })
      return
    }
    // ?draft=1 — Zustand persist가 자동 복원하므로 별도 처리 불필요
  }, [identities, egos])

  // Zustand persist가 자동 저장 처리

  // 완료 시 히스토리 저장
  useEffect(() => {
    if (state.phase === 'completed') {
      saveRunToHistory(state)
    }
  }, [state.phase])

  const handleReset = useCallback(() => { dispatch({ type: 'RESET' }) }, [dispatch])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const sidebarRef = useRef<HTMLDivElement>(null)

  // GSAP: 사이드바 열기/닫기 애니메이션
  useEffect(() => {
    ;(async () => {
      const gsap = (await import('gsap')).default
      if (!sidebarRef.current) return
      if (sidebarOpen) {
        gsap.fromTo(sidebarRef.current, { x: 50, opacity: 0 }, { x: 0, opacity: 1, duration: 0.3, ease: 'power2.out' })
      }
    })()
  }, [sidebarOpen])

  // ── Setup ──
  if (state.phase === 'setup') {
    return (
      <div className="min-h-screen" style={{ background: '#0d0b08', color: '#e8e0d0' }}>
        <div className="mx-auto" style={{ maxWidth: '72rem', padding: '1.5rem 1rem' }}>
          <Link href="/planner" className="inline-flex items-center gap-2 hover:opacity-80 mb-6" style={{ color: '#c8900a', fontSize: '0.875rem', minHeight: '2.75rem' }}>
            <ArrowLeft style={{ width: '1.125rem', height: '1.125rem' }} /> 플래너로 돌아가기
          </Link>
          <h1 className="font-serif" style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>거울 던전 트리거 모드</h1>
          <RunSetup state={state} dispatch={dispatch} gifts={gifts} giftMap={giftMap} identities={identities} sinners={sinners} egos={egos} />
        </div>
      </div>
    )
  }

  // ── Completed ──
  if (state.phase === 'completed') {
    const total = state.giftInventory.length
    const played = state.floorLogs.filter(l => l.completedAt).length
    return (
      <div className="min-h-screen" style={{ background: '#0d0b08', color: '#e8e0d0' }}>
        <div className="mx-auto text-center" style={{ maxWidth: '40rem', padding: '3rem 1rem' }}>
          <h1 className="font-serif" style={{ fontSize: '2rem', color: '#c8900a', marginBottom: '1rem' }}>런 완료</h1>
          <div className="rounded-lg" style={{ background: '#1a1510', padding: '1.5rem', marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>{played}층 클리어 · 기프트 {total}개</p>
          </div>
          <div className="flex justify-center gap-3">
            <button onClick={handleReset} className="inline-flex items-center gap-2 rounded-lg" style={{ background: '#2a2015', padding: '0.625rem 1.25rem', fontSize: '0.875rem', border: '1px solid #3a3020', minHeight: '2.75rem' }}>
              <RotateCcw style={{ width: '0.875rem', height: '0.875rem' }} /> 새 런
            </button>
            <Link href="/planner" className="inline-flex items-center gap-2 rounded-lg" style={{ background: '#c8900a', color: '#0d0b08', padding: '0.625rem 1.25rem', fontSize: '0.875rem', fontWeight: 600, minHeight: '2.75rem' }}>
              플래너로
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Playing: 3-column layout ──
  const currentLog = state.floorLogs[state.currentFloor - 1]
  const isLastFloor = state.currentFloor >= state.maxFloors

  return (
    <div className="min-h-screen" style={{ background: '#0d0b08', color: '#e8e0d0' }}>
      {/* 모바일 상단 바 */}
      <div className="lg:hidden flex items-center justify-between" style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #2a2015', gap: '0.5rem' }}>
        <Link href="/planner" className="flex items-center justify-center shrink-0" style={{ color: '#c8900a', minWidth: '2.75rem', minHeight: '2.75rem' }}>
          <ArrowLeft style={{ width: '1.25rem', height: '1.25rem' }} />
        </Link>
        <div className="flex-1 min-w-0 text-center">
          <span className="font-serif block" style={{ fontSize: '1rem' }}>층 {state.currentFloor} / {state.maxFloors}</span>
          {(() => {
            const log = state.floorLogs[state.currentFloor - 1]
            const theme = log?.themeId ? themes.find(t => t.id === log.themeId) : null
            return theme ? (
              <span className="block truncate" style={{ fontSize: '0.6875rem', color: '#888' }}>{theme.name}</span>
            ) : null
          })()}
        </div>
        <button
          onClick={() => dispatch({ type: isLastFloor ? 'COMPLETE_RUN' : 'NEXT_FLOOR' })}
          className="rounded shrink-0 flex items-center justify-center gap-0.5"
          style={{ background: '#c8900a', color: '#0d0b08', padding: '0.5rem 1rem', fontSize: '0.8125rem', fontWeight: 600, minHeight: '2.75rem' }}
        >
          {isLastFloor ? '완료' : '다음 층'} <ChevronRight style={{ width: '0.875rem', height: '0.875rem' }} />
        </button>
      </div>

      <div className="flex flex-col lg:flex-row" style={{ minHeight: 'calc(100vh - 3rem)' }}>
        {/* 좌측: 층 타임라인 (데스크톱) */}
        <aside className="hidden lg:block shrink-0" style={{ width: '8rem', borderRight: '1px solid #2a2015' }}>
          <div className="sticky top-0" style={{ padding: '1rem 0.5rem' }}>
            <Link href="/planner" className="inline-flex items-center gap-1 hover:opacity-80 mb-4" style={{ color: '#c8900a', fontSize: '0.75rem' }}>
              <ArrowLeft style={{ width: '0.75rem', height: '0.75rem' }} /> 플래너
            </Link>
            <FloorProgress state={state} dispatch={dispatch} themes={themes} />
          </div>
        </aside>

        {/* 중앙: 메인 패널 */}
        <main className="flex-1 min-w-0">
          <FloorPanel
            state={state} dispatch={dispatch}
            themes={themes} gifts={gifts} giftMap={giftMap}
            identities={identities} sinners={sinners} skills={skills} passives={passives} egos={egos}
            events={events}
          />
        </main>

        {/* 우측: 인벤토리 (접기/펼치기) */}
        <aside className="shrink-0 lg:border-l border-t lg:border-t-0 relative" style={{ borderColor: '#2a2015' }}>
          {/* 데스크톱 사이드바 토글 탭 */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden lg:flex items-center justify-center z-[3] transition-all"
            style={{
              position: 'absolute', top: '50%', transform: 'translateY(-50%)',
              left: '-1.25rem',
              width: '1.25rem', height: '3rem',
              borderRadius: '0.375rem 0 0 0.375rem',
              background: sidebarOpen ? '#1a1510' : 'rgba(200,144,10,0.15)',
              borderTop: `1px solid ${sidebarOpen ? '#2a2015' : 'rgba(200,144,10,0.3)'}`,
              borderBottom: `1px solid ${sidebarOpen ? '#2a2015' : 'rgba(200,144,10,0.3)'}`,
              borderLeft: `1px solid ${sidebarOpen ? '#2a2015' : 'rgba(200,144,10,0.3)'}`,
              color: sidebarOpen ? '#555' : '#c8900a',
            }}
            title={sidebarOpen ? '사이드바 접기' : '사이드바 펼치기'}
          >
            {sidebarOpen ? <ChevronsRight style={{ width: '0.75rem', height: '0.75rem' }} /> : <ChevronsLeft style={{ width: '0.75rem', height: '0.75rem' }} />}
          </button>
          {/* 모바일: 항상 InventoryPanel 렌더 (자체 토글 사용), 데스크톱: sidebarOpen 따라 표시 */}
          <div className="lg:hidden">
            <InventoryPanel state={state} dispatch={dispatch} gifts={gifts} giftMap={giftMap} recipes={recipes} />
          </div>
          {sidebarOpen && (
            <div ref={sidebarRef} className="hidden lg:block lg:sticky lg:top-0 lg:overflow-y-auto" style={{ maxHeight: '100vh' }}>
              <InventoryPanel state={state} dispatch={dispatch} gifts={gifts} giftMap={giftMap} recipes={recipes} />
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
