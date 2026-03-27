'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Heart, Eye, MessageCircle, Send, ChevronDown, ChevronUp, Copy, GitFork, Pencil, Trash2, Check } from 'lucide-react'
import { NoteRenderer, type NoteEgoGiftEntry } from '@/components/decks/NoteChips'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { DIFFICULTY_CONFIG, type Difficulty, type GiftActivationCondition, type RecipeData } from '@/lib/planner/types'
import { buildGiftMap } from '@/lib/planner/fusion'
import { saveDraftToLocal } from '@/lib/planner/encoder'
import { encodeDeckCode } from '@/components/deck-builder/deckCodeUtils'
import ConfirmModal from '@/components/ui/ConfirmModal'
import IdentityDetailModal from '@/components/ui/IdentityDetailModal'
import EgoDetailModal from '@/components/ui/EgoDetailModal'
import RelativeTime from '@/components/ui/RelativeTime'
import PlannerGiftModal from '@/components/planner/PlannerGiftModal'
import DeckStatsPanel from '@/components/planner/DeckStatsPanel'
import { getIdentityImageUrl, getSinnerLogoUrl, getSkillIconUrl } from '@/lib/utils/images'
import { STORAGE_BASE, RARITY_COLORS, GRADE_COLORS } from '@/lib/constants/game'
import { SIN_COLORS, SIN_KR_TO_EN } from '@/lib/constants/sin'
import { normalizeThemeKeyword } from '@/lib/constants/keywords'
import { DEFAULT_AVATAR_URL } from '@/lib/constants/game'

// ── 상수 ──────────────────────────────────────────────────────────────────────

const S = STORAGE_BASE
const OCTAGON_CLIP = 'polygon(12% 0%, 88% 0%, 100% 12%, 100% 88%, 88% 100%, 12% 100%, 0% 88%, 0% 12%)'
const GRADE_ROMAN: Record<string, string> = { 'EX': 'EX', '5': '\u2164', '4': '\u2163', '3': '\u2162', '2': '\u2161', '1': '\u2160' }
const GRADE_ORDER = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH']

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
  dungeon_id: string | null
  ego_gift_ids: number[] | null
  specific_ego_gift_ids: number[] | null
  image_url: string | null
  boss_image_url: string | null
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

type Comment = {
  id: string
  content: string
  created_at: string
  user_id: string
  parent_id: string | null
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

  const [comments, setComments] = useState<Comment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null)

  const [deckSubTab, setDeckSubTab] = useState<'identity' | 'ego' | 'skillset'>('identity')
  const [expandedFloor, setExpandedFloor] = useState<number | null>(null)
  const [codeCopied, setCodeCopied] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedGift, setSelectedGift] = useState<{ gift: GiftData; enhance?: number } | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null)
  const [identityModalId, setIdentityModalId] = useState<string | null>(null)
  const [egoModalId, setEgoModalId] = useState<string | null>(null)
  const router = useRouter()

  const isOwner = session?.user?.email && plan.profiles?.username // 서버에서 비교해야 정확하지만, UI 표시용
  const isAdmin = (session?.user as { isAdmin?: boolean } | undefined)?.isAdmin === true

  const showToast = (message: string, type: 'error' | 'success' = 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleCopyCode = async () => {
    try {
      // 플랜 덱 → encodeDeckCode 형식으로 변환
      const deckSlots: Record<string, typeof identities[0] | undefined> = {}
      const egoSlotsMap: Record<string, Record<string, typeof egos[0]>> = {}
      const formationOrder: string[] = []

      // 편성 순서로 정렬
      const formed = deck.filter(s => (s.slot_order ?? 99) < 99).sort((a, b) => (a.slot_order ?? 99) - (b.slot_order ?? 99))
      for (const slot of formed) {
        if (!slot.sinner_id || !slot.identity_id) continue
        const ident = identities.find(i => i.id === slot.identity_id)
        if (ident) deckSlots[slot.sinner_id] = ident
        if ((slot.slot_order ?? 99) < 7) formationOrder.push(slot.sinner_id)
      }

      for (const slot of egoSlots) {
        if (!slot.sinner_id || !slot.ego_id || !slot.grade) continue
        const ego = egos.find(e => e.id === slot.ego_id)
        if (ego) {
          if (!egoSlotsMap[slot.sinner_id]) egoSlotsMap[slot.sinner_id] = {}
          egoSlotsMap[slot.sinner_id][slot.grade] = ego
        }
      }

      const code = await encodeDeckCode(sinners as any, identities as any, egos as any, deckSlots as any, egoSlotsMap as any, formationOrder)
      await navigator.clipboard.writeText(code)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    } catch { showToast('편성코드 복사 실패') }
  }

  const handleFork = () => {
    const planState = {
      difficulty: plan.difficulty,
      title: `${plan.title} (Fork)`,
      description: plan.description ?? '',
      identitySlots: deck,
      egoSlots,
      floorPlan,
      giftInventory,
      activeTab: 'deck' as const,
    }
    saveDraftToLocal(planState as any)
    router.push('/planner')
    showToast('플래너에 불러왔습니다', 'success')
  }

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/planner/${plan.id}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/planner/community')
      } else {
        const data = await res.json()
        showToast(data.error ?? '삭제 실패')
      }
    } catch { showToast('삭제 중 오류 발생') }
    setShowDeleteModal(false)
  }

  const kwContext = useKeywordData()
  const allowedKeywords = useMemo(() => new Set(Object.keys(kwContext.keywords)), [kwContext.keywords])

  const diffConfig = DIFFICULTY_CONFIG[plan.difficulty]
  const diffStyle = DIFFICULTY_STYLE[plan.difficulty]

  const deck: IdentitySlot[] = Array.isArray(plan.deck) ? plan.deck : []
  const egoSlots: EgoSlot[] = Array.isArray(plan.egos) ? plan.egos : []
  const floorPlan: FloorEntry[] = Array.isArray(plan.floor_plan) ? plan.floor_plan : []
  const giftInventory: string[] = Array.isArray(plan.gift_inventory) ? plan.gift_inventory : []

  const username = plan.profiles?.username ?? '익명'
  const avatarUrl = plan.profiles?.avatar_url ?? DEFAULT_AVATAR_URL

  // Maps
  const giftMap = useMemo(() => buildGiftMap(gifts), [gifts])
  const themeMap = useMemo(() => new Map(themes.map(t => [t.id, t])), [themes])
  const identityMap = useMemo(() => new Map(identities.map(i => [i.id, i])), [identities])

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

  // Condition checks for final gifts
  const { formationKwCounts, allKwCounts } = useMemo(() => {
    const formation: Record<string, number> = {}
    const all: Record<string, number> = {}
    for (const slot of deck) {
      const order = slot.slot_order ?? 99
      if (order >= 99) continue // 편성 순서 없는 인격(벤치) 제외
      const isFormation = order < 7 // 0-6 = 편성 1-7
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

  // 조회수 증가 (페이지 로드 시 1회, POST로 분리하여 중복 방지)
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
    if (!session) { alert('로그인이 필요합니다.'); return }
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

  // Comments
  const fetchComments = useCallback(async () => {
    setCommentsLoading(true)
    try {
      const res = await fetch(`/api/planner/${plan.id}/comments`)
      if (!res.ok) return
      const json = await res.json()
      setComments(json.comments ?? [])
    } catch { /* 무시 */ } finally {
      setCommentsLoading(false)
    }
  }, [plan.id])

  useEffect(() => { fetchComments() }, [fetchComments])

  const handleCommentSubmit = async () => {
    if (!session) { alert('로그인이 필요합니다.'); return }
    const content = commentText.trim()
    if (!content) return
    setSubmitting(true)
    try {
      const body: Record<string, string> = { content }
      if (replyTo) body.parent_id = replyTo.id
      const res = await fetch(`/api/planner/${plan.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setCommentText('')
        setReplyTo(null)
        fetchComments()
      }
    } catch { /* 무시 */ } finally {
      setSubmitting(false)
    }
  }

  // Build sinner → ego map
  const egoByGradeMap = useMemo(() => {
    const map: Record<string, Record<string, EgoSlot>> = {}
    for (const e of egoSlots) {
      if (!e.sinner_id || !e.grade) continue
      if (!map[e.sinner_id]) map[e.sinner_id] = {}
      map[e.sinner_id][e.grade] = e
    }
    return map
  }, [egoSlots])

  // Slot order map for identity display
  const slotBySinner = useMemo(() => {
    const map: Record<string, IdentitySlot> = {}
    for (const s of deck) {
      if (s.sinner_id) map[s.sinner_id] = s
    }
    return map
  }, [deck])

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

        {/* ── 플랜 헤더 (블로그 스타일) ── */}
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

          {/* 작성자 + 날짜 + 통계 */}
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
                  <MessageCircle style={{ width: '0.6875rem', height: '0.6875rem' }} /> {comments.length}
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
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <button onClick={handleCopyCode} style={{
              display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.375rem 0.75rem',
              background: codeCopied ? 'rgba(34,197,94,0.12)' : 'transparent',
              border: `1px solid ${codeCopied ? 'rgba(34,197,94,0.4)' : '#333'}`,
              borderRadius: '0.375rem', color: codeCopied ? '#4ade80' : '#9ca3af',
              fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.2s',
            }}>
              {codeCopied ? <Check size={12} /> : <Copy size={12} />}
              {codeCopied ? '복사 완료' : '편성코드 복사'}
            </button>
            <button onClick={handleFork} style={{
              display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.375rem 0.75rem',
              background: 'transparent', border: '1px solid #333', borderRadius: '0.375rem',
              color: '#9ca3af', fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.2s',
            }}>
              <GitFork size={12} /> Fork
            </button>
            {(isOwner || isAdmin) && (
              <>
                <button onClick={() => {
                  // 플래너에 불러온 후 edit 모드로 이동
                  saveDraftToLocal({
                    difficulty: plan.difficulty,
                    title: plan.title,
                    description: plan.description ?? '',
                    identitySlots: deck,
                    egoSlots,
                    floorPlan,
                    giftInventory,
                    activeTab: 'deck',
                  } as any)
                  router.push(`/planner?edit=${plan.id}`)
                }} style={{
                  display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.375rem 0.75rem',
                  background: 'transparent', border: '1px solid rgba(200,144,10,0.3)', borderRadius: '0.375rem',
                  color: '#c8900a', fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.2s',
                }}>
                  <Pencil size={12} /> 수정
                </button>
                <button onClick={() => setShowDeleteModal(true)} style={{
                  display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.375rem 0.75rem',
                  background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.375rem',
                  color: '#ef4444', fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.2s',
                }}>
                  <Trash2 size={12} /> 삭제
                </button>
              </>
            )}
          </div>

          {/* 구분선 */}
          <div style={{ height: '1px', background: 'linear-gradient(to right, rgba(200,144,10,0.3), transparent)', marginBottom: '1rem' }} />

          {/* 설명 */}
          {plan.description && (
            <div style={{ marginBottom: '1rem' }}>
              <NoteRenderer text={plan.description} allowedKeywords={allowedKeywords} egoGiftLookup={egoGiftLookup} />
            </div>
          )}
        </header>

        {/* ── 덱 편성 ── */}
        <div style={{ marginBottom: '1.5rem' }}>
          {/* 서브탭 헤더 */}
          <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #222', marginBottom: '0.75rem', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            {([
              { key: 'identity' as const, label: `인격 (${deck.length}/12)`, hint: '클릭하여 상세 보기' },
              { key: 'ego' as const, label: `EGO (${egoSlots.length})` },
              { key: 'skillset' as const, label: '스킬셋' },
            ]).map(tab => {
              const active = deckSubTab === tab.key
              return (
                <button key={tab.key} onClick={() => setDeckSubTab(tab.key)} style={{
                  padding: '0.5rem 0.625rem', fontSize: '0.8125rem', fontWeight: active ? 700 : 400, whiteSpace: 'nowrap',
                  color: active ? '#e8dcc8' : '#555', cursor: 'pointer',
                  background: active ? 'rgba(200,144,10,0.05)' : 'transparent',
                  border: 'none',
                  borderBottom: `2px solid ${active ? '#c8900a' : 'transparent'}`,
                  marginBottom: '-1px',
                }}>
                  {tab.label}
                  {'hint' in tab && active && (
                    <span style={{ fontSize: '0.5625rem', color: '#5a5065', marginLeft: '0.375rem', fontWeight: 400 }}>
                      {(tab as { hint: string }).hint}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* 인격 그리드 */}
          {deckSubTab === 'identity' && (
            <div className="grid grid-cols-6 gap-x-1.5 sm:gap-x-3 gap-y-3 sm:gap-y-4">
              {sinners.map(sinner => {
                const slot = slotBySinner[sinner.id]
                const identData = slot?.identity_id ? identityMap.get(slot.identity_id) : undefined
                const rc = slot ? (RARITY_COLORS[slot.rarity ?? 1] ?? RARITY_COLORS[1]) : null
                const n = slot && (slot.slot_order ?? 99) < 99 ? (slot.slot_order ?? 0) + 1 : null
                return (
                  <div key={sinner.id} onClick={() => slot?.identity_id && setIdentityModalId(slot.identity_id)} style={{ cursor: slot?.identity_id ? 'pointer' : 'default' }}>
                    <div style={{
                      position: 'relative', width: '100%', aspectRatio: '2/3',
                      background: 'linear-gradient(160deg, #1e1810 0%, #120e08 60%, #1a1410 100%)',
                      border: `0.09375rem ${slot ? 'solid' : 'dashed'} ${slot ? (rc?.border ?? '#2a2015') : '#2a2015'}`,
                      borderRadius: '0.25rem', overflow: 'hidden',
                      boxShadow: slot ? `0 0 0.5rem ${rc?.glow ?? 'transparent'}` : 'none',
                    }}>
                      {slot && identData ? (
                        <>
                          <Image
                            src={getIdentityImageUrl(identData.sinner_id, identData.folder_name ?? '', `${identData.game_id}_normal_info`)}
                            alt={slot.name_kr ?? ''} fill className="object-cover object-top" sizes="120px"
                          />
                          <div style={{ position: 'absolute', top: 0, left: 0, zIndex: 10, padding: '0.1875rem' }}>
                            <Image
                              src={`${S}/icons/Rarity/${slot.rarity ?? 1}star.webp`}
                              alt={`${slot.rarity ?? 1}성`}
                              width={(slot.rarity ?? 1) * 14} height={14}
                              style={{ height: '0.875rem', width: 'auto', objectFit: 'contain' }}
                            />
                          </div>
                          <div style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10, textAlign: 'center',
                            background: 'linear-gradient(to top, rgba(13,11,8,0.95) 0%, transparent 100%)',
                            paddingTop: '1.25rem', paddingBottom: '0.25rem',
                          }}>
                            <p className="font-serif text-[0.5rem] sm:text-[0.6875rem]" style={{ color: '#e8dcc8', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: '0.25rem', paddingRight: '0.25rem' }}>{slot.name_kr}</p>
                          </div>
                          {n != null && (
                            <div style={{
                              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                              zIndex: 15, background: 'rgba(13,11,8,0.45)', pointerEvents: 'none',
                            }}>
                              <span className="text-[0.625rem] sm:text-base" style={{ fontWeight: 700, color: n <= 7 ? '#e8b030' : '#5ab0d0', textShadow: `0 0 0.5rem ${n <= 7 ? 'rgba(200,144,10,0.7)' : 'rgba(90,176,208,0.7)'}, 0 0.125rem 0.5rem rgba(0,0,0,1)` }}>
                                {n <= 7 ? '편성' : '대기'}
                              </span>
                              <span className="text-sm sm:text-2xl" style={{ fontWeight: 800, color: n <= 7 ? '#e8b030' : '#5ab0d0', marginLeft: '0.1875rem', textShadow: `0 0 1rem ${n <= 7 ? 'rgba(200,144,10,0.7)' : 'rgba(90,176,208,0.7)'}, 0 0.125rem 0.5rem rgba(0,0,0,1)` }}>
                                {n}
                              </span>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                            <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={32} height={32}
                              style={{ width: '2rem', height: '2rem', opacity: 0.35 }} />
                          </div>
                          <div style={{ position: 'absolute', top: 0, right: 0, width: '36%', opacity: 0.15, pointerEvents: 'none' }}>
                            <Image src={`${S}/sinners/${sinner.id}/number.webp`} alt="" width={389} height={1023} className="w-full h-auto" />
                          </div>
                          <div style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0, textAlign: 'center', zIndex: 10,
                            background: 'linear-gradient(to top, rgba(13,11,8,0.95) 0%, transparent 100%)',
                            paddingTop: '1.25rem', paddingBottom: '0.375rem',
                          }}>
                            <p className="font-serif font-light text-[0.5rem] sm:text-[0.75rem]" style={{ color: '#3a2a10' }}>{sinner.name_kr}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* 공격 유형 + 죄악 자원 + 패시브 */}
          {deckSubTab === 'identity' && deck.length > 0 && (() => {
            const selectedEgoIds = new Set(egoSlots.map(e => e.ego_id).filter(Boolean))
            const selectedEgoCosts = egos.filter(e => selectedEgoIds.has(e.id)).map(e => ({ cost: e.cost }))
            return (
              <DeckStatsPanel
                identitySlots={deck}
                skills={skills}
                passives={passives}
                sinners={sinners}
                egoCosts={selectedEgoCosts}
              />
            )
          })()}

          {/* EGO 그리드 */}
          {deckSubTab === 'ego' && (
            deck.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-4">
                {sinners.map(sinner => {
                  const slot = slotBySinner[sinner.id]
                  const egoByGrade = egoByGradeMap[sinner.id] ?? {}
                  return (
                    <div key={sinner.id} style={{
                      background: 'linear-gradient(160deg, #1a1510 0%, #100d08 100%)',
                      border: `1px solid ${slot ? '#221a0f' : '#18120a'}`,
                      borderRadius: '0.25rem', overflow: 'hidden',
                      opacity: slot ? 1 : 0.5,
                    }}>
                      <div className="flex items-center gap-1.5" style={{ padding: '0.375rem 0.5rem', borderBottom: '1px solid #1a1208' }}>
                        <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={14} height={14}
                          style={{ width: '0.875rem', height: '0.875rem', opacity: 0.5 }} />
                        <span className="font-serif font-light truncate" style={{ color: slot ? '#8a7a60' : '#3a2a10', fontSize: '0.5625rem' }}>
                          {sinner.name_kr}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem', padding: '0.125rem' }}>
                        {GRADE_ORDER.map(grade => {
                          const ego = egoByGrade[grade]
                          const gc = GRADE_COLORS[grade] ?? '#555'
                          const egoFull = ego ? egos.find(e => e.id === ego.ego_id) : null
                          const sinEn = egoFull?.sin_affinity ? (SIN_KR_TO_EN[egoFull.sin_affinity] ?? egoFull.sin_affinity) : null
                          const ec = sinEn ? (SIN_COLORS[sinEn as keyof typeof SIN_COLORS] ?? gc) : gc
                          return (
                            <div key={grade} onClick={() => ego?.ego_id && setEgoModalId(ego.ego_id)} style={{
                              background: ego ? `${ec}1a` : 'rgba(10,8,5,0.7)',
                              border: `1px solid ${ego ? ec + '55' : '#18120a'}`,
                              borderRadius: '0.125rem', padding: '0.25rem 0.3125rem',
                              display: 'flex', alignItems: 'center', gap: '0.3125rem',
                              minHeight: '1.5rem',
                              cursor: ego?.ego_id ? 'pointer' : 'default',
                            }}>
                              {grade !== 'ALEPH' ? (
                                <Image src={`${S}/icons/grade/${grade}.webp`} alt={grade} width={22} height={11} unoptimized
                                  style={{ height: '0.6875rem', width: 'auto', opacity: ego ? 0.9 : 0.3, flexShrink: 0 }} />
                              ) : (
                                <span style={{ color: gc, fontSize: '0.375rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', opacity: ego ? 0.9 : 0.3, flexShrink: 0 }}>ALEPH</span>
                              )}
                              {ego ? (
                                <span style={{ color: gc, fontSize: '0.5rem', fontWeight: 700, lineHeight: 1.2, flex: 1, textAlign: 'left' }}>{ego.name_kr}</span>
                              ) : (
                                <span style={{ color: '#2a1e10', fontSize: '0.5rem', lineHeight: 1 }}>{slot ? '—' : ''}</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      {!slot && (
                        <div style={{ padding: '0.25rem 0.5rem 0.375rem', textAlign: 'center' }}>
                          <span style={{ fontSize: '0.5rem', color: '#333' }}>인격 미선택</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState text="인격이 편성되지 않았습니다" />
            )
          )}

          {/* 스킬셋 */}
          {deckSubTab === 'skillset' && (
            deck.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-6">
                {sinners.map(sinner => {
                  const slot = slotBySinner[sinner.id]
                  if (!slot) return null
                  const identData = slot.identity_id ? identityMap.get(slot.identity_id) : undefined
                  const dist = [3, 2, 1]
                  const identForIcon = identData ? { game_id: identData.game_id, sinner_id: identData.sinner_id } : null

                  return (
                    <div key={sinner.id} onClick={() => slot.identity_id && setIdentityModalId(slot.identity_id)} style={{ cursor: slot.identity_id ? 'pointer' : 'default' }}>
                      <div style={{
                        position: 'relative', width: '100%', aspectRatio: '2/3',
                        background: 'linear-gradient(160deg, #1e1810 0%, #120e08 60%, #1a1410 100%)',
                        border: `0.09375rem solid ${(RARITY_COLORS[slot.rarity ?? 1] ?? RARITY_COLORS[1]).border}`,
                        borderRadius: '0.25rem', overflow: 'hidden',
                      }}>
                        {identData && (
                          <Image
                            src={getIdentityImageUrl(identData.sinner_id, identData.folder_name ?? '', `${identData.game_id}_normal_info`)}
                            alt={slot.name_kr ?? ''} fill className="object-cover object-top" sizes="120px"
                          />
                        )}
                        <div style={{
                          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10, textAlign: 'center',
                          background: 'linear-gradient(to top, rgba(13,11,8,0.95) 0%, transparent 100%)',
                          paddingTop: '1.25rem', paddingBottom: '0.25rem',
                        }}>
                          <p className="font-serif" style={{ color: '#e8dcc8', fontSize: '0.6875rem', lineHeight: 1.2 }}>{slot.name_kr}</p>
                        </div>
                      </div>
                      <div style={{
                        marginTop: '0.375rem',
                        background: 'linear-gradient(160deg, #1a1510 0%, #100d08 100%)',
                        border: '1px solid #221a0f', borderRadius: '0.25rem', padding: '0.375rem',
                      }}>
                        {[0, 1, 2].map(idx => {
                          const skillName = skills.find(sk => sk.identity_id === slot.identity_id && sk.skill_order === idx + 1)?.name
                          return (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.125rem 0' }}>
                              {identForIcon?.game_id ? (
                                <Image
                                  src={getSkillIconUrl(identForIcon as Parameters<typeof getSkillIconUrl>[0], idx + 1)}
                                  alt={`S${idx + 1}`} width={24} height={24}
                                  style={{ width: '1.5rem', height: '1.5rem', borderRadius: '0.125rem', flexShrink: 0 }}
                                />
                              ) : (
                                <span style={{ fontSize: '0.5625rem', color: '#c8900a', fontFamily: 'var(--font-mono)', fontWeight: 700, width: '1.5rem', flexShrink: 0, textAlign: 'center' }}>
                                  S{idx + 1}
                                </span>
                              )}
                              {skillName ? (
                                <span style={{ fontSize: '0.5rem', color: '#8a7a60', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {skillName}
                                </span>
                              ) : (
                                <div style={{ flex: 1 }} />
                              )}
                              <span style={{
                                width: '1rem', textAlign: 'center', fontSize: '0.8125rem',
                                fontFamily: 'var(--font-mono)', fontWeight: 700,
                                color: dist[idx] === 0 ? '#3a2a10' : '#c8900a',
                              }}>
                                {dist[idx]}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState text="인격이 편성되지 않았습니다" />
            )
          )}
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

                      {theme ? (
                        <>
                          {theme.image_url && (
                            <div style={{ position: 'relative', width: '1.75rem', height: '3.175rem', flexShrink: 0 }}>
                              <Image src={theme.image_url} alt={theme.name} width={18} height={33}
                                style={{ width: '1.75rem', height: '3.175rem', objectFit: 'cover', borderRadius: '0.1875rem' }} />
                              {theme.boss_image_url && (
                                <Image src={theme.boss_image_url} alt="보스" width={28} height={32}
                                  style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '1.625rem', height: '1.8rem', objectFit: 'contain', opacity: 0.85 }} />
                              )}
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
                              {theme.boss_image_url && (
                                <Image src={theme.boss_image_url} alt="보스" width={40} height={44}
                                  style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '2.25rem', height: '2.5rem', objectFit: 'contain', opacity: 0.85 }} />
                              )}
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e8b030' }}>{theme.name}</div>
                            <div style={{ fontSize: '0.6875rem', color: '#6b7280', marginTop: '0.125rem' }}>
                              기프트 {(theme.ego_gift_ids?.length ?? 0) + (theme.specific_ego_gift_ids?.length ?? 0)}종
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

        {/* ── 댓글 섹션 ── */}
        <section>
          <h2 className="flex items-center gap-2 mb-4 font-semibold" style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
            <MessageCircle style={{ width: '0.875rem', height: '0.875rem' }} />
            댓글 {comments.length}개
          </h2>

          {replyTo && (
            <div className="flex items-center justify-between mb-2 px-3 py-1.5 rounded" style={{ background: 'rgba(200,144,10,0.08)', border: '1px solid rgba(200,144,10,0.2)', fontSize: '0.75rem', color: '#c8900a' }}>
              <span>@{replyTo.username} 에게 답글 작성 중</span>
              <button onClick={() => setReplyTo(null)} style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem' }}>취소</button>
            </div>
          )}

          {session ? (
            <div className="flex gap-2 mb-5">
              <textarea
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder={replyTo ? `@${replyTo.username}에게 답글...` : '댓글을 입력하세요 (최대 500자)'}
                maxLength={500}
                rows={2}
                className="flex-1 resize-none"
                style={{
                  background: '#1a1510', border: '1px solid #333',
                  borderRadius: '0.375rem', color: '#e5e7eb',
                  fontSize: '0.875rem', padding: '0.5rem 0.75rem',
                  outline: 'none', fontFamily: 'inherit',
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault()
                    handleCommentSubmit()
                  }
                }}
              />
              <button
                onClick={handleCommentSubmit}
                disabled={submitting || !commentText.trim()}
                className="flex items-center gap-1 transition-all hover:brightness-110 disabled:opacity-40"
                style={{
                  padding: '0.5rem 0.875rem',
                  background: 'rgba(200,144,10,0.15)', border: '1px solid rgba(200,144,10,0.35)',
                  borderRadius: '0.375rem', color: '#e8b030',
                  fontSize: '0.75rem', fontWeight: 600,
                  cursor: submitting || !commentText.trim() ? 'not-allowed' : 'pointer',
                  alignSelf: 'flex-end',
                }}
              >
                <Send style={{ width: '0.75rem', height: '0.75rem' }} />
                등록
              </button>
            </div>
          ) : (
            <div className="text-center py-4 mb-5" style={{
              background: '#1a1510', border: '1px solid #222',
              borderRadius: '0.375rem', fontSize: '0.75rem', color: '#6b7280',
            }}>
              <Link href="/login" style={{ color: '#e8b030' }}>로그인</Link>
              {' '}후 댓글을 작성할 수 있습니다.
            </div>
          )}

          {commentsLoading ? (
            <div style={{ fontSize: '0.75rem', color: '#6b7280', padding: '1rem 0' }}>댓글 불러오는 중...</div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8" style={{ fontSize: '0.75rem', color: '#4b5563' }}>
              아직 댓글이 없습니다. 첫 번째 댓글을 남겨보세요.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {comments.filter(c => !c.parent_id).map(comment => {
                const cNickname = comment.profiles?.username ?? '익명'
                const cAvatar = comment.profiles?.avatar_url ?? DEFAULT_AVATAR_URL
                const replies = comments.filter(c => c.parent_id === comment.id)
                return (
                  <div key={comment.id}>
                    <div className="flex gap-3 p-4" style={{ background: '#1a1510', border: '1px solid #222', borderRadius: '0.375rem' }}>
                      <div className="relative overflow-hidden rounded-full" style={{ width: '1.75rem', height: '1.75rem', flexShrink: 0 }}>
                        <Image src={cAvatar} alt={cNickname} width={28} height={28}
                          style={{ width: '1.75rem', height: '1.75rem', objectFit: 'cover' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 600 }}>{cNickname}</span>
                          <RelativeTime date={comment.created_at} style={{ fontSize: '0.75rem', color: '#4b5563' }} />
                        </div>
                        <p style={{ fontSize: '0.875rem', color: '#e5e7eb', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>
                          {comment.content}
                        </p>
                        {session && (
                          <button
                            onClick={() => setReplyTo({ id: comment.id, username: cNickname })}
                            style={{ marginTop: '0.375rem', fontSize: '0.6875rem', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          >
                            답글
                          </button>
                        )}
                      </div>
                    </div>
                    {replies.map(reply => {
                      const rNickname = reply.profiles?.username ?? '익명'
                      const rAvatar = reply.profiles?.avatar_url ?? DEFAULT_AVATAR_URL
                      return (
                        <div key={reply.id} className="flex gap-3 p-4" style={{
                          background: 'rgba(200,144,10,0.03)', border: '1px solid #222',
                          borderRadius: '0.375rem', marginLeft: '1.5rem', marginTop: '0.375rem',
                        }}>
                          <div className="relative overflow-hidden rounded-full" style={{ width: '1.5rem', height: '1.5rem', flexShrink: 0 }}>
                            <Image src={rAvatar} alt={rNickname} width={24} height={24}
                              style={{ width: '1.5rem', height: '1.5rem', objectFit: 'cover' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 600 }}>{rNickname}</span>
                              <RelativeTime date={reply.created_at} style={{ fontSize: '0.75rem', color: '#4b5563' }} />
                            </div>
                            <p style={{ fontSize: '0.875rem', color: '#e5e7eb', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>
                              {reply.content}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </section>

      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
          zIndex: 100, padding: '0.625rem 1.25rem', borderRadius: '0.5rem',
          background: toast.type === 'error' ? 'rgba(239,68,68,0.95)' : 'rgba(34,197,94,0.95)',
          color: '#fff', fontSize: '0.8125rem', fontWeight: 600,
          boxShadow: '0 0.5rem 2rem rgba(0,0,0,0.5)',
        }}>
          {toast.message}
        </div>
      )}

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

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        open={showDeleteModal}
        title="플랜 삭제"
        message="이 플랜을 삭제하시겠습니까? 삭제 후 복구할 수 없습니다."
        confirmLabel="삭제"
        cancelLabel="취소"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
      {identityModalId && (
        <IdentityDetailModal identityId={identityModalId} onClose={() => setIdentityModalId(null)} />
      )}
      {egoModalId && (
        <EgoDetailModal egoId={egoModalId} onClose={() => setEgoModalId(null)} />
      )}
    </div>
  )
}
