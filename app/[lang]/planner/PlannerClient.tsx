'use client'

import { pendingNoteUploads, noteUploadInProgressMessage } from '@/lib/notes/images'

import { useMemo, useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useRouter } from '@/lib/i18n/navigation'
import { Link } from '@/lib/i18n/navigation'
import { useSession } from 'next-auth/react'
import { useLocale, useTranslations } from 'next-intl'
import { useQueryState, parseAsString } from 'nuqs'
import { ArrowLeft, Users, Star, Gift, Layers, FileText, Copy, Upload, Check, Play, Save, ChevronDown, Trash2, FolderOpen, X } from 'lucide-react'
import { createInitialState, type PlannerState, type PlannerTab, type ThemeData, type GiftData, type RecipeData, type IdentityData, type SinnerData, type PassiveData, type SkillSummary, type EgoData } from '@/lib/planner/types'
import { buildGiftMap } from '@/lib/planner/fusion'
import { encodePlan, savePlanForRun, loadDraftFromLocal, clearDraftFromLocal, loadPlannerTempSlots, savePlannerTempSlot, deletePlannerTempSlot, type PlannerTempSlot } from '@/lib/planner/encoder'
import { enrichIdentitySlotsForGiftConditions } from '@/lib/planner/gift-condition-status'
import { usePlannerStore } from '@/lib/stores/planner'
import { showSuccess, showError } from '@/lib/toast'
import DeckTab from '@/components/planner/DeckTab'
import FloorTab from '@/components/planner/FloorTab'
import SummaryTab from '@/components/planner/SummaryTab'
import BlessingTab from '@/components/planner/BlessingTab'
import GiftPlanTab from '@/components/planner/GiftPlanTab'
import { workbenchReveal } from '@/lib/animations'

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

const PLANNER_TAB_KEYS = ['deck', 'blessing', 'gift', 'floor', 'summary'] as const

const TABS: { key: PlannerTab; labelKey: string; icon: typeof Users }[] = [
  { key: 'deck', labelKey: 'tabs.deck', icon: Users },
  { key: 'blessing', labelKey: 'tabs.blessing', icon: Star },
  { key: 'gift', labelKey: 'tabs.gift', icon: Gift },
  { key: 'floor', labelKey: 'tabs.floor', icon: Layers },
  { key: 'summary', labelKey: 'tabs.summary', icon: FileText },
]

function isPlannerTab(value: string): value is PlannerTab {
  return (PLANNER_TAB_KEYS as readonly string[]).includes(value)
}

export default function PlannerClient({ themes, gifts, recipes, identities, sinners, passives, skills, egos }: Props) {
  const tPlanner = useTranslations('planner')
  const tTempSaves = useTranslations('planner.tempSaves')
  const locale = useLocale()
  const state = usePlannerStore()
  const dispatch = usePlannerStore(s => s.dispatch)
  const [tabParam, setTabParam] = useQueryState('tab', parseAsString.withDefault('deck'))
  const activeTab = isPlannerTab(tabParam) ? tabParam : 'deck'
  const shouldReduceMotion = useReducedMotion()

  const giftMap = useMemo(() => buildGiftMap(gifts), [gifts])
  const giftConditionState = useMemo<PlannerState>(() => ({
    ...state,
    identitySlots: enrichIdentitySlotsForGiftConditions(state.identitySlots, identities),
  }), [state, identities])

  const [copied, setCopied] = useState(false)
  const handleCopyUrl = async () => {
    try {
      const encoded = await encodePlan(state)
      const url = new URL(window.location.href)
      url.search = ''
      url.searchParams.set('plan', encoded)
      navigator.clipboard.writeText(url.toString()).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
    } catch { /* */ }
  }

  const router = useRouter()
  const session = useSession()
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [tempSavesOpen, setTempSavesOpen] = useState(false)
  const [tempSlots, setTempSlots] = useState<PlannerTempSlot[]>([])

  useEffect(() => {
    if (state.activeTab !== activeTab) {
      dispatch({ type: 'SET_TAB', tab: activeTab })
    }
  }, [activeTab, dispatch, state.activeTab])

  // edit 모드 감지
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const eid = params.get('edit')
    if (eid) setEditId(eid)
  }, [])

  const handleUpload = async () => {
    if (pendingNoteUploads.size) { showError(noteUploadInProgressMessage(locale)); return }
    if (uploading) return
    if (!state.title.trim()) { showError(tPlanner('actions.titleRequired')); return }
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
        tags: state.mainKeywords ?? [],
      }
      const url = editId ? `/api/planner/${editId}` : '/api/planner'
      const method = editId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planBody),
      })
      if (res.ok) {
        const result = await res.json()
        setUploaded(true)
        showSuccess(editId ? tPlanner('actions.updated') : tPlanner('actions.uploaded'))
        const targetId = editId ?? result.id
        if (targetId) {
          setTimeout(() => router.push(`/planner/community/${targetId}`), 800)
        }
      } else {
        const data = await res.json()
        showError(data.error ?? (editId ? tPlanner('actions.updateFailed') : tPlanner('actions.uploadFailed')))
      }
    } catch { showError(tPlanner('actions.uploadError')) }
    finally { setUploading(false) }
  }

  useEffect(() => {
    setTempSlots(loadPlannerTempSlots())
  }, [])

  const handleSaveTempSlot = (slot: PlannerTempSlot) => {
    if (pendingNoteUploads.size) { showError(noteUploadInProgressMessage(locale)); return }
    const slots = savePlannerTempSlot(slot.slotNumber, state, tTempSaves('untitled'))
    setTempSlots(slots)
    showSuccess(tTempSaves(slot.draft ? 'overwritten' : 'savedToSlot', { slot: slot.slotNumber }))
  }

  const handleLoadTempSlot = (slot: PlannerTempSlot) => {
    const draft = slot.draft
    if (!draft) return
    dispatch({ type: 'LOAD_PLAN', state: draft.state })
    setTempSavesOpen(false)
    showSuccess(tTempSaves('loadedFromSlot', { slot: slot.slotNumber }))
  }

  const handleDeleteTempSlot = (slot: PlannerTempSlot) => {
    setTempSlots(deletePlannerTempSlot(slot.slotNumber))
    showSuccess(tTempSaves('deletedFromSlot', { slot: slot.slotNumber }))
  }

  const formatTempSavedAt = (savedAt: string) => {
    const date = new Date(savedAt)
    if (Number.isNaN(date.getTime())) return ''
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  // URL 파라미터 또는 1회성 handoff 복원. 자동 localStorage persist는 사용하지 않는다.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const planCode = params.get('plan') ?? params.get('p')
    if (planCode) {
      import('@/lib/planner/encoder').then(async ({ decodePlan }) => {
        try {
          const decoded = await decodePlan(planCode)
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
              skill_keyword_list: identity.skill_keyword_list,
              affiliation: identity.affiliation,
              association_list: identity.association_list,
              s1_count: decoded.skillDistributions[i]?.[0],
              s2_count: decoded.skillDistributions[i]?.[1],
              s3_count: decoded.skillDistributions[i]?.[2],
              game_id: identity.game_id,
              folder_name: identity.folder_name,
              slot_order: i,
            }
          }).filter(Boolean)

          const egoSlots = decoded.egoIds.map(id => {
            const ego = egos.find(entry => entry.id === id)
            if (!ego) return null
            return {
              ego_id: id,
              sinner_id: ego.sinner_id,
              name_kr: ego.name,
              grade: ego.grade,
              sin_affinity: ego.sin_affinity,
            }
          }).filter(Boolean)

          dispatch({
            type: 'LOAD_PLAN',
            state: {
              difficulty: decoded.difficulty,
              identitySlots: slots as PlannerState['identitySlots'],
              egoSlots: egoSlots as PlannerState['egoSlots'],
              floorPlan: decoded.floorThemeIds.map((tid, i) => ({
                floor: i + 1,
                difficulty: decoded.floorDifficulties[i],
                theme_id: tid,
                gift_ids: decoded.floorGifts[i],
                memo: decoded.floorMemos[i],
                constraints: decoded.floorConstraints[i],
              })),
              giftInventory: decoded.giftIds,
              mainKeywords: decoded.mainKeywords,
              mainKeywordsManual: decoded.mainKeywordsManual,
              title: decoded.title,
              description: decoded.description,
              activeTab: 'deck',
            },
          })
        } catch { /* invalid plan code */ }
      })
      return
    }

    const handoff = loadDraftFromLocal()
    if (handoff) {
      dispatch({ type: 'LOAD_PLAN', state: handoff })
      clearDraftFromLocal()
      return
    }

    dispatch({ type: 'LOAD_PLAN', state: createInitialState('hard') })
  }, [dispatch, egos, identities])

  const tabContent = (() => {
    if (activeTab === 'deck') {
      return <DeckTab state={state} dispatch={dispatch} identities={identities} sinners={sinners} themes={themes} gifts={gifts} giftMap={giftMap} passives={passives} skills={skills} egos={egos} />
    }
    if (activeTab === 'blessing') {
      return <BlessingTab state={state} dispatch={dispatch} />
    }
    if (activeTab === 'gift') {
      return <GiftPlanTab state={giftConditionState} dispatch={dispatch} gifts={gifts} recipes={recipes} giftMap={giftMap} />
    }
    if (activeTab === 'floor') {
      return <FloorTab state={state} dispatch={dispatch} themes={themes} gifts={gifts} recipes={recipes} giftMap={giftMap} />
    }
    return <SummaryTab state={giftConditionState} dispatch={dispatch} themes={themes} gifts={gifts} recipes={recipes} giftMap={giftMap} identities={identities} sinners={sinners} egos={egos} skills={skills} passives={passives} />
  })()

  return (
    <div className="min-h-[100dvh] pb-16" style={{ background: '#0d0b08' }}>
      <div className="max-w-6xl mx-auto px-3 sm:px-6">
        {/* 헤더는 server-rendered page.tsx에서 렌더링 — 여기서는 액션 버튼만 */}
        <motion.div
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6"
          variants={shouldReduceMotion ? undefined : workbenchReveal}
          initial={shouldReduceMotion ? false : 'initial'}
          animate={shouldReduceMotion ? undefined : 'animate'}
        >
          <div>
            <Link href="/planner/community" className="inline-flex items-center gap-1 mb-2 transition-colors" style={{ color: '#666', fontSize: '0.875rem' }}>
              <ArrowLeft style={{ width: '0.75rem', height: '0.75rem' }} /> {tPlanner('community')}
            </Link>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => { savePlanForRun(giftConditionState); window.location.href = '/planner/run?from-plan=1' }}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.375rem 0.625rem',
                background: '#c8900a', borderRadius: '0.375rem', color: '#0d0b08',
                fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              <Play size={12} />
              {tPlanner('actions.triggerMode')}
            </button>
            <button onClick={handleCopyUrl} style={{
              display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.375rem 0.625rem',
              background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(200,144,10,0.1)',
              border: `1px solid ${copied ? 'rgba(34,197,94,0.4)' : 'rgba(200,144,10,0.3)'}`,
              borderRadius: '0.375rem', color: copied ? '#4ade80' : '#e8b030',
              fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
            }}>
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? tPlanner('actions.copied') : tPlanner('actions.copyUrl')}
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setTempSavesOpen(open => !open)}
                aria-expanded={tempSavesOpen}
                aria-haspopup="menu"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.375rem 0.625rem',
                  background: 'rgba(200,144,10,0.1)',
                  border: '1px solid rgba(200,144,10,0.3)',
                  borderRadius: '0.375rem', color: '#e8b030',
                  fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                <Save size={12} />
                {tTempSaves('button')}
                <ChevronDown size={12} style={{ transform: tempSavesOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
              </button>
              {tempSavesOpen && (
                <div
                  role="menu"
                  aria-label={tTempSaves('menuLabel')}
                  className="fixed left-3 right-3 top-40 z-40 mt-2 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg sm:absolute sm:left-auto sm:right-0 sm:top-full sm:w-[26rem]"
                  style={{ background: '#1a1510', border: '1px solid rgba(200,144,10,0.25)' }}
                >
                  <div className="flex items-center justify-between border-b border-[#241c14] px-3 py-2 sm:hidden">
                    <span style={{ color: '#e8dcc8', fontSize: '0.9375rem', fontWeight: 700 }}>
                      {tTempSaves('menuLabel')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setTempSavesOpen(false)}
                      aria-label={tTempSaves('closeMenu')}
                      className="flex items-center justify-center rounded"
                      style={{ width: '2.75rem', minHeight: '2.75rem', color: '#e8b030' }}
                    >
                      <X size={16} aria-hidden="true" />
                    </button>
                  </div>
                  <div style={{ padding: '0.375rem' }}>
                    {tempSlots.map(slot => (
                      <div key={slot.slotNumber} style={{ padding: '0.625rem 0.5rem', borderTop: slot.slotNumber === 1 ? 'none' : '1px solid #241c14' }}>
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="flex items-center justify-center rounded" style={{ width: '1.625rem', height: '1.625rem', flexShrink: 0, background: 'rgba(200,144,10,0.12)', color: '#e8b030', fontSize: '0.875rem', fontWeight: 700 }}>
                            {slot.slotNumber}
                          </span>
                          <span className="min-w-0 flex-1" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'baseline', gap: '0.75rem' }}>
                            <span className="block truncate" style={{ color: slot.draft ? '#e8dcc8' : '#8a8175', fontSize: '0.9375rem', fontWeight: 600 }}>
                              {slot.draft?.label ?? tTempSaves('emptySlot')}
                            </span>
                            <span className="block" style={{ color: '#8a8175', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                              {slot.draft ? formatTempSavedAt(slot.draft.savedAt) : tTempSaves('slotLabel', { slot: slot.slotNumber })}
                            </span>
                          </span>
                        </div>
                        <div className="mt-2 grid gap-1" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) 2.25rem' }}>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => handleSaveTempSlot(slot)}
                            className="inline-flex min-w-0 items-center justify-center gap-1 rounded transition-colors"
                            style={{ minHeight: '2.25rem', padding: '0.375rem 0.5rem', color: '#e8b030', background: 'rgba(200,144,10,0.1)', border: '1px solid rgba(200,144,10,0.25)', fontSize: '0.875rem', fontWeight: 700 }}
                          >
                            <Save size={14} />
                            <span className="truncate">{tTempSaves(slot.draft ? 'overwriteSlot' : 'saveToSlot')}</span>
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => handleLoadTempSlot(slot)}
                            disabled={!slot.draft}
                            className="inline-flex min-w-0 items-center justify-center gap-1 rounded transition-colors"
                            style={{ minHeight: '2.25rem', padding: '0.375rem 0.5rem', color: slot.draft ? '#e8dcc8' : '#5a5045', background: slot.draft ? 'rgba(232,220,200,0.06)' : 'rgba(90,80,69,0.05)', border: '1px solid #2a2118', fontSize: '0.875rem', fontWeight: 600, cursor: slot.draft ? 'pointer' : 'not-allowed' }}
                          >
                            <FolderOpen size={14} />
                            <span className="truncate">{tTempSaves('loadSlot')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTempSlot(slot)}
                            disabled={!slot.draft}
                            aria-label={tTempSaves('deleteSlotLabel', { slot: slot.slotNumber })}
                            className="flex items-center justify-center rounded transition-colors"
                            style={{ width: '2.25rem', minHeight: '2.25rem', color: slot.draft ? '#a16855' : '#5a5045', border: '1px solid #2a2118', cursor: slot.draft ? 'pointer' : 'not-allowed', opacity: slot.draft ? 1 : 0.55 }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={session.status === 'authenticated' ? handleUpload : undefined}
              disabled={session.status !== 'authenticated' || uploading}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.375rem 0.625rem',
                background: uploaded ? 'rgba(34,197,94,0.12)' : session.status === 'authenticated' ? 'rgba(200,144,10,0.1)' : '#1a1510',
                border: `1px solid ${uploaded ? 'rgba(34,197,94,0.35)' : session.status === 'authenticated' ? 'rgba(200,144,10,0.3)' : '#222'}`,
                borderRadius: '0.375rem',
                color: uploaded ? '#4ade80' : session.status === 'authenticated' ? '#e8b030' : '#4b5563',
                fontSize: '0.9375rem', cursor: session.status === 'authenticated' ? 'pointer' : 'not-allowed',
                opacity: session.status === 'authenticated' ? 1 : 0.5,
                transition: 'all 0.2s',
              }}
              title={session.status !== 'authenticated' ? tPlanner('actions.loginRequired') : tPlanner('actions.uploadTitle')}
            >
              {uploaded ? <Check size={12} /> : <Upload size={12} />}
              {uploading
                ? (editId ? tPlanner('actions.updating') : tPlanner('actions.uploading'))
                : uploaded
                  ? (editId ? tPlanner('actions.updateComplete') : tPlanner('actions.uploadComplete'))
                  : (editId ? tPlanner('actions.update') : tPlanner('actions.upload'))}
            </button>
          </div>
        </motion.div>

        {/* 탭 바 */}
        <motion.div
          className="flex mb-6 overflow-x-auto"
          style={{ borderBottom: '1px solid #222', WebkitOverflowScrolling: 'touch' }}
          variants={shouldReduceMotion ? undefined : workbenchReveal}
          initial={shouldReduceMotion ? false : 'initial'}
          animate={shouldReduceMotion ? undefined : 'animate'}
          transition={{ delay: shouldReduceMotion ? 0 : 0.04 }}
        >
          {TABS.map(tab => {
            const active = activeTab === tab.key
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => {
                  dispatch({ type: 'SET_TAB', tab: tab.key })
                  void setTabParam(tab.key, { history: 'push' })
                }}
                className="flex items-center gap-1.5 px-3 sm:px-5 py-2.5 font-semibold transition-colors whitespace-nowrap"
                style={{
                  color: active ? '#e8dcc8' : '#555',
                  fontSize: '0.9375rem',
                  background: active ? '#c8900a12' : 'transparent',
                  borderBottom: active ? '2px solid #c8900a' : '2px solid transparent',
                  marginBottom: '-1px',
                }}
              >
                <Icon style={{ width: '0.875rem', height: '0.875rem' }} />
                {tPlanner(tab.labelKey)}
              </button>
            )
          })}
        </motion.div>

        {/* 탭 콘텐츠 */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            variants={shouldReduceMotion ? undefined : workbenchReveal}
            initial={shouldReduceMotion ? false : 'initial'}
            animate={shouldReduceMotion ? undefined : 'animate'}
            exit={shouldReduceMotion ? undefined : 'exit'}
          >
            {tabContent}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Toast는 Sonner가 글로벌로 처리 */}
    </div>
  )
}
