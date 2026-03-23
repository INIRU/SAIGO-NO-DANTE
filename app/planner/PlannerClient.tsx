'use client'

import { useReducer, useMemo, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { ArrowLeft, Users, Star, Gift, Layers, FileText, Copy, Save, Upload, Check } from 'lucide-react'
import { plannerReducer, createInitialState, DIFFICULTY_CONFIG, type PlannerState, type ThemeData, type GiftData, type RecipeData, type IdentityData, type SinnerData, type PassiveData, type SkillSummary, type EgoData, type Difficulty } from '@/lib/planner/types'
import { buildGiftMap } from '@/lib/planner/fusion'
import { loadDraftFromLocal, encodePlan, saveDraftToLocal } from '@/lib/planner/encoder'
import DeckTab from '@/components/planner/DeckTab'
import FloorTab from '@/components/planner/FloorTab'
import SummaryTab from '@/components/planner/SummaryTab'
import BlessingTab from '@/components/planner/BlessingTab'
import GiftPlanTab from '@/components/planner/GiftPlanTab'

interface Props {
  themes: ThemeData[]
  gifts: GiftData[]
  recipes: RecipeData[]
  identities: IdentityData[]
  sinners: SinnerData[]
  passives: PassiveData[]
  skills: SkillSummary[]
  egos: EgoData[]
}

const TABS = [
  { key: 'deck' as const, label: '덱 편성', icon: Users },
  { key: 'blessing' as const, label: '가호', icon: Star },
  { key: 'gift' as const, label: '기프트', icon: Gift },
  { key: 'floor' as const, label: '층별 계획', icon: Layers },
  { key: 'summary' as const, label: '미리보기', icon: FileText },
]

export default function PlannerClient({ themes, gifts, recipes, identities, sinners, passives, skills, egos }: Props) {
  const [state, dispatch] = useReducer(plannerReducer, 'hard', createInitialState)

  const giftMap = useMemo(() => buildGiftMap(gifts), [gifts])

  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const handleCopyUrl = () => {
    try {
      const encoded = encodePlan(state)
      const url = `${window.location.origin}/planner?p=${encoded}`
      navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
    } catch { /* */ }
  }
  const handleSaveDraft = () => {
    saveDraftToLocal(state)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const session = useSession()
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null)
  const [editId, setEditId] = useState<string | null>(null)

  // edit 모드 감지
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const eid = params.get('edit')
    if (eid) setEditId(eid)
  }, [])

  const showToast = (message: string, type: 'error' | 'success' = 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }
  const handleUpload = async () => {
    if (uploading) return
    if (!state.title.trim()) { showToast('플랜 제목을 입력하세요'); return }
    setUploading(true)
    try {
      const planBody = {
        title: state.title,
        description: state.description,
        difficulty: state.difficulty,
        deck: state.identitySlots,
        egos: state.egoSlots,
        floor_plan: state.floorPlan,
        gift_inventory: state.giftInventory,
      }
      const url = editId ? `/api/planner/${editId}` : '/api/planner'
      const method = editId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planBody),
      })
      if (res.ok) {
        setUploaded(true)
        showToast(editId ? '플랜이 수정되었습니다!' : '커뮤니티에 업로드되었습니다!', 'success')
        setTimeout(() => setUploaded(false), 3000)
        if (editId) {
          // 수정 완료 후 edit 모드 해제
          window.history.replaceState(null, '', '/planner')
        }
      } else {
        const data = await res.json()
        showToast(data.error ?? (editId ? '수정 실패' : '업로드 실패'))
      }
    } catch { showToast('업로드 중 오류가 발생했습니다') }
    finally { setUploading(false) }
  }

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
              floorPlan: decoded.floorThemeIds.map((tid, i) => ({ floor: i + 1, theme_id: tid, gift_ids: [], memo: '' })),
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
            <Link href="/planner/community" className="inline-flex items-center gap-1 mb-2 transition-colors" style={{ color: '#666', fontSize: '0.75rem' }}>
              <ArrowLeft style={{ width: '0.75rem', height: '0.75rem' }} /> 커뮤니티
            </Link>
            <h1 className="font-serif" style={{ fontSize: '1.5rem', color: '#e8dcc8' }}>거울 던전 플래너</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCopyUrl} style={{
              display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.375rem 0.625rem',
              background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(200,144,10,0.1)',
              border: `1px solid ${copied ? 'rgba(34,197,94,0.4)' : 'rgba(200,144,10,0.3)'}`,
              borderRadius: '0.375rem', color: copied ? '#4ade80' : '#e8b030',
              fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
            }}>
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? '복사 완료' : 'URL 복사'}
            </button>
            <button onClick={handleSaveDraft} style={{
              display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.375rem 0.625rem',
              background: saved ? 'rgba(34,197,94,0.12)' : '#1a1510',
              border: `1px solid ${saved ? 'rgba(34,197,94,0.35)' : '#333'}`,
              borderRadius: '0.375rem', color: saved ? '#4ade80' : '#9ca3af',
              fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.2s',
            }}>
              {saved ? <Check size={12} /> : <Save size={12} />}
              {saved ? '저장 완료' : '임시 저장'}
            </button>
            <button
              onClick={session.status === 'authenticated' ? handleUpload : undefined}
              disabled={session.status !== 'authenticated' || uploading}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.375rem 0.625rem',
                background: uploaded ? 'rgba(34,197,94,0.12)' : session.status === 'authenticated' ? 'rgba(200,144,10,0.1)' : '#1a1510',
                border: `1px solid ${uploaded ? 'rgba(34,197,94,0.35)' : session.status === 'authenticated' ? 'rgba(200,144,10,0.3)' : '#222'}`,
                borderRadius: '0.375rem',
                color: uploaded ? '#4ade80' : session.status === 'authenticated' ? '#e8b030' : '#4b5563',
                fontSize: '0.75rem', cursor: session.status === 'authenticated' ? 'pointer' : 'not-allowed',
                opacity: session.status === 'authenticated' ? 1 : 0.5,
                transition: 'all 0.2s',
              }}
              title={session.status !== 'authenticated' ? '로그인 후 이용 가능' : '커뮤니티에 플랜 업로드'}
            >
              {uploaded ? <Check size={12} /> : <Upload size={12} />}
              {uploading ? (editId ? '수정 중...' : '업로드 중...') : uploaded ? (editId ? '수정 완료' : '업로드 완료') : (editId ? '수정' : '업로드')}
            </button>
          </div>
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
          <DeckTab state={state} dispatch={dispatch} identities={identities} sinners={sinners} themes={themes} gifts={gifts} giftMap={giftMap} passives={passives} skills={skills} egos={egos} />
        )}
        {state.activeTab === 'blessing' && (
          <BlessingTab state={state} dispatch={dispatch} />
        )}
        {state.activeTab === 'gift' && (
          <GiftPlanTab state={state} dispatch={dispatch} gifts={gifts} giftMap={giftMap} />
        )}
        {state.activeTab === 'floor' && (
          <FloorTab state={state} dispatch={dispatch} themes={themes} gifts={gifts} giftMap={giftMap} />
        )}
        {state.activeTab === 'summary' && (
          <SummaryTab state={state} dispatch={dispatch} themes={themes} gifts={gifts} recipes={recipes} giftMap={giftMap} identities={identities} sinners={sinners} egos={egos} skills={skills} passives={passives} />
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
          zIndex: 100, padding: '0.625rem 1.25rem', borderRadius: '0.5rem',
          background: toast.type === 'error' ? 'rgba(239,68,68,0.95)' : 'rgba(34,197,94,0.95)',
          color: '#fff', fontSize: '0.8125rem', fontWeight: 600,
          boxShadow: '0 0.5rem 2rem rgba(0,0,0,0.5)',
          animation: 'fadeInUp 0.2s ease',
        }}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
