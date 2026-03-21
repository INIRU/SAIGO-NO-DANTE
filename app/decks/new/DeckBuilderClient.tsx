'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import { useFormatSkillDesc } from '@/components/sinners/KeywordTooltip'
import {
  Sinner,
  Identity,
  EGO,
  Skill,
  Passive,
  getSkillIconUrl,
  getIdentityInfoUrl,
  computeSkillImageIndices,
  STORAGE_BASE,
  SIN_COLORS,
  SinType,
  GRADE_COLORS,
  getSkillOrderLabel,
  type ActivationCondition,
} from '@/lib/data/sinners'
import {
  type NoteSkillEntry,
  type NotePassiveEntry,
  type NoteEgoEntry,
  type NoteEgoGiftEntry,
} from '@/components/decks/NoteChips'
import { useNoteAutocomplete, buildKeywordPool, buildEgoGiftPool, type AutocompleteSuggestion } from '@/components/notes/NoteAutocomplete'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import IdentityCard from '@/components/sinners/IdentityCard'

import { encodeDeckCode, decodeDeckCode } from '@/components/deck-builder/deckCodeUtils'
import { useToast, Toast } from '@/components/ui/Toast'
import { Users, Sparkles, SlidersHorizontal, ListOrdered, FileText } from 'lucide-react'
import { IdentityTab, EgoTab, OrderTab, SkillsetTab } from '@/components/deck-builder/DeckBuilderTabs'
import DeckPreviewPanel from '@/components/deck-builder/DeckPreviewPanel'
import EgoGiftModal from '@/components/deck-builder/EgoGiftModal'
import DeckNoteEditor from '@/components/deck-builder/DeckNoteEditor'

interface EditMode {
  deckId: string
  title: string
  description: string
  tags: string[]
  content_type?: string
  identitySlotIds: Record<string, string>
  gacksungSlots: Record<string, boolean>
  skillDistribution?: Record<string, [number, number, number]>
  formationOrder: string[]
  egoSlotIds: Record<string, Record<string, string>>
}

type ForkMode = Omit<EditMode, 'deckId'> & { forkedFrom: string }

const CONTENT_TYPES = ['스토리', '거던5층', '거던10층', '거던15층', '거굴철'] as const
type ContentType = typeof CONTENT_TYPES[number]

const CONTENT_TYPE_BTN_COLORS: Record<ContentType, { bg: string; color: string; border: string }> = {
  '스토리':   { bg: 'rgba(80,120,200,0.2)', color: '#6090d0', border: 'rgba(80,120,200,0.5)' },
  '거던5층':  { bg: 'rgba(60,160,100,0.15)', color: '#50b878', border: 'rgba(60,160,100,0.5)' },
  '거던10층': { bg: 'rgba(60,160,100,0.2)', color: '#50b878', border: 'rgba(60,160,100,0.5)' },
  '거던15층': { bg: 'rgba(60,160,100,0.25)', color: '#50b878', border: 'rgba(60,160,100,0.5)' },
  '거굴철':   { bg: 'rgba(200,70,70,0.2)', color: '#d06060', border: 'rgba(200,70,70,0.5)' },
}

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

type Tab = 'identity' | 'ego' | 'skillset' | 'order' | 'note'

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

export default function DeckBuilderClient({ sinners, identities, egos, skills, passives, egoGifts = [], editMode, forkMode }: Props) {
  const { keywords: kwContext, getIconUrl: kwGetIconUrl } = useKeywordData()
  const router = useRouter()
  const initData = editMode ?? forkMode
  const [tab, setTab] = useState<Tab>('identity')
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
  const [modalSinnerId, setModalSinnerId] = useState<string | null>(null)
  const [modalGrade, setModalGrade] = useState<string | null>(null)
  const [title, setTitle] = useState(forkMode ? `${forkMode.title} (포크)` : editMode?.title ?? '')
  const [contentType, setContentType] = useState<string>(initData?.content_type && initData.content_type !== '없음' ? initData.content_type : '')
  const [description, setDescription] = useState(initData?.description ?? '')
  const [saving, setSaving] = useState(false)
  const { toast, showToast } = useToast()
  const [showCostDetail, setShowCostDetail] = useState(false)
  const [showIdentityDetail, setShowIdentityDetail] = useState(false)
  const [descPreview, setDescPreview] = useState(false)
  const [gacksungSlots, setGacksungSlots] = useState<Record<string, boolean>>(initData?.gacksungSlots ?? {})
  const [skillDistribution, setSkillDistribution] = useState<Record<string, [number, number, number]>>(initData?.skillDistribution ?? {})
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [codeInput, setCodeInput] = useState('')
  const [codeCopied, setCodeCopied] = useState(false)
  const [codeApplying, setCodeApplying] = useState(false)
  const [codeError, setCodeError] = useState(false)
  const { status: authStatus } = useSession()
  const [draftSaved, setDraftSaved] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)
  const [showPassiveDetail, setShowPassiveDetail] = useState(false)
  const [showGiftPanel, setShowGiftPanel] = useState(false)
  const [giftTabKw, setGiftTabKw] = useState('전체')
  const [giftSearch, setGiftSearch] = useState('')
  const [giftGradeFilter, setGiftGradeFilter] = useState('전체')
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

  const atkTypeTotals = useMemo(() => {
    const totals: Record<string, number> = { slash: 0, pierce: 0, blunt: 0 }
    for (const identity of Object.values(deckSlots)) {
      if (!identity) continue
      for (const sk of skillsByIdentityId[identity.id] ?? []) {
        if (sk.skill_type in totals) totals[sk.skill_type]++
      }
    }
    return totals
  }, [deckSlots, skillsByIdentityId])

  const sinCostTotals = useMemo(() => {
    const totals = [0, 0, 0, 0, 0, 0, 0]
    for (const sinnerSlots of Object.values(egoSlots)) {
      for (const ego of Object.values(sinnerSlots)) {
        if (ego.cost) {
          for (let i = 0; i < 7; i++) totals[i] += ego.cost[i] ?? 0
        }
      }
    }
    return totals
  }, [egoSlots])

  const skillTokenLookup = useMemo(() => {
    const map: Record<string, NoteSkillEntry> = {}
    for (const identity of Object.values(deckSlots)) {
      if (!identity) continue
      const sinnerName = sinners.find(s => s.id === identity.sinner_id)?.name_kr ?? identity.name_kr
      const idSkills = skillsByIdentityId[identity.id] ?? []
      const imgIdx = computeSkillImageIndices(idSkills)
      const orderCount: Record<number, number> = {}
      for (const sk of idSkills) {
        const baseOrder = sk.skill_order >= 5 ? 3 : sk.skill_order
        const subIdx = orderCount[baseOrder] || 0
        orderCount[baseOrder] = subIdx + 1
        const key = subIdx === 0
          ? `${sinnerName}:${baseOrder}`
          : `${sinnerName}:${baseOrder}:${subIdx}`
        const entry = {
          name: sk.name, skill_type: sk.skill_type, sin_affinity: sk.sin_affinity as string,
          skill_order: sk.skill_order, description: sk.description,
          iconUrl: getSkillIconUrl(identity, imgIdx[sk.id] ?? sk.skill_order),
          identityName: identity.name_kr, sinnerName,
        }
        map[key] = entry
        // 이전 형식 호환
        if (sk.skill_order >= 5) map[`${sinnerName}:${sk.skill_order}`] = entry
      }
    }
    return map
  }, [deckSlots, skillsByIdentityId, sinners])

  const passiveTokenLookup = useMemo(() => {
    const map: Record<string, NotePassiveEntry> = {}
    for (const identity of Object.values(deckSlots)) {
      if (!identity) continue
      const sinnerName = sinners.find(s => s.id === identity.sinner_id)?.name_kr ?? identity.name_kr
      for (const p of passivesByIdentityId[identity.id] ?? []) {
        map[p.name] = {
          name: p.name, sin_affinity: p.sin_affinity,
          sin_count: p.sin_count, active_cond: p.active_cond,
          description: p.description, sinnerName,
          imageUrl: getIdentityInfoUrl(identity) || undefined,
        }
      }
    }
    return map
  }, [deckSlots, passivesByIdentityId, sinners])

  const egoTokenLookup = useMemo(() => {
    const map: Record<string, NoteEgoEntry> = {}
    for (const identity of Object.values(deckSlots)) {
      if (!identity) continue
      const sinnerName = sinners.find(s => s.id === identity.sinner_id)?.name_kr ?? identity.name_kr
      for (const ego of Object.values(egoSlots[identity.sinner_id] ?? {})) {
        const name = ego.name_kr || ego.name
        map[`${sinnerName}:${name}`] = {
          name, grade: ego.grade, sin_affinity: ego.sin_affinity,
          image_url: ego.image_url, sinnerName,
        }
      }
    }
    return map
  }, [deckSlots, egoSlots, sinners])

  // 활성 가능한 EGO 기프트 계산
  const activatableGifts = useMemo(() => {
    const formedIdentities = formationOrder
      .map(sid => deckSlots[sid])
      .filter(Boolean) as Identity[]
    if (formedIdentities.length === 0) return []

    const kwCounts: Record<string, number> = {}
    const affCounts: Record<string, number> = {}

    for (const id of formedIdentities) {
      if (id.keywords) {
        for (const kw of id.keywords) {
          kwCounts[kw] = (kwCounts[kw] ?? 0) + 1
        }
      }
      if (id.affiliation) {
        affCounts[id.affiliation] = (affCounts[id.affiliation] ?? 0) + 1
      }
    }

    type GiftStatus = {
      name: string; keyword: string; grade: string; image_url: string | null
      effect_base: string | null; condition: ActivationCondition
      current: number; met: boolean
    }

    const results: GiftStatus[] = []
    for (const g of egoGifts) {
      const c = g.activation_condition
      if (!c) continue

      let current = 0
      if (c.type === 'keyword') {
        current = kwCounts[c.keyword!] ?? 0
      } else if (c.type === 'multi_keyword') {
        for (const kw of c.keywords!) current += kwCounts[kw] ?? 0
      } else if (c.type === 'affiliation') {
        if (c.affiliations) {
          for (const aff of c.affiliations) current += affCounts[aff] ?? 0
        } else {
          current = affCounts[c.affiliation!] ?? 0
        }
      } else if (c.type === 'skill') {
        continue
      }

      if (current > 0) {
        results.push({
          name: g.name, keyword: g.keyword, grade: g.grade,
          image_url: g.image_url, effect_base: g.effect_base,
          condition: c, current, met: current >= c.count,
        })
      }
    }

    results.sort((a, b) => {
      if (a.met !== b.met) return a.met ? -1 : 1
      return (b.current / b.condition.count) - (a.current / a.condition.count)
    })
    return results
  }, [deckSlots, egoGifts, formationOrder])

  const egoGiftLookup = useMemo(() => {
    const map: Record<string, NoteEgoGiftEntry> = {}
    for (const g of egoGifts) {
      map[g.name] = { name: g.name, keyword: g.keyword, grade: g.grade, image_url: g.image_url, effect_base: g.effect_base }
    }
    return map
  }, [egoGifts])

  const noteAcPool = useMemo((): AutocompleteSuggestion[] => {
    const pool: AutocompleteSuggestion[] = []
    for (const identity of Object.values(deckSlots)) {
      if (!identity) continue
      const sinnerName = sinners.find(s => s.id === identity.sinner_id)?.name_kr ?? identity.name_kr
      const idSkills = skillsByIdentityId[identity.id] ?? []
      const imgIdx = computeSkillImageIndices(idSkills)
      const acOrderCount: Record<number, number> = {}
      for (const sk of idSkills) {
        const baseOrder = sk.skill_order >= 5 ? 3 : sk.skill_order
        const subIdx = acOrderCount[baseOrder] || 0
        acOrderCount[baseOrder] = subIdx + 1
        const sc = SIN_COLORS[sk.sin_affinity] || '#888'
        const orderLabel = subIdx === 0 ? getSkillOrderLabel(baseOrder, sk.skill_type) : `${getSkillOrderLabel(baseOrder, sk.skill_type)}-${subIdx + 1}`
        const token = subIdx === 0
          ? `[s:${sinnerName}:${baseOrder}]`
          : `[s:${sinnerName}:${baseOrder}:${subIdx}]`
        pool.push({
          label: `${orderLabel} ${sk.name}`, type: 'skill', typeLabel: '스킬', color: sc,
          iconUrl: getSkillIconUrl(identity, imgIdx[sk.id] ?? sk.skill_order),
          token,
        })
      }
    }
    for (const identity of Object.values(deckSlots)) {
      if (!identity) continue
      for (const p of passivesByIdentityId[identity.id] ?? []) {
        const sinEn = p.sin_affinity ? (SIN_COLORS as Record<string, string>)[p.sin_affinity] : undefined
        pool.push({
          label: p.name, type: 'passive', typeLabel: '패시브', color: sinEn || '#88a830',
          token: `[p:${p.name}]`,
        })
      }
    }
    for (const identity of Object.values(deckSlots)) {
      if (!identity) continue
      const sinnerName = sinners.find(s => s.id === identity.sinner_id)?.name_kr ?? identity.name_kr
      for (const ego of Object.values(egoSlots[identity.sinner_id] ?? {})) {
        const name = ego.name_kr || ego.name
        const sc = ego.sin_affinity ? (SIN_COLORS[ego.sin_affinity] ?? '#c8900a') : '#c8900a'
        pool.push({
          label: name, type: 'ego', typeLabel: 'E.G.O', color: sc,
          imageUrl: ego.image_url ?? undefined,
          token: `[e:${sinnerName}:${name}]`,
        })
      }
    }
    pool.push(...buildKeywordPool(kwContext))
    pool.push(...buildEgoGiftPool(egoGifts))
    return pool
  }, [deckSlots, skillsByIdentityId, passivesByIdentityId, egoSlots, sinners, egoGifts])

  const noteAc = useNoteAutocomplete({
    text: description,
    setText: setDescription,
    textareaRef,
    pool: noteAcPool,
  })

  const identityCount = Object.values(deckSlots).filter(Boolean).length
  const egoCount = Object.values(egoSlots).reduce((s, g) => s + Object.keys(g).length, 0)
  const skillsetCustomCount = useMemo(() => {
    return Object.entries(skillDistribution).filter(([sinnerId, dist]) => {
      if (!deckSlots[sinnerId]) return false
      return !(dist[0] === 3 && dist[1] === 2 && dist[2] === 1)
    }).length
  }, [skillDistribution, deckSlots])

  const modalSinner = sinners.find(s => s.id === modalSinnerId)
  const modalIdentities = modalSinnerId ? identities.filter(i => i.sinner_id === modalSinnerId) : []
  const modalEgos = modalSinnerId ? egos.filter(e => e.sinner_id === modalSinnerId) : []

  const handleIdentitySelect = (identity: Identity) => {
    if (!modalSinnerId) return
    setDeckSlots(prev => {
      if (prev[modalSinnerId]?.id === identity.id) {
        const next = { ...prev }; delete next[modalSinnerId]; return next
      }
      return { ...prev, [modalSinnerId]: identity }
    })
    setModalSinnerId(null)
  }

  const handleGradeClick = (sinnerId: string, grade: string) => {
    setModalSinnerId(sinnerId)
    setModalGrade(grade)
  }

  const closeEgoModal = () => {
    setModalSinnerId(null)
    setModalGrade(null)
  }

  const handleEgoSelect = (ego: EGO) => {
    if (!modalSinnerId) return
    setEgoSlots(prev => {
      const sinnerSlots: Record<string, EGO> = prev[modalSinnerId] ?? {}
      if (sinnerSlots[ego.grade]?.id === ego.id) {
        const next = { ...sinnerSlots }
        delete next[ego.grade]
        return { ...prev, [modalSinnerId]: next } as Record<string, Record<string, EGO>>
      }
      return { ...prev, [modalSinnerId]: { ...sinnerSlots, [ego.grade]: ego } } as Record<string, Record<string, EGO>>
    })
    closeEgoModal()
  }

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
      body: JSON.stringify({ title, description, tags: [], content_type: contentType, identitySlots, egoSlots: egoRows }),
    })
    setSaving(false)
    if (res.ok) {
      router.push(editMode ? `/decks/${editMode.deckId}` : '/decks')
    } else {
      const data = await res.json().catch(() => null)
      showToast(data?.error ?? (editMode ? '덱 수정에 실패했습니다.' : '덱 저장에 실패했습니다.'))
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

  const inputStyle = { background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: '#e8e4d8' } as const

  const TABS: { key: Tab; label: string; badge?: number; icon: React.ReactNode }[] = [
    { key: 'identity', label: '인격 편성', badge: identityCount || undefined, icon: <Users size={14} /> },
    { key: 'ego',      label: '에고 편성', badge: egoCount || undefined, icon: <Sparkles size={14} /> },
    ...(isGeodun(contentType) ? [{ key: 'skillset' as Tab, label: '스킬 편성', badge: skillsetCustomCount || undefined, icon: <SlidersHorizontal size={14} /> }] : []),
    { key: 'order',    label: '편성 순서', badge: formationOrder.length || undefined, icon: <ListOrdered size={14} /> },
    { key: 'note',     label: '덱 노트', icon: <FileText size={14} /> },
  ]

  return (
    <div className="min-h-screen pt-20 pb-16">
      {/* 헤더 */}
      <div className="px-6 max-w-5xl mx-auto mb-5 flex flex-wrap items-center gap-3 sm:gap-4" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
        <Link href="/decks" className="text-sm transition-colors hover:text-yellow-300" style={{ color: '#888888' }}>← 뒤로</Link>
        <h1 className="font-serif text-2xl font-bold" style={{ color: 'var(--gold)' }}>{editMode ? '덱 수정' : '덱 편성'}</h1>
        <div className="flex-1 hidden sm:block" />
        <input
          type="text"
          placeholder="덱 제목 *"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="px-3 py-1.5 rounded text-sm outline-none w-full sm:w-auto"
          style={{ ...inputStyle, maxWidth: '260px' }}
          onFocus={e => (e.target.style.borderColor = 'var(--gold)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border)')}
        />
        {hasDraft && (
          <button
            onClick={handleLoadDraft}
            className="px-3 py-1.5 rounded text-sm transition-all"
            style={{ color: '#88aacc', border: '1px solid rgba(136,170,204,0.3)', background: 'rgba(136,170,204,0.08)' }}
          >
            초안 불러오기
          </button>
        )}
        <button
          onClick={handleSaveDraft}
          disabled={!title.trim()}
          className="px-5 py-1.5 rounded font-medium text-sm transition-all duration-200 disabled:opacity-40"
          style={{ background: draftSaved ? 'rgba(136,204,136,0.2)' : 'rgba(200,144,10,0.15)', color: draftSaved ? '#88cc88' : 'var(--gold)', border: `1px solid ${draftSaved ? '#88cc8855' : 'rgba(200,144,10,0.4)'}` }}
        >
          {draftSaved ? '✓ 임시 저장됨' : '임시 저장'}
        </button>
        {authStatus === 'authenticated' && (
          <button
            onClick={handleSave}
            disabled={!title.trim() || identityCount < 12 || !contentType || saving}
            title={!contentType ? '콘텐츠 유형을 선택해주세요' : identityCount < 12 ? `12명 전원 인격을 편성해야 합니다 (${identityCount}/12)` : ''}
            className="px-5 py-1.5 rounded font-medium text-sm transition-all duration-200 disabled:opacity-40 hover:brightness-110"
            style={{ background: 'var(--gold)', color: 'var(--bg-deep)' }}
          >
            {saving ? '저장 중...' : editMode ? '저장' : '업로드'}
          </button>
        )}
      </div>

      <div className="px-4 sm:px-6 max-w-5xl mx-auto">
        {/* 편성 코드 바 */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4">
          <input
            type="text"
            value={codeInput}
            onChange={e => { setCodeInput(e.target.value); setCodeError(false) }}
            placeholder="편성 코드 붙여넣기..."
            className="px-3 sm:px-4 py-2 sm:py-2.5 rounded outline-none flex-1"
            style={{ ...inputStyle, minWidth: '120px', maxWidth: '420px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}
            onKeyDown={e => { if (e.key === 'Enter') handleApplyCode() }}
          />
          <button
            onClick={handleApplyCode}
            disabled={!codeInput.trim() || codeApplying}
            className="px-3 sm:px-4 py-2 sm:py-2.5 rounded text-xs sm:text-sm font-medium transition-all disabled:opacity-40"
            style={{ background: 'rgba(200,144,10,0.15)', color: 'var(--gold)', border: '1px solid rgba(200,144,10,0.3)' }}
          >
            {codeApplying ? '...' : '적용'}
          </button>
          {codeError && (
            <span style={{ color: '#cc4444', fontSize: '0.75rem' }}>오류</span>
          )}
          <button
            onClick={handleCopyCode}
            disabled={identityCount < 12}
            className="px-3 sm:px-4 py-2 sm:py-2.5 rounded text-xs sm:text-sm transition-all disabled:opacity-30 ml-auto"
            style={{
              color: codeCopied ? '#88cc88' : '#6a6a80',
              border: `1px solid ${codeCopied ? '#88cc8855' : 'var(--border)'}`,
              background: codeCopied ? 'rgba(136,204,136,0.08)' : 'transparent',
            }}
            title={identityCount < 12 ? '12명 전원 인격을 편성해야 코드를 복사할 수 있습니다' : ''}
          >
            {codeCopied ? '✓ 복사됨' : '코드 복사'}
          </button>
        </div>

        {/* 콘텐츠 유형 선택 */}
        <div className="flex items-center gap-2 mb-4">
          <span style={{ color: '#555570', fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', flexShrink: 0 }}>콘텐츠</span>
          <div className="flex gap-1.5 flex-wrap">
            {CONTENT_TYPES.map(ct => {
              const active = contentType === ct
              const colors = CONTENT_TYPE_BTN_COLORS[ct]
              return (
                <button
                  key={ct}
                  type="button"
                  onClick={() => setContentType(active ? '' : ct)}
                  className="px-3 py-1.5 rounded transition-all duration-150"
                  style={{
                    background: active ? colors.bg : 'transparent',
                    color: active ? colors.color : '#555566',
                    border: `1px solid ${active ? colors.border : 'var(--border)'}`,
                    fontFamily: 'var(--font-heading)',
                    fontSize: '0.75rem',
                    fontWeight: active ? 700 : 500,
                    boxShadow: active ? `0 0 8px ${colors.color}25` : 'none',
                  }}
                >
                  {ct}
                </button>
              )
            })}
          </div>
          {!contentType && (
            <span style={{ color: '#cc8844', fontSize: '0.625rem', opacity: 0.7 }}>* 필수</span>
          )}
        </div>

        {/* 탭 바 — 세그먼트 컨트롤 */}
        <div
          className="flex mb-7 overflow-x-auto"
          style={{
            background: 'rgba(10,8,5,0.6)',
            border: '1px solid var(--border)',
            borderRadius: '0.5rem',
            padding: '0.25rem',
            gap: '0.125rem',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
          }}
        >
          {TABS.map(({ key, label, badge, icon }) => {
            const isActive = tab === key
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-medium transition-all duration-200 whitespace-nowrap flex-1"
                style={{
                  color: isActive ? '#0d0b08' : '#666660',
                  background: isActive
                    ? 'linear-gradient(135deg, var(--gold) 0%, #e8b030 100%)'
                    : 'transparent',
                  borderRadius: '0.375rem',
                  boxShadow: isActive ? '0 0.125rem 0.5rem rgba(200,144,10,0.3)' : 'none',
                  fontFamily: 'var(--font-heading)',
                  fontSize: '0.75rem',
                  minWidth: 0,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', opacity: isActive ? 1 : 0.5 }}>{icon}</span>
                <span className="hidden sm:inline">{label}</span>
                {badge !== undefined && (
                  <span
                    style={{
                      background: isActive ? 'rgba(13,11,8,0.25)' : '#2a2015',
                      color: isActive ? '#0d0b08' : '#666655',
                      fontSize: '0.5625rem',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      borderRadius: '0.375rem',
                      padding: '0.0625rem 0.3125rem',
                      lineHeight: 1.4,
                    }}
                  >
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* 탭 콘텐츠 */}
        {tab === 'identity' && (
          <IdentityTab
            sinners={sinners}
            deckSlots={deckSlots}
            onCardClick={setModalSinnerId}
            gacksungSlots={gacksungSlots}
            onGacksungToggle={handleGacksungToggle}
          />
        )}
        {tab === 'ego' && (
          <EgoTab
            sinners={sinners}
            egoSlots={egoSlots}
            onGradeClick={handleGradeClick}
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
        {tab === 'order' && (
          <OrderTab
            sinners={sinners}
            deckSlots={deckSlots}
            formationOrder={formationOrder}
            onToggle={handleFormationToggle}
          />
        )}

        {/* 정보 패널 (note 탭 제외) */}
        {tab !== 'note' && (
          <DeckPreviewPanel
            sinners={sinners}
            deckSlots={deckSlots}
            egoSlots={egoSlots}
            skillsByIdentityId={skillsByIdentityId}
            passivesByIdentityId={passivesByIdentityId}
            sinCostTotals={sinCostTotals}
            atkTypeTotals={atkTypeTotals}
            activatableGifts={activatableGifts}
            contentType={contentType}
            showCostDetail={showCostDetail}
            setShowCostDetail={setShowCostDetail}
            showIdentityDetail={showIdentityDetail}
            setShowIdentityDetail={setShowIdentityDetail}
            showPassiveDetail={showPassiveDetail}
            setShowPassiveDetail={setShowPassiveDetail}
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
            deckSlots={deckSlots}
            egoSlots={egoSlots}
            skillsByIdentityId={skillsByIdentityId}
            passivesByIdentityId={passivesByIdentityId}
            description={description}
            setDescription={setDescription}
            descPreview={descPreview}
            setDescPreview={setDescPreview}
            textareaRef={textareaRef}
            noteAc={noteAc}
            skillTokenLookup={skillTokenLookup}
            passiveTokenLookup={passiveTokenLookup}
            egoTokenLookup={egoTokenLookup}
            egoGiftLookup={egoGiftLookup}
          />
        )}
      </div>

      {/* ── 인격 선택 모달 ──────────────────────────────── */}
      {modalSinnerId && tab === 'identity' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.82)' }} onClick={() => setModalSinnerId(null)}>
          <div className="card flex flex-col" style={{ width: '600px', maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
              <div>
                <h2 className="font-serif font-light" style={{ color: 'var(--gold)', fontSize: '1.125rem' }}>{modalSinner?.name_kr}</h2>
                <p style={{ color: '#888888', fontSize: '0.6875rem', marginTop: '2px' }}>인격을 선택하세요</p>
              </div>
              <div className="flex items-center gap-3">
                {deckSlots[modalSinnerId] && (
                  <button
                    onClick={() => { setDeckSlots(prev => { const n = { ...prev }; delete n[modalSinnerId]; return n }); setModalSinnerId(null) }}
                    className="text-xs px-3 py-1.5 rounded transition-all hover:bg-red-900/20"
                    style={{ color: '#cc4444', border: '1px solid rgba(200,48,32,0.3)' }}
                  >편성 해제</button>
                )}
                <button onClick={() => setModalSinnerId(null)} style={{ color: '#888888', fontSize: '1.375rem', lineHeight: 1, padding: '0 4px' }}>✕</button>
              </div>
            </div>
            <div className="overflow-y-auto px-5 py-5 flex-1">
              {modalIdentities.length === 0 ? (
                <p className="text-center py-12" style={{ color: '#6a6a80' }}>등록된 인격이 없습니다</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-8">
                  {modalIdentities.map(identity => (
                    <IdentityCard key={identity.id} identity={identity} compact selected={deckSlots[modalSinnerId]?.id === identity.id} onClick={() => handleIdentitySelect(identity)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 에고 선택 모달 ──────────────────────────────── */}
      {modalSinnerId && modalGrade && tab === 'ego' && (() => {
        const gc = GRADE_COLORS[modalGrade] ?? '#667788'
        const gradeEgos = modalEgos.filter(e => e.grade === modalGrade)
        const currentEgo = egoSlots[modalSinnerId]?.[modalGrade]
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.82)' }} onClick={closeEgoModal}>
            <div className="card flex flex-col" style={{ width: '480px', maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-3">
                  {modalGrade !== 'ALEPH' ? (
                    <Image src={`${STORAGE_BASE}/icons/grade/${modalGrade}.webp`} alt={modalGrade} width={32} height={16} unoptimized style={{ height: '16px', width: 'auto', opacity: 0.9 }} />
                  ) : (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', color: gc, letterSpacing: '0.1em' }}>ALEPH</span>
                  )}
                  <div>
                    <h2 className="font-serif font-light" style={{ color: 'var(--gold)', fontSize: '1.0625rem' }}>{modalSinner?.name_kr}</h2>
                    <p style={{ color: gc, fontSize: '0.625rem', marginTop: '1px', fontFamily: 'var(--font-mono)' }}>{modalGrade} E.G.O</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {currentEgo && (
                    <button
                      onClick={() => {
                        setEgoSlots(prev => {
                          const s = { ...(prev[modalSinnerId] ?? {}) }
                          delete s[modalGrade]
                          return { ...prev, [modalSinnerId]: s } as Record<string, Record<string, EGO>>
                        })
                        closeEgoModal()
                      }}
                      className="text-xs px-3 py-1.5 rounded transition-all hover:bg-red-900/20"
                      style={{ color: '#cc4444', border: '1px solid rgba(200,48,32,0.3)' }}
                    >해제</button>
                  )}
                  <button onClick={closeEgoModal} style={{ color: '#888888', fontSize: '1.375rem', lineHeight: 1, padding: '0 4px' }}>✕</button>
                </div>
              </div>
              <div className="overflow-y-auto px-5 py-5 flex-1">
                {gradeEgos.length === 0 ? (
                  <p className="text-center py-12" style={{ color: '#6a6a80' }}>이 등급의 E.G.O가 없습니다</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-5">
                    {gradeEgos.map(ego => {
                      const sinColor = ego.sin_affinity ? (SIN_COLORS[ego.sin_affinity as SinType] ?? gc) : gc
                      const isSelected = currentEgo?.id === ego.id
                      return (
                        <button
                          key={ego.id}
                          onClick={() => handleEgoSelect(ego)}
                          className="flex flex-col items-center gap-2"
                          style={{ cursor: 'pointer' }}
                        >
                          <div style={{
                            position: 'relative', width: '90px', height: '90px',
                            borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                            border: `2px solid ${isSelected ? sinColor : sinColor + '55'}`,
                            boxShadow: isSelected ? `0 0 16px ${sinColor}80` : `0 0 6px ${sinColor}25`,
                            background: '#0d0a06', transition: 'all 0.2s',
                          }}>
                            {ego.image_url
                              ? <Image src={ego.image_url} alt="" fill className="object-cover" style={{ objectPosition: '50% 10%' }} sizes="90px" />
                              : <div className="w-full h-full flex items-center justify-center"><span style={{ fontFamily: 'monospace', color: gc, fontSize: '0.75rem' }}>{ego.grade?.[0]}</span></div>
                            }
                          </div>
                          <p className="font-serif font-light leading-snug text-center" style={{ color: isSelected ? '#f0d060' : '#c8a450', fontSize: '0.75rem' }}>{ego.name_kr || ego.name}</p>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}
      <Toast toast={toast} />

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
