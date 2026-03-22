'use client'

import { useReducer, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Users, Star, Layers, Combine, FileText } from 'lucide-react'
import { plannerReducer, createInitialState, DIFFICULTY_CONFIG, type PlannerState, type ThemeData, type GiftData, type RecipeData, type IdentityData, type SinnerData, type PassiveData, type SkillSummary, type Difficulty } from '@/lib/planner/types'
import { buildGiftMap } from '@/lib/planner/fusion'
import { loadDraftFromLocal } from '@/lib/planner/encoder'
import DeckTab from '@/components/planner/DeckTab'
import FloorTab from '@/components/planner/FloorTab'
import FusionTab from '@/components/planner/FusionTab'
import SummaryTab from '@/components/planner/SummaryTab'
import BlessingTab from '@/components/planner/BlessingTab'

interface Props {
  themes: ThemeData[]
  gifts: GiftData[]
  recipes: RecipeData[]
  identities: IdentityData[]
  sinners: SinnerData[]
  passives: PassiveData[]
  skills: SkillSummary[]
}

const TABS = [
  { key: 'deck' as const, label: '덱 편성', icon: Users },
  { key: 'blessing' as const, label: '가호', icon: Star },
  { key: 'floor' as const, label: '층별 계획', icon: Layers },
  { key: 'fusion' as const, label: '조합식', icon: Combine },
  { key: 'summary' as const, label: '요약', icon: FileText },
]

export default function PlannerClient({ themes, gifts, recipes, identities, sinners, passives, skills }: Props) {
  const [state, dispatch] = useReducer(plannerReducer, 'hard', createInitialState)

  const giftMap = useMemo(() => buildGiftMap(gifts), [gifts])

  // localStorage 복원
  useEffect(() => {
    const draft = loadDraftFromLocal()
    if (draft) dispatch({ type: 'LOAD_PLAN', state: draft })
  }, [])

  // URL 파라미터 복원
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const planCode = params.get('plan')
    if (planCode) {
      import('@/lib/planner/encoder').then(({ decodePlan }) => {
        try {
          const decoded = decodePlan(planCode)
          // identity_ids → identitySlots로 복원
          const slots = decoded.identityIds.map((id, i) => {
            const identity = identities.find(ident => ident.id === id)
            if (!identity) return null
            return {
              identity_id: id,
              sinner_id: identity.sinner_id,
              name_kr: identity.name_kr,
              rarity: identity.rarity,
              keywords: identity.keywords ?? [],
              game_id: identity.game_id,
              folder_name: identity.folder_name,
              slot_order: i,
            }
          }).filter(Boolean)

          dispatch({
            type: 'LOAD_PLAN',
            state: {
              difficulty: decoded.difficulty,
              identitySlots: slots as PlannerState['identitySlots'],
              floorPlan: decoded.floorThemeIds.map((tid, i) => ({ floor: i + 1, theme_id: tid })),
              giftInventory: decoded.giftIds,
              title: decoded.title,
              description: decoded.description,
            },
          })
        } catch { /* invalid plan code */ }
      })
    }
  }, [identities])

  return (
    <div className="min-h-screen pt-24 pb-16" style={{ background: '#0d0b08' }}>
      <div className="max-w-6xl mx-auto px-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/mirror-dungeon" className="inline-flex items-center gap-1 mb-2 transition-colors" style={{ color: '#666', fontSize: '0.75rem' }}>
              <ArrowLeft style={{ width: '0.75rem', height: '0.75rem' }} /> 거울 던전
            </Link>
            <h1 className="font-serif" style={{ fontSize: '1.5rem', color: '#e8dcc8' }}>거울 던전 플래너</h1>
          </div>
          <Link href="/planner/community" className="text-sm transition-colors hover:brightness-110" style={{ color: '#c8900a', fontSize: '0.8125rem' }}>
            커뮤니티 플랜 →
          </Link>
        </div>

        {/* 난이도 선택 */}
        <div className="flex gap-2 mb-6">
          {(Object.entries(DIFFICULTY_CONFIG) as [Difficulty, typeof DIFFICULTY_CONFIG[Difficulty]][]).map(([key, config]) => (
            <button
              key={key}
              onClick={() => dispatch({ type: 'SET_DIFFICULTY', difficulty: key })}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: state.difficulty === key ? '#c8900a20' : '#1a1510',
                color: state.difficulty === key ? '#e8b030' : '#666',
                border: `1px solid ${state.difficulty === key ? '#c8900a50' : '#222'}`,
              }}
            >
              {config.label} ({config.floors}층)
            </button>
          ))}
        </div>

        {/* 탭 바 */}
        <div className="flex mb-6" style={{ borderBottom: '1px solid #222' }}>
          {TABS.map(tab => {
            const active = state.activeTab === tab.key
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => dispatch({ type: 'SET_TAB', tab: tab.key })}
                className="flex items-center gap-1.5 px-5 py-2.5 font-semibold transition-all"
                style={{
                  color: active ? '#e8dcc8' : '#555',
                  fontSize: '0.8125rem',
                  background: active ? '#c8900a12' : 'transparent',
                  borderBottom: active ? '2px solid #c8900a' : '2px solid transparent',
                  marginBottom: '-1px',
                }}
              >
                <Icon style={{ width: '0.875rem', height: '0.875rem' }} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* 탭 콘텐츠 */}
        {state.activeTab === 'deck' && (
          <DeckTab state={state} dispatch={dispatch} identities={identities} sinners={sinners} themes={themes} gifts={gifts} giftMap={giftMap} passives={passives} skills={skills} />
        )}
        {state.activeTab === 'blessing' && (
          <BlessingTab state={state} dispatch={dispatch} />
        )}
        {state.activeTab === 'floor' && (
          <FloorTab state={state} dispatch={dispatch} themes={themes} gifts={gifts} giftMap={giftMap} />
        )}
        {state.activeTab === 'fusion' && (
          <FusionTab state={state} dispatch={dispatch} recipes={recipes} gifts={gifts} giftMap={giftMap} />
        )}
        {state.activeTab === 'summary' && (
          <SummaryTab state={state} dispatch={dispatch} themes={themes} gifts={gifts} giftMap={giftMap} identities={identities} sinners={sinners} />
        )}
      </div>
    </div>
  )
}
