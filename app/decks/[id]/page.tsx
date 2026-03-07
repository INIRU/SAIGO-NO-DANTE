'use client'

import { use, useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Trash2, Reply, X } from 'lucide-react'
import { useToast, Toast } from '@/components/ui/Toast'
import { STORAGE_BASE, getSinnerLogoUrl, GRADE_COLORS, computeSkillImageIndices, SIN_COLORS, SIN_KR_TO_EN, type ActivationCondition, DEFAULT_AVATAR_URL } from '@/lib/data/sinners'
import { NoteRenderer, type NoteSkillEntry, type NotePassiveEntry, type NoteEgoEntry, type NoteEgoGiftEntry } from '@/components/decks/NoteChips'
import DeckIdentityCard, { type IdentitySlot, type IdentityDetail, type EgoEntry } from '@/components/deck-detail/DeckIdentityCard'
import { portraitUrl } from '@/components/deck-detail/DeckIdentityCard'
import PassiveBadgeDetail from '@/components/deck-detail/PassiveBadgeDetail'
import DeckEgoGiftAccordion from '@/components/deck-detail/DeckEgoGiftAccordion'
import { DeckSidebarPanel, DeckMobileActionBar } from '@/components/deck-detail/DeckDetailHeader'

// ── 타입 ──────────────────────────────────────────────────────────────────
type EgoSlot = {
  grade: string
  ego: {
    id: string
    name_kr: string | null
    grade: string
    sin_affinity: string | null
    sinner_id: string
    folder_name: string | null
    image_url: string | null
  } | null
}

type SinnerEgo = {
  sinner_id: string
  name_kr: string | null
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

const GEODUN_TYPES = new Set(['거던5층', '거던10층', '거던15층'])

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

// ── 상수 ──────────────────────────────────────────────────────────────────
const THEME_KEYWORDS = new Set(['침잠', '출혈', '파열', '화상', '진동', '충전', '호흡'])

const RARITY_COLORS: Record<string, string> = {
  '1성': '#667788',
  '2성': '#4898b0',
  '3성': '#c8900a',
}

// ── 헬퍼 ──────────────────────────────────────────────────────────────────
function sinColor(sin: string, isKr = false): string {
  const en = isKr ? (SIN_KR_TO_EN[sin] ?? sin) : sin
  return SIN_COLORS[en as keyof typeof SIN_COLORS] ?? '#888888'
}

function topKeywords(slots: IdentitySlot[]): string[] {
  const formed = slots.filter(s => s.slot_order < 99 && s.identities)
  const total = formed.length
  if (total === 0) return []

  const freq: Record<string, number> = {}
  for (const slot of formed) {
    for (const kw of slot.identities?.keywords ?? []) {
      if (THEME_KEYWORDS.has(kw)) freq[kw] = (freq[kw] ?? 0) + 1
    }
  }

  const minCount = total <= 1 ? 1 : Math.max(2, Math.ceil(total * 0.4))
  return Object.entries(freq)
    .filter(([, n]) => n >= minCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([kw]) => kw)
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

function buildNoteLookups(slots: IdentitySlot[], allEgos: SinnerEgo[]) {
  const skillLookup: Record<string, NoteSkillEntry> = {}
  const passiveLookup: Record<string, NotePassiveEntry> = {}
  const egoLookup: Record<string, NoteEgoEntry> = {}

  for (const slot of slots) {
    const id_ = slot.identities
    if (!id_) continue
    const sName = SINNER_NAMES[id_.sinner_id] ?? id_.sinner_id

    const rawSk = id_.skills ?? []
    const skBest = new Map<string, typeof rawSk[0]>()
    for (const s of rawSk) {
      const key = `${s.skill_order}:${(s as Record<string, unknown>).variant_order ?? 0}`
      const ex = skBest.get(key)
      if (!ex || (s.uptie_level ?? 3) > (ex.uptie_level ?? 3)) skBest.set(key, s)
    }
    const sortedSkills = [...skBest.values()].sort((a, b) => a.skill_order - b.skill_order || ((a as Record<string, unknown>).variant_order as number ?? 0) - ((b as Record<string, unknown>).variant_order as number ?? 0))
    const imgIdx = computeSkillImageIndices(sortedSkills)
    const atkSkills = sortedSkills.filter(sk => !['evade', 'defense', 'counter'].includes(sk.skill_type))
    const orderCount: Record<number, number> = {}
    for (const sk of atkSkills) {
      const subIdx = orderCount[sk.skill_order] || 0
      orderCount[sk.skill_order] = subIdx + 1
      const key = subIdx === 0
        ? `${sName}:${sk.skill_order}`
        : `${sName}:${sk.skill_order}:${subIdx}`
      const iconUrl = id_.game_id
        ? `${STORAGE_BASE}/icons/skills/${id_.sinner_id}/${id_.game_id}${String(imgIdx[sk.id] ?? sk.skill_order).padStart(2, '0')}.webp`
        : undefined
      skillLookup[key] = {
        name: sk.name, skill_type: sk.skill_type, sin_affinity: sk.sin_affinity,
        skill_order: sk.skill_order, description: sk.description,
        iconUrl, identityName: id_.name_kr, sinnerName: sName,
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
      passiveLookup[pa.name] = {
        name: pa.name, sin_affinity: pa.sin_affinity,
        sin_count: pa.sin_count, active_cond: pa.active_cond,
        description: pa.description, sinnerName: sName,
        imageUrl: id_.game_id && id_.folder_name ? `${STORAGE_BASE}/sinners/${id_.sinner_id}/identities/${id_.folder_name}/${id_.game_id}_normal_info.webp` : undefined,
      }
    }
  }
  for (const ego of allEgos) {
    const sName = SINNER_NAMES[ego.sinner_id] ?? ego.sinner_id
    const name = ego.name_kr ?? sName
    egoLookup[`${sName}:${name}`] = {
      name, grade: ego.grade, sin_affinity: ego.sin_affinity,
      image_url: ego.image_url, sinnerName: sName,
    }
  }
  return { skillLookup, passiveLookup, egoLookup }
}

// ── 스켈레톤 ──────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="min-h-screen" style={{ background: '#0d0b08' }}>
      <div style={{ height: '360px', background: 'linear-gradient(to bottom, #080604, #0d0b08)' }} />
      <div className="max-w-5xl mx-auto px-4 md:px-6 pt-6 flex gap-5">
        <div className="hidden lg:block" style={{ width: 252, flexShrink: 0 }}>
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
export default function DeckDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { status: authStatus } = useSession()

  const [deck, setDeck] = useState<DeckDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast, showToast } = useToast()
  const [voted, setVoted] = useState(false)
  const [voteCount, setVoteCount] = useState(0)
  const [voting, setVoting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [selectedSinner, setSelectedSinner] = useState<string | null>(null)
  const [keywordMeta, setKeywordMeta] = useState<Record<string, { description: string }>>({})
  const [identitiesOpen, setIdentitiesOpen] = useState(true)
  const [notesOpen, setNotesOpen] = useState(true)
  const [passivesOpen, setPassivesOpen] = useState(false)
  const [giftsOpen, setGiftsOpen] = useState(false)

  const [bookmarked, setBookmarked] = useState(false)
  const [bookmarking, setBookmarking] = useState(false)

  const [comments, setComments] = useState<Comment[]>([])
  const [commentText, setCommentText] = useState('')
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [replyingTo, setReplyingTo] = useState<{ rootId: string; targetName: string } | null>(null)
  const [replyText, setReplyText] = useState('')

  const [shared, setShared] = useState(false)
  const [shareGenerating, setShareGenerating] = useState(false)

  const [egoGiftLookup, setEgoGiftLookup] = useState<Record<string, NoteEgoGiftEntry>>({})
  const [allEgoGifts, setAllEgoGifts] = useState<{ name: string; keyword: string; grade: string; image_url: string | null; effect_base: string | null; activation_condition: ActivationCondition | null }[]>([])

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
      .then((gifts: { name: string; keyword: string; grade: string; image_url: string | null; effect_base: string | null; activation_condition: ActivationCondition | null }[]) => {
        const map: Record<string, NoteEgoGiftEntry> = {}
        for (const g of gifts) map[g.name] = g
        setEgoGiftLookup(map)
        setAllEgoGifts(gifts)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch(`/api/decks/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && !data.error) {
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
          setDeck(fixed)
          setVoteCount(data.vote_count ?? 0)
        }
      })
      .finally(() => setLoading(false))
  }, [id])

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

  useEffect(() => {
    fetch(`/api/decks/${id}/comments`)
      .then(r => r.ok ? r.json() : [])
      .then((data: Comment[]) => setComments(data))
      .catch(() => {})
  }, [id])

  const handleVote = useCallback(async () => {
    if (authStatus !== 'authenticated' || voting) return
    setVoting(true)
    try {
      const res = await fetch(`/api/decks/${id}/vote`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setVoted(data.voted)
        setVoteCount(c => data.voted ? c + 1 : c - 1)
      } else {
        showToast('추천에 실패했습니다.')
      }
    } catch {
      showToast('추천에 실패했습니다.')
    } finally {
      setVoting(false)
    }
  }, [authStatus, id, voting])

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
        showToast(data.bookmarked ? '북마크에 추가했습니다.' : '북마크를 해제했습니다.', 'success')
      } else {
        showToast('북마크에 실패했습니다.')
      }
    } catch {
      showToast('북마크에 실패했습니다.')
    } finally {
      setBookmarking(false)
    }
  }, [authStatus, id, bookmarking])

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

  const handleCommentSubmit = useCallback(async () => {
    if (!commentText.trim() || commentSubmitting || authStatus !== 'authenticated') return
    setCommentSubmitting(true)
    try {
      const res = await fetch(`/api/decks/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentText.trim() }),
      })
      if (res.ok) {
        const comment: Comment = await res.json()
        setComments(prev => [...prev, comment])
        setCommentText('')
      } else {
        showToast('댓글 작성에 실패했습니다.')
      }
    } catch {
      showToast('댓글 작성에 실패했습니다.')
    } finally {
      setCommentSubmitting(false)
    }
  }, [commentText, commentSubmitting, authStatus, id, showToast])

  const handleReplySubmit = useCallback(async () => {
    if (!replyingTo || !replyText.trim() || commentSubmitting || authStatus !== 'authenticated') return
    setCommentSubmitting(true)
    try {
      const res = await fetch(`/api/decks/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: replyText.trim(), parent_id: replyingTo.rootId }),
      })
      if (res.ok) {
        const comment: Comment = await res.json()
        setComments(prev => [...prev, comment])
        setReplyText('')
        setReplyingTo(null)
      } else {
        showToast('답글 작성에 실패했습니다.')
      }
    } catch {
      showToast('답글 작성에 실패했습니다.')
    } finally {
      setCommentSubmitting(false)
    }
  }, [replyingTo, replyText, commentSubmitting, authStatus, id, showToast])

  const handleCommentDelete = useCallback(async (commentId: string) => {
    try {
      const res = await fetch(`/api/decks/${id}/comments?commentId=${commentId}`, { method: 'DELETE' })
      if (res.ok) {
        setComments(prev => prev.filter(c => c.id !== commentId && c.parent_id !== commentId))
        showToast('댓글이 삭제되었습니다.', 'success')
      } else {
        showToast('댓글 삭제에 실패했습니다.')
      }
    } catch {
      showToast('댓글 삭제에 실패했습니다.')
    }
  }, [id, showToast])

  const handleFork = useCallback(() => {
    window.location.href = `/decks/new?fork=${id}`
  }, [id])

  if (loading) return <Skeleton />

  if (!deck) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center">
          <p className="font-serif text-2xl mb-4" style={{ color: 'var(--gold)' }}>덱을 찾을 수 없습니다</p>
          <Link href="/decks" style={{ color: '#555566' }} className="hover:text-yellow-300 transition-colors">
            ← 게시판으로 돌아가기
          </Link>
        </div>
      </div>
    )
  }

  // 정렬
  const sorted = [...deck.deck_identities].sort((a, b) => {
    if (a.slot_order === 99 && b.slot_order !== 99) return 1
    if (b.slot_order === 99 && a.slot_order !== 99) return -1
    return a.slot_order - b.slot_order
  })
  const slots = Array.from({ length: 12 }, (_, i) => sorted[i] ?? null)
  const keywords = topKeywords(sorted)
  const filledSlots = sorted.filter(s => s.identities)
  const customSkillSlots = filledSlots.filter(s => {
    const s1 = s.s1_count ?? 3, s2 = s.s2_count ?? 2, s3 = s.s3_count ?? 1
    return !(s1 === 3 && s2 === 2 && s3 === 1)
  })

  // 죄악 자원 & 공격 유형
  const sinAffinityTotals: Record<string, number> = {}
  const atkTypeTotals: Record<string, number> = { slash: 0, pierce: 0, blunt: 0 }
  for (const slot of filledSlots) {
    for (const sk of slot.identities!.skills) {
      if (sk.sin_affinity) {
        const en = SIN_KR_TO_EN[sk.sin_affinity] ?? sk.sin_affinity
        sinAffinityTotals[en] = (sinAffinityTotals[en] ?? 0) + 1
      }
      if (sk.skill_type in atkTypeTotals) atkTypeTotals[sk.skill_type]++
    }
  }

  // EGO 그룹핑
  const gradeOrder = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH']
  const egoGrouped: Record<string, EgoEntry[]> = {}
  for (const row of deck.deck_egos ?? []) {
    if (!row.ego) continue
    const sid = row.ego.sinner_id
    ;(egoGrouped[sid] ??= []).push({ grade: row.grade, ego: row.ego })
  }
  for (const sid of Object.keys(egoGrouped)) {
    egoGrouped[sid].sort((a, b) => gradeOrder.indexOf(a.grade) - gradeOrder.indexOf(b.grade))
  }
  const egoSinnerIds = Object.keys(egoGrouped)

  // 수감자별 그룹핑
  const slotsBySinner = filledSlots.reduce<Record<string, IdentitySlot[]>>((acc, slot) => {
    const sid = slot.identities!.sinner_id
    ;(acc[sid] ??= []).push(slot)
    return acc
  }, {})
  const sinnerIds = [
    ...Object.keys(slotsBySinner),
    ...egoSinnerIds.filter(sid => !slotsBySinner[sid]),
  ].sort((a, b) => {
    const ai = SINNER_ORDER.indexOf(a as typeof SINNER_ORDER[number])
    const bi = SINNER_ORDER.indexOf(b as typeof SINNER_ORDER[number])
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  const sinnerFormationOrder: Record<string, number> = {}
  for (const slot of filledSlots) {
    const sid = slot.identities!.sinner_id
    if (slot.slot_order !== 99) sinnerFormationOrder[sid] = slot.slot_order + 1
  }
  const activeSinner = selectedSinner ?? sinnerIds[0] ?? null
  const activeSlots = activeSinner ? (slotsBySinner[activeSinner] ?? []) : []
  const activeEgos = activeSinner ? (egoGrouped[activeSinner] ?? []) : []

  const isGeodun = GEODUN_TYPES.has(deck.content_type ?? '')
  const date = new Date(deck.created_at).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

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
    atkTypeTotals,
    filledSlotsCount: filledSlots.length,
    onVote: handleVote,
    onBookmark: handleBookmark,
    onShare: handleShare,
    onCopyCode: handleCopyCode,
    onFork: handleFork,
  }

  return (
    <div className="min-h-screen" style={{ background: '#0d0b08' }}>

      {/* ── 히어로 파노라마 ── */}
      <div className="relative" style={{ paddingTop: '64px' }}>
        <div className="relative overflow-hidden" style={{ height: '340px' }}>

          {/* 12 포트레이트 스트립 */}
          <div className="absolute inset-0" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)' }}>
            {slots.map((slot, i) => {
              const id_ = slot?.identities
              const imgUrl = id_
                ? portraitUrl(id_.sinner_id, id_.folder_name, id_.game_id, slot?.gacksung ?? false)
                : ''
              const normalImgUrl = id_
                ? portraitUrl(id_.sinner_id, id_.folder_name, id_.game_id, false)
                : ''
              const rarityColor = id_?.rarity ? (RARITY_COLORS[id_.rarity] ?? null) : null
              return (
                <div key={i} className="relative overflow-hidden">
                  {imgUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imgUrl}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block', filter: 'brightness(0.65) saturate(0.85)' }}
                      loading="lazy"
                      onError={e => {
                        if (slot?.gacksung && e.currentTarget.src !== normalImgUrl) {
                          e.currentTarget.src = normalImgUrl
                        }
                      }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: '#08060410' }} />
                  )}
                  {i > 0 && (
                    <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '1px', background: 'rgba(0,0,0,0.5)' }} />
                  )}
                  {rarityColor && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: rarityColor, opacity: 0.6 }} />
                  )}
                </div>
              )
            })}
          </div>

          {/* 그라디언트 */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to bottom, rgba(13,11,8,0.1) 0%, rgba(13,11,8,0.0) 25%, rgba(13,11,8,0.55) 60%, rgba(13,11,8,0.96) 90%, rgba(13,11,8,1) 100%)',
              pointerEvents: 'none',
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to right, rgba(13,11,8,0.65) 0%, transparent 18%, transparent 82%, rgba(13,11,8,0.65) 100%)',
              pointerEvents: 'none',
            }}
          />

          {/* 타이틀 오버레이 */}
          <div className="absolute bottom-0 left-0 right-0">
            <div className="max-w-5xl mx-auto px-4 md:px-6 pb-7">
              <Link
                href="/decks"
                className="inline-flex items-center gap-1.5 mb-3 transition-opacity hover:opacity-70"
                style={{ color: '#c8a450', fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', letterSpacing: '0.1em' }}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                DECK ARCHIVE
              </Link>
              <h1
                className="font-serif font-bold mb-2 leading-tight"
                style={{ color: '#f0ece0', fontSize: 'clamp(1.4rem, 3.5vw, 2.1rem)', textShadow: '0 2px 24px rgba(0,0,0,0.9)' }}
              >
                {deck.title}
              </h1>
              <div className="flex items-center gap-2.5" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', color: '#555570' }}>
                {deck.profiles?.username && (
                  <span style={{ color: '#6a6080' }}>{deck.profiles.username}</span>
                )}
                {deck.profiles?.username && <span style={{ fontFamily: 'sans-serif' }}>·</span>}
                <span>{date}</span>
                <span style={{ fontFamily: 'sans-serif' }}>·</span>
                <span className="flex items-center gap-1">
                  <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
                    <ellipse cx="8" cy="8" rx="7" ry="4.5" stroke="currentColor" strokeWidth="1.4"/>
                    <circle cx="8" cy="8" r="2" fill="currentColor"/>
                  </svg>
                  {deck.view_count}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 콘텐츠 ── */}
      <div className="max-w-5xl mx-auto px-4 md:px-6 pb-24 pt-6">

        {/* 모바일 액션바 */}
        <DeckMobileActionBar {...headerProps} />

        <div className="flex gap-5 items-start">

          {/* 데스크탑 사이드바 */}
          <aside className="hidden lg:block" style={{ width: 252, flexShrink: 0 }}>
            <DeckSidebarPanel {...headerProps} />
          </aside>

          {/* 수감자 탭 + 인격 상세 */}
          <main className="flex-1 min-w-0">
            {filledSlots.length === 0 ? (
              <p className="text-sm italic" style={{ color: '#2a2a3a', fontFamily: 'var(--font-body)' }}>인격 정보 없음</p>
            ) : (
              <>
                {/* 수감자 탭 그리드 */}
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 mb-4">
                  {sinnerIds.map(sid => {
                    const firstSlot = slotsBySinner[sid]?.[0] ?? null
                    const id_ = firstSlot?.identities ?? null
                    const imgUrl = id_ ? portraitUrl(id_.sinner_id, id_.folder_name, id_.game_id, firstSlot?.gacksung ?? false) : (egoGrouped[sid]?.[0]?.ego.image_url ?? '')
                    const normalUrl = id_ ? portraitUrl(id_.sinner_id, id_.folder_name, id_.game_id, false) : imgUrl
                    const rc = id_ ? (RARITY_COLORS[id_.rarity] ?? '#667788') : (GRADE_COLORS[egoGrouped[sid]?.[0]?.grade ?? ''] ?? '#667788')
                    const isActive = activeSinner === sid
                    return (
                      <button
                        key={sid}
                        onClick={() => setSelectedSinner(sid)}
                        className="relative overflow-hidden"
                        style={{
                          aspectRatio: '2/3',
                          borderRadius: 4,
                          border: `1.5px solid ${isActive ? rc : 'rgba(38,24,10,0.5)'}`,
                          background: '#0a0806',
                          cursor: 'pointer',
                          transition: 'border-color 0.15s, box-shadow 0.15s',
                          boxShadow: isActive ? `0 0 12px ${rc}28` : 'none',
                          padding: 0,
                        }}
                      >
                        {imgUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={imgUrl}
                            alt={id_?.name_kr ?? ''}
                            style={{
                              width: '100%', height: '100%',
                              objectFit: 'cover', objectPosition: 'center top',
                              display: 'block',
                              filter: isActive ? 'brightness(0.88)' : 'brightness(0.45) saturate(0.65)',
                              transition: 'filter 0.15s',
                            }}
                            onError={e => {
                              if (firstSlot?.gacksung && e.currentTarget.src !== normalUrl) {
                                e.currentTarget.src = normalUrl
                              }
                            }}
                          />
                        ) : (
                          <div style={{ width: '100%', height: '100%', background: '#080604' }} />
                        )}
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: rc, opacity: isActive ? 1 : 0.4 }} />
                        {sinnerFormationOrder[sid] != null && (() => {
                          const n = sinnerFormationOrder[sid]
                          const isFormation = n <= 7
                          return (
                            <div
                              className="absolute inset-0 flex items-center justify-center"
                              style={{ opacity: isActive ? 0.95 : 0.55, transition: 'opacity 0.15s', pointerEvents: 'none', gap: '3px' }}
                            >
                              <span style={{ fontSize: '0.875rem', fontWeight: 700, fontFamily: 'var(--font-body)', color: isFormation ? '#e8b030' : '#5ab0d0', textShadow: `0 0 8px ${isFormation ? 'rgba(200,144,10,0.5)' : 'rgba(90,176,208,0.5)'}, 0 2px 6px rgba(0,0,0,0.9)` }}>
                                {isFormation ? '편성' : '대기'}
                              </span>
                              <span style={{ fontSize: '1.375rem', fontWeight: 800, fontFamily: 'var(--font-body)', lineHeight: 1, color: isFormation ? '#e8b030' : '#5ab0d0', textShadow: `0 0 10px ${isFormation ? 'rgba(200,144,10,0.5)' : 'rgba(90,176,208,0.5)'}, 0 2px 6px rgba(0,0,0,0.9)` }}>
                                {n}
                              </span>
                            </div>
                          )
                        })()}
                        <div
                          className="absolute bottom-0 left-0 right-0 flex items-end justify-center"
                          style={{ background: 'linear-gradient(to top, rgba(8,6,4,0.92) 0%, transparent 100%)', paddingBottom: 5, paddingTop: 16 }}
                        >
                          <Image src={getSinnerLogoUrl(sid)} alt="" width={14} height={14} style={{ opacity: isActive ? 0.75 : 0.3, transition: 'opacity 0.15s' }} />
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* 인격 정보 아코디언 */}
                <div className="mb-3 rounded-lg overflow-hidden" style={{ background: '#120e09', border: '1px solid var(--border)' }}>
                  <button
                    onClick={() => setIdentitiesOpen(v => !v)}
                    className="w-full flex items-center justify-between px-4 py-2.5 transition-colors"
                    style={{ background: identitiesOpen ? 'rgba(200,144,10,0.04)' : 'transparent', borderBottom: identitiesOpen ? '1px solid rgba(32,20,8,0.7)' : 'none' }}
                  >
                    <div className="flex items-center gap-2">
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5625rem', color: identitiesOpen ? '#8a7040' : '#5a5070', letterSpacing: '0.12em' }}>
                        IDENTITIES
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', color: '#c8900a' }}>
                        {activeSlots.length}
                      </span>
                    </div>
                    <svg
                      width="12" height="12" viewBox="0 0 16 16" fill="none"
                      style={{ color: identitiesOpen ? '#8a7040' : '#5a5065', transition: 'transform 0.2s', transform: identitiesOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    >
                      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  {identitiesOpen && (
                    <div className="flex flex-col gap-2 p-3">
                      {activeSlots.map((slot, i) => (
                        <DeckIdentityCard key={i} slot={slot} egos={i === 0 ? activeEgos : undefined} keywordMeta={keywordMeta} />
                      ))}
                    </div>
                  )}
                </div>

                {/* 덱 노트 아코디언 */}
                {(deck.description || customSkillSlots.length > 0) && (
                  <div className="mb-3 rounded-lg overflow-hidden" style={{ background: '#120e09', border: '1px solid var(--border)' }}>
                    <button
                      onClick={() => setNotesOpen(v => !v)}
                      className="w-full flex items-center justify-between px-4 py-2.5 transition-colors"
                      style={{ background: notesOpen ? 'rgba(200,144,10,0.04)' : 'transparent', borderBottom: notesOpen ? '1px solid rgba(32,20,8,0.7)' : 'none' }}
                    >
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5625rem', color: notesOpen ? '#8a7040' : '#5a5070', letterSpacing: '0.12em' }}>
                        DECK NOTES
                      </span>
                      <svg
                        width="12" height="12" viewBox="0 0 16 16" fill="none"
                        style={{ color: notesOpen ? '#8a7040' : '#5a5065', transition: 'transform 0.2s', transform: notesOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                      >
                        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    {notesOpen && (
                      <div className="px-4 py-3">
                        {deck.description && (
                          <NoteRenderer
                            text={deck.description}
                            {...buildNoteLookups(sorted, deck.all_sinner_egos ?? [])}
                            egoGiftLookup={egoGiftLookup}
                          />
                        )}
                        {customSkillSlots.length > 0 && (
                          <div style={{ marginTop: deck.description ? '12px' : 0, borderTop: deck.description ? '1px solid rgba(32,20,8,0.5)' : 'none', paddingTop: deck.description ? '12px' : 0 }}>
                            <div className="flex items-center gap-2 mb-2">
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5625rem', color: '#8a6010', letterSpacing: '0.08em', fontWeight: 700 }}>SKILL DISTRIBUTION</span>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              {customSkillSlots.map((slot, i) => {
                                const id_ = slot.identities!
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
                                  <div key={i} className="flex items-center gap-2 rounded px-2.5 py-1.5" style={{ background: 'rgba(200,144,10,0.04)', border: '1px solid rgba(200,144,10,0.15)' }}>
                                    <Image src={getSinnerLogoUrl(id_.sinner_id)} alt="" width={16} height={16} style={{ opacity: 0.5, flexShrink: 0 }} />
                                    <span className="truncate" style={{ fontSize: '0.6875rem', color: '#a09080', fontFamily: 'var(--font-body)', minWidth: 0, flex: '0 1 auto', maxWidth: '120px' }}>
                                      {id_.name_kr}
                                    </span>
                                    <div style={{ flex: 1 }} />
                                    {[0, 1, 2].map(idx => {
                                      const skill = sortedSk.find(s => s.skill_order === idx + 1)
                                      const sc = skill ? sinColor(skill.sin_affinity) : '#888'
                                      const iconUrl = skillIconBase ? `${skillIconBase}${String(idx + 1).padStart(2, '0')}.webp` : ''
                                      return (
                                        <div key={idx} className="flex items-center gap-1" style={{ minWidth: '42px' }}>
                                          {iconUrl && (
                                            <Image src={iconUrl} alt={`S${idx + 1}`} width={18} height={18} style={{ borderRadius: '3px', border: `1px solid ${sc}40` }} />
                                          )}
                                          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: dist[idx] > 0 ? sc : '#2a2015' }}>
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
                    )}
                  </div>
                )}

                {/* 패시브 패널 */}
                <div className="mb-3 rounded-lg overflow-hidden" style={{ background: '#120e09', border: '1px solid var(--border)' }}>
                  <button
                    onClick={() => setPassivesOpen(v => !v)}
                    className="w-full flex items-center justify-between px-4 py-2.5 transition-colors"
                    style={{ background: passivesOpen ? 'rgba(200,144,10,0.04)' : 'transparent', borderBottom: passivesOpen ? '1px solid rgba(32,20,8,0.7)' : 'none' }}
                  >
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5625rem', color: passivesOpen ? '#8a7040' : '#5a5070', letterSpacing: '0.12em' }}>
                      PASSIVES
                    </span>
                    <svg
                      width="12" height="12" viewBox="0 0 16 16" fill="none"
                      style={{ color: passivesOpen ? '#8a7040' : '#5a5065', transition: 'transform 0.2s', transform: passivesOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    >
                      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  {passivesOpen && (() => {
                    const deckSinCounts: Record<string, number> = {}
                    for (const slot of filledSlots) {
                      const id__ = slot.identities!
                      const rawSk__ = id__.skills ?? []
                      const skBest__ = new Map<string, typeof rawSk__[0]>()
                      for (const s of rawSk__) {
                        if (['evade', 'defense', 'counter'].includes(s.skill_type)) continue
                        const key = `${s.skill_order}:${(s as Record<string, unknown>).variant_order ?? 0}`
                        const ex = skBest__.get(key)
                        if (!ex || (s.uptie_level ?? 3) > (ex.uptie_level ?? 3)) skBest__.set(key, s)
                      }
                      for (const sk of skBest__.values()) {
                        if (sk.sin_affinity) {
                          const en = SIN_KR_TO_EN[sk.sin_affinity] ?? sk.sin_affinity
                          deckSinCounts[en] = (deckSinCounts[en] ?? 0) + 1
                        }
                      }
                    }
                    return (
                      <div style={{ borderTop: '1px solid var(--border)' }}>
                        {filledSlots.map((slot, idx) => {
                          const id_ = slot.identities!
                          const rawPa = id_.passives ?? []
                          const paBest = new Map<string, typeof rawPa[0]>()
                          for (const p of rawPa) {
                            const key = `${p.passive_type}:${p.passive_order}`
                            const ex = paBest.get(key)
                            if (!ex || (p.uptie_level ?? 3) > (ex.uptie_level ?? 3)) paBest.set(key, p)
                          }
                          const filtPa = [...paBest.values()]
                          const battlePassives = filtPa.filter(p => p.passive_type === 'battle')
                          const supportPassives = filtPa.filter(p => p.passive_type === 'support')
                          return (
                            <div
                              key={idx}
                              className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 px-4 py-2.5"
                              style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}
                            >
                              <div style={{ width: '130px', minWidth: 0, flexShrink: 0 }}>
                                <div className="flex items-center gap-1 mb-0.5">
                                  <Image src={getSinnerLogoUrl(id_.sinner_id)} alt="" width={14} height={14} style={{ opacity: 0.4 }} />
                                  <span style={{ color: '#6a5e38', fontSize: '0.6875rem', fontFamily: 'var(--font-mono)' }}>{SINNER_NAMES[id_.sinner_id] ?? id_.sinner_id}</span>
                                </div>
                                <p style={{ color: '#c8a450', fontSize: '0.6875rem', fontWeight: 700, lineHeight: 1.3, wordBreak: 'keep-all', overflowWrap: 'break-word' }}>{id_.name_kr}</p>
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ color: '#555570', fontSize: '0.625rem', fontFamily: 'var(--font-mono)', marginBottom: '4px', letterSpacing: '0.05em' }}>일반 패시브</p>
                                <div className="flex flex-col gap-1.5">
                                  {battlePassives.length > 0 ? battlePassives.map((p, pi) => (
                                    <PassiveBadgeDetail key={pi} p={p} deckSinCounts={deckSinCounts} />
                                  )) : <span style={{ color: '#5a5260', fontSize: '0.625rem' }}>-</span>}
                                </div>
                              </div>
                              <div className="hidden sm:block" style={{ width: '1px', alignSelf: 'stretch', background: 'rgba(255,255,255,0.04)', flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ color: '#555570', fontSize: '0.625rem', fontFamily: 'var(--font-mono)', marginBottom: '4px', letterSpacing: '0.05em' }}>서포트 패시브</p>
                                <div className="flex flex-col gap-1.5">
                                  {supportPassives.length > 0 ? supportPassives.map((p, pi) => (
                                    <PassiveBadgeDetail key={pi} p={p} deckSinCounts={deckSinCounts} />
                                  )) : <span style={{ color: '#5a5260', fontSize: '0.625rem' }}>-</span>}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>

                {/* EGO 기프트 아코디언 (거던 유형만) */}
                {isGeodun && (
                  <DeckEgoGiftAccordion
                    filledSlots={filledSlots.map(s => ({ slot_order: s.slot_order, identities: s.identities ? { keywords: s.identities.keywords } : null }))}
                    allEgoGifts={allEgoGifts}
                    open={giftsOpen}
                    onToggle={() => setGiftsOpen(v => !v)}
                  />
                )}

              </>
            )}
          </main>

        </div>

        {/* 댓글 섹션 */}
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <span style={{ color: '#5a5070', fontFamily: 'var(--font-mono)', fontSize: '0.625rem', letterSpacing: '0.15em' }}>
              COMMENTS
            </span>
            <span className="font-serif font-bold" style={{ color: 'var(--gold)', fontSize: '1rem' }}>
              댓글
            </span>
            <span style={{ color: '#5a5070', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem' }}>
              {comments.length}
            </span>
          </div>

          {authStatus === 'authenticated' ? (
            <div className="rounded-lg p-4 mb-4" style={{ background: '#120e09', border: '1px solid var(--border)' }}>
              <textarea
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="덱에 대한 의견을 남겨보세요..."
                className="w-full px-3 py-2 text-sm outline-none resize-none"
                style={{ background: '#0a0806', border: '1px solid rgba(58,40,18,0.5)', borderRadius: '4px', color: '#e8dcc8', fontFamily: 'var(--font-body)' }}
              />
              <div className="flex items-center justify-between mt-2">
                <span style={{ color: '#5a5070', fontSize: '0.625rem', fontFamily: 'var(--font-mono)' }}>
                  {commentText.length}/500
                </span>
                <button
                  onClick={handleCommentSubmit}
                  disabled={commentSubmitting || !commentText.trim()}
                  className="px-4 py-1.5 text-xs font-medium transition-all duration-150 hover:brightness-110"
                  style={{
                    background: commentText.trim() ? 'var(--gold)' : 'rgba(44,28,12,0.5)',
                    color: commentText.trim() ? 'var(--bg-deep)' : '#5a5070',
                    borderRadius: '4px',
                    cursor: commentText.trim() ? 'pointer' : 'default',
                    fontFamily: 'var(--font-heading)',
                    opacity: commentSubmitting ? 0.5 : 1,
                  }}
                >
                  {commentSubmitting ? '등록 중...' : '등록'}
                </button>
              </div>
            </div>
          ) : (
            <div
              className="rounded-lg px-4 py-3 mb-4 text-center"
              style={{ background: '#120e09', border: '1px solid var(--border)', color: '#5a5070', fontSize: '0.8125rem', fontFamily: 'var(--font-body)' }}
            >
              로그인 후 댓글을 작성할 수 있습니다.
            </div>
          )}

          {(() => {
            const rootComments = comments.filter(c => !c.parent_id)
            const repliesMap = new Map<string, Comment[]>()
            for (const c of comments) {
              if (c.parent_id) {
                const arr = repliesMap.get(c.parent_id) ?? []
                arr.push(c)
                repliesMap.set(c.parent_id, arr)
              }
            }

            const renderAvatar = (comment: Comment, size: number) => (
                <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', position: 'relative', border: '1px solid rgba(58,40,18,0.5)', flexShrink: 0 }}>
                  <Image src={comment.avatar_url || DEFAULT_AVATAR_URL} alt="" fill sizes={`${size}px`} style={{ objectFit: 'cover' }} />
                </div>
              )

            const renderBadge = (role?: string) => (
              <>
                {role === 'admin' && (
                  <span style={{ fontSize: '0.5625rem', fontFamily: 'var(--font-mono)', color: '#e84040', background: 'rgba(232,64,64,0.12)', border: '1px solid rgba(232,64,64,0.3)', borderRadius: '3px', padding: '1px 5px', letterSpacing: '0.05em' }}>ADMIN</span>
                )}
                {role === 'wanjang' && (
                  <span style={{ fontSize: '0.5625rem', fontFamily: 'var(--font-mono)', color: '#e89040', background: 'rgba(232,144,64,0.12)', border: '1px solid rgba(232,144,64,0.3)', borderRadius: '3px', padding: '1px 5px', letterSpacing: '0.05em' }}>완장</span>
                )}
              </>
            )

            const formatDate = (d: string) => new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

            return rootComments.length > 0 ? (
              <div className="flex flex-col gap-3">
                {rootComments.map(comment => {
                  const replies = repliesMap.get(comment.id) ?? []
                  const hasReplies = replies.length > 0 || replyingTo?.rootId === comment.id
                  return (
                    <div key={comment.id}>
                      {/* 루트 댓글 */}
                      <div className="rounded-lg p-4" style={{ background: '#120e09', border: '1px solid var(--border)' }}>
                        <div className="flex items-start gap-3">
                          {renderAvatar(comment, 28)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span style={{ color: '#9a8a70', fontSize: '0.75rem', fontWeight: 600 }}>{comment.username ?? '익명'}</span>
                              {renderBadge(comment.role)}
                              <span style={{ color: '#5a5065', fontSize: '0.625rem', fontFamily: 'var(--font-mono)' }}>{formatDate(comment.created_at)}</span>
                            </div>
                            <p style={{ color: '#7a7060', fontSize: '0.8125rem', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {comment.content}
                            </p>
                            <div className="flex items-center gap-3 mt-2">
                              {authStatus === 'authenticated' && (
                                <button
                                  onClick={() => {
                                    setReplyingTo(prev => prev?.rootId === comment.id && prev?.targetName === (comment.username ?? '익명') ? null : { rootId: comment.id, targetName: comment.username ?? '익명' })
                                    setReplyText('')
                                  }}
                                  className="flex items-center gap-1 transition-colors hover:text-yellow-600"
                                  style={{ color: replyingTo?.rootId === comment.id ? 'var(--gold-dim)' : '#4a4055', fontSize: '0.6875rem', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                                >
                                  <Reply size={11} />
                                  답글{replies.length > 0 ? ` ${replies.length}` : ''}
                                </button>
                              )}
                              {authStatus !== 'authenticated' && replies.length > 0 && (
                                <span className="flex items-center gap-1" style={{ color: '#4a4055', fontSize: '0.6875rem', fontFamily: 'var(--font-body)' }}>
                                  <Reply size={11} />
                                  답글 {replies.length}
                                </span>
                              )}
                            </div>
                          </div>
                          {authStatus === 'authenticated' && (
                            <button onClick={() => handleCommentDelete(comment.id)} className="flex-shrink-0 p-1 rounded transition-opacity hover:opacity-70" style={{ color: '#3a2020', cursor: 'pointer' }} title="댓글 삭제">
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* 답글 영역 */}
                      {hasReplies && (
                        <div className="mt-1 rounded-lg" style={{ background: '#0e0b07', border: '1px solid rgba(58,40,18,0.25)', overflow: 'hidden', marginLeft: 16 }}>
                          {replies.map((reply, ri) => (
                            <div key={reply.id} className="flex items-start gap-2.5 px-4 py-3" style={{ marginLeft: 0, borderLeft: '2px solid rgba(200,144,10,0.1)', ...(ri < replies.length - 1 ? { borderBottom: '1px solid rgba(58,40,18,0.15)' } : {}) }}>
                              {renderAvatar(reply, 22)}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span style={{ color: '#8a7a60', fontSize: '0.6875rem', fontWeight: 600 }}>{reply.username ?? '익명'}</span>
                                  {renderBadge(reply.role)}
                                  <span style={{ color: '#4a4555', fontSize: '0.5625rem', fontFamily: 'var(--font-mono)' }}>{formatDate(reply.created_at)}</span>
                                </div>
                                <p style={{ color: '#6a6050', fontSize: '0.8rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                  {reply.content}
                                </p>
                                {/* 답글에 답글 버튼 */}
                                {authStatus === 'authenticated' && (
                                  <button
                                    onClick={() => {
                                      setReplyingTo({ rootId: comment.id, targetName: reply.username ?? '익명' })
                                      setReplyText(`@${reply.username ?? '익명'} `)
                                    }}
                                    className="flex items-center gap-1 mt-1 transition-colors hover:text-yellow-600"
                                    style={{ color: '#4a4055', fontSize: '0.625rem', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                                  >
                                    <Reply size={10} />
                                    답글
                                  </button>
                                )}
                              </div>
                              {authStatus === 'authenticated' && (
                                <button onClick={() => handleCommentDelete(reply.id)} className="flex-shrink-0 p-1 rounded transition-opacity hover:opacity-70" style={{ color: '#3a2020', cursor: 'pointer' }} title="답글 삭제">
                                  <Trash2 size={11} />
                                </button>
                              )}
                            </div>
                          ))}

                          {/* 답글 입력 */}
                          {replyingTo?.rootId === comment.id && (
                            <div className="flex items-start gap-2.5 px-4 py-3" style={{ marginLeft: 0, borderLeft: '2px solid rgba(200,144,10,0.2)', borderTop: replies.length > 0 ? '1px solid rgba(58,40,18,0.15)' : 'none' }}>
                              <Reply size={14} style={{ color: 'rgba(200,144,10,0.3)', marginTop: 4, flexShrink: 0 }} />
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span style={{ color: '#5a5065', fontSize: '0.6875rem', fontFamily: 'var(--font-body)' }}>
                                    <b style={{ color: '#9a8a70' }}>{replyingTo.targetName}</b>에게 답글
                                  </span>
                                  <button onClick={() => setReplyingTo(null)} className="transition-opacity hover:opacity-70" style={{ color: '#5a5065', cursor: 'pointer' }}>
                                    <X size={13} />
                                  </button>
                                </div>
                                <textarea
                                  value={replyText}
                                  onChange={e => setReplyText(e.target.value)}
                                  maxLength={500}
                                  rows={2}
                                  placeholder="답글을 작성하세요..."
                                  className="w-full px-3 py-2 text-sm outline-none resize-none"
                                  style={{ background: '#0a0806', border: '1px solid rgba(200,144,10,0.12)', borderRadius: '4px', color: '#e8dcc8', fontFamily: 'var(--font-body)', fontSize: '0.8rem' }}
                                  autoFocus
                                />
                                <div className="flex items-center justify-between mt-1.5">
                                  <span style={{ color: '#4a4555', fontSize: '0.5625rem', fontFamily: 'var(--font-mono)' }}>
                                    {replyText.length}/500
                                  </span>
                                  <button
                                    onClick={() => handleReplySubmit()}
                                    disabled={commentSubmitting || !replyText.trim()}
                                    className="px-3 py-1 text-xs font-medium transition-all duration-150 hover:brightness-110"
                                    style={{
                                      background: replyText.trim() ? 'var(--gold)' : 'rgba(44,28,12,0.5)',
                                      color: replyText.trim() ? 'var(--bg-deep)' : '#5a5070',
                                      borderRadius: '4px',
                                      cursor: replyText.trim() ? 'pointer' : 'default',
                                      fontFamily: 'var(--font-heading)',
                                      opacity: commentSubmitting ? 0.5 : 1,
                                      fontSize: '0.6875rem',
                                    }}
                                  >
                                    {commentSubmitting ? '등록 중...' : '답글 등록'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8" style={{ color: '#5a5065', fontSize: '0.8125rem', fontStyle: 'italic', fontFamily: 'var(--font-body)' }}>
                아직 댓글이 없습니다.
              </div>
            )
          })()}
        </div>
      </div>

      <Toast toast={toast} />
    </div>
  )
}
