'use client'

import BackLink from '@/components/navigation/BackLink'
import { pendingNoteUploads, noteUploadInProgressMessage } from '@/lib/notes/images'

import { showError, showSuccess } from '@/lib/toast'
import { deleteTempSlot, saveTempSlot, type TempSlot } from '@/lib/drafts/temp-slots'
import { DECK_DRAFTS_KEY, isDeckDraft, loadDeckDraftSlots, type DeckDraft } from '@/lib/drafts/deck-drafts'
import TempSaveMenu from '@/components/ui/TempSaveMenu'

import { useState, useMemo, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { motion, useReducedMotion } from 'motion/react'
import { useRouter } from '@/lib/i18n/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { useQueryState, parseAsString } from 'nuqs'
import { Link } from '@/lib/i18n/navigation'
import {
  Sinner,
  Identity,
  EGO,
  Skill,
  Passive,
} from '@/lib/data/sinners'
// IdentityCard → IdentityTab 내부에서 직접 렌더링

import { encodeDeckCode, decodeDeckCode } from '@/components/deck-builder/deckCodeUtils'
import UnderlineTabBar, { type TabItem } from '@/components/ui/UnderlineTabBar'
import Dropdown from '@/components/ui/Dropdown'
import CompactButton from '@/components/ui/CompactButton'
import { CONTENT_TYPES } from '@/lib/constants/deck-tokens'
import { LCB_IDS } from '@/lib/constants/game'
import { Users, Sparkles, SlidersHorizontal, FileText, ArrowLeft, Copy, Save, Upload, Check } from 'lucide-react'
import { IdentityTab, EgoTab, SkillsetTab } from '@/components/deck-builder/DeckBuilderTabs'
import { getIdentityImageUrl } from '@/lib/utils/images'
import DeckInsights, { type DeckInsightIdentity } from '@/components/deck-analysis/DeckInsights'
import DeckResourceSummary from '@/components/deck-analysis/DeckResourceSummary'
import { computeAttackTypeCounts, computeEgoCostTotals, computeSinProduction } from '@/lib/decks/deck-analysis'
import { contentTypeMessageKey } from '@/components/decks/decks-types'
import {
  localizeIdentityName,
  localizePassiveDescription,
  localizePassiveName,
} from '@/components/deck-detail/DeckIdentityCard'
import type { SupportedLang } from '@/lib/i18n/types'
import type { EgoGiftNote } from '@/lib/types'
import { rowsAtUptie } from '@/lib/decks/deck-identity-uptie'
import {
  DECK_MAIN_KEYWORDS,
  MAX_DECK_MAIN_KEYWORDS,
  computeAllGiftKeywordCounts,
  computeDeckKeywordCounts,
  computeDeckMainKeywordsFromSlots,
  computeFormationGiftKeywordCounts,
  type DeckKeywordSlot,
} from '@/lib/decks/keyword-rules'

interface EditMode {
  deckId: string
  title: string
  description: string
  tags: string[]
  content_type?: string
  mainKeywords?: string[]
  identitySlotIds: Record<string, string>
  gacksungSlots: Record<string, boolean>
  upties?: Record<string, number>
  skillDistribution?: Record<string, [number, number, number]>
  formationOrder: string[]
  egoSlotIds: Record<string, Record<string, string>>
}

type ForkMode = Omit<EditMode, 'deckId'> & { forkedFrom: string }

// CONTENT_TYPES, ContentType, CONTENT_TYPE_COLORS → deck-tokens.ts에서 import


interface Props {
  sinners: Sinner[]
  identities: Identity[]
  egos: EGO[]
  skills: Skill[]
  passives: Passive[]
  egoGifts?: EgoGiftNote[]
  editMode?: EditMode
  forkMode?: ForkMode
}

type Tab = 'identity' | 'ego' | 'skillset' | 'note'

// 수감자별 기본 E.G.O (name_kr 기준)
const DEFAULT_EGO_NAMES: Record<string, string> = {
  '이상':    '오감도',
  '파우스트': '표사 방출기',
  '돈키호테': '라 상그레 산초',
  '료슈':    '삼라영삼',
  '뫼르소':  '타인의 사슬',
  '홍루':    '허환경',
  '이스마엘': '작살박이',
  '오티스':  '토 파토스 마토스',
  '그레고르': '어느날 갑자기',
}

const MANUAL_ATTACK_MAIN_KEYWORDS = new Set<string>(['참격', '관통', '타격'])

const DeckNoteEditor = dynamic(() => import('@/components/deck-builder/DeckNoteEditor'), {
  ssr: false,
  loading: () => null,
})

function sanitizeDeckMainKeywords(value: readonly string[] | undefined): string[] {
  if (!value) return []
  const allowed = new Set<string>(DECK_MAIN_KEYWORDS)
  const seen = new Set<string>()
  return value.filter(keyword => {
    if (!allowed.has(keyword) || seen.has(keyword)) return false
    seen.add(keyword)
    return true
  }).slice(0, MAX_DECK_MAIN_KEYWORDS)
}

export default function DeckBuilderClient({ sinners, identities, egos, skills, passives, egoGifts = [], editMode, forkMode }: Props) {
  const locale = useLocale()
  const sinnerT = useTranslations('sinner')
  const deckT = useTranslations('decks')
  const builderT = useTranslations('decks.builder')
  const tTempSaves = useTranslations('planner.tempSaves')
  const router = useRouter()
  const initData = editMode ?? forkMode
  const lcbIdentity = (sinnerId: string) => identities.find(identity => identity.sinner_id === sinnerId && identity.game_id === LCB_IDS[sinnerId])
  // 12명 모두 항상 인격을 가진다: 비어 있는 수감자는 LCB 인격으로 채운다 (바꿀 수는 있어도 비울 수는 없다)
  const withLcb = (slots: Record<string, Identity | undefined>) => Object.fromEntries(sinners.map(sinner => [sinner.id, slots[sinner.id] ?? lcbIdentity(sinner.id)]))
  const [tabParam, setTab] = useQueryState('tab', parseAsString.withDefault('identity'))
  const tab = (tabParam as Tab) || 'identity'
  const [deckSlots, setDeckSlots] = useState<Record<string, Identity | undefined>>(() => {
    if (initData?.identitySlotIds) {
      const slots: Record<string, Identity | undefined> = {}
      for (const [sinnerId, identityId] of Object.entries(initData.identitySlotIds)) {
        slots[sinnerId] = identities.find(i => i.id === identityId)
      }
      return withLcb(slots)
    }
    return withLcb({})
  })
  // egoSlots: sinnerId → { grade → EGO } (등급별 1개), 기본값 = ZAYIN EGO
  const [egoSlots, setEgoSlots] = useState<Record<string, Record<string, EGO>>>(() => {
    if (initData?.egoSlotIds) {
      const slots: Record<string, Record<string, EGO>> = {}
      for (const [sinnerId, gradeMap] of Object.entries(initData.egoSlotIds)) {
        slots[sinnerId] = {}
        for (const [grade, egoId] of Object.entries(gradeMap)) {
          const ego = egos.find(e => e.id === egoId)
          if (ego) slots[sinnerId][grade] = ego
        }
      }
      return slots
    }
    const initial: Record<string, Record<string, EGO>> = {}
    for (const sinner of sinners) {
      const defaultName = DEFAULT_EGO_NAMES[sinner.name_kr]
      const ego = defaultName
        ? egos.find(e => e.sinner_id === sinner.id && (e.name_kr === defaultName || e.name === defaultName))
            ?? egos.find(e => e.sinner_id === sinner.id && e.grade === 'ZAYIN')
        : egos.find(e => e.sinner_id === sinner.id && e.grade === 'ZAYIN')
      if (ego) initial[sinner.id] = { [ego.grade]: ego }
    }
    return initial
  })
  const [formationOrder, setFormationOrder] = useState<string[]>(initData?.formationOrder ?? [])
  const [title, setTitle] = useState(forkMode ? builderT('forkTitle', { title: forkMode.title }) : editMode?.title ?? '')
  const [contentType, setContentType] = useState<string>(initData?.content_type && initData.content_type !== '없음' ? initData.content_type : '')
  const [description, setDescription] = useState(initData?.description ?? '')
  const [selectedMainKeywords, setSelectedMainKeywords] = useState<string[]>(() => sanitizeDeckMainKeywords(initData?.mainKeywords))
  const [mainKeywordsManual, setMainKeywordsManual] = useState(() => Array.isArray(initData?.mainKeywords))
  const [saving, setSaving] = useState(false)
  // toast는 Sonner가 글로벌로 처리 (showError from lib/toast)
  const [descPreview, setDescPreview] = useState(false)
  const [gacksungSlots, setGacksungSlots] = useState<Record<string, boolean>>(initData?.gacksungSlots ?? {})
  const [upties, setUpties] = useState<Record<string, number>>(initData?.upties ?? {})
  const [skillDistribution, setSkillDistribution] = useState<Record<string, [number, number, number]>>(initData?.skillDistribution ?? {})
  const [codeInput, setCodeInput] = useState('')
  const [codeCopied, setCodeCopied] = useState(false)
  const [codeApplying, setCodeApplying] = useState(false)
  const [codeError, setCodeError] = useState(false)
  const { status: authStatus } = useSession()
  const [draftSlots, setDraftSlots] = useState<TempSlot<DeckDraft>[]>([])
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    setDraftSlots(loadDeckDraftSlots())
  }, [])

  // Skills/passives follow each slot's uptie (nearest level the data has).
  const identityUpties = useMemo(() => new Map(sinners.flatMap(s => deckSlots[s.id] ? [[deckSlots[s.id]!.id, upties[s.id]] as const] : [])), [deckSlots, sinners, upties])

  const skillsByIdentityId = useMemo(() => {
    const raw: Record<string, Skill[]> = {}
    for (const s of rowsAtUptie(skills, identityUpties)) {
      ;(raw[s.identity_id] ??= []).push(s)
    }
    // 4동기화 우선: 같은 (skill_order, variant_order)에서 최고 uptie_level만 유지
    const map: Record<string, Skill[]> = {}
    for (const [id, list] of Object.entries(raw)) {
      const best = new Map<string, Skill>()
      for (const s of list) {
        const key = `${s.skill_order}:${s.variant_order ?? 0}`
        const ex = best.get(key)
        if (!ex || (s.uptie_level ?? 3) > (ex.uptie_level ?? 3)) best.set(key, s)
      }
      map[id] = [...best.values()].sort((a, b) => a.skill_order - b.skill_order || (a.variant_order ?? 0) - (b.variant_order ?? 0))
    }
    return map
  }, [identityUpties, skills])

  const passivesByIdentityId = useMemo(() => {
    const raw: Record<string, Passive[]> = {}
    for (const p of rowsAtUptie(passives, identityUpties)) {
      ;(raw[p.identity_id] ??= []).push(p)
    }
    // 4동기화 우선: 같은 (passive_type, passive_order)에서 최고 uptie_level만 유지
    const map: Record<string, Passive[]> = {}
    for (const [id, list] of Object.entries(raw)) {
      const best = new Map<string, Passive>()
      for (const p of list) {
        const key = `${p.passive_type}:${p.passive_order}`
        const ex = best.get(key)
        if (!ex || (p.uptie_level ?? 3) > (ex.uptie_level ?? 3)) best.set(key, p)
      }
      map[id] = [...best.values()].sort((a, b) => a.passive_order - b.passive_order)
    }
    return map
  }, [identityUpties, passives])

  // Planner deck panels: keyword distribution, passives, attack types and sin resources.
  const deckInsights = useMemo(() => {
    const placed = sinners.flatMap(sinner => deckSlots[sinner.id] ? [{ sinner, identity: deckSlots[sinner.id]! }] : [])
    const selectedEgos = Object.values(egoSlots).flatMap(gradeMap => Object.values(gradeMap))
    const skillsOf = (identity: Identity) => skillsByIdentityId[identity.id] ?? []
    const sinCounts = computeSinProduction(placed.map(({ sinner, identity }) => ({ skills: skillsOf(identity), distribution: skillDistribution[sinner.id] })))
    const identities: DeckInsightIdentity[] = placed.map(({ sinner, identity }) => ({
      id: identity.id,
      name: localizeIdentityName(identity, locale),
      sinnerName: sinnerT(sinner.id as Parameters<typeof sinnerT>[0]),
      imageUrl: identity.folder_name && identity.game_id ? getIdentityImageUrl(identity.sinner_id, identity.folder_name, `${identity.game_id}_normal_info`) : '',
      keywords: identity.skill_keyword_list ?? identity.keywords ?? [],
      passives: (passivesByIdentityId[identity.id] ?? []).map(passive => ({
        ...passive,
        name: localizePassiveName(passive, locale),
        description: localizePassiveDescription(passive, locale) ?? null,
      })),
    }))
    return {
      identities,
      sinCounts,
      baseSinCounts: computeSinProduction(placed.map(({ identity }) => ({ skills: skillsOf(identity) }))),
      summary: (
        <DeckResourceSummary
          {...computeAttackTypeCounts(placed.map(({ identity }) => skillsOf(identity)), selectedEgos.map(ego => ego.ego_skills))}
          production={sinCounts}
          egoCost={computeEgoCostTotals(selectedEgos.map(ego => ego.cost))}
        />
      ),
    }
  }, [deckSlots, egoSlots, locale, passivesByIdentityId, sinners, sinnerT, skillDistribution, skillsByIdentityId])

  const deckKeywordSlots = useMemo<DeckKeywordSlot[]>(() => (
    sinners
      .map(sinner => {
        const identity = deckSlots[sinner.id]
        if (!identity) return null
        const formationIndex = formationOrder.indexOf(sinner.id)
        const slot: DeckKeywordSlot = {
          slot_order: formationIndex >= 0 ? formationIndex : 99,
          identities: {
            skill_keyword_list: identity.skill_keyword_list ?? [],
            affiliation: identity.affiliation ?? null,
            association_list: identity.association_list ?? [],
            skills: (skillsByIdentityId[identity.id] ?? []).map(skill => ({
              skill_type: skill.skill_type,
              atk_type: (skill as Skill & { atk_type?: string | null }).atk_type ?? skill.skill_type,
            })),
          },
        }
        return slot
      })
      .filter((slot): slot is DeckKeywordSlot => Boolean(slot))
  ), [deckSlots, formationOrder, sinners, skillsByIdentityId])

  const deckKeywordCounts = useMemo(() => computeDeckKeywordCounts(deckKeywordSlots).counts, [deckKeywordSlots])
  const autoMainKeywords = useMemo(() => computeDeckMainKeywordsFromSlots(deckKeywordSlots), [deckKeywordSlots])
  const effectiveMainKeywords = mainKeywordsManual ? selectedMainKeywords : autoMainKeywords
  const formationGiftKeywordCounts = useMemo(() => computeFormationGiftKeywordCounts(deckKeywordSlots), [deckKeywordSlots])
  const allGiftKeywordCounts = useMemo(() => computeAllGiftKeywordCounts(deckKeywordSlots), [deckKeywordSlots])

  useEffect(() => {
    if (!mainKeywordsManual) return
    setSelectedMainKeywords(prev => prev.filter(keyword => (
      MANUAL_ATTACK_MAIN_KEYWORDS.has(keyword) || (deckKeywordCounts[keyword] ?? 0) > 0
    )))
  }, [deckKeywordCounts, mainKeywordsManual])

  const handleMainKeywordToggle = (keyword: string) => {
    const isManualAttackKeyword = MANUAL_ATTACK_MAIN_KEYWORDS.has(keyword)
    if (!isManualAttackKeyword && (deckKeywordCounts[keyword] ?? 0) <= 0) return
    setMainKeywordsManual(true)
    setSelectedMainKeywords(prev => {
      const baseKeywords = mainKeywordsManual ? prev : autoMainKeywords
      if (baseKeywords.includes(keyword)) return baseKeywords.filter(item => item !== keyword)
      if (baseKeywords.length >= MAX_DECK_MAIN_KEYWORDS) return baseKeywords
      return [...baseKeywords, keyword]
    })
  }

  const identityCount = Object.values(deckSlots).filter(Boolean).length
  const egoCount = Object.values(egoSlots).reduce((s, g) => s + Object.keys(g).length, 0)
  const skillsetCustomCount = useMemo(() => {
    return Object.entries(skillDistribution).filter(([sinnerId, dist]) => {
      if (!deckSlots[sinnerId]) return false
      return !(dist[0] === 3 && dist[1] === 2 && dist[2] === 1)
    }).length
  }, [skillDistribution, deckSlots])

  const handleFormationToggle = (sinnerId: string) => {
    setFormationOrder(prev => {
      if (prev.includes(sinnerId)) return prev.filter(id => id !== sinnerId)
      if (prev.length >= 12) return prev
      return [...prev, sinnerId]
    })
  }

  const handleSave = async () => {
    if (pendingNoteUploads.size) { showError(noteUploadInProgressMessage(locale)); return }
    if (!title.trim() || identityCount < 12 || !contentType) return
    setSaving(true)
    const identitySlots = sinners
      .filter(s => deckSlots[s.id])
      .map(s => {
        const dist = skillDistribution[s.id] ?? [3, 2, 1]
        return {
          identity_id: deckSlots[s.id]!.id,
          gacksung: gacksungSlots[s.id] ?? false,
          uptie: upties[s.id] ?? 4,
          slot_order: formationOrder.indexOf(s.id) >= 0 ? formationOrder.indexOf(s.id) : 99,
          s1_count: dist[0],
          s2_count: dist[1],
          s3_count: dist[2],
        }
      })
    const egoRows = Object.entries(egoSlots).flatMap(([, gradeMap]) =>
      Object.entries(gradeMap).map(([grade, ego]) => ({ ego_id: ego.id, grade }))
    )
    const url = editMode ? `/api/decks/${editMode.deckId}` : '/api/decks'
    const method = editMode ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, tags: [], main_keywords: effectiveMainKeywords, content_type: contentType, identitySlots, egoSlots: egoRows }),
    })
    setSaving(false)
    if (res.ok) {
      router.push(editMode ? `/decks/${editMode.deckId}` : '/decks', { locale: locale as SupportedLang })
    } else {
      const data = await res.json().catch(() => null)
      showError(data?.error ?? (editMode ? builderT('errors.updateFailed') : builderT('errors.saveFailed')))
    }
  }

  const handleSaveDraft = (slot: TempSlot<DeckDraft>) => {
    if (pendingNoteUploads.size) { showError(noteUploadInProgressMessage(locale)); return }
    const draft: DeckDraft = {
      title,
      contentType,
      description,
      deckSlotIds: Object.fromEntries(
        Object.entries(deckSlots).filter(([, v]) => v).map(([k, v]) => [k, v!.id])
      ),
      egoSlotIds: Object.fromEntries(
        Object.entries(egoSlots).map(([k, v]) => [
          k,
          Object.fromEntries(Object.entries(v).map(([grade, ego]) => [grade, ego.id])),
        ])
      ),
      formationOrder,
      mainKeywords: effectiveMainKeywords,
      mainKeywordsManual,
      savedAt: Date.now(),
    }
    Object.assign(draft, { gacksungSlots, skillDistribution, upties })
    const slots = saveTempSlot(DECK_DRAFTS_KEY, slot.slotNumber, draft, title.trim() || tTempSaves('untitledDeck'), isDeckDraft)
    if (!slots) { showError(tTempSaves('saveFailed')); return }
    setDraftSlots(slots)
    showSuccess(tTempSaves(slot.draft ? 'overwritten' : 'savedToSlot', { slot: slot.slotNumber }))
  }

  const handleLoadDraft = (slot: TempSlot<DeckDraft>) => {
    try {
      const draft = slot.draft?.state
      if (!draft) return
      if (draft.title) setTitle(draft.title)
      if (draft.contentType) setContentType(draft.contentType)
      if (draft.description) setDescription(draft.description)
      if (draft.formationOrder) setFormationOrder(draft.formationOrder)
      if (Array.isArray(draft.mainKeywords)) {
        setSelectedMainKeywords(sanitizeDeckMainKeywords(draft.mainKeywords))
        setMainKeywordsManual(draft.mainKeywordsManual !== false)
      } else {
        setMainKeywordsManual(false)
      }
      if (draft.deckSlotIds) {
        const slots: Record<string, Identity | undefined> = {}
        for (const [sinnerId, identityId] of Object.entries(draft.deckSlotIds)) {
          slots[sinnerId] = identities.find(i => i.id === identityId)
        }
        setDeckSlots(withLcb(slots))
      }
      if (draft.egoSlotIds) {
        const slots: Record<string, Record<string, EGO>> = {}
        for (const [sinnerId, gradeMap] of Object.entries(draft.egoSlotIds as Record<string, Record<string, string>>)) {
          slots[sinnerId] = {}
          for (const [grade, egoId] of Object.entries(gradeMap)) {
            const ego = egos.find(e => e.id === egoId)
            if (ego) slots[sinnerId][grade] = ego
          }
        }
        setEgoSlots(slots)
      }
      if (draft.gacksungSlots) setGacksungSlots(draft.gacksungSlots)
      setUpties(draft.upties ?? {})
      if (draft.skillDistribution) setSkillDistribution(draft.skillDistribution as typeof skillDistribution)
      showSuccess(tTempSaves('loadedFromSlot', { slot: slot.slotNumber }))
    } catch { /* ignore */ }
  }
  const handleDeleteDraft = (slot: TempSlot<DeckDraft>) => {
    setDraftSlots(deleteTempSlot(DECK_DRAFTS_KEY, slot.slotNumber, isDeckDraft))
    showSuccess(tTempSaves('deletedFromSlot', { slot: slot.slotNumber }))
  }

  const handleApplyCode = async () => {
    if (!codeInput.trim()) return
    setCodeApplying(true)
    setCodeError(false)
    const result = await decodeDeckCode(codeInput.trim(), sinners, identities, egos)
    setCodeApplying(false)
    if (!result) { setCodeError(true); return }
    setDeckSlots(withLcb(result.deckSlots))
    setUpties({})
    setEgoSlots(result.egoSlots)
    setFormationOrder(result.formationOrder)
    setCodeInput('')
    setTab('identity')
  }

  const handleCopyCode = async () => {
    const code = await encodeDeckCode(sinners, identities, egos, deckSlots, egoSlots, formationOrder)
    await navigator.clipboard.writeText(code)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  const tabItems: TabItem[] = [
    { key: 'identity', label: builderT('tabs.identity'), badge: identityCount || undefined, icon: Users },
    { key: 'ego',      label: builderT('tabs.ego'), badge: egoCount || undefined, icon: Sparkles },
    { key: 'skillset', label: builderT('tabs.skillset'), badge: skillsetCustomCount || undefined, icon: SlidersHorizontal },
    { key: 'note', label: builderT('tabs.note'), icon: FileText },
    // 편성 순서는 인격 탭의 40%/60% 호버로 통합
  ]

  return (
    <div className="min-h-[100dvh] pt-24 pb-20 sm:pt-28" style={{ background: 'var(--bg-deep)' }}>
      <div className="deck-workspace mx-auto max-w-6xl px-3 sm:px-6">
        <header
          className="mb-6"
          style={{
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div className="deck-workspace-header py-4">
            <div className="deck-workspace-heading">
              <div className="min-w-0">
                <BackLink href="/decks" locale={locale as SupportedLang} className="mb-0.5 inline-flex min-h-10 items-center gap-1.5 rounded px-1 transition-colors sm:min-h-11" style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
                <ArrowLeft style={{ width: '1rem', height: '1rem' }} /> {builderT('backToDecks')}
                </BackLink>
                <h1 className="sr-only">{editMode ? builderT('titleEdit') : builderT('titleNew')}</h1>
                <p className="sr-only">
                  {builderT('description')}
                </p>
              </div>
              <div className="deck-workspace-actions flex flex-wrap items-center gap-2">
                <div className="deck-workspace-code">
                  <input
                    type="text"
                    value={codeInput}
                    onChange={e => { setCodeInput(e.target.value); setCodeError(false) }}
                    placeholder={builderT('fields.codePlaceholder')}
                    aria-label={builderT('fields.deckCode')}
                    aria-invalid={codeError}
                    className="min-h-10 min-w-0 flex-1 rounded px-3 outline-none sm:min-h-11"
                    style={{ background: 'var(--bg-elevated)', border: `1px solid ${codeError ? 'var(--error)' : 'var(--border)'}`, color: 'var(--text-primary)', fontSize: '0.9375rem', fontFamily: 'var(--font-mono)' }}
                    onKeyDown={e => { if (e.key === 'Enter') handleApplyCode() }}
                  />
                  <CompactButton onClick={handleApplyCode} disabled={!codeInput.trim() || codeApplying} variant="gold">
                    {codeApplying ? builderT('fields.applying') : builderT('fields.applyCode')}
                  </CompactButton>
                  {codeError && <span role="alert" className="deck-workspace-code-error">{builderT('fields.codeError')}</span>}
                </div>
                <TempSaveMenu title={tTempSaves('deckMenuLabel')} slots={draftSlots} onSave={handleSaveDraft} onLoad={handleLoadDraft} onDelete={handleDeleteDraft} />
                <CompactButton
                  icon={codeCopied ? Check : Copy}
                  onClick={handleCopyCode}
                  disabled={identityCount < 12}
                  variant={codeCopied ? 'success' : 'muted'}
                  title={identityCount < 12 ? builderT('actions.copyDisabled') : ''}
                >
                  {codeCopied ? builderT('actions.copied') : builderT('actions.copyCode')}
                </CompactButton>
                {authStatus === 'authenticated' && (
                  <CompactButton
                    icon={Upload}
                    onClick={handleSave}
                    disabled={!title.trim() || identityCount < 12 || !contentType || saving}
                    variant="primary"
                    title={!contentType ? builderT('actions.contentRequired') : identityCount < 12 ? builderT('actions.identityRequired', { count: identityCount, total: sinners.length }) : ''}
                  >
                    {saving ? builderT('actions.saving') : editMode ? builderT('actions.save') : builderT('actions.upload')}
                  </CompactButton>
                )}
              </div>
            </div>

            <div className="deck-workspace-fields">
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="font-mono" style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{builderT('fields.title')}</span>
                <input
                  type="text"
                  placeholder={builderT('fields.titlePlaceholder')}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="min-h-10 w-full rounded px-3 outline-none sm:min-h-11"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    fontSize: '1rem',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => (e.target.style.borderColor = 'var(--gold)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                />
              </label>


              <div className="min-w-0">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="font-mono" style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{builderT('fields.contentType')}</span>
                  {!contentType && <span style={{ color: 'var(--warning)', fontSize: '0.875rem', opacity: 0.85 }}>{builderT('fields.required')}</span>}
                </div>
                <Dropdown value={contentType} onChange={setContentType} ariaLabel={builderT('fields.contentType')} options={[{value:'',label:builderT('fields.contentType')},...CONTENT_TYPES.map(ct=>({value:ct,label:deckT(`contentTypes.${contentTypeMessageKey(ct)}`)}))]} buttonStyle={{minHeight:'2.75rem',width:'100%',fontSize:'.9375rem'}} />
              </div>
            </div>
          </div>
        </header>

        <div className="deck-workspace-formation">
        {/* 탭 바 — 밑줄 인디케이터 (플래너 패턴) */}
        <UnderlineTabBar
          tabs={tabItems}
          activeKey={tab}
          onTabChange={key => setTab(key as Tab)}
          className="mb-4"
        />

        {/* 탭 콘텐츠 */}
        {tab === 'identity' && (
          <motion.section
            key="identity"
            className="deck-builder-identity-section"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >


            <IdentityTab
              sinners={sinners}
              identities={identities}
              deckSlots={deckSlots}
              upties={upties}
              mainKeywordCounts={deckKeywordCounts}
              selectedMainKeywords={effectiveMainKeywords}
              maxMainKeywords={MAX_DECK_MAIN_KEYWORDS}
              mainKeywordLabel={deckT('filters.alwaysKeywords')}
              formationOrder={formationOrder}
              onFormationToggle={handleFormationToggle}
              onFormationReset={() => setFormationOrder([])}
              onMainKeywordToggle={handleMainKeywordToggle}
              onIdentitySelect={(identity, uptie) => {
                if (!identity) return
                setDeckSlots(prev => ({ ...prev, [identity.sinner_id]: identity }))
                setUpties(prev => ({ ...prev, [identity.sinner_id]: uptie }))
              }}
            />

          </motion.section>
        )}
        {tab === 'ego' && (
          <motion.div
            key="ego"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <EgoTab
              sinners={sinners}
              egos={egos}
              egoSlots={egoSlots}
              lang={locale as SupportedLang}
              onEgoSelect={ego => {
                setEgoSlots(prev => ({
                  ...prev,
                  [ego.sinner_id]: { ...(prev[ego.sinner_id] ?? {}), [ego.grade]: ego }
                }))
              }}
              onEgoDeselect={(sinnerId, grade) => {
                if (grade === 'ZAYIN') return
                setEgoSlots(prev => {
                  const s = { ...(prev[sinnerId] ?? {}) }
                  delete s[grade]
                  return { ...prev, [sinnerId]: s }
                })
              }}
            />
          </motion.div>
        )}
        {tab === 'skillset' && (
          <motion.div
            key="skillset"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <SkillsetTab
              sinners={sinners}
              deckSlots={deckSlots}
              skillsByIdentityId={skillsByIdentityId}
              skillDistribution={skillDistribution}
              onDistributionChange={(sinnerId, dist) =>
                setSkillDistribution(prev => ({ ...prev, [sinnerId]: dist }))
              }
            />
          </motion.div>
        )}
        {/* 편성 순서 탭 → 인격 탭 40%/60% 호버로 통합 */}

        {/* ── 키워드 분포 + 패시브 + 공격 유형/죄악 자원 (플래너와 같은 패널) ── */}
        {tab !== 'note' && deckInsights.identities.length > 0 && (
          <DeckInsights
            identities={deckInsights.identities}
            sinCounts={deckInsights.sinCounts}
            baseSinCounts={deckInsights.baseSinCounts}
            summary={deckInsights.summary}
          />
        )}

        {/* 덱 노트 */}
        {tab === 'note' && (
          <motion.div
            key="note"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <DeckNoteEditor
              sinners={sinners}
              identities={identities}
              deckSlots={deckSlots}
              egoSlots={egoSlots}
              skillsByIdentityId={skillsByIdentityId}
              passivesByIdentityId={passivesByIdentityId}
              egoGifts={egoGifts}
              formationOrder={formationOrder}
              formationGiftKeywordCounts={formationGiftKeywordCounts}
              allGiftKeywordCounts={allGiftKeywordCounts}
              locale={locale as SupportedLang}
              description={description}
              setDescription={setDescription}
              descPreview={descPreview}
              setDescPreview={setDescPreview}
            />
          </motion.div>
        )}
        </div>

        <style jsx global>{`
          @media (max-width: 639px) {
            .deck-builder-identity-section {
              padding: 0.625rem;
              border: 1px solid rgba(200, 144, 10, 0.12);
              border-radius: 0.5rem;
              background: rgba(18, 14, 9, 0.42);
            }
          }
        `}</style>
      </div>

      {/* Toast는 Sonner가 글로벌로 처리 */}
    </div>
  )
}
