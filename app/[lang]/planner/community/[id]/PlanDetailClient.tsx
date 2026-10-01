'use client'

import BackLink from '@/components/navigation/BackLink'
import { useHtmlFlag } from '@/hooks/useHtmlFlag'
import { useGuestPosts } from '@/hooks/useGuestPosts'
import { guestAuthorName } from '@/lib/guest/copy'
import { resolvePlannerIdentity, resolvePlannerEgo } from '@/lib/planner/catalog-references'

import { getGameUiAsset } from '@/lib/utils/game-ui'
import { useState, useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { motion, useReducedMotion } from 'motion/react'
import { Link } from '@/lib/i18n/navigation'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import useSWR from 'swr'
import { ArrowLeft, Heart, Share2 } from 'lucide-react'
import { NoteRenderer, type NoteEgoGiftEntry } from '@/components/decks/NoteChips'
import { NoteGiftClickContext } from '@/components/notes/NoteBlockViewer'
import { findNoteGift } from '@/lib/notes/note-gift'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { type Difficulty, type FloorDifficulty, type GiftActivationCondition, type IdentitySlot as PlannerIdentitySlot, type RecipeData } from '@/lib/planner/types'
import { buildGiftMap } from '@/lib/planner/fusion'
import { normalizeFloorPlanDifficulty } from '@/lib/planner/floor-difficulty'
import { computeDifficultySummary, planDifficultyBadge } from '@/lib/planner/stripPlanForList'
import { showError, showSuccess } from '@/lib/toast'
import RelativeTime from '@/components/ui/RelativeTime'
const PlannerGiftModal = dynamic(() => import('@/components/planner/PlannerGiftModal'), { ssr: false })
const loadEventModal = () => import('@/components/mirror-dungeon/EventModal')
const EventModal = dynamic(loadEventModal, { ssr: false })
import type { MdEvent, MdEventChoice, EgoGift, EgoGiftTheme } from '@/components/mirror-dungeon/types'
import PlanActions from '@/components/planner/PlanActions'
import PlanComments from '@/components/planner/PlanComments'
import PlanDeckTabs from '@/components/planner/PlanDeckTabs'
import FloorPlanPreviewBoard from '@/components/planner/FloorPlanPreviewBoard'
import GiftCard from '@/components/ui/GiftCard'
import KeywordIcon from '@/components/ui/KeywordIcon'
import { localizeDeckKeyword } from '@/components/decks/decks-types'
import { STORAGE_BASE, DEFAULT_AVATAR_URL, DEPLOYED_SLOT_COUNT } from '@/lib/constants/game'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import { getGiftActivationConditionStatus, getGiftConditionCountsForSlots, type GiftConditionStatus } from '@/lib/planner/gift-condition-status'
import {
  getSelectedBlessingCost,
  getSelectedBlessingLevels,
  normalizeBlessingMessages,
  ReadOnlyBlessingGrid,
} from '@/components/planner/BlessingTab'
import { workbenchReveal } from '@/lib/animations'
import styles from './PlanDetailHeader.module.css'
import { observationCost } from '@/lib/planner/observation'
import { gameTextToPlain } from '@/lib/game-text/rich-text'

// ── 상수 ──────────────────────────────────────────────────────────────────────

const S = STORAGE_BASE

// 편성 N번 전용 효과 슬롯 파싱
function parseFormationSlots(text: string | null): number[] {
  if (!text) return []
  // Game text may put colour tags (digits and all) inside the bracket label; read the text as shown.
  const m = gameTextToPlain(text).match(/\[편성[^\]]*전용\s*효과\]|\[\d[^\]]*편성\s*전용\s*효과\]/)
  if (!m) return []
  return [...m[0].matchAll(/(\d+)/g)].map(r => parseInt(r[1]))
}

const DIFFICULTY_STYLE: Record<Difficulty, { bg: string; color: string; border: string }> = {
  normal:  { bg: 'rgba(74,152,104,0.15)',  color: '#4a9868', border: 'rgba(74,152,104,0.35)' },
  hard:    { bg: 'rgba(200,144,10,0.15)',  color: '#e8b030', border: 'rgba(200,144,10,0.35)' },
  overlap: { bg: 'rgba(72,152,176,0.15)',  color: '#48b0c0', border: 'rgba(72,152,176,0.35)' },
  extreme: { bg: 'rgba(200,48,48,0.15)',   color: '#e05050', border: 'rgba(200,48,48,0.35)' },
}

// ── 타입 ──────────────────────────────────────────────────────────────────────

type IdentitySlot = {
  identity_id?: string
  sinner_id?: string
  name_kr?: string
  name_en?: string | null
  name_jp?: string | null
  rarity?: number
  keywords?: string[]
  skill_keyword_list?: string[] | null
  gacksung?: boolean
  s1_count?: number | null
  s2_count?: number | null
  s3_count?: number | null
  game_id?: string | null
  folder_name?: string | null
  slot_order?: number
}

type EgoSlot = {
  ego_id?: string
  sinner_id?: string
  name_kr?: string
  grade?: string
}

type FloorEntry = {
  floor: number
  difficulty?: FloorDifficulty
  theme_id: string | null
  gift_ids: string[]
  memo: string
}

type GiftData = {
  id: string
  game_id: number
  name: string
  name_en?: string | null
  name_jp?: string | null
  keyword: string | null
  grade: string | null
  image_url: string | null
  effect_base: string | null
  effect_plus: string | null
  effect_plusplus: string | null
  theme_ids: number[] | null
  activation_condition: GiftActivationCondition | null
}

type ThemeData = {
  id: string
  name: string
  name_en?: string | null
  name_jp?: string | null
  ego_gift_ids: number[] | null
  specific_ego_gift_ids: number[] | null
  fixed_reward_gift_ids?: number[] | null
  image_url: string | null
  difficulty: string | null
  floor_info: Record<string, number[] | string> | null
}

type IdentityData = {
  id: string
  sinner_id: string
  name?: string | null
  name_kr: string
  name_en?: string | null
  name_jp?: string | null
  tier: number
  rarity: number
  keywords: string[] | null
  skill_keyword_list?: string[] | null
  affiliation?: string | null
  association_list?: string[] | null
  game_id: string | null
  folder_name: string | null
  hp: number | null
  speed_min: number | null
  speed_max: number | null
  def_level: number | null
  slash_res: string | null
  pierce_res: string | null
  blunt_res: string | null
}

type SinnerData = {
  id: string
  name_kr: string
  order_num: number
}

type EgoData = {
  id: string
  sinner_id: string
  name: string
  name_kr: string | null
  name_en?: string | null
  name_jp?: string | null
  grade: string
  sin_affinity: string | null
  folder_name?: string | null
  image_url: string | null
  cost: number[] | null
}

type SkillSummary = {
  id: string
  identity_id: string
  name: string
  name_en?: string | null
  name_jp?: string | null
  sin_affinity: string
  skill_type: string
  atk_type?: string | null
  coins: number | null
  base_power: number | null
  coin_power: number | null
  skill_order: number
  variant_order?: number | null
  atk_weight: number | null
  offense_level: number | null
  description?: string | null
  description_en?: string | null
  description_jp?: string | null
  uptie_level: number | null
}

type PassiveSummary = {
  id: string
  identity_id: string
  name: string
  name_en?: string | null
  name_jp?: string | null
  passive_type: string
  sin_affinity: string | null
  sin_count: number | null
  sin_requirements?: { sin: string; count: number }[] | null
  active_cond: string | null
  description: string | null
  description_en?: string | null
  description_jp?: string | null
  passive_order: number
  uptie_level: number | null
}

type Plan = {
  id: string
  title: string
  description: string | null
  difficulty: Difficulty
  deck: IdentitySlot[] | null
  egos: EgoSlot[] | null
  tags?: string[] | null
  floor_plan: FloorEntry[] | null
  gift_inventory: string[] | null
  vote_count: number
  view_count: number
  comment_count: number
  created_at: string
  user_id: string
  guest_tag?: string | null
  profiles: { username: string | null; avatar_url: string | null } | null
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHead({ id, title, meta, caption }: { id: string; title: string; meta?: ReactNode; caption?: string }) {
  return (
    <div className="mb-5 flex min-w-0 flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <div className="min-w-0">
        <h2 id={id} className="font-[family-name:var(--font-heading)] text-[1.375rem] leading-snug text-[#e8dcc8] sm:text-[1.5rem]">{title}</h2>
        {caption && <p className="mt-1 text-[0.9375rem] leading-snug text-[#9c8b73]">{caption}</p>}
      </div>
      {meta != null && <div className="shrink-0 text-[0.9375rem] tabular-nums text-[#9c8b73]">{meta}</div>}
    </div>
  )
}

/** Same starlight chip as the planner's blessing and observation costs. */
function StarlightCost({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[rgba(92,73,54,0.86)] bg-[rgba(18,15,12,0.72)] px-2.5 text-[0.875rem] text-[#d8c1a0]">
      <Image src={getGameUiAsset('start-buffs/starlight')} alt="" width={18} height={18} className="h-[1.125rem] w-[1.125rem]" />
      {label}
      <span className="font-semibold tabular-nums text-[#e8b030]">{value}</span>
    </span>
  )
}

function SubHead({ title, meta }: { title: string; meta: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="font-[family-name:var(--font-heading)] text-[1.0625rem] text-[#e8dcc8]">{title}</h3>
      <span className="flex items-center gap-2 text-[0.875rem] tabular-nums text-[#9c8b73]">{meta}</span>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="border-l-2 border-[#2e2417] py-1 pl-3 text-[0.9375rem] leading-relaxed text-[#7f7364]">
      {text}
    </p>
  )
}

function Section({ id, children }: { id: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={styles.section}>
      {children}
    </section>
  )
}

function GiftGrid({ gifts, getCondition, onGiftClick, locale }: {
  gifts: { gift: GiftData; enhance: number }[]
  getCondition?: (gift: GiftData) => GiftConditionStatus | null
  onGiftClick?: (gift: GiftData, enhance: number) => void
  locale: SupportedLang
}) {
  return (
    <ul className={styles.giftGrid}>
      {gifts.map(({ gift, enhance }) => {
        const cond = getCondition?.(gift)
        const giftName = getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, locale)
        return (
          <li key={`${gift.game_id}_${enhance}`} className={styles.giftCell}>
            <GiftCard
              gift={gift}
              onClick={() => onGiftClick?.(gift, enhance)}
              disabled={!onGiftClick}
              enhance={enhance}
              conditionStatus={cond}
              title={giftName}
              ariaLabel={giftName}
              size="100%"
              className="max-w-[5rem]"
            />
          </li>
        )
      })}
    </ul>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  plan: Plan
  themes: ThemeData[]
  gifts: GiftData[]
  recipes: RecipeData[]
  identities: IdentityData[]
  sinners: SinnerData[]
  skills: SkillSummary[]
  passives: PassiveSummary[]
  egos: EgoData[]
  /** Events that award this plan's floor gifts, plus their follow-up events (for the in-place event modal). */
  events: MdEvent[]
  eventChoices: MdEventChoice[]
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PlanDetailClient({ plan, themes, gifts, recipes, identities, sinners, skills, passives, egos, events, eventChoices }: Props) {
  useHtmlFlag('with-plan-detail')
  const locale = useLocale() as SupportedLang
  const tPlanner = useTranslations('planner')
  const tFloor = useTranslations('planner.floorTab')
  const tDetail = useTranslations('planner.detail')
  const tCommunity = useTranslations('planner.communityBoard')
  const tBlessing = useTranslations('planner.blessingTab')
  const tShare = useTranslations('decks.detail')
  const { data: session, status: authStatus } = useSession()
  const viewer = useSWR<{ id?: string }>(authStatus === 'authenticated' ? '/api/profile/avatar' : null, (url: string) => fetch(url).then(res => res.json())).data
  // Signed-out visitors own a guest plan when this browser's key wrote it.
  const guestPosts = useGuestPosts(authStatus === 'unauthenticated' && !plan.user_id).posts
  const guestOwner = authStatus === 'unauthenticated' && !!guestPosts.data?.plans.some(post => post.id === plan.id)
  const [voted, setVoted] = useState(false)
  const [voteCount, setVoteCount] = useState(plan.vote_count)
  const [voteLoading, setVoteLoading] = useState(false)
  const [selectedGift, setSelectedGift] = useState<{ gift: GiftData; enhance?: number } | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)
  const openNoteGift = (key: string) => {
    const gift = findNoteGift(gifts, key)
    if (gift) setSelectedGift({ gift, enhance: 0 })
  }
  const shouldReduceMotion = useReducedMotion()

  const isAdmin = (session?.user as { isAdmin?: boolean } | undefined)?.isAdmin === true

  const difficultyBadge = planDifficultyBadge(plan.difficulty, computeDifficultySummary(plan.floor_plan, plan.difficulty))
  const diffStyle = DIFFICULTY_STYLE[difficultyBadge.styleKey]

  const deck: IdentitySlot[] = (Array.isArray(plan.deck) ? plan.deck : []).map(slot => ({ ...slot, identity_id: resolvePlannerIdentity(slot, identities)?.id ?? slot.identity_id }))
  const egoSlots: EgoSlot[] = (Array.isArray(plan.egos) ? plan.egos : []).map(slot => ({ ...slot, ego_id: resolvePlannerEgo(slot, egos)?.id ?? slot.ego_id }))
  const floorPlan: FloorEntry[] = normalizeFloorPlanDifficulty(plan.floor_plan, plan.difficulty).floorPlan as FloorEntry[]
  const giftInventory: string[] = Array.isArray(plan.gift_inventory) ? plan.gift_inventory : []

  const username = plan.profiles?.username ?? guestAuthorName(plan.guest_tag, locale) ?? tDetail('anonymous')
  const avatarUrl = plan.profiles?.avatar_url ?? DEFAULT_AVATAR_URL

  // Maps
  const giftMap = useMemo(() => buildGiftMap(gifts), [gifts])
  const themeMap = useMemo(() => new Map(themes.map(t => [String(t.id), t])), [themes])
  const eventById = useMemo(() => new Map(events.map(event => [event.id, event])), [events])
  const choicesByEventId = useMemo(() => {
    const map = new Map<number, MdEventChoice[]>()
    for (const choice of eventChoices) map.set(choice.event_id, [...(map.get(choice.event_id) ?? []), choice])
    return map
  }, [eventChoices])
  // 상세 페이지의 기프트 행은 ego_gifts 전체 컬럼이라 이벤트 모달의 EgoGift로 그대로 쓸 수 있다
  const eventGifts = giftMap as unknown as Map<number, EgoGift>
  const eventThemes = useMemo(() => themes.map(theme => ({ ...theme, id: Number(theme.id) }) as unknown as EgoGiftTheme), [themes])
  const selectedEvent = selectedEventId == null ? null : eventById.get(selectedEventId) ?? null

  // 레시피맵
  const giftByName = useMemo(() => {
    const map = new Map<string, GiftData>()
    for (const g of gifts) map.set(g.name, g)
    return map
  }, [gifts])
  const recipeMap = useMemo(() => {
    const map = new Map<number, { materials: GiftData[]; result: GiftData }>()
    for (const r of recipes) {
      const result = giftByName.get(r.result_name)
      if (!result) continue
      const mats = r.ingredients.map((name: string) => giftByName.get(name)).filter(Boolean) as GiftData[]
      map.set(result.game_id, { materials: mats, result })
    }
    return map
  }, [recipes, giftByName])

  // EgoGift lookup for NoteRenderer
  const egoGiftLookup = useMemo(() => {
    const map: Record<string, NoteEgoGiftEntry> = {}
    for (const g of gifts) {
      if (g.name && g.keyword) {
        map[g.name] = { name: g.name, keyword: g.keyword, grade: g.grade ?? '1', image_url: g.image_url, effect_base: g.effect_base }
      }
    }
    return map
  }, [gifts])

  const kwContext = useKeywordData()
  const allowedKeywords = useMemo(() => new Set(Object.keys(kwContext.keywords)), [kwContext.keywords])
  const localizedBlessings = useMemo(
    () => normalizeBlessingMessages(tBlessing.raw('blessings'), baseId => tBlessing('fallbackName', { baseId })),
    [tBlessing],
  )
  const selectedBlessings = useMemo(
    () => getSelectedBlessingLevels(giftInventory),
    [giftInventory],
  )

  const totalBlessingCost = useMemo(
    () => getSelectedBlessingCost(localizedBlessings, selectedBlessings),
    [localizedBlessings, selectedBlessings],
  )

  // Gift categorization
  const observeGifts = useMemo(() =>
    giftInventory.filter(id => id.startsWith('observe_')).map(id => giftMap.get(parseInt(id.replace('observe_', '')))).filter(Boolean) as GiftData[]
  , [giftInventory, giftMap])

  const startGifts = useMemo(() =>
    giftInventory.filter(id => id.startsWith('start_')).map(id => giftMap.get(parseInt(id.replace('start_', '')))).filter(Boolean) as GiftData[]
  , [giftInventory, giftMap])

  const finalGifts = useMemo(() => {
    const list: { gift: GiftData; enhance: number }[] = []
    for (const id of giftInventory) {
      if (!id.startsWith('final_')) continue
      let enhance = 0, gid: number
      if (id.endsWith('_plusplus')) { gid = parseInt(id.replace('final_', '').replace('_plusplus', '')); enhance = 2 }
      else if (id.endsWith('_plus')) { gid = parseInt(id.replace('final_', '').replace('_plus', '')); enhance = 1 }
      else { gid = parseInt(id.replace('final_', '')) }
      const gift = giftMap.get(gid)
      if (gift) list.push({ gift, enhance })
    }
    return list
  }, [giftInventory, giftMap])

  // 편성 슬롯 → 최종 기프트 이미지 매핑 (PlanDeckTabs에 전달)
  const slotGiftMap = useMemo(() => {
    const map = new Map<number, string[]>()
    for (const { gift, enhance } of finalGifts) {
      const txt = enhance === 2 ? gift.effect_plusplus : enhance === 1 ? gift.effect_plus : gift.effect_base
      const slots = parseFormationSlots(txt)
      if (!gift.image_url || !slots.length) continue
      for (const s of slots) {
        if (!map.has(s)) map.set(s, [])
        map.get(s)!.push(gift.image_url)
      }
    }
    return map
  }, [finalGifts])

  // Condition checks for final gifts
  const conditionCounts = useMemo(() => {
    const conditionSlots: PlannerIdentitySlot[] = deck
      .filter(slot => slot.identity_id && slot.sinner_id)
      .map(slot => ({
        identity_id: slot.identity_id!,
        sinner_id: slot.sinner_id!,
        name_kr: slot.name_kr ?? '',
        rarity: slot.rarity ?? 1,
        keywords: slot.keywords ?? [],
        skill_keyword_list: slot.skill_keyword_list,
        game_id: slot.game_id ?? null,
        folder_name: slot.folder_name ?? null,
        slot_order: slot.slot_order ?? 99,
      }))
    return getGiftConditionCountsForSlots(conditionSlots, identities)
  }, [deck, identities])

  // Same check as the planner: keyword and affiliation conditions against the deployed slots and the bench.
  function getConditionStatus(gift: GiftData): GiftConditionStatus | null {
    return getGiftActivationConditionStatus({ gift, ...conditionCounts })
  }

  // 조회수 증가 (페이지 로드 시 1회)
  useEffect(() => {
    fetch(`/api/planner/${plan.id}/view`, { method: 'POST' }).catch(() => {})
  }, [plan.id])

  // 추천 상태 확인
  useEffect(() => {
    if (!session) return
    fetch(`/api/planner/${plan.id}/vote`)
      .then(r => r.json())
      .then(d => setVoted(d.voted ?? false))
      .catch(() => {})
  }, [plan.id, session])

  const handleVote = async () => {
    if (!session) { showError(tDetail('loginRequired')); return }
    setVoteLoading(true)
    try {
      const res = await fetch(`/api/planner/${plan.id}/vote`, { method: 'POST' })
      const json = await res.json()
      if (res.ok) {
        setVoted(json.voted)
        setVoteCount(prev => json.voted ? prev + 1 : prev - 1)
      }
    } catch { /* 무시 */ } finally {
      setVoteLoading(false)
    }
  }

  const difficultyLabel = difficultyBadge.labelKeys.map(key => tCommunity(`difficulty.${key}`)).join("/\u200b")
  const mainKeywords = (plan.tags ?? []).filter(Boolean)
  const configuredFloors = floorPlan.filter(f => f.theme_id).length
  const floorCountLabel = tFloor('configuredFloorCount', { configured: configuredFloors, total: floorPlan.length })
  const openGift = (gift: GiftData, enhance: number) => setSelectedGift({ gift, enhance })

  const sections = [
    ...(plan.description ? [{ id: 'plan-summary', label: tPlanner('tabs.summary') }] : []),
    { id: 'plan-deck', label: tPlanner('tabs.deck') },
    { id: 'plan-blessing', label: tPlanner('tabs.blessing') },
    { id: 'plan-gifts', label: tPlanner('tabs.gift') },
    { id: 'plan-floor', label: tPlanner('tabs.floor') },
    { id: 'plan-final', label: tDetail('finalGifts') },
    { id: 'plan-comments', label: tDetail('commentsLabel'), count: plan.comment_count },
  ]
  const sectionKey = sections.map(s => s.id).join()
  const [activeSection, setActiveSection] = useState(sections[0].id)
  // 스크롤 위치에 맞춰 구역 목차의 현재 항목을 표시한다: 화면 위 30% 선을 지난 마지막 구역
  useEffect(() => {
    const ids = sectionKey.split(',')
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const line = window.innerHeight * 0.3
        let current = ids[0]
        for (const id of ids) {
          const top = document.getElementById(id)?.getBoundingClientRect().top
          if (top != null && top <= line) current = id
        }
        setActiveSection(current)
      })
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [sectionKey])

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
  const goToSection = (id: string) => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    setActiveSection(id)
  }

  const handleShare = async () => {
    const url = window.location.href.split('#')[0]
    try {
      if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title: plan.title, url })
        return
      }
      await navigator.clipboard.writeText(url)
      showSuccess(tShare('shareCopied'))
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') showError(tDetail('shareFailed'))
    }
  }

  return (
    <NoteGiftClickContext value={openNoteGift}>
    <div data-plan-detail className="min-h-screen bg-[#0d0b08] pt-24 pb-20">
      <div className="mx-auto w-full max-w-7xl px-3 sm:px-6">
        <BackLink
          href="/planner/community"
          className="mb-5 inline-flex min-h-[44px] items-center gap-2 rounded-sm px-1 text-[0.9375rem] font-medium text-[#9c8b73] transition-colors hover:text-[#e8b030] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c8900a]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {tDetail('backToCommunity')}
        </BackLink>

        <motion.header
          className={styles.hero}
          variants={shouldReduceMotion ? undefined : workbenchReveal}
          initial={shouldReduceMotion ? false : 'initial'}
          animate={shouldReduceMotion ? undefined : 'animate'}
        >
          <div className={styles.identity}>
            {mainKeywords.length > 0 && (
              <ul className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                {mainKeywords.map(keyword => {
                  const iconUrl = kwContext.getIconUrl(keyword)
                  return (
                    <li key={keyword} className="inline-flex min-h-8 items-center gap-1.5">
                      {iconUrl && <KeywordIcon src={iconUrl} alt="" width={28} height={28} className="h-7 w-7 object-contain" />}
                      <span className="font-[family-name:var(--font-heading)] text-[1rem] leading-none text-[#cfc2ad]">
                        {localizeDeckKeyword(keyword, kwContext.keywords[keyword], locale)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
            <h1 className={styles.title}>{plan.title}</h1>
          </div>

          <div className={`${styles.author} flex items-center gap-3`}>
            <Image src={avatarUrl} alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-full bg-[#17120c] object-cover ring-1 ring-[#6b4c12]" />
            <div className="min-w-0">
              <p className="truncate text-[1rem] font-semibold leading-snug text-[#e8dcc8]">{username}</p>
              <RelativeTime date={plan.created_at} className="text-[0.875rem] text-[#9c8b73]" />
            </div>
          </div>

          <dl className={styles.facts}>
            <div className={styles.fact}>
              <dt>{tDetail('factDifficulty')}</dt>
              <dd data-text style={{ color: diffStyle.color }}>{difficultyLabel}</dd>
            </div>
            <div className={styles.fact}>
              <dt>{tDetail('factIdentities')}</dt>
              <dd>{deck.length}</dd>
            </div>
            <div className={styles.fact}>
              <dt>{tPlanner('deckTab.subTabs.ego')}</dt>
              <dd>{egoSlots.length}</dd>
            </div>
            {floorPlan.length > 0 && (
              <div className={styles.fact}>
                <dt>{tDetail('factFloors')}</dt>
                <dd aria-label={floorCountLabel}>{configuredFloors}<span className="text-[#7f7364]">/{floorPlan.length}</span></dd>
              </div>
            )}
            <div className={styles.fact}>
              <dt>{tDetail('viewsLabel')}</dt>
              <dd>{plan.view_count}</dd>
            </div>
            <div className={styles.fact}>
              <dt>{tDetail('commentsLabel')}</dt>
              <dd>{plan.comment_count}</dd>
            </div>
          </dl>

          <div className={styles.actions}>
            <button type="button" onClick={handleVote} disabled={voteLoading} aria-pressed={voted}>
              <Heart className="h-4 w-4" fill={voted ? 'currentColor' : 'none'} aria-hidden="true" />
              {tDetail('voteWithCount', { count: voteCount })}
            </button>
            <button type="button" onClick={handleShare}>
              <Share2 className="h-4 w-4" aria-hidden="true" />
              {tShare('share')}
            </button>
            <PlanActions
              planId={plan.id}
              planTitle={plan.title}
              planDescription={plan.description}
              difficulty={plan.difficulty}
              deck={deck}
              egoSlots={egoSlots}
              floorPlan={floorPlan}
              giftInventory={giftInventory}
              mainKeywords={plan.tags ?? []}
              identities={identities}
              sinners={sinners}
              egos={egos}
              isOwner={(!!viewer?.id && viewer.id === plan.user_id) || guestOwner}
              guestOwner={guestOwner}
              isAdmin={isAdmin}
            />
          </div>
        </motion.header>

        <nav aria-label={tPlanner('sectionNav')} className={`sticky-under-nav ${styles.sectionNav}`}>
          <ol ref={sectionNavRef}>
            {sections.map(section => (
              <li key={section.id} className="shrink-0">
                <a
                  href={`#${section.id}`}
                  aria-current={activeSection === section.id ? 'location' : undefined}
                  onClick={event => { event.preventDefault(); goToSection(section.id) }}
                >
                  {section.label}
                  {section.count != null && <span>{section.count}</span>}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <main className="min-w-0 overflow-x-clip">
          {plan.description && (
            <Section id="plan-summary">
              <SectionHead id="plan-summary-title" title={tPlanner('tabs.summary')} />
              <div
                className="planner-detail-note min-w-0 max-w-[52rem] text-[1rem] leading-8 text-[#cfc2ad] [&>div]:!max-w-none"
                style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
              >
                <NoteRenderer
                  text={plan.description}
                  allowedKeywords={allowedKeywords}
                  egoGiftLookup={egoGiftLookup}
                  textScale="comfortable"
                />
              </div>
            </Section>
          )}

          <Section id="plan-deck">
            <SectionHead id="plan-deck-title" title={tPlanner('tabs.deck')} />
            <PlanDeckTabs
              deck={deck}
              egoSlots={egoSlots}
              identities={identities}
              sinners={sinners}
              egos={egos}
              skills={skills}
              passives={passives}
              slotGiftMap={slotGiftMap}
            />
          </Section>

          <Section id="plan-blessing">
            <SectionHead
              id="plan-blessing-title"
              title={tBlessing('title')}
              meta={selectedBlessings.size > 0 ? <StarlightCost label={tBlessing('usedStarlight')} value={totalBlessingCost} /> : tBlessing('none')}
            />
            <div className="overflow-x-clip">
              <ReadOnlyBlessingGrid
                blessings={localizedBlessings}
                selectedBlessings={selectedBlessings}
                emptyText={tBlessing('empty')}
              />
            </div>
          </Section>

          <Section id="plan-gifts">
            <SectionHead id="plan-gifts-title" title={tPlanner('tabs.gift')} />
            <div className="grid gap-8 md:grid-cols-2 md:gap-0">
              <div className="min-w-0 md:pr-8">
                <SubHead title={tDetail('startGifts')} meta={tDetail('itemCount', { count: startGifts.length })} />
                {startGifts.length > 0 ? (
                  <GiftGrid locale={locale} gifts={startGifts.map(g => ({ gift: g, enhance: 0 }))} onGiftClick={openGift} />
                ) : (
                  <EmptyState text={tDetail('emptyStartGifts')} />
                )}
              </div>
              <div className="min-w-0 md:border-l md:border-[#2e2417] md:pl-8">
                <SubHead title={tDetail('observeGifts')} meta={<>{tDetail('observeCount', { count: observeGifts.length })}{observeGifts.length > 0 && <StarlightCost label={tDetail('observeCost')} value={observationCost(observeGifts.length)} />}</>} />
                {observeGifts.length > 0 ? (
                  <GiftGrid locale={locale} gifts={observeGifts.map(g => ({ gift: g, enhance: 0 }))} onGiftClick={openGift} />
                ) : (
                  <EmptyState text={tDetail('emptyObserveGifts')} />
                )}
              </div>
            </div>
          </Section>

          <Section id="plan-floor">
            <SectionHead
              id="plan-floor-title"
              title={tPlanner('tabs.floor')}
              meta={floorCountLabel}
              caption={tDetail('floorPlanCaption')}
            />
            <FloorPlanPreviewBoard
              inventory={giftInventory}
              recipes={recipes}
              floorPlan={floorPlan}
              planDifficulty={plan.difficulty}
              themeMap={themeMap}
              giftMap={giftMap}
              onGiftClick={gift => setSelectedGift({ gift, enhance: 0 })}
              events={events}
              onEventClick={setSelectedEventId}
              onEventPrefetch={() => { void loadEventModal() }}
              renderMemo={memo => (
                <NoteRenderer text={memo} allowedKeywords={allowedKeywords} egoGiftLookup={egoGiftLookup} />
              )}
            />
          </Section>

          <Section id="plan-final">
            <SectionHead id="plan-final-title" title={tDetail('finalGifts')} meta={tDetail('itemCount', { count: finalGifts.length })} />
            {deck.length > 0 && finalGifts.length > 0 && (
              <ul className="mb-4 flex flex-wrap gap-x-6 gap-y-1.5 text-[0.875rem] leading-snug text-[#9c8b73]">
                <li className="inline-flex items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-full bg-[#ef4444]" aria-hidden="true" />{tDetail('conditionUnmet')}</li>
                <li className="inline-flex items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-full bg-[#e8b030]" aria-hidden="true" />{tDetail('conditionWarn', { deployed: DEPLOYED_SLOT_COUNT })}</li>
              </ul>
            )}
            {finalGifts.length > 0 ? (
              <GiftGrid locale={locale} gifts={finalGifts} getCondition={getConditionStatus} onGiftClick={openGift} />
            ) : (
              <EmptyState text={tDetail('emptyFinalGifts')} />
            )}
          </Section>

          <Section id="plan-comments">
            <PlanComments planId={plan.id} headingId="plan-comments-title" />
          </Section>
        </main>
      </div>

      {/* 기프트 상세 모달 */}
      {selectedEvent && (
        <EventModal
          lang={locale}
          event={selectedEvent}
          eventById={eventById}
          choicesByEventId={choicesByEventId}
          giftByGameId={eventGifts}
          themes={eventThemes}
          onClose={() => setSelectedEventId(null)}
          onSelectGift={gift => {
            const planGift = gift.game_id == null ? undefined : giftMap.get(gift.game_id)
            if (planGift) setSelectedGift({ gift: planGift, enhance: 0 })
          }}
          pageLink={{ href: `/mirror-dungeon?tab=events&event=${selectedEvent.id}`, label: tDetail('viewEventPage') }}
        />
      )}
      {selectedGift && (
        <PlannerGiftModal
          gift={selectedGift.gift}
          enhance={selectedGift.enhance}
          onClose={() => setSelectedGift(null)}
          themes={themes}
          conditionStatus={getConditionStatus(selectedGift.gift)}
          recipe={recipeMap.get(selectedGift.gift.game_id) ?? null}
        />
      )}
    </div>
    </NoteGiftClickContext>
  )
}
