'use client'

import BackLink from '@/components/navigation/BackLink'
import { assistAvailable } from '@/lib/assist/availability'
import { pendingNoteUploads, noteUploadInProgressMessage } from '@/lib/notes/images'

import { memo, useMemo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Link, useRouter } from '@/lib/i18n/navigation'
import { useSession } from 'next-auth/react'
import { useLocale, useTranslations } from 'next-intl'
import { useQueryState, parseAsString } from 'nuqs'
import { ArrowLeft, Copy, Upload, Check, Play } from 'lucide-react'
import { createInitialState, type PlannerState, type PlannerTab, type ThemeData, type GiftData, type RecipeData, type IdentityData, type SinnerData, type PassiveData, type SkillSummary, type EgoData } from '@/lib/planner/types'
import { buildGiftMap } from '@/lib/planner/fusion'
import { encodePlan, savePlanForRun, loadDraftFromLocal, clearDraftFromLocal, loadPlannerTempSlots, savePlannerTempSlot, deletePlannerTempSlot, type PlannerTempSlot } from '@/lib/planner/encoder'
import { enrichIdentitySlotsForGiftConditions } from '@/lib/planner/gift-condition-status'
import { withLcbIdentitySlots } from '@/lib/planner/lcb'
import { usePlannerStore } from '@/lib/stores/planner'
import { showSuccess, showError } from '@/lib/toast'
import { guestHeaders } from '@/lib/guest/key'
import { getGuestCopy } from '@/lib/guest/copy'
import DeckTab from '@/components/planner/DeckTab'
import FloorTab from '@/components/planner/FloorTab'
import PlanIntroEditor from '@/components/planner/PlanIntroEditor'
import BlessingTab from '@/components/planner/BlessingTab'
import GiftPlanTab from '@/components/planner/GiftPlanTab'
import TempSaveMenu from '@/components/ui/TempSaveMenu'
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

// 한 페이지 스크롤. 각 구역은 plan-<key> 앵커로 이동하고 ?tab= 링크는 해당 구역으로 스크롤한다. summary 키는 맨 위 플랜 소개(제목·설명)다.
const TABS: { key: PlannerTab; labelKey: string }[] = [
  { key: 'summary', labelKey: 'tabs.summary' },
  { key: 'deck', labelKey: 'tabs.deck' },
  { key: 'blessing', labelKey: 'tabs.blessing' },
  { key: 'gift', labelKey: 'tabs.gift' },
  { key: 'floor', labelKey: 'tabs.floor' },
]

// 무거운 구역은 자기가 읽는 상태가 바뀔 때만 다시 그린다(인격 순서를 바꿔도 층별 계획까지 다시 그리던 지연)
type SectionProps = { state: PlannerState }
const sameKeys = (keys: (keyof PlannerState)[]) => (prev: SectionProps, next: SectionProps) =>
  keys.every(key => prev.state[key] === next.state[key]) &&
  Object.keys(next).every(prop => prop === 'state' || (prev as Record<string, unknown>)[prop] === (next as Record<string, unknown>)[prop])
const DeckSection = memo(DeckTab, sameKeys(['egoSlots', 'identitySlots', 'mainKeywords', 'mainKeywordsManual', 'difficulty']) as never)
// 가호는 blessing_ 항목만 읽는다: 최종 기프트를 눌러도 다시 그리지 않는다
const blessingKey = (state: PlannerState) => state.giftInventory.filter(id => id.startsWith('blessing_')).join()
const BlessingSection = memo(BlessingTab, ((prev: SectionProps, next: SectionProps) =>
  blessingKey(prev.state) === blessingKey(next.state) && sameKeys([])(prev, next)) as never)
const GiftSection = memo(GiftPlanTab, sameKeys(['giftInventory']) as never)
const FloorSection = memo(FloorTab, sameKeys(['floorPlan', 'giftInventory', 'difficulty', 'identitySlots']) as never)
const IntroSection = memo(PlanIntroEditor, sameKeys(['title', 'description', 'identitySlots']) as never)
const SECTION_KEYS = ['difficulty', 'mainKeywords', 'mainKeywordsManual', 'identitySlots', 'egoSlots', 'floorPlan', 'giftInventory'] as const

// 넓은 화면의 목차: 평소에는 왼쪽 레일, 최종 기프트 영역에서는 위쪽 가로 막대가 겹쳐 나타난다. 본문 폭은 바뀌지 않는다(최종 기프트 영역만 처음부터 레일 자리까지 넓다).
type NavLayout = 'rail' | 'bar'


function isPlannerTab(value: string): value is PlannerTab {
  return (PLANNER_TAB_KEYS as readonly string[]).includes(value)
}

export default function PlannerClient({ themes, gifts, recipes, identities, sinners, passives, skills, egos }: Props) {
  const tPlanner = useTranslations('planner')
  const tTempSaves = useTranslations('planner.tempSaves')
  const locale = useLocale()
  const state = usePlannerStore()
  const dispatch = usePlannerStore(s => s.dispatch)
  const [tabParam, setTabParam] = useQueryState('tab', parseAsString.withDefault('summary'))
  const [currentSection, setCurrentSection] = useState<PlannerTab>(isPlannerTab(tabParam) ? tabParam : 'summary')
  const shouldReduceMotion = useReducedMotion()
  const [navLayout, setNavLayout] = useState<NavLayout>('rail')

  // 제목·설명만 바뀐 입력은 구역들에 전달하지 않는다(한 글자마다 전체 플래너가 다시 그려지던 렉)
  const [sectionState, setSectionState] = useState<PlannerState>(state)
  if (sectionState !== state && SECTION_KEYS.some(key => sectionState[key] !== state[key])) setSectionState(state)

  const giftMap = useMemo(() => buildGiftMap(gifts), [gifts])
  // 인격이 바뀔 때만 다시 만든다: 기프트·층 구역은 identitySlots가 같은 배열이면 다시 그리지 않는다
  const conditionSlots = useMemo(
    () => enrichIdentitySlotsForGiftConditions(sectionState.identitySlots, identities),
    [sectionState.identitySlots, identities],
  )
  const giftConditionState = useMemo<PlannerState>(() => ({
    ...sectionState,
    identitySlots: conditionSlots,
  }), [sectionState, conditionSlots])

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
  const [tempSlots, setTempSlots] = useState<PlannerTempSlot[]>([])

  // 무거운 아래쪽 구역은 화면에 가까워지거나 목차로 이동할 때 처음 그린다(첫 화면에 이미지 수천 장을 한꺼번에 그리던 문제)
  const initialIndex = Math.max(1, TABS.findIndex(tab => tab.key === tabParam))
  const [mountedCount, setMountedCount] = useState(initialIndex + 1)
  useEffect(() => {
    if (mountedCount >= TABS.length) return
    const next = document.getElementById(`plan-${TABS[mountedCount].key}`)
    if (!next) return
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) setMountedCount(count => Math.max(count, mountedCount + 1))
    }, { rootMargin: '0px 0px 1200px 0px' })
    observer.observe(next)
    return () => observer.disconnect()
  }, [mountedCount])

  // 처음 ?tab= 으로 들어오면 해당 구역으로 이동
  useEffect(() => {
    if (isPlannerTab(tabParam) && tabParam !== 'summary') requestAnimationFrame(() => document.getElementById(`plan-${tabParam}`)?.scrollIntoView({ block: 'start' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 화면 위쪽에 걸친 구역을 목차에 표시
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      const hit = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (hit) setCurrentSection(hit.target.id.slice(5) as PlannerTab)
    }, { rootMargin: '-25% 0px -65% 0px' })
    TABS.forEach(tab => { const el = document.getElementById(`plan-${tab.key}`); if (el) observer.observe(el) })
    return () => observer.disconnect()
  }, [])

  // 좁은 화면의 가로 목차에서 현재 항목이 보이도록 목차만 가로로 스크롤한다
  const sectionNavRef = useRef<HTMLOListElement>(null)
  useEffect(() => {
    const list = sectionNavRef.current
    const link = list?.querySelector<HTMLElement>('[aria-current]')
    if (!list || !link) return
    const left = link.offsetLeft - list.offsetLeft
    if (left < list.scrollLeft || left + link.offsetWidth > list.scrollLeft + list.clientWidth) list.scrollTo({ left: Math.max(0, left - 16) })
  }, [currentSection, navLayout])

  // 최종 기프트 구역의 윗변이 레일의 실제 아랫변(+0.75rem)에 닿는 순간 가로 막대로, 그 선보다 3rem 넘게 내려가면 레일로 돌아간다.
  // 스크롤마다 두 위치를 직접 재고 data-layout을 바로 바꿔 CSS가 같은 프레임에 반응한다(레일은 즉시 숨고 막대만 페이드).
  // 사이트 메뉴가 숨거나 나타나면 레일이 300ms 동안 움직이므로 마지막 스크롤 뒤 0.4초 동안 매 프레임 다시 잰다.
  const layoutRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLOListElement>(null)
  const floorMounted = mountedCount >= TABS.length
  useEffect(() => {
    const wrapper = layoutRef.current
    const rail = railRef.current
    const start = document.querySelector('[data-final-gifts-start]')
    if (!wrapper || !rail || !start) return
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    const check = () => {
      const railBox = rail.getBoundingClientRect()
      if (!railBox.height) return // 좁은 화면: 레일 없음
      const top = start.getBoundingClientRect().top
      const line = railBox.bottom + 0.75 * rem
      const current = wrapper.dataset.layout as NavLayout
      const next: NavLayout = top <= line ? 'bar' : top > line + 3 * rem ? 'rail' : current
      if (next === current) return
      wrapper.dataset.layout = next
      setNavLayout(next)
    }
    let frame = 0
    let until = 0
    const tick = () => { check(); frame = performance.now() < until ? requestAnimationFrame(tick) : 0 }
    const onScroll = () => {
      check()
      until = performance.now() + 400
      if (!frame) frame = requestAnimationFrame(tick)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll) }
  }, [floorMounted])


  const goToSection = (key: PlannerTab) => {
    const index = TABS.findIndex(tab => tab.key === key)
    const needsMount = index >= mountedCount
    if (needsMount) setMountedCount(index + 1)
    // 새로 그린 구역의 높이가 잡힌 뒤에 이동한다
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.getElementById(`plan-${key}`)?.scrollIntoView({ behavior: shouldReduceMotion || needsMount ? 'auto' : 'smooth', block: 'start' })
    }))
    setCurrentSection(key)
    void setTabParam(key === 'summary' ? null : key, { history: 'replace' })
  }

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
        deck: withLcbIdentitySlots(identities, state.identitySlots),
        egos: state.egoSlots,
        floor_plan: state.floorPlan,
        gift_inventory: state.giftInventory,
        tags: state.mainKeywords ?? [],
      }
      const url = editId ? `/api/planner/${editId}` : '/api/planner'
      const method = editId ? 'PATCH' : 'POST'
      const signedIn = session.status === 'authenticated'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...guestHeaders(signedIn) },
        body: JSON.stringify(planBody),
      })
      if (res.ok) {
        const result = await res.json()
        setUploaded(true)
        showSuccess(editId ? tPlanner('actions.updated') : signedIn ? tPlanner('actions.uploaded') : getGuestCopy(locale).posted)
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
    if (!slots) { showError(tTempSaves('saveFailed')); return }
    setTempSlots(slots)
    showSuccess(tTempSaves(slot.draft ? 'overwritten' : 'savedToSlot', { slot: slot.slotNumber }))
  }

  const handleLoadTempSlot = (slot: PlannerTempSlot) => {
    const draft = slot.draft
    if (!draft) return
    dispatch({ type: 'LOAD_PLAN', state: { ...draft.state, identitySlots: withLcbIdentitySlots(identities, draft.state.identitySlots ?? []) } })
    showSuccess(tTempSaves('loadedFromSlot', { slot: slot.slotNumber }))
  }

  const handleDeleteTempSlot = (slot: PlannerTempSlot) => {
    setTempSlots(deletePlannerTempSlot(slot.slotNumber))
    showSuccess(tTempSaves('deletedFromSlot', { slot: slot.slotNumber }))
  }

  // URL 파라미터 또는 1회성 handoff 복원. 자동 localStorage persist는 사용하지 않는다.
  // 화면을 그리기 전에 적용해 LCB 기본 배치가 늦게 끼어들지 않게 한다.
  // handoff는 한 번만 읽어 ref에 둔다: 효과가 다시 돌아도(StrictMode, identities 갱신) 같은 플랜을 다시 적용하고 빈 플랜으로 덮지 않는다.
  const handoffRef = useRef<ReturnType<typeof loadDraftFromLocal> | undefined>(undefined)
  useLayoutEffect(() => {
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
              identitySlots: withLcbIdentitySlots(identities, slots as PlannerState['identitySlots']),
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

    if (handoffRef.current === undefined) {
      handoffRef.current = loadDraftFromLocal()
      clearDraftFromLocal()
    }
    const handoff = handoffRef.current
    if (handoff) {
      // 수감자가 빠진 옛 플랜도 LCB 인격으로 채워 빈 칸이 없게 한다
      dispatch({ type: 'LOAD_PLAN', state: { ...handoff, identitySlots: withLcbIdentitySlots(identities, handoff.identitySlots ?? []) } })
      return
    }

    dispatch({ type: 'LOAD_PLAN', state: { ...createInitialState('hard'), identitySlots: withLcbIdentitySlots(identities) } })
  }, [dispatch, egos, identities])


  const sectionContent: Record<PlannerTab, React.ReactNode> = {
    summary: <IntroSection state={state} dispatch={dispatch} themes={themes} gifts={gifts} giftMap={giftMap} sinners={sinners} />,
    deck: <DeckSection state={sectionState} dispatch={dispatch} identities={identities} sinners={sinners} themes={themes} gifts={gifts} giftMap={giftMap} passives={passives} skills={skills} egos={egos} />,
    blessing: <BlessingSection state={sectionState} dispatch={dispatch} />,
    gift: <GiftSection state={sectionState} dispatch={dispatch} gifts={gifts} giftMap={giftMap} />,
    floor: <FloorSection state={giftConditionState} dispatch={dispatch} themes={themes} gifts={gifts} recipes={recipes} giftMap={giftMap} />,
  }
  const plannedFloors = state.floorPlan.filter(floor => floor.theme_id).length
  const sectionStatus: Partial<Record<PlannerTab, string>> = {
    deck: `${state.identitySlots.filter(slot => slot.slot_order < 99).length}/12`,
    gift: state.giftInventory.length ? String(state.giftInventory.length) : undefined,
    floor: plannedFloors ? `${plannedFloors}/${state.floorPlan.length}` : undefined,
    summary: state.title.trim() ? '✓' : undefined,
  }
  const renderNavLink = (tab: typeof TABS[number], variant: 'rail' | 'bar') => {
    const status = sectionStatus[tab.key]
    return (
      <a
        href={`#plan-${tab.key}`}
        aria-current={currentSection === tab.key ? 'location' : undefined}
        onClick={event => { event.preventDefault(); goToSection(tab.key) }}
        className={variant === 'bar'
          ? '-mb-px inline-flex min-h-12 items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-3 text-[0.9375rem] text-[#a8977d] transition-colors hover:text-[#e8dcc8] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#e8b030] motion-reduce:transition-none aria-[current]:border-[#c8900a] aria-[current]:font-semibold aria-[current]:text-[#e8dcc8] [li:first-child>&]:pl-0'
          : '-ml-px flex min-h-11 items-center justify-between gap-2 border-l-2 border-transparent pl-3 pr-1 text-[0.9375rem] text-[#a8977d] transition-colors hover:text-[#e8dcc8] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#e8b030] motion-reduce:transition-none aria-[current]:border-[#c8900a] aria-[current]:font-semibold aria-[current]:text-[#e8dcc8]'}
      >
        {tPlanner(tab.labelKey)}
        {status && <span className="font-normal tabular-nums text-[#7f7364]">{status}</span>}
      </a>
    )
  }
  const navFade = 'lg:transition-[opacity,transform,visibility] lg:duration-[250ms] lg:ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:lg:transition-none'
  // 레이아웃은 data-layout(스크롤 처리기가 바로 바꾼다)에 반응하는 CSS로만 정한다. 레일은 숨을 때 전환 없이 즉시 사라져 최종 기프트와 겹칠 틈이 없다.
  const barHidden = 'lg:group-data-[layout=rail]/planner:invisible lg:group-data-[layout=rail]/planner:-translate-y-2 lg:group-data-[layout=rail]/planner:opacity-0'
  const railHidden = 'lg:group-data-[layout=bar]/planner:invisible lg:group-data-[layout=bar]/planner:-translate-x-3 lg:group-data-[layout=bar]/planner:opacity-0 lg:group-data-[layout=bar]/planner:duration-0'

  return (
    <div className="min-h-[100dvh] pb-16" style={{ background: '#0d0b08' }}>
      <div className="max-w-[90rem] mx-auto px-3 md:px-6">
        {/* 헤더는 server-rendered page.tsx에서 렌더링 — 여기서는 액션 버튼만 */}
        <motion.div
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4"
          variants={shouldReduceMotion ? undefined : workbenchReveal}
          initial={shouldReduceMotion ? false : 'initial'}
          animate={shouldReduceMotion ? undefined : 'animate'}
        >
          <div>
            <BackLink href="/planner/community" className="inline-flex items-center gap-1 transition-colors" style={{ color: '#9c8b73', fontSize: '0.875rem' }}>
              <ArrowLeft style={{ width: '0.75rem', height: '0.75rem' }} /> {tPlanner('community')}
            </BackLink>
          </div>
          <div className="flex items-center gap-2 flex-wrap sm:justify-end">
            {assistAvailable(locale) && <button
              onClick={() => { savePlanForRun({ ...giftConditionState, title: state.title, description: state.description }); window.location.href = '/planner/run?from-plan=1' }}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.375rem 0.625rem',
                background: '#c8900a', borderRadius: '0.375rem', color: '#0d0b08',
                fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              <Play size={12} />
              {tPlanner('actions.triggerMode')}
            </button>}
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
            <TempSaveMenu title={tTempSaves('menuLabel')} slots={tempSlots} onSave={handleSaveTempSlot} onLoad={handleLoadTempSlot} onDelete={handleDeleteTempSlot} />
            <button
              onClick={handleUpload}
              disabled={session.status === 'loading' || uploading}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.375rem 0.625rem',
                background: uploaded ? 'rgba(34,197,94,0.12)' : 'rgba(200,144,10,0.1)',
                border: `1px solid ${uploaded ? 'rgba(34,197,94,0.35)' : 'rgba(200,144,10,0.3)'}`,
                borderRadius: '0.375rem',
                color: uploaded ? '#4ade80' : '#e8b030',
                fontSize: '0.9375rem', cursor: session.status === 'loading' ? 'wait' : 'pointer',
                transition: 'all 0.2s',
              }}
              title={tPlanner('actions.uploadTitle')}
            >
              {uploaded ? <Check size={12} /> : <Upload size={12} />}
              {uploading
                ? (editId ? tPlanner('actions.updating') : tPlanner('actions.uploading'))
                : uploaded
                  ? (editId ? tPlanner('actions.updateComplete') : tPlanner('actions.uploadComplete'))
                  : (editId ? tPlanner('actions.update') : tPlanner('actions.upload'))}
            </button>
            {session.status === 'unauthenticated' && (
              <p className="w-full text-[0.8125rem] text-[#6a6058] sm:text-right">
                {getGuestCopy(locale).saveHint}{' '}
                <Link href="/guest" className="text-[#e8b030] underline-offset-4 hover:underline">{getGuestCopy(locale).manage}</Link>
              </p>
            )}
          </div>
        </motion.div>

        {/* 구역 목차. 좁은 화면은 늘 가로 밑줄 탭. 넓은 화면은 왼쪽 레일이다가 최종 기프트부터 가로 막대로 바뀌어 본문이 전체 폭을 쓴다.
            넓은 화면의 nav는 높이 0의 sticky 틀이라 두 목록이 서로 겹쳐 전환돼도 본문 높이는 그대로다. --planner-bar-h는 아래 sticky 도구줄의 기준이다. */}
        <div ref={layoutRef} data-layout={navLayout} className="group/planner [--planner-bar-h:3rem] [--planner-rail-w:0rem] lg:[--planner-rail-w:13.5rem] lg:data-[layout=rail]:[--planner-bar-h:0rem]">
        <nav aria-label={tPlanner('sectionNav')} className="sticky-under-nav z-40 -mx-3 border-b border-[#5a4526] bg-[#0d0b08] px-3 md:-mx-6 md:px-6 lg:mx-0 lg:h-0 lg:border-0 lg:bg-transparent lg:px-0">
          <div className={`lg:absolute lg:-inset-x-6 lg:top-0 lg:border-b lg:border-[#5a4526] lg:bg-[#0d0b08] lg:px-6 ${navFade} ${barHidden}`}>
            <ol ref={sectionNavRef} className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {TABS.map(tab => <li key={tab.key} className="shrink-0">{renderNavLink(tab, 'bar')}</li>)}
            </ol>
          </div>
          <ol ref={railRef} className={`hidden lg:absolute lg:left-0 lg:top-7 lg:block lg:w-44 lg:border-l lg:border-[#2e2417] ${navFade} ${railHidden}`}>
            {TABS.map(tab => <li key={tab.key}>{renderNavLink(tab, 'rail')}</li>)}
          </ol>
        </nav>

        <div className="min-w-0 lg:pl-[var(--planner-rail-w)]">
            {TABS.map((tab, index) => (
              <section
                key={tab.key}
                id={`plan-${tab.key}`}
                aria-labelledby={`plan-${tab.key}-title`}
                className="scroll-mt-[6rem]"
                style={{ paddingTop: index ? '2.5rem' : '1.75rem', paddingBottom: '1rem', borderTop: index ? '1px solid #2e2417' : undefined, marginTop: index ? '1.5rem' : undefined }}
              >
                <h2 id={`plan-${tab.key}-title`} className="mb-4 flex items-baseline gap-3" style={{ fontFamily: 'var(--font-heading)', fontSize: '1.375rem', color: '#e8dcc8' }}>
                  {tPlanner(tab.labelKey)}
                  {tab.key === 'summary' && <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8125rem', color: '#9c8b73' }}>{tPlanner('summaryHint')}</span>}
                </h2>
                {index < mountedCount ? sectionContent[tab.key] : <div aria-hidden="true" style={{ minHeight: '40rem' }} />}
              </section>
            ))}
        </div>
        </div>
      </div>
    </div>
  )
}
