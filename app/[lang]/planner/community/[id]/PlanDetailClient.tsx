'use client'

import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Link } from '@/lib/i18n/navigation'
import Image from 'next/image'
import { useSession } from 'next-auth/react'
import { ArrowLeft, Heart, Eye, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { NoteRenderer, type NoteEgoGiftEntry } from '@/components/decks/NoteChips'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { DIFFICULTY_CONFIG, type Difficulty, type FloorDifficulty, type GiftActivationCondition, type RecipeData } from '@/lib/planner/types'
import { buildGiftMap } from '@/lib/planner/fusion'
import { getLegacyPlanFloorDifficulty, isAllowedFloorDifficulty, isFloorDifficulty, normalizeFloorPlanDifficulty } from '@/lib/planner/floor-difficulty'
import { showError } from '@/lib/toast'
import RelativeTime from '@/components/ui/RelativeTime'
const PlannerGiftModal = dynamic(() => import('@/components/planner/PlannerGiftModal'), { ssr: false })
import PlanActions from '@/components/planner/PlanActions'
import PlanComments from '@/components/planner/PlanComments'
import PlanDeckTabs from '@/components/planner/PlanDeckTabs'
import { STORAGE_BASE } from '@/lib/constants/game'
import { normalizeThemeKeyword } from '@/lib/constants/keywords'
import { DEFAULT_AVATAR_URL } from '@/lib/constants/game'
import { OCTAGON_CLIP, GRADE_ROMAN } from '@/lib/constants/gift'

// ── 상수 ──────────────────────────────────────────────────────────────────────

const S = STORAGE_BASE
const SLUG_TO_KEYWORD: Record<string, string> = {
  burn: '화상', bleed: '출혈', tremor: '진동', rupture: '파열',
  sinking: '침잠', breath: '호흡', charge: '충전', slash: '참격',
  pierce: '관통', blunt: '타격',
}
const STATS_SLUGS = new Set(['slash', 'pierce', 'blunt'])

function getKeywordSlug(kw: string | null): string | null {
  if (!kw) return null
  for (const [slug, k] of Object.entries(SLUG_TO_KEYWORD)) {
    if (kw.includes(k) || k.includes(kw)) return slug
  }
  return null
}
function getKwIconUrl(slug: string): string {
  if (STATS_SLUGS.has(slug)) return `${S}/icons/stats/${slug}.webp`
  return `${S}/icons/keywords/${slug}.webp`
}

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

const FLOOR_DIFFICULTY_LABELS: Record<FloorDifficulty, string> = {
  normal: '노말',
  hard: '하드',
  overlap: '인피니티 루프',
  extreme: '익스트림',
}

const BLESSING_NAMES: Record<number, string> = {
  100: '시작의 별', 101: '쌓여가는 별무리', 102: '성간여행', 103: '쏟아지는 유성우',
  104: '쌍성계 상점', 105: '위성계 상점', 106: '성운의 총애', 107: '별빛의 인도',
  108: '우연한 혜성', 109: '완전한 가능성',
}
const BLESSING_COSTS: Record<number, [number, number, number]> = {
  100: [10, 20, 30], 101: [10, 20, 30], 102: [20, 40, 60], 103: [20, 40, 60],
  104: [30, 60, 90], 105: [30, 60, 90], 106: [40, 80, 120], 107: [40, 80, 120],
  108: [50, 100, 150], 109: [60, 120, 180],
}
const BLESSING_EFFECTS: Record<number, [string[], string[], string[]]> = {
  100: [['시작 코스트 +150', '테마팩 목록 +1', '상점 기프트 목록 +1', '상점 일반 새로고침 1회 무료'], ['시작 코스트 +250', '테마팩 목록 +1', '상점 기프트 목록 +1', '상점 일반 새로고침 1회 무료'], ['시작 코스트 +250', '테마팩 목록 +1', '상점 기프트 목록 +1', '상점 일반 새로고침 2회 무료']],
  101: [['층 이동 시, 보유 코스트 10% 증가 (최대 100)', '기프트 판매 비용 50% 증가 (상점별 1회)'], ['층 이동 시, 보유 코스트 20% 증가 (최대 125)', '기프트 판매 비용 75% 증가 (상점별 1회)'], ['층 이동 시, 보유 코스트 30% 증가 (최대 150)', '기프트 판매 비용 100% 증가 (상점별 1회)']],
  102: [['테마팩 목록 +1', '테마팩 새로고침 횟수 +2', '기록 없는 테마팩 선택 시, 모든 인격 레벨 +3'], ['테마팩 목록 +1', '테마팩 새로고침 횟수 +3', '기록 없는 테마팩 선택 시, 모든 인격 레벨 +3', '테마팩 해금 수에 따라 버프'], ['테마팩 목록 +1', '테마팩 새로고침 횟수 +4', '기록 없는 테마팩 선택 시, 모든 인격 레벨 +3', '테마팩 해금 수에 따라 버프']],
  103: [['시작 코스트 +400', '시작 기프트 수 +1'], ['시작 코스트 +500', '시작 기프트 수 +1', '별빛 전투 보상 시 코스트 +75'], ['시작 코스트 +700', '시작 기프트 수 +1', '별빛 전투 보상 시 코스트 +150']],
  104: [['상점 기프트 목록 +1', '전투 보급 코스트 +20', '높은 등급 기프트 확률 상승'], ['상점 기프트 목록 +1', '전투 보급 코스트 +30', '높은 등급 기프트 확률 상승', '기프트 등급 합 기반 코스트'], ['상점 기프트 목록 +1', '전투 보급 코스트 +40', '높은 등급 기프트 확률 상승', '기프트 등급 합 기반 코스트']],
  105: [['상점 키워드 새로고침 1회 무료', '1층 입장 시, 1등급 기프트 1개'], ['상점 키워드 새로고침 1회 무료', '1층 입장 시, 1등급 기프트 2개', '강화 상점 확률 증가'], ['상점 키워드 새로고침 2회 무료', '1층 입장 시, 1등급 기프트 3개', '강화 상점 확률 증가']],
  106: [['1층 입장 시, 인격 레벨 +3', '층 클리어 시, 인격 레벨 +1 (최대 5)'], ['1층 입장 시, 인격 레벨 +3', '층 클리어 시, 인격 레벨 +1 (최대 9)'], ['1층 입장 시, 인격 레벨 +3', '6층 입장 시, +3', '층 클리어 시, +1 (최대 9)']],
  107: [['속도 최댓값 +2', '합 위력 증가 1', '피해량 증가 1', '보호 1'], ['속도 최댓값 +3', '합 위력 증가 1', '피해량 증가 1', '보호 1'], ['속도 최댓값 +3', '합 위력 증가 1', '피해량 증가 1', '보호 1']],
  108: [['합성 판매용 기프트 1개', '3층 입장 시, 3등급 기프트 1개', '합성 시 2단계 낮은 기프트'], ['합성 판매용 기프트 2개', '3/5층 입장 시, 3등급 기프트 1개', '합성 시 2단계 낮은 기프트'], ['합성 판매용 기프트 3개', '3/5/7층 입장 시, 4등급 기프트 1개', '합성 시 1단계 낮은 기프트']],
  109: [['테마팩 목록 +1', '시작 기프트 수 +1', '키워드 3등급 기프트 1개 선택', '어두운 잔영 1개'], ['테마팩 목록 +1', '시작 기프트 수 +1', '키워드 3등급 기프트 2개 선택', '1~2등급 합성 재료'], ['테마팩 목록 +1', '시작 기프트 수 +1', '키워드 3등급 기프트 3개 선택', '1~3등급 합성 재료']],
}

// ── 타입 ──────────────────────────────────────────────────────────────────────

type IdentitySlot = {
  identity_id?: string
  sinner_id?: string
  name_kr?: string
  rarity?: number
  keywords?: string[]
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
  name_kr: string
  rarity: number
  keywords: string[] | null
  game_id: string | null
  folder_name: string | null
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
  grade: string
  sin_affinity: string | null
  image_url: string | null
  cost: number[] | null
}

type SkillSummary = {
  identity_id: string
  name: string
  sin_affinity: string
  skill_type: string
  skill_order: number
  uptie_level: number | null
}

type PassiveSummary = {
  identity_id: string
  name: string
  passive_type: string
  sin_affinity: string | null
  sin_count: number | null
  active_cond: string | null
  description: string | null
  uptie_level: number | null
}

type Plan = {
  id: string
  title: string
  description: string | null
  difficulty: Difficulty
  deck: IdentitySlot[] | null
  egos: EgoSlot[] | null
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

function SectionTitle({ title, count }: { title: string; count: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      borderBottom: '1px solid #222', paddingBottom: '0.375rem',
    }}>
      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#e8dcc8' }}>{title}</span>
      <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{count}</span>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{
      background: '#1a1510', border: '1px solid #1a1510', borderRadius: '0.5rem',
      padding: '1rem', textAlign: 'center', fontSize: '0.75rem', color: '#333',
    }}>{text}</div>
  )
}

function GiftGrid({ gifts, getCondition, onGiftClick }: {
  gifts: { gift: GiftData; enhance: number }[]
  getCondition?: (gift: GiftData) => { level: 'warn' | 'unmet'; text: string } | null
  onGiftClick?: (gift: GiftData, enhance: number) => void
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(3.75rem, 1fr))', gap: '0.5rem', justifyItems: 'center' }}>
      {gifts.map(({ gift, enhance }) => {
        const cond = getCondition?.(gift)
        const kwSlug = getKeywordSlug(gift.keyword ?? null)
        const kwIconUrl = kwSlug ? getKwIconUrl(kwSlug) : null
        return (
          <div
            key={`${gift.game_id}_${enhance}`}
            onClick={() => onGiftClick?.(gift, enhance)}
            style={{ width: '100%', maxWidth: '4.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: onGiftClick ? 'pointer' : 'default' }}
          >
            <div style={{
              position: 'relative', width: '100%', aspectRatio: '1', overflow: 'hidden',
              backgroundImage: `url(${S}/icons/ego-gift-bg.webp)`, backgroundSize: 'cover', backgroundPosition: 'center',
              clipPath: OCTAGON_CLIP,
            }}>
              <span style={{
                position: 'absolute', top: '4%', left: '3%', zIndex: 10, pointerEvents: 'none',
                fontFamily: "'Bebas Neue', var(--font-title), sans-serif",
                fontWeight: 700, fontSize: '1.25rem', lineHeight: 1,
                color: (gift.grade === 'EX') ? 'rgb(198, 255, 46)' : 'rgb(251, 183, 46)',
                textShadow: (gift.grade === 'EX')
                  ? '0 0 0.625rem rgb(251,255,8), 0 0 0.25rem rgb(12,90,0), 0.0625rem 0.0625rem 0.125rem rgba(0,0,0,0.8)'
                  : '0 0 0.5rem rgb(255,114,21), 0 0 0.125rem rgba(0,0,0,0.6)',
              }}>
                {GRADE_ROMAN[gift.grade ?? '1'] ?? gift.grade}
              </span>
              {kwIconUrl && (
                <div style={{ position: 'absolute', bottom: 0, right: 0, zIndex: 10, pointerEvents: 'none', width: '30%', height: '30%' }}>
                  <Image src={kwIconUrl} alt="" fill sizes="40px" style={{ objectFit: 'contain' }} />
                </div>
              )}
              <div style={{ position: 'absolute', inset: '15%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {gift.image_url?.startsWith('http') ? (
                  <Image src={gift.image_url} alt={gift.name} fill style={{ objectFit: 'contain' }} sizes="80px" />
                ) : (
                  <div style={{ width: '1.75rem', height: '1.75rem', background: '#333', borderRadius: '50%' }} />
                )}
              </div>
              {enhance > 0 && (
                <span style={{
                  position: 'absolute', top: '1%', right: '6%', zIndex: 15,
                  fontFamily: "'Bebas Neue', var(--font-title), sans-serif",
                  fontWeight: 800, fontSize: '1.25rem', lineHeight: 1,
                  color: enhance === 2 ? '#ff8c00' : '#e8b030',
                  textShadow: enhance === 2
                    ? '0 0 0.5rem rgba(255,140,0,0.8), 0 0.125rem 0.25rem rgba(0,0,0,0.9)'
                    : '0 0 0.375rem rgba(200,144,10,0.6), 0 0.125rem 0.25rem rgba(0,0,0,0.8)',
                }}>
                  {enhance === 2 ? '++' : '+'}
                </span>
              )}
              {cond && (
                <div style={{
                  position: 'absolute', inset: 0, zIndex: 18,
                  background: cond.level === 'unmet' ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{
                    fontSize: '0.5rem', fontWeight: 700,
                    color: cond.level === 'unmet' ? '#ef4444' : '#e8b030',
                    textShadow: '0 0 0.25rem rgba(0,0,0,0.9)',
                    textAlign: 'center', lineHeight: 1.3,
                  }}>
                    {cond.level === 'unmet' ? '조건 미달' : '조건 주의'}
                  </span>
                </div>
              )}
            </div>
            <span style={{
              fontSize: '0.625rem',
              color: cond?.level === 'unmet' ? '#ef4444' : cond?.level === 'warn' ? '#e8b030' : '#9ca3af',
              textAlign: 'center', marginTop: '0.1875rem', lineHeight: 1.2, width: '100%',
              overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>
              {gift.name}
            </span>
            {cond && (
              <span style={{ fontSize: '0.5rem', color: cond.level === 'unmet' ? '#ef4444' : '#e8b030', textAlign: 'center', lineHeight: 1.2 }}>
                {cond.text}
              </span>
            )}
          </div>
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
  const { data: session } = useSession()
  const [voted, setVoted] = useState(false)
  const [voteCount, setVoteCount] = useState(plan.vote_count)
  const [voteLoading, setVoteLoading] = useState(false)
  const [expandedFloor, setExpandedFloor] = useState<number | null>(null)
  const [selectedGift, setSelectedGift] = useState<{ gift: GiftData; enhance?: number } | null>(null)

  const isAdmin = (session?.user as { isAdmin?: boolean } | undefined)?.isAdmin === true

  const diffConfig = DIFFICULTY_CONFIG[plan.difficulty]
  const diffStyle = DIFFICULTY_STYLE[plan.difficulty]

  const deck: IdentitySlot[] = Array.isArray(plan.deck) ? plan.deck : []
  const egoSlots: EgoSlot[] = Array.isArray(plan.egos) ? plan.egos : []
  const floorPlan: FloorEntry[] = normalizeFloorPlanDifficulty(plan.floor_plan, plan.difficulty).floorPlan as FloorEntry[]
  const giftInventory: string[] = Array.isArray(plan.gift_inventory) ? plan.gift_inventory : []

  const username = plan.profiles?.username ?? '익명'
  const avatarUrl = plan.profiles?.avatar_url ?? DEFAULT_AVATAR_URL

  // Maps
  const giftMap = useMemo(() => buildGiftMap(gifts), [gifts])
  const themeMap = useMemo(() => new Map(themes.map(t => [t.id, t])), [themes])

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

  // Blessings
  const blessings = useMemo(() => {
    const list: { baseId: number; name: string; level: number; cost: number }[] = []
    for (const id of giftInventory) {
      if (!id.startsWith('blessing_')) continue
      const [, bStr, lStr] = id.split('_')
      const baseId = parseInt(bStr), level = parseInt(lStr)
      list.push({ baseId, name: BLESSING_NAMES[baseId] ?? `가호 ${baseId}`, level, cost: BLESSING_COSTS[baseId]?.[level - 1] ?? 0 })
    }
    return list
  }, [giftInventory])

  const totalBlessingCost = blessings.reduce((s, b) => s + b.cost, 0)

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
  const { formationKwCounts, allKwCounts } = useMemo(() => {
    const formation: Record<string, number> = {}
    const all: Record<string, number> = {}
    for (const slot of deck) {
      const order = slot.slot_order ?? 99
      if (order >= 99) continue
      const isFormation = order < 7
      const normalized = new Set<string>((slot.keywords ?? []).map(normalizeThemeKeyword))
      for (const kw of normalized) {
        all[kw] = (all[kw] ?? 0) + 1
        if (isFormation) formation[kw] = (formation[kw] ?? 0) + 1
      }
    }
    return { formationKwCounts: formation, allKwCounts: all }
  }, [deck])

  function getConditionStatus(gift: GiftData): { level: 'warn' | 'unmet'; text: string } | null {
    const cond = gift.activation_condition
    if (!cond || !cond.count) return null
    let fHave = 0, aHave = 0, label = ''
    if (cond.type === 'keyword' && cond.keyword) {
      fHave = formationKwCounts[cond.keyword] ?? 0
      aHave = allKwCounts[cond.keyword] ?? 0
      label = cond.keyword
    } else if (cond.type === 'multi_keyword' && cond.keywords) {
      fHave = cond.keywords.reduce((s, kw) => s + (formationKwCounts[kw] ?? 0), 0)
      aHave = cond.keywords.reduce((s, kw) => s + (allKwCounts[kw] ?? 0), 0)
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
    if (!session) { showError('로그인이 필요합니다.'); return }
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

  return (
    <div className="min-h-screen pt-24 pb-16" style={{ background: '#0d0b08' }}>
      <div className="max-w-4xl mx-auto px-3 sm:px-6">

        {/* 뒤로가기 */}
        <Link
          href="/planner/community"
          className="inline-flex items-center gap-1 mb-4 transition-colors hover:opacity-80"
          style={{ color: '#666', fontSize: '0.75rem' }}
        >
          <ArrowLeft style={{ width: '0.75rem', height: '0.75rem' }} />
          커뮤니티 플랜
        </Link>

        {/* ── 플랜 헤더 ── */}
        <header style={{ marginBottom: '2rem' }}>
          {/* 난이도 + 메타 */}
          <div className="flex items-center gap-2 mb-3">
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '0.1875rem 0.625rem',
              background: diffStyle.bg, color: diffStyle.color, border: `1px solid ${diffStyle.border}`,
              borderRadius: '2rem', fontFamily: 'var(--font-heading)',
              fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.05em',
            }}>
              {diffConfig.label} ({diffConfig.floors}층)
            </span>
            <span style={{ color: '#333', fontSize: '0.625rem', fontFamily: 'var(--font-mono)' }}>
              {deck.length}인 편성
            </span>
          </div>

          {/* 제목 */}
          <h1 className="leading-tight text-xl sm:text-2xl md:text-[2rem]" style={{
            color: '#e8dcc8', marginBottom: '0.75rem',
            fontFamily: 'var(--font-heading)',
          }}>
            {plan.title}
          </h1>

          {/* 작성자 + 날짜 + 통계 + 추천 */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative overflow-hidden rounded-full" style={{
              width: '2rem', height: '2rem', flexShrink: 0,
              border: '1.5px solid rgba(200,144,10,0.3)',
            }}>
              <Image src={avatarUrl} alt={username} width={32} height={32}
                style={{ width: '2rem', height: '2rem', objectFit: 'cover' }} />
            </div>
            <div>
              <span style={{ fontSize: '0.875rem', color: '#e8dcc8', fontWeight: 600 }}>{username}</span>
              <div className="flex items-center gap-3 mt-0.5">
                <RelativeTime date={plan.created_at} style={{ fontSize: '0.6875rem', color: '#4b5563' }} />
                <span className="flex items-center gap-1" style={{ fontSize: '0.6875rem', color: '#4b5563' }}>
                  <Eye style={{ width: '0.6875rem', height: '0.6875rem' }} /> {plan.view_count}
                </span>
                <span className="flex items-center gap-1" style={{ fontSize: '0.6875rem', color: '#4b5563' }}>
                  <MessageCircle style={{ width: '0.6875rem', height: '0.6875rem' }} /> {plan.comment_count}
                </span>
              </div>
            </div>
            <button
              onClick={handleVote}
              disabled={voteLoading}
              className="flex items-center gap-1.5 transition-all hover:brightness-110 disabled:opacity-50 ml-auto"
              style={{
                padding: '0.375rem 0.75rem',
                background: voted ? 'rgba(200,144,10,0.2)' : 'transparent',
                border: `1px solid ${voted ? 'rgba(200,144,10,0.5)' : '#333'}`,
                borderRadius: '2rem',
                color: voted ? '#e8b030' : '#6b7280',
                fontSize: '0.8125rem', fontWeight: 600, cursor: voteLoading ? 'not-allowed' : 'pointer',
              }}
            >
              <Heart style={{ width: '0.875rem', height: '0.875rem' }} fill={voted ? 'currentColor' : 'none'} />
              추천 {voteCount}
            </button>
          </div>

          {/* 액션 바 */}
          <PlanActions
            planId={plan.id}
            planTitle={plan.title}
            planDescription={plan.description}
            difficulty={plan.difficulty}
            deck={deck}
            egoSlots={egoSlots}
            floorPlan={floorPlan}
            giftInventory={giftInventory}
            identities={identities}
            sinners={sinners}
            egos={egos}
            isOwner={!!(session?.user?.email && plan.profiles?.username)}
            isAdmin={isAdmin}
          />

          {/* 구분선 */}
          <div style={{ height: '1px', background: 'linear-gradient(to right, rgba(200,144,10,0.3), transparent)', marginBottom: '1rem' }} />

          {/* 설명 */}
          {plan.description && (
            <div style={{ marginBottom: '1rem' }}>
              <NoteRenderer text={plan.description} allowedKeywords={allowedKeywords} egoGiftLookup={egoGiftLookup} />
            </div>
          )}
        </header>

        {/* ── 덱 편성 탭 ── */}
        <div style={{ marginBottom: '1.5rem' }}>
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
        </div>

        {/* ── 가호 ── */}
        <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #222', paddingBottom: '0.375rem' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#e8dcc8' }}>가호</span>
            {blessings.length > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Image src={`${S}/icons/start-buffs/starlight.webp`} alt="별빛" width={16} height={16} style={{ width: '1rem', height: '1rem' }} />
                <span style={{ fontSize: '0.8125rem', color: '#c8900a', fontWeight: 700 }}>{totalBlessingCost}</span>
              </div>
            ) : (
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>미선택</span>
            )}
          </div>
          {blessings.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
              {blessings.map(b => {
                const effects = BLESSING_EFFECTS[b.baseId]?.[b.level - 1] ?? []
                return (
                  <div key={b.baseId} className="rounded-lg overflow-hidden flex flex-col" style={{
                    background: '#1a1510', border: '1px solid #c8900a50',
                    boxShadow: '0 0 12px #c8900a15',
                  }}>
                    <div className="flex items-center gap-1.5 sm:gap-2 p-2 sm:p-3 pb-1.5 sm:pb-2">
                      <Image src={`${S}/icons/start-buffs/${b.baseId}.webp`} alt={b.name} width={32} height={32}
                        style={{ width: '1.5rem', height: '1.5rem', objectFit: 'contain' }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[0.6875rem] sm:text-[0.8125rem]" style={{ color: '#e8dcc8', fontWeight: 600, lineHeight: 1.2 }}>{b.name}</div>
                      </div>
                      <div className="flex items-center gap-0.5 sm:gap-1">
                        <Image src={`${S}/icons/start-buffs/starlight.webp`} alt="" width={14} height={14} style={{ width: '0.75rem', height: '0.75rem' }} />
                        <span style={{ color: '#c8900a', fontSize: '0.6875rem', fontWeight: 700 }}>{b.cost}</span>
                      </div>
                    </div>
                    <div className="px-2 sm:px-3 pb-1.5 sm:pb-2 flex-1">
                      {effects.map((eff, i) => (
                        <div key={i} style={{ color: '#777', fontSize: '0.5625rem', lineHeight: 1.5 }}>• {eff}</div>
                      ))}
                    </div>
                    <div style={{
                      borderTop: '1px solid #222', padding: '0.1875rem 0.5rem 0.25rem',
                      fontSize: '0.625rem', fontWeight: 700, textAlign: 'center',
                      color: b.level === 3 ? '#c83030' : b.level === 2 ? '#4898b0' : '#e8b030',
                    }}>
                      {b.level === 1 ? '기본' : b.level === 2 ? '+' : '++'}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState text="가호가 선택되지 않았습니다" />
          )}
        </div>

        {/* ── 시작 기프트 ── */}
        <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <SectionTitle title="시작 기프트" count={`${startGifts.length}개`} />
          {startGifts.length > 0 ? (
            <GiftGrid gifts={startGifts.map(g => ({ gift: g, enhance: 0 }))} onGiftClick={(g, e) => setSelectedGift({ gift: g, enhance: e })} />
          ) : (
            <EmptyState text="시작 기프트가 선택되지 않았습니다" />
          )}
        </div>

        {/* ── 관측 기프트 ── */}
        <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <SectionTitle title="관측 기프트" count={`${observeGifts.length}/3`} />
          {observeGifts.length > 0 ? (
            <GiftGrid gifts={observeGifts.map(g => ({ gift: g, enhance: 0 }))} onGiftClick={(g, e) => setSelectedGift({ gift: g, enhance: e })} />
          ) : (
            <EmptyState text="관측 기프트가 선택되지 않았습니다" />
          )}
        </div>

        {/* ── 층별 계획 ── */}
        <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <SectionTitle
            title="층별 계획"
            count={`${floorPlan.filter(f => f.theme_id).length}/${floorPlan.length}층`}
          />
          {floorPlan.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {floorPlan.map(f => {
                const theme = f.theme_id ? themeMap.get(f.theme_id) : null
                const floorGifts = f.gift_ids.map(id => giftMap.get(parseInt(id))).filter(Boolean) as GiftData[]
                const isExpanded = expandedFloor === f.floor
                const floorDifficulty = isFloorDifficulty(f.difficulty) && isAllowedFloorDifficulty(f.difficulty, f.floor)
                  ? f.difficulty
                  : getLegacyPlanFloorDifficulty(plan.difficulty, f.floor)
                return (
                  <div key={f.floor} style={{
                    background: '#1a1510',
                    border: `1px solid ${isExpanded ? '#c8900a' : theme ? '#2a2520' : '#1a1510'}`,
                    borderRadius: '0.5rem', overflow: 'hidden', transition: 'border-color 0.2s',
                  }}>
                    <button
                      onClick={() => setExpandedFloor(isExpanded ? null : f.floor)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '0.625rem',
                        padding: '0.5rem 0.75rem', background: 'transparent', border: 'none',
                        cursor: 'pointer', textAlign: 'left', color: '#e5e7eb',
                      }}
                    >
                      <span style={{
                        width: '1.75rem', height: '1.75rem', borderRadius: '50%',
                        background: theme ? '#c8900a' : '#222',
                        color: theme ? '#0d0b08' : '#4b5563',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
                      }}>{f.floor}</span>

                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        minHeight: '1.5rem',
                        padding: '0.125rem 0.5rem',
                        borderRadius: '999px',
                        border: '1px solid rgba(200,144,10,0.2)',
                        color: '#b9a47f',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        flexShrink: 0,
                      }}>
                        {FLOOR_DIFFICULTY_LABELS[floorDifficulty]}
                      </span>

                      {theme ? (
                        <>
                          {theme.image_url && (
                            <div style={{ position: 'relative', width: '1.75rem', height: '3.175rem', flexShrink: 0 }}>
                              <Image src={theme.image_url} alt={theme.name} width={18} height={33}
                                style={{ width: '1.75rem', height: '3.175rem', objectFit: 'cover', borderRadius: '0.1875rem' }} />
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#e8b030', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {theme.name}
                            </div>
                            {!isExpanded && floorGifts.length > 0 && (
                              <div style={{ fontSize: '0.6875rem', color: '#6b7280', marginTop: '0.0625rem' }}>
                                획득 기프트 {floorGifts.length}개
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <span style={{ flex: 1, fontSize: '0.75rem', color: '#333' }}>미선택</span>
                      )}
                      {isExpanded
                        ? <ChevronUp size={14} color="#6b7280" style={{ flexShrink: 0 }} />
                        : <ChevronDown size={14} color="#6b7280" style={{ flexShrink: 0 }} />}
                    </button>

                    {isExpanded && theme && (
                      <div style={{ borderTop: '1px solid #222', padding: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.75rem' }}>
                          {theme.image_url && (
                            <div style={{ position: 'relative', width: '2.375rem', height: '4.3125rem', flexShrink: 0 }}>
                              <Image src={theme.image_url} alt={theme.name} width={38} height={69}
                                style={{ width: '2.375rem', height: '4.3125rem', objectFit: 'cover', borderRadius: '0.25rem' }} />
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e8b030' }}>{theme.name}</div>
                            <div style={{ fontSize: '0.6875rem', color: '#6b7280', marginTop: '0.125rem' }}>
                              기프트 {theme.ego_gift_ids?.length ?? 0}종
                            </div>
                          </div>
                        </div>

                        {floorGifts.length > 0 && (
                          <div style={{ marginBottom: '0.75rem' }}>
                            <div style={{ fontSize: '0.6875rem', color: '#6b7280', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              획득 기프트
                            </div>
                            <GiftGrid gifts={floorGifts.map(g => ({ gift: g, enhance: 0 }))} onGiftClick={(g, e) => setSelectedGift({ gift: g, enhance: e })} />
                          </div>
                        )}

                        {f.memo && (
                          <div>
                            <div style={{ fontSize: '0.6875rem', color: '#6b7280', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              메모
                            </div>
                            <div style={{ background: '#0d0b08', border: '1px solid #333', borderRadius: '0.375rem', padding: '0.5rem 0.625rem' }}>
                              <NoteRenderer text={f.memo} allowedKeywords={allowedKeywords} egoGiftLookup={egoGiftLookup} />
                            </div>
                          </div>
                        )}

                        {!floorGifts.length && !f.memo && (
                          <div style={{ fontSize: '0.75rem', color: '#333', textAlign: 'center' }}>상세 정보 없음</div>
                        )}
                      </div>
                    )}

                    {isExpanded && !theme && f.memo && (
                      <div style={{ borderTop: '1px solid #222', padding: '0.75rem' }}>
                        <div style={{ background: '#0d0b08', border: '1px solid #333', borderRadius: '0.375rem', padding: '0.5rem 0.625rem' }}>
                          <NoteRenderer text={f.memo} allowedKeywords={allowedKeywords} egoGiftLookup={egoGiftLookup} />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState text="층별 계획이 없습니다" />
          )}
        </div>

        {/* ── 최종 기프트 ── */}
        <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <SectionTitle title="최종 기프트" count={`${finalGifts.length}개`} />
          {deck.length > 0 && finalGifts.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.75rem', fontSize: '0.5625rem', marginBottom: '0.25rem' }}>
              <span style={{ color: '#ef4444' }}>● 조건 미달 — 전체 인격으로도 부족</span>
              <span style={{ color: '#e8b030' }}>● 조건 주의 — 편성(1-7)만으로는 부족, 대기 포함 시 충족</span>
            </div>
          )}
          {finalGifts.length > 0 ? (
            <GiftGrid gifts={finalGifts} getCondition={getConditionStatus} onGiftClick={(g, e) => setSelectedGift({ gift: g, enhance: e })} />
          ) : (
            <EmptyState text="최종 기프트가 선택되지 않았습니다" />
          )}
        </div>

        {/* ── 댓글 ── */}
        <PlanComments planId={plan.id} />

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
