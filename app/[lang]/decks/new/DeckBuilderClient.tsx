'use client'

import { showError } from '@/lib/toast'

import { useState, useMemo, useEffect } from 'react'
import dynamic from 'next/dynamic'
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
  type ActivationCondition,
} from '@/lib/data/sinners'
import { useKeywordData } from '@/components/providers/KeywordProvider'
// IdentityCard → IdentityTab 내부에서 직접 렌더링

import { encodeDeckCode, decodeDeckCode } from '@/components/deck-builder/deckCodeUtils'
import UnderlineTabBar, { type TabItem } from '@/components/ui/UnderlineTabBar'
import CompactButton from '@/components/ui/CompactButton'
import Image from 'next/image'
import { CONTENT_TYPES, CONTENT_TYPE_COLORS, type ContentType } from '@/lib/constants/deck-tokens'
import { STORAGE_BASE } from '@/lib/constants/game'
import { Users, Sparkles, SlidersHorizontal, FileText, ArrowLeft, Copy, Save, Upload, Check } from 'lucide-react'
import { IdentityTab, EgoTab, SkillsetTab } from '@/components/deck-builder/DeckBuilderTabs'
import DeckPreviewPanel from '@/components/deck-builder/DeckPreviewPanel'
import DeckStatsPanel from '@/components/planner/DeckStatsPanel'
import EgoGiftModal from '@/components/deck-builder/EgoGiftModal'
import {
  localizeIdentityName,
  localizePassiveDescription,
  localizePassiveName,
} from '@/components/deck-detail/DeckIdentityCard'
import type { SupportedLang } from '@/lib/i18n/types'
import {
  DECK_MAIN_KEYWORDS,
  MAX_DECK_MAIN_KEYWORDS,
  computeAllGiftKeywordCounts,
  computeDeckKeywordCounts,
  computeDeckMainKeywordsFromSlots,
  computeFormationGiftKeywordCounts,
  type DeckKeywordSlot,
} from '@/lib/decks/keyword-rules'
import { normalizeThemeKeyword } from '@/lib/constants/keywords'

interface EditMode {
  deckId: string
  title: string
  description: string
  tags: string[]
  content_type?: string
  mainKeywords?: string[]
  identitySlotIds: Record<string, string>
  gacksungSlots: Record<string, boolean>
  skillDistribution?: Record<string, [number, number, number]>
  formationOrder: string[]
  egoSlotIds: Record<string, Record<string, string>>
}

type ForkMode = Omit<EditMode, 'deckId'> & { forkedFrom: string }

// CONTENT_TYPES, ContentType, CONTENT_TYPE_COLORS → deck-tokens.ts에서 import

const isGeodun = (ct: string) => ct.startsWith('거던')

interface Props {
  sinners: Sinner[]
  identities: Identity[]
  egos: EGO[]
  skills: Skill[]
  passives: Passive[]
  egoGifts?: { name: string; keyword: string; grade: string; image_url: string | null; effect_base: string | null; activation_condition: ActivationCondition | null }[]
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
  const { getIconUrl: kwGetIconUrl } = useKeywordData()
  const locale = useLocale()
  const sinnerT = useTranslations('sinner')
  const deckT = useTranslations('decks')
  const router = useRouter()
  const initData = editMode ?? forkMode
  const [tabParam, setTab] = useQueryState('tab', parseAsString.withDefault('identity'))
  const tab = (tabParam as Tab) || 'identity'
  const [deckSlots, setDeckSlots] = useState<Record<string, Identity | undefined>>(() => {
    if (initData?.identitySlotIds) {
      const slots: Record<string, Identity | undefined> = {}
      for (const [sinnerId, identityId] of Object.entries(initData.identitySlotIds)) {
        slots[sinnerId] = identities.find(i => i.id === identityId)
      }
      return slots
    }
    return {}
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
  const [title, setTitle] = useState(forkMode ? `${forkMode.title} (포크)` : editMode?.title ?? '')
  const [contentType, setContentType] = useState<string>(initData?.content_type && initData.content_type !== '없음' ? initData.content_type : '')
  const [description, setDescription] = useState(initData?.description ?? '')
  const [selectedMainKeywords, setSelectedMainKeywords] = useState<string[]>(() => sanitizeDeckMainKeywords(initData?.mainKeywords))
  const [mainKeywordsManual, setMainKeywordsManual] = useState(() => Array.isArray(initData?.mainKeywords))
  const [saving, setSaving] = useState(false)
  // toast는 Sonner가 글로벌로 처리 (showError from lib/toast)
  const [descPreview, setDescPreview] = useState(false)
  const [gacksungSlots, setGacksungSlots] = useState<Record<string, boolean>>(initData?.gacksungSlots ?? {})
  const [skillDistribution, setSkillDistribution] = useState<Record<string, [number, number, number]>>(initData?.skillDistribution ?? {})
  const [codeInput, setCodeInput] = useState('')
  const [codeCopied, setCodeCopied] = useState(false)
  const [codeApplying, setCodeApplying] = useState(false)
  const [codeError, setCodeError] = useState(false)
  const { status: authStatus } = useSession()
  const [draftSaved, setDraftSaved] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)
  const [showGiftPanel, setShowGiftPanel] = useState(false)
  const [giftTabKw, setGiftTabKw] = useState('전체')
  const [giftSearch, setGiftSearch] = useQueryState('gq', parseAsString.withDefault(''))
  const [giftGradeFilter, setGiftGradeFilter] = useQueryState('gg', parseAsString.withDefault('전체'))
  const [giftStatusFilter, setGiftStatusFilter] = useState<'all' | 'met' | 'unmet'>('all')
  const [showGiftModal, setShowGiftModal] = useState(false)

  useEffect(() => {
    setHasDraft(!!localStorage.getItem('limbus-deck-draft'))
  }, [])

  // 거던 아닐 때 스킬 편성 탭이면 인격 탭으로 이동
  useEffect(() => {
    if (!isGeodun(contentType) && tab === 'skillset') setTab('identity')
  }, [contentType, tab])

  const skillsByIdentityId = useMemo(() => {
    const raw: Record<string, Skill[]> = {}
    for (const s of skills) {
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
  }, [skills])

  const passivesByIdentityId = useMemo(() => {
    const raw: Record<string, Passive[]> = {}
    for (const p of passives) {
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
  }, [passives])

  const deckStatsData = useMemo(() => {
    const selectedIdentities = sinners
      .map(sinner => deckSlots[sinner.id])
      .filter((identity): identity is Identity => Boolean(identity))
    const selectedIdentityIds = new Set(selectedIdentities.map(identity => identity.id))
    const selectedEgos = Object.values(egoSlots).flatMap(gradeMap => Object.values(gradeMap))

    return {
      identitySlots: selectedIdentities.map(identity => ({
        identity_id: identity.id,
        sinner_id: identity.sinner_id,
        name_kr: localizeIdentityName(identity, locale),
      })),
      skills: selectedIdentities.flatMap(identity =>
        (skillsByIdentityId[identity.id] ?? []).map(skill => ({
          identity_id: skill.identity_id,
          sin_affinity: skill.sin_affinity,
          skill_type: skill.skill_type,
          skill_order: skill.skill_order,
          atk_type: (skill as Skill & { atk_type?: string | null }).atk_type,
          uptie_level: skill.uptie_level,
          variant_order: skill.variant_order,
        }))
      ),
      passives: Array.from(selectedIdentityIds).flatMap(identityId =>
        (passivesByIdentityId[identityId] ?? []).map(passive => ({
          identity_id: passive.identity_id,
          name: localizePassiveName(passive, locale),
          passive_type: passive.passive_type,
          sin_affinity: passive.sin_affinity,
          sin_count: passive.sin_count,
          active_cond: passive.active_cond,
          description: localizePassiveDescription(passive, locale),
          passive_order: passive.passive_order,
        }))
      ),
      sinners: sinners.map(sinner => ({
        id: sinner.id,
        name_kr: sinnerT(sinner.id as Parameters<typeof sinnerT>[0]),
      })),
      egoCosts: selectedEgos.map(ego => ({ cost: ego.cost })),
      egoSinAffinities: selectedEgos
        .map(ego => ego.sin_affinity)
        .filter((sin): sin is NonNullable<EGO['sin_affinity']> => Boolean(sin)),
      egoAttackSkills: selectedEgos.map(ego => ego.ego_skills ?? []),
    }
  }, [deckSlots, egoSlots, locale, passivesByIdentityId, sinners, sinnerT, skillsByIdentityId])

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

  // 활성 가능한 EGO 기프트 계산
  const activatableGifts = useMemo(() => {
    const formationIdentities = formationOrder
      .slice(0, 7)
      .map(sid => deckSlots[sid])
      .filter(Boolean) as Identity[]
    const assignedIdentities = formationOrder
      .map(sid => deckSlots[sid])
      .filter(Boolean) as Identity[]
    if (assignedIdentities.length === 0) return []

    const countAffiliations = (list: Identity[]) => {
      const counts: Record<string, number> = {}
      for (const id of list) {
        if (id.affiliation) {
          counts[id.affiliation] = (counts[id.affiliation] ?? 0) + 1
        }
      }
      return counts
    }
    const formationAffiliationCounts = countAffiliations(formationIdentities)
    const allAffiliationCounts = countAffiliations(assignedIdentities)

    type GiftStatus = {
      name: string; keyword: string; grade: string; image_url: string | null
      effect_base: string | null; condition: ActivationCondition
      current: number; formationCurrent: number; allCurrent: number
      met: boolean; level: 'met' | 'warn' | 'unmet'
    }

    const results: GiftStatus[] = []
    const countCondition = (
      c: ActivationCondition,
      keywordCounts: Record<string, number>,
      affiliationCounts: Record<string, number>,
    ) => {
      if (c.type === 'keyword') {
        return keywordCounts[normalizeThemeKeyword(c.keyword!)] ?? 0
      }
      if (c.type === 'multi_keyword') {
        return c.keywords!.reduce((sum, kw) => sum + (keywordCounts[normalizeThemeKeyword(kw)] ?? 0), 0)
      }
      if (c.type === 'affiliation') {
        const affiliations = c.affiliations ?? (c.affiliation ? [c.affiliation] : [])
        return affiliations.reduce((sum, aff) => sum + (affiliationCounts[aff] ?? 0), 0)
      }
      return 0
    }

    for (const g of egoGifts) {
      const c = g.activation_condition
      if (!c) continue
      if (c.type === 'skill') continue
      const formationCurrent = countCondition(c, formationGiftKeywordCounts, formationAffiliationCounts)
      const allCurrent = countCondition(c, allGiftKeywordCounts, allAffiliationCounts)
      const level = formationCurrent >= c.count ? 'met' : allCurrent >= c.count ? 'warn' : 'unmet'
      const current = level === 'met' ? formationCurrent : allCurrent

      if (current > 0) {
        results.push({
          name: g.name, keyword: g.keyword, grade: g.grade,
          image_url: g.image_url, effect_base: g.effect_base,
          condition: c, current, formationCurrent, allCurrent,
          met: level === 'met', level,
        })
      }
    }

    const levelOrder = { met: 0, warn: 1, unmet: 2 } satisfies Record<GiftStatus['level'], number>
    results.sort((a, b) => {
      if (a.level !== b.level) return levelOrder[a.level] - levelOrder[b.level]
      return (b.current / b.condition.count) - (a.current / a.condition.count)
    })
    return results
  }, [allGiftKeywordCounts, deckSlots, egoGifts, formationGiftKeywordCounts, formationOrder])

  const identityCount = Object.values(deckSlots).filter(Boolean).length
  const egoCount = Object.values(egoSlots).reduce((s, g) => s + Object.keys(g).length, 0)
  const skillsetCustomCount = useMemo(() => {
    return Object.entries(skillDistribution).filter(([sinnerId, dist]) => {
      if (!deckSlots[sinnerId]) return false
      return !(dist[0] === 3 && dist[1] === 2 && dist[2] === 1)
    }).length
  }, [skillDistribution, deckSlots])

  const handleGacksungToggle = (sinnerId: string) => {
    setGacksungSlots(prev => ({ ...prev, [sinnerId]: !(prev[sinnerId] ?? false) }))
  }

  const handleFormationToggle = (sinnerId: string) => {
    setFormationOrder(prev => {
      if (prev.includes(sinnerId)) return prev.filter(id => id !== sinnerId)
      if (prev.length >= 12) return prev
      return [...prev, sinnerId]
    })
  }

  const handleSave = async () => {
    if (!title.trim() || identityCount < 12 || !contentType) return
    setSaving(true)
    const identitySlots = sinners
      .filter(s => deckSlots[s.id])
      .map(s => {
        const dist = skillDistribution[s.id] ?? [3, 2, 1]
        return {
          identity_id: deckSlots[s.id]!.id,
          gacksung: gacksungSlots[s.id] ?? false,
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
      showError(data?.error ?? (editMode ? '덱 수정에 실패했습니다.' : '덱 저장에 실패했습니다.'))
    }
  }

  const handleSaveDraft = () => {
    const draft = {
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
    Object.assign(draft, { gacksungSlots, skillDistribution })
    localStorage.setItem('limbus-deck-draft', JSON.stringify(draft))
    setHasDraft(true)
    setDraftSaved(true)
    setTimeout(() => setDraftSaved(false), 2000)
  }

  const handleLoadDraft = () => {
    try {
      const raw = localStorage.getItem('limbus-deck-draft')
      if (!raw) return
      const draft = JSON.parse(raw)
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
        setDeckSlots(slots)
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
      if (draft.skillDistribution) setSkillDistribution(draft.skillDistribution)
      setHasDraft(false)
      localStorage.removeItem('limbus-deck-draft')
    } catch { /* ignore */ }
  }

  const handleApplyCode = async () => {
    if (!codeInput.trim()) return
    setCodeApplying(true)
    setCodeError(false)
    const result = await decodeDeckCode(codeInput.trim(), sinners, identities, egos)
    setCodeApplying(false)
    if (!result) { setCodeError(true); return }
    setDeckSlots(result.deckSlots)
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
    { key: 'identity', label: '인격 편성', badge: identityCount || undefined, icon: Users },
    { key: 'ego',      label: '에고 편성', badge: egoCount || undefined, icon: Sparkles },
    ...(isGeodun(contentType) ? [{ key: 'skillset', label: '스킬 편성', badge: skillsetCustomCount || undefined, icon: SlidersHorizontal }] : []),
    // 편성 순서는 인격 탭의 40%/60% 호버로 통합
    { key: 'note',     label: '덱 노트', icon: FileText },
  ]

  return (
    <div className="min-h-[100dvh] pt-24 pb-16" style={{ background: 'var(--bg-deep)' }}>
      {/* 헤더 — 플래너식 2단 구조 */}
      <div className="max-w-5xl mx-auto px-3 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <Link href="/decks" locale={locale as SupportedLang} className="inline-flex items-center gap-1 mb-2 transition-colors" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
              <ArrowLeft style={{ width: '0.75rem', height: '0.75rem' }} /> 덱 게시판
            </Link>
            <h1 className="font-serif text-lg sm:text-2xl" style={{ color: 'var(--text-primary)' }}>{editMode ? '덱 수정' : '덱 편성'}</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {hasDraft && (
              <CompactButton icon={undefined} onClick={handleLoadDraft} variant="muted">
                초안 불러오기
              </CompactButton>
            )}
            <CompactButton
              icon={draftSaved ? Check : Save}
              onClick={handleSaveDraft}
              disabled={!title.trim()}
              variant={draftSaved ? 'success' : 'gold'}
            >
              {draftSaved ? '저장 완료' : '임시 저장'}
            </CompactButton>
            <CompactButton
              icon={codeCopied ? Check : Copy}
              onClick={handleCopyCode}
              disabled={identityCount < 12}
              variant={codeCopied ? 'success' : 'muted'}
              title={identityCount < 12 ? '12명 전원 인격을 편성해야 코드를 복사할 수 있습니다' : ''}
            >
              {codeCopied ? '복사됨' : '코드 복사'}
            </CompactButton>
            {authStatus === 'authenticated' && (
              <CompactButton
                icon={Upload}
                onClick={handleSave}
                disabled={!title.trim() || identityCount < 12 || !contentType || saving}
                variant="primary"
                title={!contentType ? '콘텐츠 유형을 선택해주세요' : identityCount < 12 ? `12명 전원 인격을 편성해야 합니다 (${identityCount}/12)` : ''}
              >
                {saving ? '저장 중...' : editMode ? '저장' : '업로드'}
              </CompactButton>
            )}
          </div>
        </div>

        {/* 제목 입력 */}
        <input
          type="text"
          placeholder="덱 제목을 입력하세요 *"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full px-4 py-2.5 rounded outline-none mb-4"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontSize: 'var(--text-sm)',
            transition: 'border-color 0.2s',
          }}
          onFocus={e => (e.target.style.borderColor = 'var(--gold)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border)')}
        />

        {/* 코드바 + 콘텐츠 유형 — 한 줄 통합 */}
        <div className="flex flex-wrap items-center gap-2 mb-6" style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
          {/* 편성 코드 */}
          <input
            type="text"
            value={codeInput}
            onChange={e => { setCodeInput(e.target.value); setCodeError(false) }}
            placeholder="편성 코드..."
            className="px-3 py-2 rounded outline-none"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', minWidth: '8rem', maxWidth: '16rem', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', flex: '0 1 16rem' }}
            onKeyDown={e => { if (e.key === 'Enter') handleApplyCode() }}
          />
          <CompactButton onClick={handleApplyCode} disabled={!codeInput.trim() || codeApplying} variant="gold">
            {codeApplying ? '...' : '적용'}
          </CompactButton>
          {codeError && <span style={{ color: 'var(--error)', fontSize: 'var(--text-xs)' }}>오류</span>}

          {/* 구분선 */}
          <div style={{ width: '1px', height: '1.25rem', background: 'var(--border)', margin: '0 0.25rem' }} className="hidden sm:block" />

          {/* 콘텐츠 유형 */}
          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', flexShrink: 0 }} className="hidden sm:inline">콘텐츠</span>
          <div className="flex gap-1.5 flex-wrap">
            {CONTENT_TYPES.map(ct => {
              const active = contentType === ct
              const colors = CONTENT_TYPE_COLORS[ct]
              return (
                <button
                  key={ct}
                  type="button"
                  onClick={() => setContentType(active ? '' : ct)}
                  className="px-2.5 py-1 rounded transition-all duration-150"
                  style={{
                    background: active ? colors.bg : 'transparent',
                    color: active ? colors.color : 'var(--text-muted)',
                    border: `1px solid ${active ? colors.border : 'var(--border)'}`,
                    fontFamily: 'var(--font-heading)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: active ? 700 : 500,
                  }}
                >
                  {ct}
                </button>
              )
            })}
          </div>
          {!contentType && <span style={{ color: 'var(--warning)', fontSize: '0.5625rem', opacity: 0.7 }}>* 필수</span>}
        </div>

        {/* 탭 바 — 밑줄 인디케이터 (플래너 패턴) */}
        <UnderlineTabBar
          tabs={tabItems}
          activeKey={tab}
          onTabChange={key => setTab(key as Tab)}
          className="mb-6"
        />

        {/* 탭 콘텐츠 */}
        {tab === 'identity' && (
          <section className="deck-builder-identity-section">
            <IdentityTab
              sinners={sinners}
              identities={identities}
              deckSlots={deckSlots}
              gacksungSlots={gacksungSlots}
              mainKeywordCounts={deckKeywordCounts}
              selectedMainKeywords={effectiveMainKeywords}
              maxMainKeywords={MAX_DECK_MAIN_KEYWORDS}
              mainKeywordLabel={deckT('filters.alwaysKeywords')}
              onGacksungToggle={handleGacksungToggle}
              formationOrder={formationOrder}
              onFormationToggle={handleFormationToggle}
              onMainKeywordToggle={handleMainKeywordToggle}
              onIdentitySelect={identity => {
                if (!identity) return
                setDeckSlots(prev => ({ ...prev, [identity.sinner_id]: identity }))
              }}
              onIdentityDeselect={sinnerId => {
                setDeckSlots(prev => { const n = { ...prev }; delete n[sinnerId]; return n })
                setFormationOrder(prev => prev.filter(id => id !== sinnerId))
              }}
            />

            {Object.values(deckSlots).filter(Boolean).length > 0 && (
              <DeckStatsPanel {...deckStatsData} calculationMode="deckDetail" />
            )}

            <DeckPreviewPanel
              deckSlots={deckSlots}
              activatableGifts={activatableGifts}
              contentType={contentType}
              showGiftPanel={showGiftPanel}
              setShowGiftPanel={setShowGiftPanel}
              giftTabKw={giftTabKw}
              setGiftTabKw={setGiftTabKw}
              giftSearch={giftSearch}
              setGiftSearch={setGiftSearch}
              giftGradeFilter={giftGradeFilter}
              setGiftGradeFilter={setGiftGradeFilter}
              giftStatusFilter={giftStatusFilter}
              setGiftStatusFilter={setGiftStatusFilter}
              onOpenGiftModal={() => setShowGiftModal(true)}
            />
          </section>
        )}
        {tab === 'ego' && (
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
        )}
        {tab === 'skillset' && (
          <SkillsetTab
            sinners={sinners}
            deckSlots={deckSlots}
            skillsByIdentityId={skillsByIdentityId}
            skillDistribution={skillDistribution}
            onDistributionChange={(sinnerId, dist) =>
              setSkillDistribution(prev => ({ ...prev, [sinnerId]: dist }))
            }
          />
        )}
        {/* 편성 순서 탭 → 인격 탭 40%/60% 호버로 통합 */}

        {/* ── 통계 + 패시브 미리보기 ── */}
        {tab !== 'note' && tab !== 'identity' && Object.values(deckSlots).filter(Boolean).length > 0 && (
          <DeckStatsPanel {...deckStatsData} calculationMode="deckDetail" />
        )}

        {/* 정보 패널 (note 탭 제외) */}
        {tab !== 'note' && tab !== 'identity' && (
          <DeckPreviewPanel
            deckSlots={deckSlots}
            activatableGifts={activatableGifts}
            contentType={contentType}
            showGiftPanel={showGiftPanel}
            setShowGiftPanel={setShowGiftPanel}
            giftTabKw={giftTabKw}
            setGiftTabKw={setGiftTabKw}
            giftSearch={giftSearch}
            setGiftSearch={setGiftSearch}
            giftGradeFilter={giftGradeFilter}
            setGiftGradeFilter={setGiftGradeFilter}
            giftStatusFilter={giftStatusFilter}
            setGiftStatusFilter={setGiftStatusFilter}
            onOpenGiftModal={() => setShowGiftModal(true)}
          />
        )}

        {/* 덱 노트 */}
        {tab === 'note' && (
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
        )}

        <style jsx global>{`
          @media (max-width: 639px) {
            .deck-builder-identity-section {
              padding: 0.625rem;
              border: 1px solid rgba(200, 144, 10, 0.12);
              border-radius: 0.5rem;
              background: rgba(18, 14, 9, 0.42);
            }
            .deck-builder-identity-section .deck-stats-panel {
              margin-top: 0.75rem;
              gap: 0.625rem;
            }
            .deck-builder-identity-section .deck-stats-panel > div {
              width: 100% !important;
            }
          }
        `}</style>
      </div>

      {/* Toast는 Sonner가 글로벌로 처리 */}

      {/* ── 테마팩(EGO 기프트) 모달 ───────────────────── */}
      <EgoGiftModal
        open={showGiftModal}
        onClose={() => setShowGiftModal(false)}
        activatableGifts={activatableGifts}
        getIconUrl={kwGetIconUrl}
      />
    </div>
  )
}
