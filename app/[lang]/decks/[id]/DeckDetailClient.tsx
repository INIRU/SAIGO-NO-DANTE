'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/lib/i18n/navigation'
import { useSession } from 'next-auth/react'
import { ArrowLeft, Heart, Bookmark, Share2, GitFork, Copy, Check } from 'lucide-react'
import { showSuccess, showError } from '@/lib/toast'
import { STORAGE_BASE } from '@/lib/constants/game'
import { SIN_COLORS, SIN_KR_TO_EN, SIN_ORDER, normalizeSin } from '@/lib/constants/sin'
import { getSinnerLogoUrl, computeSkillImageIndices } from '@/lib/utils/images'
import type { Identity, Skill } from '@/lib/types'
import { computeFormationGiftKeywordCounts, type DeckKeywordSlot } from '@/lib/decks/keyword-rules'
import { NoteRenderer, type NoteSkillEntry, type NotePassiveEntry, type NoteEgoEntry, type NoteEgoGiftEntry, type NoteIdentityEntry } from '@/components/decks/NoteChips'
import CompactButton from '@/components/ui/CompactButton'
import SectionBlock from '@/components/ui/SectionBlock'
import {
  localizeEgoName,
  localizeIdentityName,
  localizePassiveDescription,
  localizePassiveName,
  localizeSkillDescription,
  localizeSkillName,
  type EgoEntry,
  type IdentityDetail,
  type IdentitySlot,
} from '@/components/deck-detail/DeckIdentityCard'
import IdentityCard from '@/components/sinners/IdentityCard'
import DeckPassivePanel from '@/components/deck-detail/DeckPassivePanel'
import DeckRecommendations, { type DeckRecommendationsData } from '@/components/deck-detail/DeckRecommendations'
import { DeckSidebarPanel, DeckMobileActionBar } from '@/components/deck-detail/DeckDetailHeader'
import DeckComments from '@/components/deck-detail/DeckComments'
import { getGiftActivationConditionStatus } from '@/components/planner/PlannerGiftModal'
import type { SupportedLang } from '@/lib/i18n/types'

const IdentityDetailModal = dynamic(() => import('@/components/ui/IdentityDetailModal'), { ssr: false })
const DeckIdentityPreviewModal = dynamic(() => import('@/components/deck-detail/DeckIdentityPreviewModal'), { ssr: false })
const EgoDetailModal = dynamic(() => import('@/components/ui/EgoDetailModal'), { ssr: false })

const postedDeckViews = new Set<string>()

// ── 타입 ──────────────────────────────────────────────────────────────────
type EgoSlot = {
  grade: string
  ego: {
    id: string
    name?: string | null
    name_kr: string | null
    name_en?: string | null
    name_jp?: string | null
    grade: string
    sin_affinity: string | null
    sinner_id: string
    folder_name: string | null
    image_url: string | null
    cost: number[] | null
    ego_skills?: EgoAttackSkill[] | null
  } | null
}

type EgoAttackSkill = {
  skill_type: string | null
  category?: string | null
  construe_level?: number | null
  skill_order?: number | null
}

type SinnerEgo = {
  sinner_id: string
  id?: string | null
  name?: string | null
  name_kr: string | null
  name_en?: string | null
  name_jp?: string | null
  grade: string
  sin_affinity: string | null
  image_url: string | null
}

type DeckDetail = {
  id: string
  title: string
  description: string | null
  tags: string[]
  content_type?: string
  vote_count: number
  view_count: number
  created_at: string
  deck_code?: string
  is_owner?: boolean
  is_admin?: boolean
  profiles: { username: string } | null
  deck_identities: IdentitySlot[]
  deck_egos?: EgoSlot[]
  all_sinner_egos?: SinnerEgo[]
}

// ── 상수 ──────────────────────────────────────────────────────────────────
import { THEME_KEYWORDS, normalizeThemeKeyword } from '@/lib/constants/keywords'
const THEME_KW_SET = new Set<string>(THEME_KEYWORDS)

const SELECTED_BANNER_URL = `${STORAGE_BASE}/icons/ui/identity-selected-banner.webp`
const BACKUP_BANNER_URL = `${STORAGE_BASE}/icons/ui/identity-backup-banner.webp`
const BOARD_SLOT_COUNT = 12
const FRONTLINE_SLOT_COUNT = 7
const BASE_SKILL_PRODUCTION_WEIGHT: Record<number, number> = { 1: 3, 2: 2, 3: 1 }
const EGO_GRADE_ORDER = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH']
type AttackType = 'slash' | 'pierce' | 'blunt'

// ── 헬퍼 ──────────────────────────────────────────────────────────────────
function sinColor(sin: string, isKr = false): string {
  const en = isKr ? (SIN_KR_TO_EN[sin] ?? sin) : sin
  return SIN_COLORS[en as keyof typeof SIN_COLORS] ?? '#888888'
}

function createSinTotals(): Record<string, number> {
  return Object.fromEntries(SIN_ORDER.map((sin) => [sin, 0])) as Record<string, number>
}

function normalizeAttackType(value: string | null | undefined): AttackType | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  const mapped: Record<string, AttackType> = {
    slash: 'slash',
    pierce: 'pierce',
    penetrate: 'pierce',
    blunt: 'blunt',
    hit: 'blunt',
    '참격': 'slash',
    '관통': 'pierce',
    '타격': 'blunt',
  }
  return mapped[normalized] ?? null
}

function getSkillAttackType(skill: Pick<IdentityDetail['skills'][number], 'atk_type' | 'skill_type'>): AttackType | null {
  return normalizeAttackType(skill.atk_type ?? skill.skill_type)
}

function getBaseProductionSkills(skills: IdentityDetail['skills']): IdentityDetail['skills'] {
  const bestByOrder = new Map<number, IdentityDetail['skills'][number]>()

  for (const skill of skills) {
    if (!BASE_SKILL_PRODUCTION_WEIGHT[skill.skill_order]) continue
    if (!normalizeSin(skill.sin_affinity)) continue

    const existing = bestByOrder.get(skill.skill_order)
    const variantOrder = skill.variant_order ?? 0
    const existingVariantOrder = existing?.variant_order ?? 0
    const isEarlierBaseVariant = !existing || variantOrder < existingVariantOrder
    const isSameVariantHigherUptie =
      existing &&
      variantOrder === existingVariantOrder &&
      (skill.uptie_level ?? 0) > (existing.uptie_level ?? 0)

    if (isEarlierBaseVariant || isSameVariantHigherUptie) {
      bestByOrder.set(skill.skill_order, skill)
    }
  }

  return [...bestByOrder.values()].sort((a, b) => a.skill_order - b.skill_order)
}

function buildSinProductionTotals(slots: IdentitySlot[]): Record<string, number> {
  const totals = createSinTotals()

  for (const slot of slots) {
    if (!slot.identities) continue
    for (const skill of getBaseProductionSkills(slot.identities.skills)) {
      const sin = normalizeSin(skill.sin_affinity)
      if (!sin) continue
      totals[sin] += BASE_SKILL_PRODUCTION_WEIGHT[skill.skill_order] ?? 0
    }
  }

  return totals
}

function buildEgoCostTotals(deckEgos: EgoSlot[] | undefined): Record<string, number> {
  const totals = createSinTotals()

  for (const row of deckEgos ?? []) {
    const costs = row.ego?.cost
    if (!Array.isArray(costs)) continue

    SIN_ORDER.forEach((sin, index) => {
      const cost = costs[index] ?? 0
      if (cost > 0) totals[sin] += cost
    })
  }

  return totals
}

function getCountedIdentityAttackSkills(skills: IdentityDetail['skills']): IdentityDetail['skills'] {
  const bestBySkillKey = new Map<string, IdentityDetail['skills'][number]>()

  for (const skill of skills) {
    const variantOrder = skill.variant_order ?? 0
    const key = `${skill.skill_order}:${variantOrder}`
    const existing = bestBySkillKey.get(key)
    if (!existing || (skill.uptie_level ?? 0) > (existing.uptie_level ?? 0)) {
      bestBySkillKey.set(key, skill)
    }
  }

  return [...bestBySkillKey.values()]
}

function addEgoAttackTypeTotals(totals: Record<AttackType, number>, egoSkills: EgoAttackSkill[] | null | undefined): void {
  const uniqueSkills = new Map<string, EgoAttackSkill>()

  for (let index = 0; index < (egoSkills?.length ?? 0); index++) {
    const skill = egoSkills?.[index]
    if (!skill) continue
    const attackType = normalizeAttackType(skill.skill_type)
    if (!attackType) continue
    const key = `${skill.category ?? 'awakening'}:${skill.skill_order ?? index}:${attackType}`
    const existing = uniqueSkills.get(key)
    if (!existing || (skill.construe_level ?? 0) > (existing.construe_level ?? 0)) {
      uniqueSkills.set(key, skill)
    }
  }

  for (const skill of uniqueSkills.values()) {
    const attackType = normalizeAttackType(skill.skill_type)
    if (attackType) totals[attackType]++
  }
}

function buildAttackTypeTotals(slots: IdentitySlot[], deckEgos: EgoSlot[] | undefined): Record<AttackType, number> {
  const totals: Record<AttackType, number> = { slash: 0, pierce: 0, blunt: 0 }

  for (const slot of slots) {
    if (!slot.identities) continue
    for (const skill of getCountedIdentityAttackSkills(slot.identities.skills)) {
      const attackType = getSkillAttackType(skill)
      if (attackType) totals[attackType]++
    }
  }

  for (const row of deckEgos ?? []) {
    addEgoAttackTypeTotals(totals, row.ego?.ego_skills)
  }

  return totals
}

function buildBoardSlots(slots: IdentitySlot[]): (IdentitySlot | null)[] {
  const board: (IdentitySlot | null)[] = Array.from({ length: BOARD_SLOT_COUNT }, () => null)
  const bySinner = new Map<string, IdentitySlot>()

  for (const slot of slots.filter(slot => slot.identities)) {
    const sinnerId = slot.identities!.sinner_id
    const existing = bySinner.get(sinnerId)
    const shouldReplace =
      !existing ||
      (slot.slot_order < 99 && existing.slot_order === 99) ||
      (slot.slot_order < 99 && existing.slot_order < 99 && slot.slot_order < existing.slot_order) ||
      (slot.slot_order === 99 && existing.slot_order === 99 && slot.slot_order < existing.slot_order)

    if (shouldReplace) bySinner.set(sinnerId, slot)
  }

  SINNER_ORDER.forEach((sinnerId, index) => {
    board[index] = bySinner.get(sinnerId) ?? null
  })

  return board
}

function getBoardSlotKind(slot: IdentitySlot | null): 'selected' | 'backup' | 'empty' {
  if (!slot?.identities) return 'empty'
  if (slot.slot_order < FRONTLINE_SLOT_COUNT) return 'selected'
  return slot.slot_order < 99 ? 'backup' : 'empty'
}

function topKeywords(slots: IdentitySlot[]): string[] {
  const formed = slots.filter(s => s.slot_order < 99 && s.identities)
  const total = formed.length
  if (total === 0) return []

  const freq: Record<string, number> = {}
  for (const slot of formed) {
    for (const kw of slot.identities?.keywords ?? []) {
      const nkw = normalizeThemeKeyword(kw)
      if (THEME_KW_SET.has(nkw)) freq[nkw] = (freq[nkw] ?? 0) + 1
    }
  }

  const minCount = total <= 1 ? 1 : Math.max(2, Math.ceil(total * 0.4))
  return Object.entries(freq)
    .filter(([, n]) => n >= minCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([kw]) => kw)
}

function adaptBoardIdentity(identity: IdentityDetail, locale: string): Identity {
  const name = localizeIdentityName(identity, locale)
  return {
    id: identity.id,
    sinner_id: identity.sinner_id,
    name,
    name_kr: identity.name_kr,
    name_en: identity.name_en,
    name_jp: identity.name_jp,
    tier: identity.tier,
    hp: identity.hp ?? 0,
    speed_min: identity.speed_min ?? 0,
    speed_max: identity.speed_max ?? 0,
    def_level: identity.def_level ?? 0,
    keywords: identity.keywords ?? [],
    rarity: identity.rarity,
    slash_res: identity.slash_res ?? undefined,
    pierce_res: identity.pierce_res ?? undefined,
    blunt_res: identity.blunt_res ?? undefined,
    game_id: identity.game_id,
    folder_name: identity.folder_name,
  }
}

const SINNER_ORDER = [
  'yi-sang', 'faust', 'don-quixote', 'ryoshu', 'meursault', 'hong-lu',
  'heathcliff', 'ishmael', 'rodion', 'sinclair', 'outis', 'gregor',
] as const

const SINNER_NAMES: Record<string, string> = {
  'yi-sang': '이상', 'faust': '파우스트', 'don-quixote': '돈키호테',
  'ryoshu': '료슈', 'meursault': '뫼르소', 'hong-lu': '홍루',
  'heathcliff': '히스클리프', 'ishmael': '이스마엘', 'rodion': '로쟈',
  'sinclair': '싱클레어', 'outis': '오티스', 'gregor': '그레고르',
}

function uniqueNames(...names: Array<string | null | undefined>): string[] {
  return [...new Set(names.map(name => name?.trim()).filter((name): name is string => Boolean(name)))]
}

function getNoteSkillBaseOrder(skill: Pick<IdentityDetail['skills'][number], 'skill_order' | 'skill_type'>): number {
  if (['evade', 'defense', 'counter'].includes(skill.skill_type)) return 4
  if (skill.skill_order >= 5) return 3
  return skill.skill_order
}

function buildNoteLookups(
  slots: IdentitySlot[],
  allEgos: SinnerEgo[],
  locale: string,
  localizeSinnerName: (sinnerId: string) => string,
) {
  const skillLookup: Record<string, NoteSkillEntry> = {}
  const passiveLookup: Record<string, NotePassiveEntry> = {}
  const egoLookup: Record<string, NoteEgoEntry> = {}
  const identityLookup: Record<string, NoteIdentityEntry> = {}

  for (const slot of slots) {
    const id_ = slot.identities
    if (!id_) continue
    const koreanSinnerName = SINNER_NAMES[id_.sinner_id] ?? id_.sinner_id
    const localizedSinnerName = localizeSinnerName(id_.sinner_id)
    const sinnerTokenNames = uniqueNames(koreanSinnerName, localizedSinnerName)
    const identityName = localizeIdentityName(id_, locale)
    const identityImageUrl = id_.game_id && id_.folder_name
      ? `${STORAGE_BASE}/sinners/${id_.sinner_id}/identities/${id_.folder_name}/${id_.game_id}_normal_info.webp`
      : undefined

    const identityEntry: NoteIdentityEntry = {
      name: identityName,
      rarity: id_.rarity,
      imageUrl: identityImageUrl,
      sinnerName: localizedSinnerName,
      keywords: id_.keywords ?? undefined,
    }
    for (const sinnerName of sinnerTokenNames) {
      for (const name of uniqueNames(id_.name_kr, id_.name, id_.name_en, id_.name_jp, identityName)) {
        identityLookup[`${sinnerName}:${name}`] = identityEntry
      }
    }

    const rawSk = id_.skills ?? []
    const skBest = new Map<string, typeof rawSk[0]>()
    for (const s of rawSk) {
      const key = `${s.skill_order}:${(s as Record<string, unknown>).variant_order ?? 0}`
      const ex = skBest.get(key)
      if (!ex || (s.uptie_level ?? 3) > (ex.uptie_level ?? 3)) skBest.set(key, s)
    }
    const sortedSkills = [...skBest.values()].sort((a, b) => a.skill_order - b.skill_order || ((a as Record<string, unknown>).variant_order as number ?? 0) - ((b as Record<string, unknown>).variant_order as number ?? 0))
    const frameSkills: Skill[] = sortedSkills.map(skill => ({
      ...skill,
      identity_id: id_.id,
      sin_affinity: (normalizeSin(skill.sin_affinity) ?? 'wrath') as Skill['sin_affinity'],
      description: localizeSkillDescription(skill, locale) ?? skill.description ?? '',
      atk_weight: skill.atk_weight ?? undefined,
      offense_level: skill.offense_level ?? undefined,
      uptie_level: skill.uptie_level ?? undefined,
      variant_order: skill.variant_order ?? undefined,
    }))
    const frameSkillById = new Map(frameSkills.map(skill => [skill.id, skill]))
    const imgIdx = computeSkillImageIndices(sortedSkills)
    const orderCount: Record<number, number> = {}
    for (const sk of sortedSkills) {
      const baseOrder = getNoteSkillBaseOrder(sk)
      const subIdx = orderCount[baseOrder] || 0
      orderCount[baseOrder] = subIdx + 1
      const iconUrl = id_.game_id
        ? `${STORAGE_BASE}/icons/skills/${id_.sinner_id}/${id_.game_id}${String(imgIdx[sk.id] ?? sk.skill_order).padStart(2, '0')}.webp`
        : undefined
      const entry = {
        name: localizeSkillName(sk, locale), skill_type: sk.atk_type ?? sk.skill_type, sin_affinity: sk.sin_affinity,
        skill_order: sk.skill_order, description: localizeSkillDescription(sk, locale),
        iconUrl, identityName, sinnerName: localizedSinnerName,
        skill: frameSkillById.get(sk.id),
        skills: frameSkills,
        identity: { sinner_id: id_.sinner_id, game_id: id_.game_id },
      }
      for (const sinnerName of sinnerTokenNames) {
        const key = subIdx === 0
          ? `${sinnerName}:${baseOrder}`
          : `${sinnerName}:${baseOrder}:${subIdx + 1}`
        skillLookup[key] = entry
        if (subIdx === 1) {
          skillLookup[`${sinnerName}:${baseOrder}:1`] = entry
        }
        // 이전 형식 호환: S3 변형처럼 원래 skill_order로 저장된 토큰도 인식
        if (sk.skill_order !== baseOrder) {
          skillLookup[`${sinnerName}:${sk.skill_order}`] = entry
        }
      }
    }
    const rawPa = id_.passives ?? []
    const paBest = new Map<string, typeof rawPa[0]>()
    for (const p of rawPa) {
      const key = `${p.passive_type}:${p.passive_order}`
      const ex = paBest.get(key)
      if (!ex || (p.uptie_level ?? 3) > (ex.uptie_level ?? 3)) paBest.set(key, p)
    }
    for (const pa of paBest.values()) {
      const entry = {
        name: localizePassiveName(pa, locale), sin_affinity: pa.sin_affinity,
        sin_count: pa.sin_count, active_cond: pa.active_cond,
        description: localizePassiveDescription(pa, locale), sinnerName: localizedSinnerName,
        imageUrl: identityImageUrl,
      }
      for (const passiveName of uniqueNames(pa.name, localizePassiveName(pa, locale))) {
        passiveLookup[passiveName] = entry
      }
    }
  }
  for (const ego of allEgos) {
    const koreanSinnerName = SINNER_NAMES[ego.sinner_id] ?? ego.sinner_id
    const localizedSinnerName = localizeSinnerName(ego.sinner_id)
    const name = localizeEgoName(ego, locale)
    const entry = {
      name, grade: ego.grade, sin_affinity: ego.sin_affinity,
      image_url: ego.image_url, sinnerName: localizedSinnerName,
    }
    for (const sinnerName of uniqueNames(koreanSinnerName, localizedSinnerName)) {
      for (const egoName of uniqueNames(ego.name_kr, ego.name, ego.name_en, ego.name_jp, name)) {
        egoLookup[`${sinnerName}:${egoName}`] = entry
      }
    }
  }
  return { skillLookup, passiveLookup, egoLookup, identityLookup }
}

// ── 스켈레톤 ──────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="min-h-[100dvh]" style={{ background: '#0d0b08' }}>
      <div style={{ height: '360px', background: 'linear-gradient(to bottom, #080604, #0d0b08)' }} />
      <div className="max-w-5xl mx-auto px-4 md:px-6 pt-6 flex gap-5">
        <div className="hidden lg:block" style={{ width: '15.75rem', flexShrink: 0 }}>
          <div className="rounded-lg h-36 mb-3" style={{ background: '#120e09' }} />
          <div className="rounded-lg h-48" style={{ background: '#120e09', opacity: 0.6 }} />
        </div>
        <div className="flex-1 flex flex-col gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-lg" style={{ height: 128, background: '#120e09', opacity: 0.2 + i * 0.15 }} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── 메인 ──────────────────────────────────────────────────────────────────
type Comment = {
  id: string
  content: string
  created_at: string
  user_id: string
  parent_id: string | null
  username: string | null
  avatar_url: string | null
  role?: string
}

type IdentityPreviewState = {
  slot: IdentitySlot
}

type DeckDetailClientProps = {
  id: string
  initialDeck?: DeckDetail | null
  initialComments?: Comment[]
  initialRecommendations?: DeckRecommendationsData | null
}

export default function DeckDetailClient({ id, initialDeck, initialComments, initialRecommendations }: DeckDetailClientProps) {
  const router = useRouter()
  const locale = useLocale() as SupportedLang
  const t = useTranslations('decks.detail')
  const rootT = useTranslations()
  const { status: authStatus } = useSession()

  const [deck, setDeck] = useState<DeckDetail | null>(initialDeck ?? null)
  const [loading, setLoading] = useState(!initialDeck)
  const [voted, setVoted] = useState(false)
  const [voteCount, setVoteCount] = useState(0)
  const [voting, setVoting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [selectedSinner, setSelectedSinner] = useState<string | null>(null)
  const [identityPreview, setIdentityPreview] = useState<IdentityPreviewState | null>(null)
  const [keywordMeta, setKeywordMeta] = useState<Record<string, { description: string }>>({})

  const [bookmarked, setBookmarked] = useState(false)
  const [bookmarking, setBookmarking] = useState(false)

  const [shared, setShared] = useState(false)
  const [shareGenerating, setShareGenerating] = useState(false)

  const [egoGiftLookup, setEgoGiftLookup] = useState<Record<string, NoteEgoGiftEntry>>({})
  const [identityModalId, setIdentityModalId] = useState<string | null>(null)
  const [egoModalId, setEgoModalId] = useState<string | null>(null)

  useEffect(() => {
    const viewKey = `deck-view:${id}`
    if (postedDeckViews.has(viewKey)) return
    postedDeckViews.add(viewKey)

    fetch(`/api/decks/${id}/view`, {
      method: 'POST',
      cache: 'no-store',
      keepalive: true,
    }).catch(() => {})
  }, [id])

  useEffect(() => {
    fetch('/api/keyword-meta')
      .then(r => r.ok ? r.json() : [])
      .then((rows: { name: string; description: string }[]) => {
        const map: Record<string, { description: string }> = {}
        for (const r of rows) map[r.name] = { description: r.description }
        setKeywordMeta(map)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/ego-gifts')
      .then(r => r.ok ? r.json() : [])
      .then((gifts: NoteEgoGiftEntry[]) => {
        const map: Record<string, NoteEgoGiftEntry> = {}
        for (const g of gifts) map[g.name] = g
        setEgoGiftLookup(map)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false

    fetch(`/api/decks/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled || !data || data.error) return

        const fixed: DeckDetail = {
          ...data,
          deck_identities: (data.deck_identities ?? []).map((slot: IdentitySlot & { identities: unknown }) => ({
            ...slot,
            identities: Array.isArray(slot.identities)
              ? (slot.identities[0] as IdentityDetail | undefined) ?? null
              : slot.identities as unknown as IdentityDetail | null,
          })),
          deck_egos: (data.deck_egos ?? []).map((es: EgoSlot & { ego: unknown }) => ({
            ...es,
            ego: Array.isArray(es.ego)
              ? (es.ego[0] as EgoSlot['ego'] | undefined) ?? null
              : es.ego as EgoSlot['ego'],
          })),
        }
        // If we already have initialDeck, only patch the fields the server-side
        // prefetch doesn't include (deck_code, is_owner, is_admin, all_sinner_egos).
        // This avoids replacing identity/ego data that is already rendered.
        if (initialDeck) {
          setDeck(prev => prev ? {
            ...prev,
            deck_code: fixed.deck_code,
            is_owner: fixed.is_owner,
            is_admin: fixed.is_admin,
            all_sinner_egos: fixed.all_sinner_egos ?? [],
            vote_count: fixed.vote_count,
            view_count: fixed.view_count,
          } : fixed)
        } else {
          setDeck(fixed)
        }
        setVoteCount(data.vote_count ?? 0)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Failed to fetch deck detail:', err)
        if (!initialDeck) showError(t('loadFailed'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id, initialDeck, t])

  useEffect(() => {
    if (authStatus !== 'authenticated') return
    fetch(`/api/decks/${id}/vote`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setVoted(data.voted) })
      .catch(() => {})
  }, [id, authStatus])

  useEffect(() => {
    if (authStatus !== 'authenticated') return
    fetch(`/api/decks/${id}/bookmark`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setBookmarked(data.bookmarked) })
      .catch(() => {})
  }, [id, authStatus])

  const handleVote = useCallback(async () => {
    if (authStatus !== 'authenticated' || voting) return
    setVoting(true)
    try {
      const res = await fetch(`/api/decks/${id}/vote`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setVoted(data.voted)
        setVoteCount(c => data.voted ? c + 1 : c - 1)
        router.refresh()
      } else {
        showError(t('voteFailed'))
      }
    } catch {
      showError(t('voteFailed'))
    } finally {
      setVoting(false)
    }
  }, [authStatus, id, router, voting, t])

  const handleCopyCode = useCallback(async () => {
    if (!deck?.deck_code) return
    await navigator.clipboard.writeText(deck.deck_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [deck?.deck_code])

  const handleBookmark = useCallback(async () => {
    if (authStatus !== 'authenticated' || bookmarking) return
    setBookmarking(true)
    try {
      const res = await fetch(`/api/decks/${id}/bookmark`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setBookmarked(data.bookmarked)
        showSuccess(data.bookmarked ? t('bookmarkAdded') : t('bookmarkRemoved'))
        router.refresh()
      } else {
        showError(t('bookmarkFailed'))
      }
    } catch {
      showError(t('bookmarkFailed'))
    } finally {
      setBookmarking(false)
    }
  }, [authStatus, id, bookmarking, router, t])

  const handleShare = useCallback(async () => {
    if (shareGenerating || !deck) return
    setShareGenerating(true)
    try {
      const shareUrl = `${window.location.origin}/decks/${id}`
      if (navigator.share) {
        try {
          await navigator.share({ url: shareUrl, title: deck.title })
        } catch (e) {
          if (e instanceof Error && e.name !== 'AbortError') throw e
        }
      } else {
        await navigator.clipboard.writeText(shareUrl)
        setShared(true)
        setTimeout(() => setShared(false), 2000)
      }
    } finally {
      setShareGenerating(false)
    }
  }, [shareGenerating, deck, id])

  const handleFork = useCallback(() => {
    window.location.href = `/decks/new?fork=${id}`
  }, [id])

  // 정렬
  const sorted = useMemo(() => {
    if (!deck) return []
    return [...deck.deck_identities].sort((a, b) => {
      if (a.slot_order === 99 && b.slot_order !== 99) return 1
      if (b.slot_order === 99 && a.slot_order !== 99) return -1
      return a.slot_order - b.slot_order
    })
  }, [deck?.deck_identities])
  const boardSlots = useMemo(() => buildBoardSlots(sorted), [sorted])
  const keywords = useMemo(() => topKeywords(sorted), [sorted])
  const filledSlots = useMemo(() => sorted.filter(s => s.identities), [sorted])
  const localizedFilledSlots = useMemo(() => filledSlots.map(slot => {
    const identity = slot.identities
    if (!identity) return slot
    return {
      ...slot,
      identities: {
        ...identity,
        name_kr: localizeIdentityName(identity, locale),
        passives: (identity.passives ?? []).map(passive => ({
          ...passive,
          name: localizePassiveName(passive, locale),
          description: localizePassiveDescription(passive, locale) ?? passive.description,
        })),
      },
    }
  }), [filledSlots, locale])
  const formedSlots = useMemo(() => filledSlots.filter(s => s.slot_order < 99), [filledSlots])
  const customSkillSlots = useMemo(() => formedSlots.filter(s => {
    const s1 = s.s1_count ?? 3, s2 = s.s2_count ?? 2, s3 = s.s3_count ?? 1
    return !(s1 === 3 && s2 === 2 && s3 === 1)
  }), [formedSlots])

  // 죄악 자원 & 공격 유형
  const sinAffinityTotals = useMemo(() => buildSinProductionTotals(formedSlots), [formedSlots])
  const egoCostTotals = useMemo(() => buildEgoCostTotals(deck?.deck_egos), [deck?.deck_egos])
  const atkTypeTotals = useMemo(() => buildAttackTypeTotals(formedSlots, deck?.deck_egos), [formedSlots, deck?.deck_egos])

  // EGO 그룹핑
  const egoGrouped = useMemo(() => {
    const grouped: Record<string, EgoEntry[]> = {}
    for (const row of deck?.deck_egos ?? []) {
      if (!row.ego) continue
      const sid = row.ego.sinner_id
      ;(grouped[sid] ??= []).push({ grade: row.grade, ego: row.ego })
    }
    for (const sid of Object.keys(grouped)) {
      grouped[sid].sort((a, b) => EGO_GRADE_ORDER.indexOf(a.grade) - EGO_GRADE_ORDER.indexOf(b.grade))
    }
    return grouped
  }, [deck?.deck_egos])
  const egoSinnerIds = useMemo(() => Object.keys(egoGrouped), [egoGrouped])

  // 수감자별 그룹핑
  const slotsBySinner = useMemo(() => filledSlots.reduce<Record<string, IdentitySlot[]>>((acc, slot) => {
    const sid = slot.identities!.sinner_id
    ;(acc[sid] ??= []).push(slot)
    return acc
  }, {}), [filledSlots])
  const sinnerIds = useMemo(() => [
    ...Object.keys(slotsBySinner),
    ...egoSinnerIds.filter(sid => !slotsBySinner[sid]),
  ].sort((a, b) => {
    const ai = SINNER_ORDER.indexOf(a as typeof SINNER_ORDER[number])
    const bi = SINNER_ORDER.indexOf(b as typeof SINNER_ORDER[number])
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  }), [egoSinnerIds, slotsBySinner])

  const activeSinner = selectedSinner ?? sinnerIds[0] ?? null

  const date = deck ? deck.created_at.slice(0, 10).replace(/-/g, '.') : ''
  const noteLookups = useMemo(
    () => buildNoteLookups(sorted, deck?.all_sinner_egos ?? [], locale, (sinnerId) => rootT(`sinner.${sinnerId}`)),
    [deck?.all_sinner_egos, locale, rootT, sorted],
  )
  const egoGiftConditionLookup = useMemo(() => {
    const activeFormationSlots = filledSlots.filter(slot => slot.slot_order >= 0 && slot.slot_order < FRONTLINE_SLOT_COUNT)
    const deckKeywordSlots: DeckKeywordSlot[] = activeFormationSlots.map(slot => {
      const identity = slot.identities
      const keywordIdentity = identity as (IdentityDetail & { skill_keyword_list?: string[] | null }) | null
      return {
        slot_order: slot.slot_order,
        identities: {
          skill_keyword_list: keywordIdentity?.skill_keyword_list ?? identity?.keywords ?? [],
          skills: (identity?.skills ?? []).map(skill => ({
            skill_type: skill.skill_type,
            atk_type: skill.atk_type ?? skill.skill_type,
          })),
        },
      }
    })
    const formationKeywordCounts = computeFormationGiftKeywordCounts(deckKeywordSlots)
    const formationAffiliationCounts: Record<string, number> = {}

    for (const slot of activeFormationSlots) {
      const affiliation = (slot.identities as { affiliation?: string | null } | null)?.affiliation
      if (!affiliation) continue
      formationAffiliationCounts[affiliation] = (formationAffiliationCounts[affiliation] ?? 0) + 1
    }

    const map: Record<string, ReturnType<typeof getGiftActivationConditionStatus>> = {}
    for (const gift of Object.values(egoGiftLookup)) {
      map[gift.name] = getGiftActivationConditionStatus({
        gift: { activation_condition: gift.activation_condition ?? null },
        formationKeywordCounts,
        allKeywordCounts: formationKeywordCounts,
        formationAffiliationCounts,
        allAffiliationCounts: formationAffiliationCounts,
      })
    }
    return map
  }, [egoGiftLookup, filledSlots])

  if (loading) return <Skeleton />

  if (!deck) {
    return (
      <div className="min-h-[100dvh] pt-24 flex items-center justify-center">
        <div className="text-center">
          <p className="font-serif text-2xl mb-4" style={{ color: 'var(--gold)' }}>{t('notFound')}</p>
          <Link href="/decks" style={{ color: '#888888' }} className="hover:text-yellow-300 transition-colors">
            {t('backToBoard')}
          </Link>
        </div>
      </div>
    )
  }

  // 공통 props for header components
  const headerProps = {
    deckId: id,
    title: deck.title,
    username: deck.profiles?.username,
    date,
    viewCount: deck.view_count,
    tags: deck.tags,
    keywords,
    isOwner: deck.is_owner,
    isAdmin: deck.is_admin,
    deckCode: deck.deck_code,
    voted,
    voteCount,
    voting,
    authStatus,
    bookmarked,
    bookmarking,
    shared,
    shareGenerating,
    copied,
    sinAffinityTotals,
    egoCostTotals,
    atkTypeTotals,
    filledSlotsCount: filledSlots.length,
    onVote: handleVote,
    onBookmark: handleBookmark,
    onShare: handleShare,
    onCopyCode: handleCopyCode,
    onFork: handleFork,
  }

  return (
    <div className="min-h-[100dvh]" style={{ background: '#0d0b08' }}>

      {/* ── 플래너 스타일 헤더 ── */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        {/* 라인 1: 뒤로가기 + 제목 */}
        <div className="flex items-center gap-3 mb-2">
          <Link
            href="/decks"
            className="inline-flex items-center gap-1 transition-opacity hover:opacity-70 flex-shrink-0"
            style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)' }}
          >
            <ArrowLeft style={{ width: '0.75rem', height: '0.75rem' }} />
            {t('backToList')}
          </Link>
          <span style={{ color: 'var(--border)', fontSize: 'var(--text-xs)' }}>/</span>
          <h1
            className="font-serif font-light leading-tight truncate"
            style={{ color: 'var(--text-primary)', fontSize: 'clamp(1.1rem, 2.8vw, 1.5rem)' }}
          >
            {deck.title}
          </h1>
        </div>
        {/* 라인 2: 메타 + 액션 버튼 */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* 왼쪽: 작성자 · 날짜 · 조회수 */}
          <div className="flex items-center gap-2" style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            {deck.profiles?.username && (
              <span style={{ color: 'var(--text-secondary)' }}>{deck.profiles.username}</span>
            )}
            {deck.profiles?.username && <span style={{ fontFamily: 'sans-serif' }}>·</span>}
            <span suppressHydrationWarning>{date}</span>
            <span style={{ fontFamily: 'sans-serif' }}>·</span>
            <span className="flex items-center gap-1">
              <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
                <ellipse cx="8" cy="8" rx="7" ry="4.5" stroke="currentColor" strokeWidth="1.4"/>
                <circle cx="8" cy="8" r="2" fill="currentColor"/>
              </svg>
              {deck.view_count}
            </span>
          </div>
          {/* 오른쪽: 액션 버튼 */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <CompactButton
              icon={voted ? Heart : Heart}
              onClick={handleVote}
              disabled={authStatus !== 'authenticated' || voting}
              variant={voted ? 'gold' : 'muted'}
              title={t('vote')}
            >
              {voteCount}
            </CompactButton>
            <CompactButton
              icon={bookmarked ? Bookmark : Bookmark}
              onClick={handleBookmark}
              disabled={authStatus !== 'authenticated' || bookmarking}
              variant={bookmarked ? 'gold' : 'muted'}
              title={t('bookmark')}
            >
              {bookmarked ? t('saved') : t('save')}
            </CompactButton>
            <CompactButton
              icon={shared ? Check : Share2}
              onClick={handleShare}
              disabled={shareGenerating}
              variant={shared ? 'success' : 'muted'}
              title={t('share')}
            >
              {shared ? t('copied') : t('share')}
            </CompactButton>
            <CompactButton
              icon={GitFork}
              onClick={handleFork}
              variant="muted"
              title={t('fork')}
            >
              {t('fork')}
            </CompactButton>
            {deck.deck_code && (
              <CompactButton
                icon={copied ? Check : Copy}
                onClick={handleCopyCode}
                variant={copied ? 'success' : 'muted'}
                title={t('copyDeckCode')}
              >
                {copied ? t('copied') : t('code')}
              </CompactButton>
            )}
          </div>
        </div>
      </div>

      {/* ── 콘텐츠 ── */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 pb-24 pt-6">

        {/* 모바일 액션바 */}
        <DeckMobileActionBar {...headerProps} />

        <div className="flex gap-5 items-start">

          {/* 데스크탑 사이드바 */}
          <aside className="hidden lg:block" style={{ width: '15.75rem', flexShrink: 0 }}>
            <DeckSidebarPanel {...headerProps} />
          </aside>

          {/* 수감자 탭 + 인격 상세 */}
          <main className="flex-1 min-w-0">
            {filledSlots.length === 0 ? (
              <p className="text-sm italic" style={{ color: '#2a2a3a', fontFamily: 'var(--font-body)' }}>{t('identityEmpty')}</p>
            ) : (
              <>
                {/* Dante Planner 스타일 12슬롯 편성 보드 */}
                <section
                  className="mb-5"
                  aria-label={t('boardLabel')}
                >
                  <style>{`
                    .deck-detail-board-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));column-gap:0.35rem;row-gap:0.6rem}
                    @media (min-width:23.75rem){.deck-detail-board-grid{grid-template-columns:repeat(4,minmax(0,1fr));column-gap:0.35rem;row-gap:0.6rem}}
                    @media (min-width:40rem){.deck-detail-board-grid{column-gap:0.75rem;row-gap:0.8rem}}
                    @media (min-width:64rem){.deck-detail-board-grid{grid-template-columns:repeat(6,minmax(0,1fr));column-gap:1.75rem;row-gap:1.25rem}}
                    .deck-detail-board-button{transform:translate3d(0,0,0);transition:transform 220ms cubic-bezier(.22,1,.36,1),filter 220ms cubic-bezier(.22,1,.36,1)}
                    .deck-detail-board-button:not(:disabled):is(:hover,:focus-visible){transform:translate3d(0,-0.25rem,0);filter:brightness(1.08) drop-shadow(0 .65rem 1.1rem rgba(200,144,10,.18))}
                    .deck-detail-board-button:not(:disabled):active{transform:translate3d(0,-0.0625rem,0);filter:brightness(1.02)}
                    @media (prefers-reduced-motion:reduce){.deck-detail-board-button{transition:filter 120ms ease}.deck-detail-board-button:not(:disabled):is(:hover,:focus-visible),.deck-detail-board-button:not(:disabled):active{transform:none}}
                  `}</style>
                  <div className="deck-detail-board-grid">
                    {boardSlots.map((slot, index) => {
                      const id_ = slot?.identities ?? null
                      const identityName = id_ ? localizeIdentityName(id_, locale) : ''
                      const kind = getBoardSlotKind(slot)
                      const isFrontline = kind === 'selected'
                      const isBackup = kind === 'backup'
                      const isActive = !!id_ && activeSinner === id_.sinner_id
                      const displayedOrder = slot && slot.slot_order < 99 ? slot.slot_order + 1 : null
                      const bannerUrl = isFrontline ? SELECTED_BANNER_URL : isBackup ? BACKUP_BANNER_URL : null

                      return (
                        <div key={`${id_?.id ?? 'empty'}-${index}`} className="min-w-0">
                          <button
                            type="button"
                            onClick={() => {
                              if (!id_ || !slot) return
                              setSelectedSinner(id_.sinner_id)
                              setIdentityPreview({ slot })
                            }}
                            disabled={!id_}
                            aria-pressed={isActive}
                            aria-label={id_ ? t('slotPreview', { index: index + 1, identity: identityName }) : t('emptySlot', { index: index + 1 })}
                            className="deck-detail-board-button relative w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0c09] disabled:cursor-default disabled:opacity-45"
                          >
                            {id_ ? (
                              <IdentityCard
                                identity={adaptBoardIdentity(id_, locale)}
                                compact
                                board
                                selected={isActive}
                                gacksung={slot?.gacksung ?? false}
                                disableHoverEffects
                                formationOverlay={bannerUrl && displayedOrder != null
                                  ? {
                                      kind: isFrontline ? 'selected' : 'backup',
                                      order: displayedOrder,
                                      bannerUrl,
                                    }
                                  : undefined}
                              />
                            ) : (
                              <div
                                className="aspect-[2/3] w-full rounded"
                                style={{ background: '#080604', border: '1px solid rgba(44,28,12,0.45)' }}
                              />
                            )}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                  <p
                    className="mt-3"
                    style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem', lineHeight: 1.55 }}
                  >
                    {t('boardHint')}
                  </p>
                </section>

                {/* 덱 노트 */}
                {deck.description?.trim() && (
                  <>
                    <style>{`
                      .deck-detail-note-section{
                        position:relative;
                        overflow:hidden;
                        border:1px solid rgba(200,144,10,.24);
                        border-radius:.5rem;
                        background:#14100c;
                      }
                      .deck-detail-note-section::before{
                        content:"";
                        position:absolute;
                        left:0;
                        top:0;
                        bottom:0;
                        width:.1875rem;
                        background:#c8900a;
                        opacity:.62;
                      }
                      .deck-detail-note-header{
                        display:flex;
                        align-items:center;
                        justify-content:space-between;
                        gap:.75rem;
                        padding:1rem 1rem .75rem 1.125rem;
                        border-bottom:1px solid rgba(200,144,10,.2);
                      }
                      .deck-detail-note-title{
                        margin:0;
                        color:#e4d3b0;
                        font-family:var(--font-serif);
                        font-size:1.125rem;
                        font-weight:700;
                        line-height:1.35;
                        text-wrap:balance;
                      }
                      .deck-detail-note-body{
                        padding:1rem 1.125rem 1.125rem;
                      }
                      .deck-detail-skill-mix{
                        margin-top:1rem;
                        border-top:1px solid rgba(200,144,10,.18);
                        padding-top:.875rem;
                      }
                      .deck-detail-skill-mix-label{
                        display:block;
                        margin-bottom:.625rem;
                        color:#c8900a;
                        font-family:var(--font-mono);
                        font-size:.875rem;
                        font-weight:700;
                        line-height:1.45;
                      }
                      .deck-detail-skill-mix-row{
                        display:flex;
                        align-items:center;
                        gap:.625rem;
                        min-height:2.75rem;
                        border:1px solid rgba(200,144,10,.15);
                        border-radius:.375rem;
                        background:#100d0a;
                        padding:.5rem .625rem;
                      }
                      .deck-detail-skill-mix-name{
                        min-width:0;
                        max-width:10rem;
                        flex:0 1 auto;
                        color:#b8a890;
                        font-family:var(--font-body);
                        font-size:.9375rem;
                        line-height:1.45;
                      }
                      .deck-detail-skill-count{
                        display:flex;
                        align-items:center;
                        gap:.25rem;
                        min-width:2.75rem;
                        justify-content:flex-end;
                      }
                      @media (max-width:40rem){
                        .deck-detail-note-header{padding:.875rem .875rem .625rem 1rem}
                        .deck-detail-note-body{padding:.875rem 1rem 1rem}
                        .deck-detail-skill-mix-row{align-items:flex-start;flex-wrap:wrap}
                        .deck-detail-skill-mix-name{max-width:calc(100% - 2rem)}
                        .deck-detail-skill-count{justify-content:flex-start}
                      }
                    `}</style>
                    <section className="deck-detail-note-section mb-5" aria-labelledby="deck-detail-note-title">
                      <div className="deck-detail-note-header">
                        <h2 id="deck-detail-note-title" className="deck-detail-note-title">{t('deckNote')}</h2>
                      </div>
                      <div className="deck-detail-note-body">
                        <NoteRenderer
                          text={deck.description}
                          {...noteLookups}
                          egoGiftLookup={egoGiftLookup}
                          egoGiftConditionLookup={egoGiftConditionLookup}
                          textScale="comfortable"
                        />
                        {customSkillSlots.length > 0 && (
                          <div className="deck-detail-skill-mix">
                            <span className="deck-detail-skill-mix-label">{t('skillDistribution')}</span>
                            <div className="flex flex-col gap-2">
                              {customSkillSlots.map((slot, i) => {
                                const id_ = slot.identities!
                                const identityName = localizeIdentityName(id_, locale)
                                const dist = [slot.s1_count ?? 3, slot.s2_count ?? 2, slot.s3_count ?? 1]
                                const rawSk2 = id_.skills ?? []
                                const skBest2 = new Map<string, typeof rawSk2[0]>()
                                for (const s of rawSk2) {
                                  if (['evade', 'defense', 'counter'].includes(s.skill_type)) continue
                                  const key = `${s.skill_order}:${(s as Record<string, unknown>).variant_order ?? 0}`
                                  const ex = skBest2.get(key)
                                  if (!ex || (s.uptie_level ?? 3) > (ex.uptie_level ?? 3)) skBest2.set(key, s)
                                }
                                const sortedSk = [...skBest2.values()].sort((a, b) => a.skill_order - b.skill_order)
                                const skillIconBase = id_.game_id ? `${STORAGE_BASE}/icons/skills/${id_.sinner_id}/${id_.game_id}` : ''
                                return (
                                  <div key={i} className="deck-detail-skill-mix-row">
                                    <Image src={getSinnerLogoUrl(id_.sinner_id)} alt="" width={18} height={18} style={{ width: '1.125rem', height: '1.125rem', objectFit: 'contain', opacity: 0.58, flexShrink: 0 }} />
                                    <span className="deck-detail-skill-mix-name truncate">
                                      {identityName}
                                    </span>
                                    <div style={{ flex: 1 }} />
                                    {[0, 1, 2].map(idx => {
                                      const skill = sortedSk.find(s => s.skill_order === idx + 1)
                                      const sc = skill ? sinColor(skill.sin_affinity) : '#888'
                                      const iconUrl = skillIconBase ? `${skillIconBase}${String(idx + 1).padStart(2, '0')}.webp` : ''
                                      return (
                                        <div key={idx} className="deck-detail-skill-count">
                                          {iconUrl && (
                                            <Image src={iconUrl} alt={`S${idx + 1}`} width={20} height={20} style={{ width: '1.25rem', height: '1.25rem', borderRadius: '0.1875rem', border: `1px solid ${sc}40` }} />
                                          )}
                                          <span style={{ fontSize: '0.9375rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: dist[idx] > 0 ? sc : '#3a2d1d' }}>
                                            {dist[idx]}
                                          </span>
                                        </div>
                                      )
                                    })}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </section>
                  </>
                )}

                {/* 패시브 패널 */}
                <SectionBlock title={t('passives')} defaultOpen={true}>
                  <DeckPassivePanel slots={localizedFilledSlots} deckSinCounts={sinAffinityTotals} />
                </SectionBlock>

                <DeckRecommendations recommendations={initialRecommendations} currentDeckId={id} />

              </>
            )}
          </main>

        </div>

        <DeckComments deckId={id} initialComments={initialComments ?? []} />
      </div>

      {identityModalId && (
        <IdentityDetailModal identityId={identityModalId} onClose={() => setIdentityModalId(null)} />
      )}
      {identityPreview?.slot.identities && (
        <DeckIdentityPreviewModal
          open
          slot={identityPreview.slot}
          egos={egoGrouped[identityPreview.slot.identities.sinner_id] ?? []}
          keywordMeta={keywordMeta}
          onEgoClick={setEgoModalId}
          onClose={() => setIdentityPreview(null)}
        />
      )}
      {egoModalId && (
        <EgoDetailModal egoId={egoModalId} onClose={() => setEgoModalId(null)} />
      )}
    </div>
  )
}
