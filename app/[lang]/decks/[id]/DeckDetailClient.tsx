'use client'

import BackLink from '@/components/navigation/BackLink'
import DeckDetailSkeleton from '@/components/decks/DeckDetailSkeleton'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import { useLocale, useTranslations } from 'next-intl'
import { Link, useRouter } from '@/lib/i18n/navigation'
import { useSession } from 'next-auth/react'
import { ArrowLeft, Heart, Bookmark, Share2, GitFork, Copy, Check, Pencil, Trash2 } from 'lucide-react'
import { showSuccess, showError } from '@/lib/toast'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useGuestPosts } from '@/hooks/useGuestPosts'
import { guestHeaders } from '@/lib/guest/key'
import GuestPinRecover from '@/components/guest/GuestPinRecover'
import { getGuestCopy, guestAuthorName } from '@/lib/guest/copy'
import { DEFAULT_AVATAR_URL, STORAGE_BASE, isDeployedSlot } from '@/lib/constants/game'
import { SIN_COLORS, SIN_KR_TO_EN, normalizeSin } from '@/lib/constants/sin'
import { getIdentityImageUrl, getIdentityPortraitUrl, getSkillIconUrl, computeSkillImageIndices } from '@/lib/utils/images'
import type { Identity, Skill } from '@/lib/types'
import {
  computeAllGiftAffiliationCounts,
  computeAllGiftKeywordCounts,
  computeFormationGiftAffiliationCounts,
  computeFormationGiftKeywordCounts,
  normalizeDeckMainKeyword,
  type DeckKeywordSlot,
} from '@/lib/decks/keyword-rules'
import { NoteRenderer, type NoteSkillEntry, type NotePassiveEntry, type NoteEgoEntry, type NoteEgoGiftEntry, type NoteIdentityEntry } from '@/components/decks/NoteChips'
import { NoteGiftClickContext } from '@/components/notes/NoteBlockViewer'
import PlannerGiftModal from '@/components/planner/PlannerGiftModal'
import type { GiftData } from '@/lib/planner/types'
import KeywordIcon from '@/components/ui/KeywordIcon'
import RelativeTime from '@/components/ui/RelativeTime'
import DeckInsights, { type DeckInsightIdentity } from '@/components/deck-analysis/DeckInsights'
import DeckResourceSummary from '@/components/deck-analysis/DeckResourceSummary'
import SkillExchangePanel from '@/components/planner/SkillExchangePanel'
import { computeDeckResources, computeSinProduction, fieldedEntries } from '@/lib/decks/deck-analysis'
import { rowsAtUptie } from '@/lib/decks/deck-identity-uptie'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { contentTypeMessageKey, localizeDeckKeyword } from '@/components/decks/decks-types'
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
import FormationBoard, { type FormationBoardSlot } from '@/components/decks/FormationBoard'
import { FormationEgoGrid, FormationTabs, type FormationEgo } from '@/components/decks/FormationEgoGrid'
import DeckRecommendations, { type DeckRecommendationsData } from '@/components/deck-detail/DeckRecommendations'
import DeckComments from '@/components/deck-detail/DeckComments'
import { getGiftActivationConditionStatus } from '@/lib/planner/gift-condition-status'
import type { SupportedLang } from '@/lib/i18n/types'
import { workbenchReveal } from '@/lib/animations'
import styles from './DeckDetail.module.css'

const IdentityDetailModal = dynamic(() => import('@/components/ui/IdentityDetailModal'), { ssr: false })
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
  main_keywords?: string[] | null
  content_type?: string
  vote_count: number
  view_count: number
  created_at: string
  deck_code?: string
  is_owner?: boolean
  is_admin?: boolean
  user_id: string
  guest_tag?: string | null
  profiles: { username: string; avatar_url?: string | null } | null
  deck_identities: IdentitySlot[]
  deck_egos?: EgoSlot[]
  all_sinner_egos?: SinnerEgo[]
}

// ── 상수 ──────────────────────────────────────────────────────────────────
import { THEME_KEYWORDS, normalizeThemeKeyword } from '@/lib/constants/keywords'
const THEME_KW_SET = new Set<string>(THEME_KEYWORDS)

const BOARD_SLOT_COUNT = 12
// Saved uptie; rows without one fall back to gacksung (= uptie III–IV), non-awakened reading as uptie II.
const slotUptie = (slot: IdentitySlot | null) => slot?.uptie ?? (slot?.gacksung === false ? 2 : 4)
const EGO_GRADE_ORDER = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH']

// ── 헬퍼 ──────────────────────────────────────────────────────────────────
function sinColor(sin: string, isKr = false): string {
  const en = isKr ? (SIN_KR_TO_EN[sin] ?? sin) : sin
  return SIN_COLORS[en as keyof typeof SIN_COLORS] ?? '#888888'
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
      ? getIdentityPortraitUrl(id_.sinner_id, id_.folder_name, id_.game_id, false)
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
        sin_count: pa.sin_count, sin_requirements: pa.sin_requirements, active_cond: pa.active_cond,
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
  const shouldReduceMotion = useReducedMotion()
  const { status: authStatus } = useSession()

  const [deck, setDeck] = useState<DeckDetail | null>(initialDeck ?? null)
  const [loading, setLoading] = useState(!initialDeck)
  // Signed-out visitors own a guest deck when this browser's key wrote it.
  const guest = useGuestPosts(authStatus === 'unauthenticated' && !deck?.user_id), guestPosts = guest.posts
  const guestOwner = authStatus === 'unauthenticated' && !!guestPosts.data?.decks.some(post => post.id === id)
  // A guest deck this browser has no key for: its author takes it back with the deck's password (REQ-COMMUNITY-031).
  const canRecover = authStatus === 'unauthenticated' && !!deck?.guest_tag && guest.keyRead && !guestPosts.isLoading && !guestOwner
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [voted, setVoted] = useState(false)
  const [voteCount, setVoteCount] = useState(0)
  const [voting, setVoting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [identityPreview, setIdentityPreview] = useState<IdentityPreviewState | null>(null)
  const [formationTab, setFormationTab] = useState<'identity' | 'ego'>('identity')

  const [bookmarked, setBookmarked] = useState(false)
  const [bookmarking, setBookmarking] = useState(false)

  const [shared, setShared] = useState(false)
  const [shareGenerating, setShareGenerating] = useState(false)

  const [egoGiftLookup, setEgoGiftLookup] = useState<Record<string, NoteEgoGiftEntry>>({})
  const [egoModalId, setEgoModalId] = useState<string | null>(null)
  // A gift label in the note: the list above is the light one, so the pressed gift is fetched whole for the modal.
  const [noteGift, setNoteGift] = useState<GiftData | null>(null)
  const openNoteGift = useCallback((key: string) => {
    fetch(`/api/ego-gifts?key=${encodeURIComponent(key)}`)
      .then(r => (r.ok ? r.json() : null))
      .then((gift: GiftData | null) => { if (gift) setNoteGift({ ...gift, theme_ids: null }) })
      .catch(() => {})
  }, [])

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
      const shareUrl = `${window.location.origin}/${locale}/decks/${id}`
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
  }, [shareGenerating, deck, id, locale])

  const handleFork = useCallback(() => {
    router.push(`/decks/new?fork=${id}`, { locale })
  }, [id, locale, router])

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
  // E.G.O 탭: 수감자 → 등급 → E.G.O
  const formationEgos = useMemo(() => {
    const map: Record<string, Record<string, FormationEgo>> = {}
    for (const row of deck?.deck_egos ?? []) {
      if (!row.ego) continue
      ;(map[row.ego.sinner_id] ??= {})[row.grade] = { id: row.ego.id, name: localizeEgoName(row.ego, locale), sin_affinity: row.ego.sin_affinity }
    }
    return map
  }, [deck?.deck_egos, locale])
  const keywords = useMemo(() => {
    const persistedKeywords = (deck?.main_keywords ?? [])
      .map(normalizeDeckMainKeyword)
      .filter((keyword): keyword is string => Boolean(keyword))

    return persistedKeywords.length > 0 ? persistedKeywords : topKeywords(sorted)
  }, [deck?.main_keywords, sorted])
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
  const date = deck ? deck.created_at.slice(0, 10).replace(/-/g, '.') : ''
  const noteLookups = useMemo(
    () => buildNoteLookups(sorted, deck?.all_sinner_egos ?? [], locale, (sinnerId) => rootT(`sinner.${sinnerId}`)),
    [deck?.all_sinner_egos, locale, rootT, sorted],
  )
  const egoGiftConditionLookup = useMemo(() => {
    const assignedSlots = filledSlots.filter(slot => slot.slot_order >= 0 && slot.slot_order < 99)
    const deckKeywordSlots: DeckKeywordSlot[] = assignedSlots.map(slot => {
      const identity = slot.identities
      const keywordIdentity = identity as (IdentityDetail & { skill_keyword_list?: string[] | null }) | null
      return {
        slot_order: slot.slot_order,
        identities: {
          skill_keyword_list: keywordIdentity?.skill_keyword_list ?? identity?.keywords ?? [],
          affiliation: keywordIdentity?.affiliation ?? null,
          association_list: keywordIdentity?.association_list ?? [],
          skills: (identity?.skills ?? []).map(skill => ({
            skill_type: skill.skill_type,
            atk_type: skill.atk_type ?? skill.skill_type,
          })),
        },
      }
    })
    const formationKeywordCounts = computeFormationGiftKeywordCounts(deckKeywordSlots)
    const allKeywordCounts = computeAllGiftKeywordCounts(deckKeywordSlots)
    const formationAffiliationCounts = computeFormationGiftAffiliationCounts(deckKeywordSlots)
    const allAffiliationCounts = computeAllGiftAffiliationCounts(deckKeywordSlots)

    const map: Record<string, ReturnType<typeof getGiftActivationConditionStatus>> = {}
    for (const gift of Object.values(egoGiftLookup)) {
      map[gift.name] = getGiftActivationConditionStatus({
        gift: { activation_condition: gift.activation_condition ?? null },
        formationKeywordCounts,
        allKeywordCounts,
        formationAffiliationCounts,
        allAffiliationCounts,
      })
    }
    return map
  }, [egoGiftLookup, filledSlots])

  useEffect(() => {
    if (loading || deck) return

    const styleId = 'deck-detail-missing-footer-style'
    const className = 'deck-detail-missing'
    let styleElement = document.getElementById(styleId)

    if (!styleElement) {
      styleElement = document.createElement('style')
      styleElement.id = styleId
      styleElement.textContent = `body.${className} footer { display: none !important; }`
      document.head.appendChild(styleElement)
    }

    document.body.classList.add(className)

    return () => {
      document.body.classList.remove(className)
      if (styleElement?.parentNode) {
        styleElement.parentNode.removeChild(styleElement)
      }
    }
  }, [deck, loading])

  const decksT = useTranslations('decks')
  const commentsT = useTranslations('decks.comments')
  const { getIconUrl, keywords: keywordMessages } = useKeywordData()

  // Planner deck panels: keyword distribution, passives, attack types and sin resources (each slot at its own uptie).
  const insightSlots = useMemo(() => {
    const order = SINNER_ORDER as readonly string[]
    const bySinner = [...filledSlots].sort((a, b) => order.indexOf(a.identities!.sinner_id) - order.indexOf(b.identities!.sinner_id))
    const upties = new Map(bySinner.map(slot => [slot.identities!.id, slotUptie(slot)]))
    return bySinner.map(slot => {
      const identity = slot.identities!
      return {
        slot,
        identity,
        skills: rowsAtUptie((identity.skills ?? []).map(skill => ({ ...skill, identity_id: identity.id })), upties),
        passives: rowsAtUptie((identity.passives ?? []).map(passive => ({ ...passive, identity_id: identity.id })), upties),
      }
    })
  }, [filledSlots])
  const deployedIdentityIds = useMemo(() => new Set(insightSlots.filter(({ slot }) => isDeployedSlot(slot.slot_order)).map(({ identity }) => identity.id)), [insightSlots])
  const insightIdentities = useMemo<DeckInsightIdentity[]>(() => insightSlots.map(({ identity, passives }) => ({
    id: identity.id,
    name: localizeIdentityName(identity, locale),
    sinnerName: rootT(`sinner.${identity.sinner_id}`),
    imageUrl: identity.folder_name && identity.game_id ? getIdentityImageUrl(identity.sinner_id, identity.folder_name, `${identity.game_id}_normal_info`) : '',
    keywords: identity.skill_keyword_list ?? identity.keywords ?? [],
    passives: [...passives].sort((a, b) => a.passive_order - b.passive_order).map(passive => ({
      ...passive,
      name: localizePassiveName(passive, locale),
      description: localizePassiveDescription(passive, locale) ?? passive.description,
    })),
  })), [insightSlots, locale, rootT])
  const deckAnalysis = useMemo(() => {
    const egos = (deck?.deck_egos ?? []).flatMap(row => row.ego ? [row.ego] : [])
    const entries = insightSlots.map(({ slot, identity, skills }) => ({
      skills,
      distribution: [slot.s1_count ?? 3, slot.s2_count ?? 2, slot.s3_count ?? 1] as const,
      deployed: isDeployedSlot(slot.slot_order),
      egos: egos.filter(ego => ego.sinner_id === identity.sinner_id).map(ego => ({ skills: ego.ego_skills, cost: ego.cost })),
    }))
    const resources = computeDeckResources(entries)
    return {
      sinCounts: resources.production,
      baseSinCounts: computeSinProduction(fieldedEntries(entries).map(({ skills }) => ({ skills }))),
      summary: <DeckResourceSummary resources={resources} />,
    }
  }, [deck?.deck_egos, insightSlots])

  const hasRecommendations = [...(initialRecommendations?.otherOpinions ?? []), ...(initialRecommendations?.similarDecks ?? [])].some(rec => rec.id !== id)
  const hasNote = Boolean(deck?.description?.trim()) || customSkillSlots.length > 0
  const sections: { id: string; label: string }[] = [
    { id: 'deck-formation', label: t('sectionFormation') },
    ...(hasNote ? [{ id: 'deck-note', label: t('deckNote') }] : []),
    ...(hasRecommendations ? [{ id: 'deck-similar', label: t('sectionRelated') }] : []),
    { id: 'deck-comments', label: commentsT('title') },
  ]
  const sectionKey = sections.map(section => section.id).join()
  const [activeSection, setActiveSection] = useState('deck-formation')
  // 스크롤 위치에 맞춰 구역 목차의 현재 항목을 표시한다: 화면 위 30% 선을 지난 마지막 구역
  useEffect(() => {
    const ids = sectionKey.split(',')
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const line = window.innerHeight * 0.3
        let current = ids[0]
        for (const sectionId of ids) {
          const top = document.getElementById(sectionId)?.getBoundingClientRect().top
          if (top != null && top <= line) current = sectionId
        }
        setActiveSection(current)
      })
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [sectionKey, loading])

  // 모바일의 가로 목차에서 현재 항목이 보이도록 목차만 가로로 스크롤한다
  const sectionNavRef = useRef<HTMLOListElement>(null)
  useEffect(() => {
    const list = sectionNavRef.current
    const link = list?.querySelector<HTMLElement>('[aria-current]')
    if (!list || !link) return
    const left = link.offsetLeft - list.offsetLeft
    if (left < list.scrollLeft || left + link.offsetWidth > list.scrollLeft + list.clientWidth) {
      list.scrollTo({ left: Math.max(0, left - 16) })
    }
  }, [activeSection])

  // 해시를 남기지 않고 이동해 BackLink의 뒤로 가기 기록을 그대로 둔다
  const goToSection = (sectionId: string) => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.getElementById(sectionId)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    setActiveSection(sectionId)
  }

  if (loading) return <DeckDetailSkeleton />

  if (!deck) {
    return (
      <div
        className="flex items-center justify-center px-4"
        style={{ minHeight: 'calc(100dvh - 4rem)', background: '#0d0b08' }}
      >
        <div className="text-center">
          <p className="mb-4 font-serif text-2xl" style={{ color: 'var(--gold)' }}>{t('notFound')}</p>
          <Link
            href="/decks"
            locale={locale}
            style={{ color: '#888888' }}
            className="transition-colors hover:text-yellow-300"
          >
            {t('backToBoard')}
          </Link>
        </div>
      </div>
    )
  }

  const contentLabel = deck.content_type && deck.content_type !== '없음'
    ? decksT(`contentTypes.${contentTypeMessageKey(deck.content_type)}`)
    : null
  const canEdit = deck.is_owner || deck.is_admin || guestOwner
  const guestT = getGuestCopy(locale)
  const deleteGuestDeck = async () => {
    setConfirmDelete(false)
    const res = await fetch(`/api/decks/${id}`, { method: 'DELETE', headers: guestHeaders(false) }).catch(() => null)
    if (!res?.ok) { showError(guestT.deleteFailed); return }
    void guestPosts.mutate()
    showSuccess(guestT.deleted)
    router.push('/decks')
  }

  return (
    <NoteGiftClickContext value={openNoteGift}>
    <div className="min-h-screen bg-[#0d0b08] pt-24 pb-20">
      <div className="mx-auto w-full max-w-7xl px-3 sm:px-6">
        <BackLink
          href="/decks"
          locale={locale}
          className="mb-5 inline-flex min-h-[44px] items-center gap-2 rounded-sm px-1 text-[0.9375rem] font-medium text-[#9c8b73] transition-colors hover:text-[#e8b030] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c8900a]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('backToList')}
        </BackLink>

        <m.header
          className={styles.hero}
          variants={shouldReduceMotion ? undefined : workbenchReveal}
          initial={shouldReduceMotion ? false : 'initial'}
          animate={shouldReduceMotion ? undefined : 'animate'}
        >
          <div className={styles.identity}>
            {keywords.length > 0 && (
              <ul className={styles.keywords}>
                {keywords.map(keyword => {
                  const iconUrl = getIconUrl(keyword)
                  return (
                    <li key={keyword}>
                      {iconUrl && <KeywordIcon src={iconUrl} alt="" width={28} height={28} className="h-7 w-7 object-contain" />}
                      {localizeDeckKeyword(keyword, keywordMessages[keyword], locale)}
                    </li>
                  )
                })}
              </ul>
            )}
            <h1 className={styles.title}>{deck.title}</h1>
          </div>

          <div className={styles.author}>
            <Image src={deck.profiles?.avatar_url || DEFAULT_AVATAR_URL} alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-full bg-[#17120c] object-cover ring-1 ring-[#6b4c12]" />
            <div className="min-w-0">
              {deck.profiles?.username ? (
                <Link href={`/users/${deck.user_id}`} className="block truncate text-[1rem] font-semibold leading-snug text-[#e8dcc8] hover:text-[#e8b030]">{deck.profiles.username}</Link>
              ) : (
                <p className="text-[1rem] font-semibold leading-snug text-[#e8dcc8]">{guestAuthorName(deck.guest_tag, locale) ?? commentsT('anonymous')}</p>
              )}
              <RelativeTime date={deck.created_at} className="text-[0.875rem] text-[#9c8b73]" />
            </div>
          </div>

          <dl className={styles.facts}>
            {contentLabel && (
              <div className={styles.fact}>
                <dt>{t('factContent')}</dt>
                <dd data-text>{contentLabel}</dd>
              </div>
            )}
            <div className={styles.fact}>
              <dt>{t('factFormed')}</dt>
              <dd>{formedSlots.length}<span className="text-[#7f7364]">/{BOARD_SLOT_COUNT}</span></dd>
            </div>
            <div className={styles.fact}>
              <dt>E.G.O</dt>
              <dd>{deck.deck_egos?.filter(row => row.ego).length ?? 0}</dd>
            </div>
            <div className={styles.fact}>
              <dt>{t('vote')}</dt>
              <dd>{voteCount}</dd>
            </div>
            <div className={styles.fact}>
              <dt>{t('factViews')}</dt>
              <dd>{deck.view_count}</dd>
            </div>
          </dl>

          <div className={styles.actions}>
            <button
              type="button"
              onClick={handleVote}
              disabled={authStatus !== 'authenticated' || voting}
              aria-pressed={voted}
              title={authStatus !== 'authenticated' ? t('loginToVote') : voted ? t('undoVote') : t('vote')}
            >
              <Heart className="h-4 w-4" fill={voted ? 'currentColor' : 'none'} aria-hidden="true" />
              {t('vote')} {voteCount}
            </button>
            <button
              type="button"
              onClick={handleBookmark}
              disabled={authStatus !== 'authenticated' || bookmarking}
              aria-pressed={bookmarked}
              title={authStatus !== 'authenticated' ? t('loginToBookmark') : bookmarked ? t('undoBookmark') : t('bookmark')}
            >
              <Bookmark className="h-4 w-4" fill={bookmarked ? 'currentColor' : 'none'} aria-hidden="true" />
              {bookmarked ? t('saved') : t('save')}
            </button>
            <button type="button" onClick={handleShare} disabled={shareGenerating} data-done={shared || undefined}>
              {shared ? <Check className="h-4 w-4" aria-hidden="true" /> : <Share2 className="h-4 w-4" aria-hidden="true" />}
              {shared ? t('copied') : t('share')}
            </button>
            {deck.deck_code && (
              <button type="button" onClick={handleCopyCode} data-done={copied || undefined}>
                {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                {copied ? t('copied') : t('copyDeckCode')}
              </button>
            )}
            {canEdit && (
              <Link href={`/decks/${id}/edit`} className={styles.edit}>
                <Pencil className="h-4 w-4" aria-hidden="true" />
                {t('editDeck')}
              </Link>
            )}
            {guestOwner && (
              <button type="button" onClick={() => setConfirmDelete(true)} style={{ color: '#e8a08a' }}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {rootT('common.delete')}
              </button>
            )}
            {canRecover && <GuestPinRecover kind="deck" id={id} onRecovered={() => { guest.reloadKey(); void guestPosts.mutate() }} />}
            <button type="button" onClick={handleFork} data-primary>
              <GitFork className="h-4 w-4" aria-hidden="true" />
              {t('forkDeck')}
            </button>
          </div>
        </m.header>

        <nav aria-label={t('sectionNav')} className={`sticky-under-nav ${styles.sectionNav}`}>
          <ol ref={sectionNavRef}>
            {sections.map(section => (
              <li key={section.id} className="shrink-0">
                <a
                  href={`#${section.id}`}
                  aria-current={activeSection === section.id ? 'location' : undefined}
                  onClick={event => { event.preventDefault(); goToSection(section.id) }}
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <main className="min-w-0 overflow-x-clip">
          <section id="deck-formation" aria-labelledby="deck-formation-title" className={styles.section}>
            <SectionHead id="deck-formation-title" title={t('sectionFormation')} />
            {filledSlots.length === 0 ? (
              <p className={styles.empty}>{t('identityEmpty')}</p>
            ) : (
              <>
                <FormationTabs
                  tabs={[
                    { key: 'identity', label: rootT('planner.deckTab.subTabs.identity'), count: `${formedSlots.length}/${BOARD_SLOT_COUNT}` },
                    { key: 'ego', label: rootT('planner.deckTab.subTabs.ego'), count: String(deck.deck_egos?.filter(row => row.ego).length ?? 0) },
                  ]}
                  active={formationTab}
                  onChange={setFormationTab}
                  label={rootT('planner.deckTab.subTabs.label')}
                  hint={formationTab === 'identity' ? t('boardHintShort') : null}
                />
                {formationTab === 'ego' ? (
                  <FormationEgoGrid
                    sinners={SINNER_ORDER.map((sinnerId, index) => ({ id: sinnerId, name: rootT(`sinner.${sinnerId}`), filled: Boolean(boardSlots[index]?.identities) }))}
                    egos={formationEgos}
                    onEgoClick={setEgoModalId}
                    noIdentityLabel={rootT('planner.deckTab.ego.noIdentity')}
                  />
                ) : (<>
                <FormationBoard
                  slots={boardSlots.map((slot, index): FormationBoardSlot => {
                    const identity = slot?.identities ?? null
                    const identityName = identity ? localizeIdentityName(identity, locale) : ''
                    return {
                      key: `${identity?.id ?? 'empty'}-${index}`,
                      identity: identity ? adaptBoardIdentity(identity, locale) : null,
                      sinnerId: SINNER_ORDER[index],
                      slotOrder: slot?.slot_order ?? null,
                      uptie: slotUptie(slot),
                      ariaLabel: identity ? t('slotPreview', { index: index + 1, identity: identityName }) : t('emptySlot', { index: index + 1 }),
                      onClick: identity && slot ? () => setIdentityPreview({ slot }) : undefined,
                    }
                  })}
                />

                <DeckInsights identities={insightIdentities} sinCounts={deckAnalysis.sinCounts} baseSinCounts={deckAnalysis.baseSinCounts} summary={deckAnalysis.summary} deployedIds={deployedIdentityIds} />
                </>)}
              </>
            )}
          </section>

          {(deck.description?.trim() || customSkillSlots.length > 0) && (
            <section id="deck-note" aria-labelledby="deck-note-title" className={styles.section}>
              <SectionHead id="deck-note-title" title={t('deckNote')} />
              {deck.description?.trim() && (
                <div className={styles.note}>
                  <NoteRenderer
                    text={deck.description}
                    {...noteLookups}
                    egoGiftLookup={egoGiftLookup}
                    egoGiftConditionLookup={egoGiftConditionLookup}
                    textScale="comfortable"
                  />
                </div>
              )}
              {customSkillSlots.length > 0 && (
                <div className={styles.block}>
                  <h3 className={styles.subhead}>{t('skillDistribution')}</h3>
                  <div className="skill-exchange-list">
                    {customSkillSlots.map((slot, i) => {
                      const identity = slot.identities!
                      const adapted = adaptBoardIdentity(identity, locale)
                      const dist: [number, number, number] = [slot.s1_count ?? 3, slot.s2_count ?? 2, slot.s3_count ?? 1]
                      const best = new Map<string, typeof identity.skills[number]>()
                      for (const s of identity.skills ?? []) {
                        if (['evade', 'defense', 'counter'].includes(s.skill_type)) continue
                        const key = `${s.skill_order}:${(s as { variant_order?: number | null }).variant_order ?? 0}`
                        const existing = best.get(key)
                        if (!existing || (s.uptie_level ?? 3) > (existing.uptie_level ?? 3)) best.set(key, s)
                      }
                      const sortedSkills = [...best.values()].sort((a, b) => a.skill_order - b.skill_order)
                      const imageIndices = computeSkillImageIndices(sortedSkills)
                      const skillAt = (idx: number) => {
                        const skill = sortedSkills.find(s => s.skill_order === idx + 1)
                        return skill ? {
                          name: localizeSkillName(skill, locale),
                          iconSrc: getSkillIconUrl(adapted, imageIndices[skill.id] ?? idx + 1, skill),
                          sinColor: sinColor(skill.sin_affinity),
                        } : null
                      }
                      return (
                        <SkillExchangePanel
                          key={`${identity.id}-${i}`}
                          identity={{
                            imageUrl: identity.folder_name && identity.game_id ? getIdentityImageUrl(identity.sinner_id, identity.folder_name, `${identity.game_id}_normal_info`) : null,
                            name: adapted.name,
                            sinnerName: rootT(`sinner.${identity.sinner_id}`),
                          }}
                          onIdentityClick={() => setIdentityPreview({ slot })}
                          distribution={dist}
                          skills={[skillAt(0), skillAt(1), skillAt(2)]}
                          readOnly
                          showTotal={false}
                        />
                      )
                    })}
                  </div>
                </div>
              )}
            </section>
          )}

          {hasRecommendations && (
            <section id="deck-similar" aria-labelledby="deck-similar-title" className={styles.section}>
              <SectionHead id="deck-similar-title" title={t('sectionRelated')} />
              <DeckRecommendations recommendations={initialRecommendations} currentDeckId={id} />
            </section>
          )}

          <section id="deck-comments" aria-labelledby="deck-comments-title" className={styles.section}>
            <DeckComments deckId={id} initialComments={initialComments ?? []} headingId="deck-comments-title" />
          </section>
        </main>
      </div>

      {identityPreview?.slot.identities && (
        <IdentityDetailModal
          identityId={identityPreview.slot.identities.id}
          uptie={slotUptie(identityPreview.slot)}
          egos={egoGrouped[identityPreview.slot.identities.sinner_id] ?? []}
          onEgoClick={setEgoModalId}
          onClose={() => setIdentityPreview(null)}
        />
      )}
      {egoModalId && (
        <EgoDetailModal egoId={egoModalId} onClose={() => setEgoModalId(null)} />
      )}
      {noteGift && <PlannerGiftModal gift={noteGift} onClose={() => setNoteGift(null)} />}
      <ConfirmModal
        open={confirmDelete}
        title={guestT.deleteDeckTitle}
        message={guestT.deleteDeckMessage}
        confirmLabel={rootT('common.delete')}
        cancelLabel={rootT('common.cancel')}
        variant="danger"
        onConfirm={deleteGuestDeck}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
    </NoteGiftClickContext>
  )
}

function SectionHead({ id, title, meta }: { id: string; title: string; meta?: string }) {
  return (
    <div className="mb-5 flex min-w-0 flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <h2 id={id} className="font-[family-name:var(--font-heading)] text-[1.375rem] leading-snug text-[#e8dcc8] sm:text-[1.5rem]">{title}</h2>
      {meta && <p className="text-[0.875rem] text-[#9c8b73]">{meta}</p>}
    </div>
  )
}
