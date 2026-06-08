'use client'

import { useState, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { motion, useReducedMotion } from 'motion/react'
import { Link } from '@/lib/i18n/navigation'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { ArrowLeft, Heart, Eye, MessageCircle } from 'lucide-react'
import { NoteRenderer, type NoteEgoGiftEntry } from '@/components/decks/NoteChips'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { type Difficulty, type FloorDifficulty, type GiftActivationCondition, type IdentitySlot as PlannerIdentitySlot, type RecipeData } from '@/lib/planner/types'
import { buildGiftMap } from '@/lib/planner/fusion'
import { normalizeFloorPlanDifficulty } from '@/lib/planner/floor-difficulty'
import { showError } from '@/lib/toast'
import RelativeTime from '@/components/ui/RelativeTime'
const PlannerGiftModal = dynamic(() => import('@/components/planner/PlannerGiftModal'), { ssr: false })
import PlanActions from '@/components/planner/PlanActions'
import PlanComments from '@/components/planner/PlanComments'
import PlanDeckTabs from '@/components/planner/PlanDeckTabs'
import FloorPlanPreviewBoard from '@/components/planner/FloorPlanPreviewBoard'
import GiftCard from '@/components/ui/GiftCard'
import { STORAGE_BASE } from '@/lib/constants/game'
import { normalizeThemeKeyword } from '@/lib/constants/keywords'
import { DEFAULT_AVATAR_URL } from '@/lib/constants/game'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import { getGiftConditionCountsForSlots } from '@/lib/planner/gift-condition-status'
import {
  getSelectedBlessingCost,
  getSelectedBlessingLevels,
  normalizeBlessingMessages,
  ReadOnlyBlessingGrid,
} from '@/components/planner/BlessingTab'
import { staggerContainer, workbenchReveal, workbenchStaggerItem } from '@/lib/animations'

// ── 상수 ──────────────────────────────────────────────────────────────────────

const S = STORAGE_BASE

// 편성 N번 전용 효과 슬롯 파싱
function parseFormationSlots(text: string | null): number[] {
  if (!text) return []
  const m = text.match(/\[편성[^\]]*전용\s*효과\]|\[\d[^\]]*편성\s*전용\s*효과\]/)
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
  dungeon_id: string | null
  ego_gift_ids: number[] | null
  specific_ego_gift_ids: number[] | null
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
  profiles: { username: string | null; avatar_url: string | null } | null
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ title, count, caption }: { title: string; count: string; caption?: string }) {
  return (
    <div className="flex min-w-0 items-end justify-between gap-3 border-b border-[#241c14] pb-2">
      <div className="min-w-0">
        <h2 className="text-[1.125rem] font-semibold leading-snug text-[#e8dcc8]">{title}</h2>
        {caption && <p className="mt-1 text-[0.875rem] leading-snug text-[#7f7364]">{caption}</p>}
      </div>
      <span className="shrink-0 font-mono text-[0.875rem] font-semibold tabular-nums text-[#9d8d72]">{count}</span>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-[#241c14] bg-[#120e09] px-4 py-5 text-center text-[0.9375rem] leading-relaxed text-[#6b6255]">
      {text}
    </div>
  )
}

function DetailSection({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.section
      className={`min-w-0 rounded-md border border-[#241c14] bg-[#120e09]/92 p-3 sm:p-4 ${className}`}
      variants={shouldReduceMotion ? undefined : workbenchStaggerItem}
    >
      {children}
    </motion.section>
  )
}

function GiftGrid({ gifts, getCondition, onGiftClick, locale }: {
  gifts: { gift: GiftData; enhance: number }[]
  getCondition?: (gift: GiftData) => { level: 'warn' | 'unmet'; text: string } | null
  onGiftClick?: (gift: GiftData, enhance: number) => void
  locale: SupportedLang
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] justify-items-center gap-x-3 gap-y-4 sm:grid-cols-[repeat(auto-fill,minmax(5rem,1fr))]">
      {gifts.map(({ gift, enhance }) => {
        const cond = getCondition?.(gift)
        const giftName = getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, locale)
        return (
          <GiftCard
            key={`${gift.game_id}_${enhance}`}
            gift={gift}
            onClick={() => onGiftClick?.(gift, enhance)}
            disabled={!onGiftClick}
            enhance={enhance}
            conditionStatus={cond}
            title={giftName}
            ariaLabel={giftName}
            size="100%"
            className="max-w-[5.25rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c8900a]"
          />
        )
      })}
    </div>
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
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PlanDetailClient({ plan, themes, gifts, recipes, identities, sinners, skills, passives, egos }: Props) {
  const locale = useLocale() as SupportedLang
  const tPlanner = useTranslations('planner')
  const tFloor = useTranslations('planner.floorTab')
  const tDetail = useTranslations('planner.detail')
  const tCommunity = useTranslations('planner.communityBoard')
  const tBlessing = useTranslations('planner.blessingTab')
  const { data: session } = useSession()
  const [voted, setVoted] = useState(false)
  const [voteCount, setVoteCount] = useState(plan.vote_count)
  const [voteLoading, setVoteLoading] = useState(false)
  const [selectedGift, setSelectedGift] = useState<{ gift: GiftData; enhance?: number } | null>(null)
  const shouldReduceMotion = useReducedMotion()

  const isAdmin = (session?.user as { isAdmin?: boolean } | undefined)?.isAdmin === true

  const diffStyle = DIFFICULTY_STYLE[plan.difficulty]

  const deck: IdentitySlot[] = Array.isArray(plan.deck) ? plan.deck : []
  const egoSlots: EgoSlot[] = Array.isArray(plan.egos) ? plan.egos : []
  const floorPlan: FloorEntry[] = normalizeFloorPlanDifficulty(plan.floor_plan, plan.difficulty).floorPlan as FloorEntry[]
  const giftInventory: string[] = Array.isArray(plan.gift_inventory) ? plan.gift_inventory : []

  const username = plan.profiles?.username ?? tDetail('anonymous')
  const avatarUrl = plan.profiles?.avatar_url ?? DEFAULT_AVATAR_URL

  // Maps
  const giftMap = useMemo(() => buildGiftMap(gifts), [gifts])
  const themeMap = useMemo(() => new Map(themes.map(t => [String(t.id), t])), [themes])

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
  const { formationKeywordCounts: formationKwCounts, allKeywordCounts: allKwCounts } = useMemo(() => {
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

  function getConditionStatus(gift: GiftData): { level: 'warn' | 'unmet'; text: string } | null {
    const cond = gift.activation_condition
    if (!cond || !cond.count) return null
    let fHave = 0, aHave = 0, label = ''
    if (cond.type === 'keyword' && cond.keyword) {
      const keyword = normalizeThemeKeyword(cond.keyword)
      fHave = formationKwCounts[keyword] ?? 0
      aHave = allKwCounts[keyword] ?? 0
      label = cond.keyword
    } else if (cond.type === 'multi_keyword' && cond.keywords) {
      fHave = cond.keywords.reduce((s, kw) => s + (formationKwCounts[normalizeThemeKeyword(kw)] ?? 0), 0)
      aHave = cond.keywords.reduce((s, kw) => s + (allKwCounts[normalizeThemeKeyword(kw)] ?? 0), 0)
      label = cond.keywords.join('+')
    } else { return null }
    if (fHave >= cond.count) return null
    if (aHave >= cond.count) return { level: 'warn', text: `${label} ${fHave}/${cond.count}` }
    return { level: 'unmet', text: `${label} ${aHave}/${cond.count}` }
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

  const difficultyLabel = tCommunity(`difficulty.${plan.difficulty}`)
  const deckCountLabel = tDetail('deckCount', { count: deck.length })

  return (
    <div className="min-h-screen bg-[#0d0b08] pt-24 pb-16">
      <div className="mx-auto w-full max-w-7xl px-3 sm:px-6">
        <Link
          href="/planner/community"
          className="mb-4 inline-flex min-h-[44px] items-center gap-2 rounded-sm px-1 text-[0.9375rem] font-medium text-[#7f7364] transition-colors hover:text-[#c8900a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c8900a]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {tDetail('backToCommunity')}
        </Link>

        <motion.header
          className="mb-5 border-y border-[#2a2118] bg-[#100c08]/76"
          variants={shouldReduceMotion ? undefined : workbenchReveal}
          initial={shouldReduceMotion ? false : 'initial'}
          animate={shouldReduceMotion ? undefined : 'animate'}
        >
          <div className="grid min-w-0 gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,21rem)]">
            <div className="min-w-0 px-3 py-3.5 sm:px-5 sm:py-4">
              <div className="mb-2.5 flex min-w-0 flex-wrap items-center gap-2">
                <span
                  className="inline-flex min-h-9 items-center rounded-sm border px-2.5 text-[0.9375rem] font-semibold"
                  style={{ background: diffStyle.bg, color: diffStyle.color, borderColor: diffStyle.border }}
                >
                  {difficultyLabel}
                </span>
                <span className="inline-flex min-h-9 items-center rounded-sm border border-[#2a2118] bg-[#1a1510] px-2.5 font-mono text-[0.875rem] font-semibold tabular-nums text-[#b9a47f]">
                  {deckCountLabel}
                </span>
                <span className="inline-flex min-h-9 items-center rounded-sm border border-[#2a2118] bg-[#1a1510] px-2.5 font-mono text-[0.875rem] font-semibold tabular-nums text-[#b9a47f]">
                  {tDetail('egoCount', { count: egoSlots.length })}
                </span>
              </div>

              <h1 className="max-w-[34ch] break-words font-serif text-[1.25rem] font-bold leading-[1.18] text-[#e8dcc8] text-pretty sm:max-w-[38ch] sm:text-[1.625rem] lg:text-[1.75rem]">
                {plan.title}
              </h1>

              <div className="mt-3 flex min-w-0 flex-col gap-3 border-l border-[#3a2a10] pl-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-sm border border-[#3a2a10] bg-[#1a1510]">
                    <Image src={avatarUrl} alt={username} width={40} height={40} className="h-10 w-10 object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[1rem] font-semibold text-[#e8dcc8]">{username}</p>
                    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[0.875rem] text-[#7f7364]">
                      <RelativeTime date={plan.created_at} />
                      <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" /> {plan.view_count}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                        <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> {plan.comment_count}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleVote}
                  disabled={voteLoading}
                  className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-sm border px-4 text-[0.9375rem] font-semibold transition-colors hover:border-[#c8900a] hover:text-[#e8b030] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c8900a]"
                  style={{
                    background: voted ? 'rgba(200,144,10,0.16)' : '#1a1510',
                    borderColor: voted ? 'rgba(200,144,10,0.48)' : '#2a2118',
                    color: voted ? '#e8b030' : '#b9a47f',
                  }}
                >
                  <Heart className="h-4 w-4" fill={voted ? 'currentColor' : 'none'} aria-hidden="true" />
                  {tDetail('voteWithCount', { count: voteCount })}
                </button>
              </div>
            </div>

            <div className="min-w-0 border-t border-[#241c14] bg-[#0d0b08]/24 px-3 py-3 sm:px-5 lg:border-l lg:border-t-0 lg:px-4">
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
                isOwner={!!(session?.user?.email && plan.profiles?.username)}
                isAdmin={isAdmin}
              />
            </div>
          </div>
        </motion.header>

        <motion.main
          className="min-w-0 space-y-5 overflow-x-hidden"
          variants={shouldReduceMotion ? undefined : staggerContainer(0.055, 0.04)}
          initial={shouldReduceMotion ? false : 'initial'}
          animate={shouldReduceMotion ? undefined : 'animate'}
        >
            {plan.description && (
              <motion.article
                variants={shouldReduceMotion ? undefined : workbenchStaggerItem}
                className="border-y border-[#241c14] bg-[#0f0b07] px-4 py-5 sm:px-5 sm:py-6"
              >
                <div className="min-w-0 w-full">
                  <h2 className="mb-4 border-b border-[#241c14] pb-2 text-[1.125rem] font-semibold leading-snug text-[#e8dcc8]">
                    {tDetail('descriptionTitle')}
                  </h2>
                  <div
                    className="planner-detail-note min-w-0 text-[1rem] leading-8 text-[#cfc2ad] [&>div]:!max-w-none"
                    style={{
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word',
                    }}
                  >
                    <NoteRenderer
                      text={plan.description}
                      allowedKeywords={allowedKeywords}
                      egoGiftLookup={egoGiftLookup}
                      textScale="comfortable"
                    />
                  </div>
                </div>
              </motion.article>
            )}

            <DetailSection>
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
            </DetailSection>

            <DetailSection className="space-y-3 overflow-x-hidden">
              <SectionTitle title={tBlessing('title')} count={selectedBlessings.size > 0 ? String(totalBlessingCost) : tBlessing('none')} />
              {selectedBlessings.size > 0 && (
                <div className="flex items-center justify-end gap-1.5 text-[0.875rem] font-semibold text-[#c8900a]">
                  <Image src={`${S}/icons/start-buffs/starlight.webp`} alt={tBlessing('starlightAlt')} width={18} height={18} className="h-[1.125rem] w-[1.125rem]" />
                  <span className="font-mono tabular-nums">{totalBlessingCost}</span>
                </div>
              )}
              <ReadOnlyBlessingGrid
                blessings={localizedBlessings}
                selectedBlessings={selectedBlessings}
                emptyText={tBlessing('empty')}
              />
            </DetailSection>

            <DetailSection className="space-y-3">
              <SectionTitle title={tDetail('startGifts')} count={tDetail('itemCount', { count: startGifts.length })} />
              {startGifts.length > 0 ? (
                <GiftGrid locale={locale} gifts={startGifts.map(g => ({ gift: g, enhance: 0 }))} onGiftClick={(g, e) => setSelectedGift({ gift: g, enhance: e })} />
              ) : (
                <EmptyState text={tDetail('emptyStartGifts')} />
              )}
            </DetailSection>

            <DetailSection className="space-y-3">
              <SectionTitle title={tDetail('observeGifts')} count={tDetail('observeCount', { count: observeGifts.length })} />
              {observeGifts.length > 0 ? (
                <GiftGrid locale={locale} gifts={observeGifts.map(g => ({ gift: g, enhance: 0 }))} onGiftClick={(g, e) => setSelectedGift({ gift: g, enhance: e })} />
              ) : (
                <EmptyState text={tDetail('emptyObserveGifts')} />
              )}
            </DetailSection>

            <DetailSection className="space-y-3">
              <SectionTitle
                title={tPlanner('tabs.floor')}
                count={tFloor('configuredFloorCount', { configured: floorPlan.filter(f => f.theme_id).length, total: floorPlan.length })}
                caption={tDetail('floorPlanCaption')}
              />
              <FloorPlanPreviewBoard
                floorPlan={floorPlan}
                planDifficulty={plan.difficulty}
                themeMap={themeMap}
                giftMap={giftMap}
                onGiftClick={gift => setSelectedGift({ gift, enhance: 0 })}
                renderMemo={memo => (
                  <NoteRenderer text={memo} allowedKeywords={allowedKeywords} egoGiftLookup={egoGiftLookup} />
                )}
              />
            </DetailSection>

            <DetailSection className="space-y-3">
              <SectionTitle title={tDetail('finalGifts')} count={tDetail('itemCount', { count: finalGifts.length })} />
              {deck.length > 0 && finalGifts.length > 0 && (
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[0.875rem] leading-snug">
                  <span className="text-[#ef4444]">{tDetail('conditionUnmet')}</span>
                  <span className="text-[#e8b030]">{tDetail('conditionWarn')}</span>
                </div>
              )}
              {finalGifts.length > 0 ? (
                <GiftGrid locale={locale} gifts={finalGifts} getCondition={getConditionStatus} onGiftClick={(g, e) => setSelectedGift({ gift: g, enhance: e })} />
              ) : (
                <EmptyState text={tDetail('emptyFinalGifts')} />
              )}
            </DetailSection>

            <DetailSection>
              <PlanComments planId={plan.id} />
            </DetailSection>
        </motion.main>
      </div>

      {/* 기프트 상세 모달 */}
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
  )
}
