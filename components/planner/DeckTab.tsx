'use client'

import { useMemo, useState, useCallback, useEffect, type CSSProperties } from 'react'
import Image from 'next/image'
import { X, Users, Sparkles, SlidersHorizontal } from 'lucide-react'
import {
  DEFAULT_SKILL_DISTRIBUTION,
  getIdentitySkillDistribution,
  normalizeSkillDistribution,
  type PlannerState,
  type PlannerAction,
  type IdentityData,
  type SinnerData,
  type ThemeData,
  type GiftData,
  type PassiveData,
  type SkillSummary,
  type EgoData,
  type SkillDistribution,
} from '@/lib/planner/types'
import { computeKeywordDistribution } from '@/lib/planner/fusion'
import { getIdentityImageUrl, getSinnerLogoUrl, getSkillIconUrl } from '@/lib/utils/images'
import { STORAGE_BASE, RARITY_COLORS, GRADE_COLORS } from '@/lib/constants/game'
import { SIN_COLORS, SIN_KR_TO_EN } from '@/lib/constants/sin'
import KeywordChart from './KeywordChart'
import SkillDescription from '@/components/skill/SkillDescription'
import BaseModal from '@/components/ui/BaseModal'
import EgoDisplayCard from '@/components/sinners/EgoDisplayCard'
import { localizeEgoName, localizeIdentityName, localizePassiveDescription, localizePassiveName } from '@/components/deck-detail/DeckIdentityCard'
import { localizeDeckKeyword } from '@/components/decks/decks-types'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { useLocale, useTranslations } from 'next-intl'
import type { SupportedLang } from '@/lib/i18n/types'
import SkillExchangePanel from './SkillExchangePanel'
import {
  DECK_MAIN_KEYWORDS,
  MAX_DECK_MAIN_KEYWORDS,
  computeDeckMainKeywordsFromSlots,
  computeDeckKeywordCounts,
  type DeckKeywordSlot,
} from '@/lib/decks/keyword-rules'

type DeckSubTab = 'identity' | 'ego' | 'skillset'

const SUB_TABS: { key: DeckSubTab; labelKey: string; icon: typeof Users }[] = [
  { key: 'identity', labelKey: 'subTabs.identity', icon: Users },
  { key: 'ego', labelKey: 'subTabs.ego', icon: Sparkles },
  { key: 'skillset', labelKey: 'subTabs.skillset', icon: SlidersHorizontal },
]

const GRADE_ORDER = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH']
const COMPACT_KOTRA_STYLE: CSSProperties = {
  fontFamily: 'var(--font-kotra-bold), var(--font-heading), serif',
  fontWeight: 400,
  WebkitTextStroke: '0 transparent',
}

const DEFAULT_EGO_NAMES: Record<string, string> = {
  '이상': '오감도',
  '파우스트': '표사 방출기',
  '돈키호테': '라 상그레 산초',
  '료슈': '삼라영삼',
  '뫼르소': '타인의 사슬',
  '홍루': '허환경',
  '이스마엘': '작살박이',
  '오티스': '토 파토스 마토스',
  '그레고르': '어느날 갑자기',
}
const MANUAL_ATTACK_MAIN_KEYWORDS = new Set<string>(['참격', '관통', '타격'])

const getHighestDonorIndex = (dist: SkillDistribution, targetIdx: number) => {
  let donorIdx: number | null = null
  for (let idx = 0; idx < dist.length; idx++) {
    if (idx === targetIdx || dist[idx] <= 0) continue
    if (donorIdx === null || dist[idx] > dist[donorIdx]) donorIdx = idx
  }
  return donorIdx
}

const getLowestReceiverIndex = (dist: SkillDistribution, targetIdx: number) => {
  let receiverIdx: number | null = null
  for (let idx = 0; idx < dist.length; idx++) {
    if (idx === targetIdx) continue
    if (receiverIdx === null || dist[idx] < dist[receiverIdx]) receiverIdx = idx
  }
  return receiverIdx
}

interface Props {
  state: PlannerState
  dispatch: React.Dispatch<PlannerAction>
  identities: IdentityData[]
  sinners: SinnerData[]
  themes: ThemeData[]
  gifts: GiftData[]
  giftMap: Map<number, GiftData>
  passives: PassiveData[]
  skills: SkillSummary[]
  egos: EgoData[]
}

// --- Rarity star images ---
function RarityStars({ rarity, size = 'md' }: { rarity: number; size?: 'sm' | 'md' | 'lg' }) {
  const h = size === 'sm' ? 18 : size === 'lg' ? 32 : 24
  return (
    <Image
      src={`${STORAGE_BASE}/icons/Rarity/${rarity}star.webp`}
      alt={`${rarity}성`}
      width={h * rarity}
      height={h}
      style={{ height: `${h / 16}rem`, width: 'auto', objectFit: 'contain' }}
    />
  )
}

function SkillKeywordChips({
  keywords,
  getIconUrl,
  getKeywordLabel,
}: {
  keywords: string[] | null | undefined
  getIconUrl: (keyword: string) => string | null
  getKeywordLabel: (keyword: string) => string
}) {
  const skillKeywords = (keywords ?? []).filter(Boolean)
  if (skillKeywords.length === 0) return null

  return (
    <div
      className="mt-1 flex min-w-0 items-center gap-1 overflow-hidden"
      aria-label="skill keywords"
      style={{ minHeight: '1.625rem' }}
    >
      {skillKeywords.slice(0, 3).map(keyword => {
        const iconUrl = getIconUrl(keyword)
        return (
          <span
            key={keyword}
            className="planner-skill-keyword-chip inline-flex min-w-0 flex-shrink items-center gap-1 rounded-sm"
            style={{
              maxWidth: '100%',
              padding: '0.1875rem 0.3125rem',
              background: 'rgba(120,76,28,0.14)',
              border: '1px solid rgba(200,144,10,0.18)',
              color: '#8d7f69',
              fontSize: '0.875rem',
              lineHeight: 1,
            }}
          >
            {iconUrl && (
              <Image
                src={iconUrl}
                alt=""
                width={14}
                height={14}
                style={{ width: '0.875rem', height: '0.875rem', flex: '0 0 auto', opacity: 0.78 }}
              />
            )}
            <span className="truncate">{getKeywordLabel(keyword)}</span>
          </span>
        )
      })}
    </div>
  )
}

export default function DeckTab({ state, dispatch, identities, sinners, passives, skills, egos }: Props) {
  const tDeck = useTranslations('planner.deckTab')
  const tSinner = useTranslations('sinner')
  const locale = useLocale() as SupportedLang
  const { getIconUrl, keywords: keywordInfo } = useKeywordData()
  const [subTab, setSubTab] = useState<DeckSubTab>('identity')
  const [gacksungSlots, setGacksungSlots] = useState<Record<string, boolean>>({})
  const [passiveSubTab, setPassiveSubTab] = useState<'battle' | 'support'>('battle')

  // Modal state
  const [identityModalSinner, setIdentityModalSinner] = useState<string | null>(null)
  const [egoModalSinner, setEgoModalSinner] = useState<string | null>(null)

  // 수감자별 인격 그룹 (rarity 내림차순 정렬)
  const sinnerIdentities = useMemo(() => {
    const map = new Map<string, IdentityData[]>()
    for (const ident of identities) {
      if (!map.has(ident.sinner_id)) map.set(ident.sinner_id, [])
      map.get(ident.sinner_id)!.push(ident)
    }
    for (const [, list] of map) {
      list.sort((a, b) => b.rarity - a.rarity)
    }
    return map
  }, [identities])

  // 현재 수감자에 선택된 인격 찾기
  const getSelectedIdentity = useCallback(
    (sinnerId: string) => state.identitySlots.find(s => s.sinner_id === sinnerId),
    [state.identitySlots],
  )

  // identities map by id for quick lookup
  const identityById = useMemo(() => {
    const map = new Map<string, IdentityData>()
    for (const ident of identities) map.set(ident.id, ident)
    return map
  }, [identities])

  // 선택된 인격들의 스킬 키워드 분포
  const keywordDist = useMemo(() => {
    const allKeywords = state.identitySlots.map(slot => {
      const sourceIdentity = identityById.get(slot.identity_id)
      return slot.skill_keyword_list ?? sourceIdentity?.skill_keyword_list ?? slot.keywords ?? []
    })
    return computeKeywordDistribution(allKeywords)
  }, [identityById, state.identitySlots])

  const deckKeywordSlots = useMemo<DeckKeywordSlot[]>(() => (
    state.identitySlots.map(slot => {
      const sourceIdentity = identityById.get(slot.identity_id)
      return {
        slot_order: slot.slot_order,
        identities: {
          skill_keyword_list: slot.skill_keyword_list ?? sourceIdentity?.skill_keyword_list ?? [],
          keywords: slot.keywords ?? sourceIdentity?.keywords ?? [],
          affiliation: slot.affiliation ?? sourceIdentity?.affiliation ?? null,
          association_list: slot.association_list ?? sourceIdentity?.association_list ?? [],
          skills: skills
            .filter(skill => skill.identity_id === slot.identity_id)
            .map(skill => ({ skill_type: skill.skill_type, atk_type: skill.skill_type })),
        },
      }
    })
  ), [identityById, skills, state.identitySlots])

  const mainKeywordCounts = useMemo(() => computeDeckKeywordCounts(deckKeywordSlots).counts, [deckKeywordSlots])
  const autoMainKeywords = useMemo(() => computeDeckMainKeywordsFromSlots(deckKeywordSlots), [deckKeywordSlots])
  const selectedMainKeywords = state.mainKeywords ?? []
  const mainKeywordsManual = state.mainKeywordsManual ?? false
  const effectiveMainKeywords = mainKeywordsManual ? selectedMainKeywords : autoMainKeywords

  useEffect(() => {
    if (mainKeywordsManual) return
    const same = selectedMainKeywords.length === autoMainKeywords.length &&
      selectedMainKeywords.every((keyword, index) => keyword === autoMainKeywords[index])
    if (!same) {
      dispatch({ type: 'SET_MAIN_KEYWORDS', keywords: autoMainKeywords, manual: false })
    }
  }, [autoMainKeywords, dispatch, mainKeywordsManual, selectedMainKeywords])

  useEffect(() => {
    if (!mainKeywordsManual) return
    const next = selectedMainKeywords.filter(keyword => (
      MANUAL_ATTACK_MAIN_KEYWORDS.has(keyword) || (mainKeywordCounts[keyword] ?? 0) > 0
    ))
    if (next.length !== selectedMainKeywords.length) {
      dispatch({ type: 'SET_MAIN_KEYWORDS', keywords: next, manual: true })
    }
  }, [dispatch, mainKeywordCounts, mainKeywordsManual, selectedMainKeywords])

  const egoById = useMemo(() => {
    const map = new Map<string, EgoData>()
    for (const ego of egos) map.set(ego.id, ego)
    return map
  }, [egos])

  const getLocalizedSinnerName = useCallback(
    (sinner: SinnerData | null | undefined) => sinner ? tSinner(sinner.id as Parameters<typeof tSinner>[0]) : '',
    [tSinner],
  )

  const getIdentitySlotName = useCallback(
    (slot: PlannerState['identitySlots'][number]) => {
      const identity = identityById.get(slot.identity_id)
      return identity ? localizeIdentityName(identity, locale) : slot.name_kr
    },
    [identityById, locale],
  )

  const getEgoSlotName = useCallback(
    (slot: PlannerState['egoSlots'][number]) => {
      const ego = egoById.get(slot.ego_id)
      return ego ? localizeEgoName(ego, locale) : slot.name_kr
    },
    [egoById, locale],
  )

  const getLocalizedKeywordLabel = useCallback(
    (keyword: string) => localizeDeckKeyword(keyword, keywordInfo[keyword], locale),
    [keywordInfo, locale],
  )

  // EGO grouped by sinner (grade order within each group)
  const sinnerEgosMap = useMemo(() => {
    const map = new Map<string, EgoData[]>()
    for (const ego of egos) {
      if (!map.has(ego.sinner_id)) map.set(ego.sinner_id, [])
      map.get(ego.sinner_id)!.push(ego)
    }
    for (const [, list] of map) {
      list.sort((a, b) => GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade))
    }
    return map
  }, [egos])

  const getDefaultEgoForSinner = useCallback((sinnerId: string) => {
    const sinnerName = sinners.find(s => s.id === sinnerId)?.name_kr
    const defaultName = sinnerName ? DEFAULT_EGO_NAMES[sinnerName] : undefined
    return defaultName
      ? egos.find(e => e.sinner_id === sinnerId && e.grade === 'ZAYIN' && (e.name_kr === defaultName || e.name === defaultName))
        ?? egos.find(e => e.sinner_id === sinnerId && e.grade === 'ZAYIN')
      : egos.find(e => e.sinner_id === sinnerId && e.grade === 'ZAYIN')
  }, [egos, sinners])

  const defaultEgoSlots = useMemo(() => sinners.flatMap(sinner => {
    const ego = getDefaultEgoForSinner(sinner.id)
    return ego ? [{ ego_id: ego.id, sinner_id: sinner.id, name_kr: ego.name_kr ?? ego.name, grade: ego.grade, sin_affinity: ego.sin_affinity }] : []
  }), [getDefaultEgoForSinner, sinners])

  useEffect(() => {
    if (defaultEgoSlots.length === 0) return
    const missingDefaults = defaultEgoSlots.filter(defaultSlot =>
      !state.egoSlots.some(slot => slot.sinner_id === defaultSlot.sinner_id && slot.grade === 'ZAYIN')
    )
    if (missingDefaults.length === 0) return
    dispatch({ type: 'LOAD_PLAN', state: { egoSlots: [...state.egoSlots, ...missingDefaults] } })
  }, [defaultEgoSlots, dispatch, state.egoSlots])

  // 선택된 인격들의 스킬 죄악 카운트 (공명/보유 조건 계산용, 스킬 배분 가중치 적용)
  const deckSinCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const slot of state.identitySlots) {
      const dist = getIdentitySkillDistribution(slot)
      // 각 슬롯(S1,S2,S3)에 대해 최고 업타이 스킬 선택 후 배분 수만큼 가중치 적용
      for (let order = 1; order <= 3; order++) {
        const weight = dist[order - 1]
        if (weight === 0) continue
        const best = skills
          .filter(sk => sk.identity_id === slot.identity_id && sk.skill_order === order)
          .sort((a, b) => (b.uptie_level ?? 0) - (a.uptie_level ?? 0))[0]
        if (!best) continue
        counts[best.sin_affinity] = (counts[best.sin_affinity] ?? 0) + weight
      }
    }
    return counts
  }, [state.identitySlots, skills])

  // 기본 배분(3-2-1) 기준 deckSinCounts (패시브 경고 비교용)
  const deckSinCountsDefault = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const slot of state.identitySlots) {
      const defaultDist = DEFAULT_SKILL_DISTRIBUTION
      for (let order = 1; order <= 3; order++) {
        const weight = defaultDist[order - 1]
        const best = skills
          .filter(sk => sk.identity_id === slot.identity_id && sk.skill_order === order)
          .sort((a, b) => (b.uptie_level ?? 0) - (a.uptie_level ?? 0))[0]
        if (!best) continue
        counts[best.sin_affinity] = (counts[best.sin_affinity] ?? 0) + weight
      }
    }
    return counts
  }, [state.identitySlots, skills])

  // 인격 이미지 URL (info 이미지)
  const getIdentityInfoImageUrl = useCallback((ident: IdentityData, gacksung: boolean) => {
    if (!ident.game_id || !ident.folder_name) return ''
    const prefix = gacksung ? 'gacksung' : 'normal'
    return getIdentityImageUrl(ident.sinner_id, ident.folder_name, `${ident.game_id}_${prefix}_info`)
  }, [])

  const handleGacksungToggle = (sinnerId: string) => {
    setGacksungSlots(prev => ({ ...prev, [sinnerId]: !prev[sinnerId] }))
  }

  const handleSkillChange = (sinnerId: string, idx: number, delta: number) => {
    const slot = state.identitySlots.find(item => item.sinner_id === sinnerId)
    if (!slot) return
    const dist = getIdentitySkillDistribution(slot)
    const next: SkillDistribution = [dist[0], dist[1], dist[2]]

    if (delta > 0) {
      const donorIdx = getHighestDonorIndex(dist, idx)
      if (dist[idx] >= 6 || donorIdx === null) return
      next[idx] += 1
      next[donorIdx] -= 1
    } else if (delta < 0) {
      const receiverIdx = getLowestReceiverIndex(dist, idx)
      if (dist[idx] <= 0 || receiverIdx === null) return
      next[idx] -= 1
      next[receiverIdx] += 1
    } else {
      return
    }

    dispatch({ type: 'SET_SKILL_DISTRIBUTION', sinnerId, distribution: next })
  }

  const handleMainKeywordToggle = (keyword: string) => {
    const isManualAttackKeyword = MANUAL_ATTACK_MAIN_KEYWORDS.has(keyword)
    if (!isManualAttackKeyword && (mainKeywordCounts[keyword] ?? 0) <= 0) return

    const baseKeywords = mainKeywordsManual ? selectedMainKeywords : effectiveMainKeywords
    const next = baseKeywords.includes(keyword)
      ? baseKeywords.filter(item => item !== keyword)
      : baseKeywords.length >= MAX_DECK_MAIN_KEYWORDS
        ? baseKeywords
        : [...baseKeywords, keyword]

    dispatch({ type: 'SET_MAIN_KEYWORDS', keywords: next, manual: true })
  }

  const handleSelectIdentity = (ident: IdentityData) => {
    dispatch({
      type: 'ADD_IDENTITY',
      slot: {
        identity_id: ident.id,
        sinner_id: ident.sinner_id,
        name_kr: ident.name_kr,
        rarity: ident.rarity,
        keywords: ident.keywords ?? [],
        skill_keyword_list: ident.skill_keyword_list ?? [],
        game_id: ident.game_id,
        folder_name: ident.folder_name,
        slot_order: 99, // 기본 벤치, 하단 클릭으로 편성
      },
    })
    const hasZayin = state.egoSlots.some(e => e.sinner_id === ident.sinner_id && e.grade === 'ZAYIN')
    const defaultEgo = getDefaultEgoForSinner(ident.sinner_id)
    if (!hasZayin && defaultEgo) {
      dispatch({
        type: 'ADD_EGO',
        slot: { ego_id: defaultEgo.id, sinner_id: ident.sinner_id, name_kr: defaultEgo.name_kr ?? defaultEgo.name, grade: defaultEgo.grade, sin_affinity: defaultEgo.sin_affinity },
      })
    }
    setIdentityModalSinner(null)
  }

  const handleDeselectIdentity = (sinnerId: string) => {
    dispatch({ type: 'REMOVE_IDENTITY', sinnerId })
    setIdentityModalSinner(null)
  }

  // --- Modal sinner data ---
  const modalSinner = identityModalSinner ? sinners.find(s => s.id === identityModalSinner) : null
  const modalIdentities = identityModalSinner ? (sinnerIdentities.get(identityModalSinner) ?? []) : []
  const modalSlot = identityModalSinner ? getSelectedIdentity(identityModalSinner) : undefined

  return (
    <div>
      {/* 서브 탭 헤더 */}
      <div
        className="mb-6 flex items-center gap-1 overflow-x-auto"
        role="tablist"
        aria-label={tDeck('subTabs.label')}
        style={{ borderBottom: '1px solid #1a1510', WebkitOverflowScrolling: 'touch' }}
      >
        {SUB_TABS.map(tab => {
          const active = subTab === tab.key
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSubTab(tab.key)}
              className="flex flex-shrink-0 items-center gap-1.5 transition-all"
              style={{
                ...COMPACT_KOTRA_STYLE,
                padding: '0.5rem 1rem',
                fontSize: '0.8125rem',
                color: active ? '#e8dcc8' : '#555',
                borderBottom: active ? '2px solid #c8900a' : '2px solid transparent',
                background: active ? 'rgba(200,144,10,0.05)' : 'transparent',
                cursor: 'pointer',
              }}
            >
              <Icon style={{ width: '0.875rem', height: '0.875rem' }} />
              {tDeck(tab.labelKey)}
            </button>
          )
        })}
        <div className="ml-auto flex flex-shrink-0 items-center" style={{ fontSize: '0.75rem', color: '#666', paddingRight: '0.5rem' }}>
          {state.identitySlots.length} / 12
        </div>
      </div>

      {subTab === 'identity' && (
        <div className="planner-main-keywords" aria-label={tDeck('mainKeywords.label')}>
          {DECK_MAIN_KEYWORDS.map(keyword => {
            const iconUrl = getIconUrl(keyword)
            const count = mainKeywordCounts[keyword] ?? 0
            const selected = effectiveMainKeywords.includes(keyword)
            const isManualAttackKeyword = MANUAL_ATTACK_MAIN_KEYWORDS.has(keyword)
            const disabled = (!isManualAttackKeyword && count <= 0) || (!selected && effectiveMainKeywords.length >= MAX_DECK_MAIN_KEYWORDS)
            const keywordLabel = getLocalizedKeywordLabel(keyword)
            const accessibleName = isManualAttackKeyword ? keywordLabel : tDeck('mainKeywords.keywordCount', { keyword: keywordLabel, count })
            return (
              <button
                key={keyword}
                type="button"
                className="planner-main-keyword"
                data-selected={selected}
                disabled={disabled}
                onClick={() => handleMainKeywordToggle(keyword)}
                aria-pressed={selected}
                aria-label={accessibleName}
                title={accessibleName}
              >
                {iconUrl && (
                  <Image
                    src={iconUrl}
                    alt=""
                    width={16}
                    height={16}
                    className="planner-main-keyword__icon"
                  />
                )}
                <span>{keywordLabel}</span>
                {!isManualAttackKeyword && (
                  <span className="planner-main-keyword__count">{count}</span>
                )}
              </button>
            )
          })}
          <style jsx>{`
            .planner-main-keywords {
              display: flex;
              flex-wrap: wrap;
              align-items: center;
              gap: 0.375rem;
              margin: -0.75rem 0 1.25rem;
              padding-bottom: 0.25rem;
            }
            .planner-main-keyword {
              display: inline-flex;
              min-height: 2.75rem;
              align-items: center;
              justify-content: center;
              gap: 0.375rem;
              border: 1px solid rgba(200, 144, 10, 0.16);
              border-radius: 0.375rem;
              background: rgba(18, 14, 9, 0.74);
              color: rgba(232, 220, 200, 0.84);
              padding: 0.375rem 0.625rem;
              font-size: 0.9375rem;
              line-height: 1;
              transition: border-color 0.18s ease, background-color 0.18s ease, color 0.18s ease, opacity 0.18s ease;
            }
            .planner-main-keyword:hover:not(:disabled),
            .planner-main-keyword:focus-visible {
              border-color: rgba(232, 176, 48, 0.42);
              background: rgba(200, 144, 10, 0.12);
              color: #f0d48a;
            }
            .planner-main-keyword:focus-visible {
              outline: 1px solid rgba(232, 176, 48, 0.6);
              outline-offset: 2px;
            }
            .planner-main-keyword[data-selected="true"] {
              border-color: rgba(232, 176, 48, 0.58);
              background: rgba(200, 144, 10, 0.18);
              color: #f0d48a;
              box-shadow: inset 0 0 0 1px rgba(232, 176, 48, 0.12);
            }
            .planner-main-keyword:disabled {
              cursor: not-allowed;
              opacity: 0.42;
            }
            .planner-main-keyword__icon {
              height: 1rem;
              width: 1rem;
              object-fit: contain;
            }
            .planner-main-keyword__count {
              display: inline-flex;
              min-width: 1.25rem;
              height: 1.25rem;
              align-items: center;
              justify-content: center;
              border: 1px solid rgba(200, 144, 10, 0.18);
              border-radius: 999px;
              background: rgba(13, 11, 8, 0.52);
              color: inherit;
              font-family: var(--font-mono);
              font-size: 0.875rem;
              line-height: 1;
            }
          `}</style>
        </div>
      )}

      {/* ── 인격 탭 ── */}
      {subTab === 'identity' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-6">
          {sinners.map(sinner => {
            const slot = getSelectedIdentity(sinner.id)
            const identData = slot ? identityById.get(slot.identity_id) : undefined
            const slotName = slot ? getIdentitySlotName(slot) : ''
            const sinnerName = getLocalizedSinnerName(sinner)
            const isGacksung = gacksungSlots[sinner.id] ?? false
            const rarityColor = slot ? (RARITY_COLORS[slot.rarity] ?? RARITY_COLORS[1]) : null

            return (
              <div key={sinner.id} className="relative" style={{ overflow: 'visible' }}>
                <div
                  className="group cursor-pointer relative w-full"
                  style={{
                    aspectRatio: '2/3',
                    background: 'linear-gradient(160deg, #1e1810 0%, #120e08 60%, #1a1410 100%)',
                    border: `0.09375rem ${slot ? 'solid' : 'dashed'} ${slot ? (rarityColor?.border ?? '#2a2015') : '#2a2015'}`,
                    borderRadius: '0.25rem',
                    overflow: 'hidden',
                    boxShadow: slot ? `0 0 0.5rem ${rarityColor?.glow ?? 'transparent'}` : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  {slot && identData ? (
                    <>
                      <Image
                        src={getIdentityInfoImageUrl(identData, isGacksung)}
                        alt={slotName}
                        fill
                        className="object-cover object-top"
                        sizes="180px"
                      />
                      {/* 등급 별 이미지 */}
                      <div className="absolute top-0 left-0 z-10 flex items-center gap-0.5" style={{ padding: '0.25rem' }}>
                        <RarityStars rarity={slot.rarity} />
                      </div>
                      {/* 이름 오버레이 */}
                      <div
                        className="absolute bottom-0 left-0 right-0 z-10 text-center"
                        style={{
                          background: 'linear-gradient(to top, rgba(13,11,8,0.95) 0%, transparent 100%)',
                          paddingTop: '1.5rem',
                          paddingBottom: '0.375rem',
                        }}
                      >
                        <p style={{ ...COMPACT_KOTRA_STYLE, color: '#e8dcc8', fontSize: '0.8125rem', lineHeight: 1.2 }}>
                          {slotName}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="absolute inset-0 flex items-center justify-center z-10">
                        <Image
                          src={getSinnerLogoUrl(sinner.id)}
                          alt=""
                          width={32}
                          height={32}
                          style={{ width: '2rem', height: '2rem', opacity: 0.35 }}
                        />
                      </div>
                      <div className="absolute" style={{ top: 0, right: 0, width: '36%', opacity: 0.15, pointerEvents: 'none' }}>
                        <Image
                          src={`${STORAGE_BASE}/sinners/${sinner.id}/number.webp`}
                          alt=""
                          width={389}
                          height={1023}
                          className="w-full h-auto"
                        />
                      </div>
                      <div
                        className="absolute bottom-0 left-0 right-0 text-center z-10"
                        style={{
                          background: 'linear-gradient(to top, rgba(13,11,8,0.95) 0%, transparent 100%)',
                          paddingTop: '1.25rem',
                          paddingBottom: '0.375rem',
                        }}
                      >
                        <p style={{ ...COMPACT_KOTRA_STYLE, color: '#3a2a10', fontSize: '0.875rem' }}>
                          {sinnerName}
                        </p>
                      </div>
                    </>
                  )}

                  {/* 편성 순서 오버레이 (편성된 경우 상시 표시, 벤치는 미표시) */}
                  {slot && slot.slot_order < 99 && (() => {
                    const n = slot.slot_order + 1
                    const isFormation = n <= 7
                    return (
                      <div
                        className="absolute inset-0 flex items-center justify-center z-15 pointer-events-none"
                        style={{ background: 'rgba(13,11,8,0.5)' }}
                      >
                        <span style={{ fontSize: '1.125rem', fontWeight: 700, fontFamily: 'var(--font-body)', color: isFormation ? '#e8b030' : '#5ab0d0', textShadow: `0 0 0.75rem ${isFormation ? 'rgba(200,144,10,0.7)' : 'rgba(90,176,208,0.7)'}, 0 0.125rem 0.5rem rgba(0,0,0,1)` }}>
                          {isFormation ? tDeck('identity.formed') : tDeck('identity.bench')}
                        </span>
                        <span style={{ fontSize: '1.75rem', fontWeight: 800, fontFamily: 'var(--font-body)', lineHeight: 1, color: isFormation ? '#e8b030' : '#5ab0d0', textShadow: `0 0 1rem ${isFormation ? 'rgba(200,144,10,0.7)' : 'rgba(90,176,208,0.7)'}, 0 0.125rem 0.5rem rgba(0,0,0,1)`, marginLeft: '0.25rem' }}>
                          {n}
                        </span>
                      </div>
                    )
                  })()}

                  {/* 호버 오버레이 (배경 블러) */}
                  <div className="absolute inset-0 z-20 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col" style={{ backdropFilter: 'blur(0.375rem) brightness(0.4)', WebkitBackdropFilter: 'blur(0.375rem) brightness(0.4)' }}>
                    {slot ? (
                      <>
                        {/* 편성된 경우: 상단 40% 변경, 하단 60% 편성 순서 토글 */}
                        <div
                          onClick={() => setIdentityModalSinner(sinner.id)}
                          className="flex items-center justify-center transition-colors"
                          style={{ height: '40%', background: 'rgba(13,11,8,0.6)', borderBottom: '1px solid rgba(200,144,10,0.2)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,144,10,0.15)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(13,11,8,0.6)' }}
                        >
                          <span style={{ color: '#e8b030', fontSize: '0.875rem', fontWeight: 700, fontFamily: 'var(--font-body)', textShadow: '0 0 0.5rem rgba(200,144,10,0.5), 0 0.125rem 0.375rem rgba(0,0,0,0.9)' }}>{tDeck('identity.change')}</span>
                        </div>
                        <div
                          onClick={() => {
                            if (slot.slot_order < 99) {
                              // 편성됨 → 벤치로: slot_order = 99, 나머지 순서 재정렬
                              const removed = slot.slot_order
                              const updated = state.identitySlots.map(s => {
                                if (s.sinner_id === sinner.id) return { ...s, slot_order: 99 }
                                if (s.slot_order < 99 && s.slot_order > removed) return { ...s, slot_order: s.slot_order - 1 }
                                return s
                              })
                              dispatch({ type: 'LOAD_PLAN', state: { identitySlots: updated } })
                            } else {
                              // 벤치 → 편성: 다음 번호 부여
                              const nextOrder = state.identitySlots.filter(s => s.slot_order < 99).length
                              dispatch({ type: 'ADD_IDENTITY', slot: { ...slot, slot_order: nextOrder } })
                            }
                          }}
                          className="flex items-center justify-center transition-colors"
                          style={{ height: '60%', background: 'rgba(13,11,8,0.5)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = slot.slot_order < 99 ? 'rgba(90,176,208,0.12)' : 'rgba(200,144,10,0.12)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(13,11,8,0.5)' }}
                        >
                          <span style={{ color: slot.slot_order < 99 ? '#5ab0d0' : '#e8b030', fontSize: '0.75rem', fontWeight: 600, textShadow: '0 0.125rem 0.375rem rgba(0,0,0,0.9)' }}>
                            {slot.slot_order < 99 ? tDeck('identity.removeFormation') : tDeck('identity.addFormation')}
                          </span>
                        </div>
                      </>
                    ) : (
                      /* 미편성: 전체 클릭 = 편성 모달 */
                      <div
                        onClick={() => setIdentityModalSinner(sinner.id)}
                        className="flex items-center justify-center transition-colors"
                        style={{ height: '100%', background: 'rgba(13,11,8,0.5)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,144,10,0.12)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(13,11,8,0.5)' }}
                      >
                        <span style={{ color: '#e8b030', fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-body)', textShadow: '0 0 0.5rem rgba(200,144,10,0.5), 0 0.125rem 0.375rem rgba(0,0,0,0.9)' }}>{tDeck('identity.form')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 각성 토글 */}
                {slot && (
                  <button
                    onClick={e => { e.stopPropagation(); handleGacksungToggle(sinner.id) }}
                    title={isGacksung ? tDeck('identity.toNormalArt') : tDeck('identity.toAwakenedArt')}
                    style={{
                      position: 'absolute',
                      top: '-0.4375rem',
                      right: '-0.4375rem',
                      zIndex: 20,
                      width: '1.375rem',
                      height: '1.375rem',
                      borderRadius: '50%',
                      background: isGacksung ? 'rgba(200,144,10,0.92)' : 'rgba(18,14,9,0.92)',
                      border: `0.09375rem solid ${isGacksung ? '#c8900a' : '#2a2015'}`,
                      color: isGacksung ? '#0d0b08' : '#5a4830',
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: isGacksung ? '0 0 0.5rem rgba(200,144,10,0.5)' : 'none',
                      transition: 'all 0.2s',
                      lineHeight: 1,
                    }}
                  >
                    &#x21BA;
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── 인격 선택 모달 ── */}
      {modalSinner && (
        <BaseModal open={!!identityModalSinner} onClose={() => setIdentityModalSinner(null)} maxWidth="48rem" title={tDeck('identity.modalTitle')}>
          <div
            style={{
              background: '#1a1510',
              border: '1px solid #333',
              borderRadius: '0.5rem',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: '0 1rem 3rem rgba(0,0,0,0.8)',
            }}
          >
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between sticky top-0 z-30" style={{ padding: '1rem 1.25rem', background: '#1a1510', borderBottom: '1px solid #222' }}>
              <div className="flex items-center gap-2">
                <Image
                  src={getSinnerLogoUrl(modalSinner.id)}
                  alt=""
                  width={20}
                  height={20}
                  style={{ width: '1.25rem', height: '1.25rem', opacity: 0.7 }}
                />
                <span className="font-serif" style={{ color: '#e8dcc8', fontSize: '1rem' }}>
                  {tDeck('identity.modalHeading', { sinner: getLocalizedSinnerName(modalSinner) })}
                </span>
              </div>
              <button
                onClick={() => setIdentityModalSinner(null)}
                style={{ color: '#666', cursor: 'pointer', padding: '0.25rem' }}
              >
                <X style={{ width: '1.25rem', height: '1.25rem' }} />
              </button>
            </div>

            {/* {tDeck('identity.clear')} 버튼 */}
            {modalSlot && (
              <div style={{ padding: '0.75rem 1.25rem 0' }}>
                <button
                  onClick={() => handleDeselectIdentity(identityModalSinner!)}
                  className="w-full transition-colors hover:bg-[#2a1510]"
                  style={{
                    color: '#c83030',
                    fontSize: '0.8125rem',
                    border: '1px solid #3a1515',
                    borderRadius: '0.25rem',
                    padding: '0.5rem 0.75rem',
                    cursor: 'pointer',
                    background: 'rgba(200,48,48,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                  }}
                >
                  <X style={{ width: '0.875rem', height: '0.875rem' }} />
                  {tDeck('identity.clear')}
                </button>
              </div>
            )}

            {/* 인격 그리드 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3" style={{ padding: '1rem 1.25rem 1.25rem' }}>
              {modalIdentities.map(ident => {
                const isSelected = modalSlot?.identity_id === ident.id
                const rc = RARITY_COLORS[ident.rarity] ?? RARITY_COLORS[1]
                const identityName = localizeIdentityName(ident, locale)
                return (
                  <button
                    key={ident.id}
                    onClick={() => handleSelectIdentity(ident)}
                    className="text-left transition-all"
                    style={{
                      background: isSelected
                        ? 'linear-gradient(160deg, rgba(200,144,10,0.15) 0%, rgba(200,144,10,0.05) 100%)'
                        : 'linear-gradient(160deg, #1e1810 0%, #120e08 100%)',
                      border: `0.09375rem solid ${isSelected ? '#c8900a' : rc.border + '40'}`,
                      borderRadius: '0.375rem',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      boxShadow: isSelected ? `0 0 0.75rem ${rc.glow}` : 'none',
                    }}
                  >
                    {/* 인격 프로필 이미지 */}
                    <div className="relative isolate w-full" style={{ aspectRatio: '2/3', overflow: 'hidden' }}>
                      {ident.game_id && ident.folder_name && (
                        <Image
                          src={getIdentityInfoImageUrl(ident, false)}
                          alt={identityName}
                          fill
                          className="object-cover object-top"
                          sizes="200px"
                        />
                      )}
                      {/* 등급 별 이미지 오버레이 */}
                      <div className="absolute top-0 left-0 z-[1] flex items-center" style={{ padding: '0.25rem' }}>
                        <RarityStars rarity={ident.rarity} />
                      </div>
                      {isSelected && (
                        <div className="absolute inset-0 z-[2]" style={{ background: 'rgba(200,144,10,0.1)', border: '0.125rem solid #c8900a', borderRadius: '0.25rem' }} />
                      )}
                    </div>
                    {/* 이름 + 키워드 */}
                    <div style={{ padding: '0.375rem 0.5rem 0.5rem' }}>
                      <p
                        className="truncate"
                        style={{
                          ...COMPACT_KOTRA_STYLE,
                          color: isSelected ? '#e8dcc8' : '#b0a898',
                          fontSize: '0.6875rem',
                          lineHeight: 1.3,
                        }}
                      >
                        {identityName}
                      </p>
                      <SkillKeywordChips
                        keywords={ident.skill_keyword_list}
                        getIconUrl={getIconUrl}
                        getKeywordLabel={getLocalizedKeywordLabel}
                      />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </BaseModal>
      )}

      {/* ── EGO 탭 ── */}
      {subTab === 'ego' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-4">
          {sinners.map(sinner => {
            const slot = getSelectedIdentity(sinner.id)
            const sinnerName = getLocalizedSinnerName(sinner)
            const selectedEgos = state.egoSlots.filter(e => e.sinner_id === sinner.id)
            const egoByGrade: Record<string, typeof state.egoSlots[0]> = {}
            for (const e of selectedEgos) egoByGrade[e.grade] = e

            return (
              <div
                key={sinner.id}
                onClick={() => { if (slot) setEgoModalSinner(sinner.id) }}
                style={{
                  background: 'linear-gradient(160deg, #1a1510 0%, #100d08 100%)',
                  border: `1px solid ${slot ? '#221a0f' : '#18120a'}`,
                  borderRadius: '0.25rem',
                  overflow: 'hidden',
                  opacity: slot ? 1 : 0.5,
                  cursor: slot ? 'pointer' : 'default',
                }}
              >
                {/* 수감자 헤더 */}
                <div className="flex items-center gap-1.5" style={{ padding: '0.375rem 0.5rem', borderBottom: '1px solid #1a1208' }}>
                  <Image
                    src={getSinnerLogoUrl(sinner.id)}
                    alt=""
                    width={14}
                    height={14}
                    style={{ width: '0.875rem', height: '0.875rem', opacity: 0.5 }}
                  />
                  <span className="truncate" style={{ ...COMPACT_KOTRA_STYLE, color: slot ? '#8a7a60' : '#3a2a10', fontSize: '0.5625rem' }}>
                    {sinnerName}
                  </span>
                </div>
                {/* 등급별 EGO 슬롯 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem', padding: '0.125rem' }}>
                  {GRADE_ORDER.map(grade => {
                    const ego = egoByGrade[grade]
                    const gc = GRADE_COLORS[grade] ?? '#555'
                    const sinEn = ego?.sin_affinity ? (SIN_KR_TO_EN[ego.sin_affinity] ?? ego.sin_affinity) : null
                    const ec = sinEn ? (SIN_COLORS[sinEn as keyof typeof SIN_COLORS] ?? gc) : gc
                    return (
                      <div
                        key={grade}
                        style={{
                          background: ego ? `${ec}1a` : 'rgba(10,8,5,0.7)',
                          border: `1px solid ${ego ? ec + '55' : '#18120a'}`,
                          borderRadius: '0.125rem',
                          padding: '0.25rem 0.3125rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3125rem',
                          minHeight: '1.5rem',
                        }}
                      >
                        {grade !== 'ALEPH' ? (
                          <Image
                            src={`${STORAGE_BASE}/icons/grade/${grade}.webp`}
                            alt={grade}
                            width={22}
                            height={11}
                            unoptimized
                            style={{ height: '0.6875rem', width: 'auto', opacity: ego ? 0.9 : 0.3, flexShrink: 0 }}
                          />
                        ) : (
                          <span style={{
                            color: gc,
                            fontSize: '0.375rem',
                            fontFamily: 'var(--font-mono)',
                            letterSpacing: '0.08em',
                            opacity: ego ? 0.9 : 0.3,
                            flexShrink: 0,
                          }}>
                            ALEPH
                          </span>
                        )}
                        {ego ? (
                          <span style={{ ...COMPACT_KOTRA_STYLE, color: gc, fontSize: '0.5rem', lineHeight: 1.2, flex: 1, textAlign: 'left' }}>
                            {getEgoSlotName(ego)}
                          </span>
                        ) : (
                          <span style={{ color: '#2a1e10', fontSize: '0.5rem', lineHeight: 1 }}>
                            {slot ? '—' : ''}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
                {!slot && (
                  <div style={{ padding: '0.25rem 0.5rem 0.375rem', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.875rem', color: '#333' }}>{tDeck('ego.noIdentity')}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── EGO 선택 모달 ── */}
      {egoModalSinner && (() => {
        const modalSinnerEgo = sinners.find(s => s.id === egoModalSinner)
        const availableEgos = sinnerEgosMap.get(egoModalSinner) ?? []
        const selectedEgos = state.egoSlots.filter(e => e.sinner_id === egoModalSinner)
        const egoByGrade: Record<string, typeof state.egoSlots[0]> = {}
        for (const e of selectedEgos) egoByGrade[e.grade] = e

        return (
          <BaseModal open={!!egoModalSinner} onClose={() => setEgoModalSinner(null)} maxWidth="42rem" title={tDeck('ego.modalTitle')}>
            <div
              style={{
                background: '#1a1510',
                border: '1px solid #333',
                borderRadius: '0.5rem',
                maxHeight: '85vh',
                overflowY: 'auto',
                boxShadow: '0 1rem 3rem rgba(0,0,0,0.8)',
              }}
            >
              {/* 모달 헤더 */}
              <div className="flex items-center justify-between sticky top-0 z-10" style={{ padding: '1rem 1.25rem', background: '#1a1510', borderBottom: '1px solid #222' }}>
                <div className="flex items-center gap-2">
                  {modalSinnerEgo && (
                    <Image
                      src={getSinnerLogoUrl(modalSinnerEgo.id)}
                      alt=""
                      width={20}
                      height={20}
                      style={{ width: '1.25rem', height: '1.25rem', opacity: 0.7 }}
                    />
                  )}
                  <span className="font-serif" style={{ color: '#e8dcc8', fontSize: '1rem' }}>
                    {tDeck('ego.modalHeading', { sinner: getLocalizedSinnerName(modalSinnerEgo) })}
                  </span>
                </div>
                <button onClick={() => setEgoModalSinner(null)} style={{ color: '#666', cursor: 'pointer', padding: '0.25rem' }}>
                  <X style={{ width: '1.25rem', height: '1.25rem' }} />
                </button>
              </div>

              {/* 등급별 섹션 */}
              <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {GRADE_ORDER.map(grade => {
                  const gc = GRADE_COLORS[grade] ?? '#555'
                  const gradeEgos = availableEgos.filter(e => e.grade === grade)
                  const selectedForGrade = egoByGrade[grade]

                  return (
                    <div key={grade}>
                      {/* 등급 헤더 */}
                      <div className="flex items-center gap-2" style={{ marginBottom: '0.5rem' }}>
                        {grade !== 'ALEPH' ? (
                          <Image
                            src={`${STORAGE_BASE}/icons/grade/${grade}.webp`}
                            alt={grade}
                            width={22}
                            height={11}
                            unoptimized
                            style={{ height: '0.75rem', width: 'auto' }}
                          />
                        ) : (
                          <span style={{ color: gc, fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>ALEPH</span>
                        )}
                        <div style={{ flex: 1, height: '1px', background: gc + '30' }} />
                        {selectedForGrade && grade !== 'ZAYIN' && (
                          <button
                            onClick={() => dispatch({ type: 'REMOVE_EGO', egoId: selectedForGrade.ego_id })}
                            style={{ color: '#c83040', fontSize: '0.875rem', cursor: 'pointer', padding: '0.1875rem 0.5rem', border: '1px solid #3a1515', borderRadius: '0.25rem', background: 'rgba(200,48,64,0.08)' }}
                          >
                            {tDeck('ego.remove')}
                          </button>
                        )}
                      </div>

                      {gradeEgos.length === 0 ? (
                        <div style={{ padding: '0.625rem', background: 'rgba(10,8,5,0.5)', borderRadius: '0.25rem', border: `1px solid ${gc}15`, textAlign: 'center' }}>
                          <span style={{ color: '#333', fontSize: '0.6875rem' }}>{tDeck('ego.emptyGrade')}</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {gradeEgos.map(ego => {
                            const isSelected = selectedForGrade?.ego_id === ego.id
                            const egoName = localizeEgoName(ego, locale)
                            return (
                              <EgoDisplayCard
                                key={ego.id}
                                onClick={() => {
                                  dispatch({
                                    type: 'ADD_EGO',
                                    slot: {
                                      ego_id: ego.id,
                                      sinner_id: ego.sinner_id,
                                      name_kr: ego.name_kr ?? ego.name,
                                      grade: ego.grade,
                                      sin_affinity: ego.sin_affinity,
                                    },
                                  })
                                }}
                                ego={ego}
                                name={egoName}
                                sinnerId={ego.sinner_id}
                                lang={locale}
                                selected={isSelected}
                                className="transition-[filter] duration-200 ease-out brightness-95 hover:brightness-105 hover:saturate-110"
                              />
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </BaseModal>
        )
      })()}

      {/* ── 스킬 교환 탭 ── */}
      {subTab === 'skillset' && (
        <div>
          {state.identitySlots.length === 0 ? (
            <div className="text-center" style={{ padding: '3rem 1rem', color: '#444', fontSize: '0.8125rem' }}>
              {tDeck('skillset.selectIdentityFirst')}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-6">
              {sinners.map(sinner => {
                const slot = getSelectedIdentity(sinner.id)
                if (!slot) return null

                const identData = identityById.get(slot.identity_id)
                const dist = getIdentitySkillDistribution(slot)
                const isDefault = dist[0] === 3 && dist[1] === 2 && dist[2] === 1
                const isGacksung = gacksungSlots[sinner.id] ?? false

                // Build a fake Identity-like object for getSkillIconUrl
                const identForIcon = identData ? { game_id: identData.game_id, sinner_id: identData.sinner_id } as { game_id: string | null; sinner_id: string } : null

                // 각 슬롯(S1,S2,S3)별 최고 업타이 스킬 (죄악 속성 시각화용)
                const slotBestSkills = [1, 2, 3].map(order =>
                  skills
                    .filter(sk => sk.identity_id === slot.identity_id && sk.skill_order === order)
                    .sort((a, b) => (b.uptie_level ?? 0) - (a.uptie_level ?? 0))[0] ?? null
                )

                return (
                  <div key={sinner.id}>
                    <div
                      className="relative w-full"
                      style={{
                        background: '#120e09',
                        border: `0.09375rem solid ${(RARITY_COLORS[slot.rarity] ?? RARITY_COLORS[1]).border}`,
                        borderRadius: '0.25rem',
                        overflow: 'hidden',
                      }}
                    >
                      <div className="relative w-full" style={{ aspectRatio: '2/2.35', overflow: 'hidden', background: '#0d0b08' }}>
                        {identData && (
                          <Image
                            src={getIdentityInfoImageUrl(identData, isGacksung)}
                            alt={getIdentitySlotName(slot)}
                            fill
                            className="object-cover object-top"
                            sizes="180px"
                          />
                        )}
                      </div>
                    </div>

                    <SkillExchangePanel
                      distribution={dist}
                      skills={[
                        slotBestSkills[0] ? {
                          name: slotBestSkills[0].name,
                          iconSrc: identForIcon?.game_id ? getSkillIconUrl(identForIcon as Parameters<typeof getSkillIconUrl>[0], 1) : null,
                          sinColor: SIN_COLORS[slotBestSkills[0].sin_affinity as keyof typeof SIN_COLORS] ?? '#555',
                        } : null,
                        slotBestSkills[1] ? {
                          name: slotBestSkills[1].name,
                          iconSrc: identForIcon?.game_id ? getSkillIconUrl(identForIcon as Parameters<typeof getSkillIconUrl>[0], 2) : null,
                          sinColor: SIN_COLORS[slotBestSkills[1].sin_affinity as keyof typeof SIN_COLORS] ?? '#555',
                        } : null,
                        slotBestSkills[2] ? {
                          name: slotBestSkills[2].name,
                          iconSrc: identForIcon?.game_id ? getSkillIconUrl(identForIcon as Parameters<typeof getSkillIconUrl>[0], 3) : null,
                          sinColor: SIN_COLORS[slotBestSkills[2].sin_affinity as keyof typeof SIN_COLORS] ?? '#555',
                        } : null,
                      ]}
                      isDefault={isDefault}
                      showTotal={false}
                      canDecrease={idx => dist[idx] > 0}
                      canIncrease={idx => dist[idx] < 6 && getHighestDonorIndex(dist, idx) !== null}
                      onAdjust={(idx, delta) => handleSkillChange(sinner.id, idx, delta)}
                      onPresetSelect={preset => dispatch({ type: 'SET_SKILL_DISTRIBUTION', sinnerId: sinner.id, distribution: normalizeSkillDistribution(preset) })}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 하단: 키워드 차트 + 패시브 ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8" style={{ borderTop: '1px solid #1a1510', paddingTop: '1.5rem' }}>
        <div>
          <h3 className="mb-3" style={{ ...COMPACT_KOTRA_STYLE, color: '#e8dcc8', fontSize: '1rem' }}>{tDeck('stats.keywordDistribution')}</h3>
          {keywordDist.length > 0 ? (
            <KeywordChart distribution={keywordDist} getKeywordLabel={getLocalizedKeywordLabel} />
          ) : (
            <p style={{ color: '#444', fontSize: '0.8125rem' }}>{tDeck('stats.keywordEmpty')}</p>
          )}
        </div>
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 style={{ ...COMPACT_KOTRA_STYLE, color: '#e8dcc8', fontSize: '1rem' }}>{tDeck('stats.passives')}</h3>
            <div className="flex gap-1">
              {(['battle', 'support'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setPassiveSubTab(tab)}
                  style={{
                    padding: '0.1875rem 0.625rem',
                    fontSize: '0.9375rem',
                    borderRadius: '0.25rem',
                    cursor: 'pointer',
                    fontWeight: passiveSubTab === tab ? 700 : 400,
                    background: passiveSubTab === tab ? 'rgba(200,144,10,0.15)' : 'transparent',
                    border: `1px solid ${passiveSubTab === tab ? '#c8900a' : '#333'}`,
                    color: passiveSubTab === tab ? '#e8b030' : '#666',
                    transition: 'all 0.15s',
                  }}
                >
                  {tab === 'battle' ? tDeck('stats.battle') : tDeck('stats.support')}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-lg" style={{ background: '#1a1510', border: '1px solid #222', padding: '1rem', maxHeight: '20rem', overflowY: 'auto' }}>
            {(() => {
              const selectedIds = new Set(state.identitySlots.map(s => s.identity_id))
              const filtered = passives.filter(
                p => selectedIds.has(p.identity_id) && p.passive_type === passiveSubTab
              )
              if (filtered.length === 0) {
                return (
                  <p style={{ color: '#444', fontSize: '0.875rem' }}>
                    {state.identitySlots.length === 0 ? tDeck('stats.passiveSelectIdentity') : tDeck('stats.passiveEmpty')}
                  </p>
                )
              }
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {filtered.map(p => {
                    const slot = state.identitySlots.find(s => s.identity_id === p.identity_id)
                    const slotName = slot ? getIdentitySlotName(slot) : ''
                    const sinTypes = p.sin_affinity ? p.sin_affinity.split(',').map(s => s.trim()) : []
                    const current = sinTypes.reduce((sum, st) => sum + (deckSinCounts[st] ?? 0), 0)
                    const required = p.sin_count ?? 1
                    const isMet = current >= required
                    const isResonance = p.active_cond === 'resonance'
                    // 기본 배분(3-2-1) 기준으로는 충족되지만 현재 배분으로는 미충족인 경우 경고
                    const defaultCurrent = sinTypes.reduce((sum, st) => sum + (deckSinCountsDefault[st] ?? 0), 0)
                    const wasMetDefault = p.active_cond != null && defaultCurrent >= required
                    const distributionWarning = wasMetDefault && !isMet
                    const primarySin = sinTypes[0] ?? null
                    const sinCap = primarySin ? primarySin.charAt(0).toUpperCase() + primarySin.slice(1) : null
                    const pc = primarySin ? (SIN_COLORS[primarySin as keyof typeof SIN_COLORS] ?? '#888') : '#888'
                    const passiveName = localizePassiveName(p, locale)
                    const passiveDescription = localizePassiveDescription(p, locale)

                    // S1~S3 스킬 죄악 속성 (해당 인격)
                    const identSkills = skills
                      .filter(sk => sk.identity_id === p.identity_id && sk.skill_order <= 3 && sk.skill_order >= 1)
                      .sort((a, b) => a.skill_order - b.skill_order)
                    // uptie_level 4 우선, 없으면 3
                    const s1 = identSkills.filter(sk => sk.skill_order === 1).sort((a, b) => (b.uptie_level ?? 0) - (a.uptie_level ?? 0))[0]
                    const s2 = identSkills.filter(sk => sk.skill_order === 2).sort((a, b) => (b.uptie_level ?? 0) - (a.uptie_level ?? 0))[0]
                    const s3 = identSkills.filter(sk => sk.skill_order === 3).sort((a, b) => (b.uptie_level ?? 0) - (a.uptie_level ?? 0))[0]
                    const skillDots = [s1, s2, s3].filter(Boolean)

                    return (
                      <div
                        key={p.id}
                        style={{
                          borderBottom: '1px solid #222',
                          paddingBottom: '0.5rem',
                          opacity: p.active_cond && !isMet ? 0.6 : 1,
                          transition: 'opacity 0.15s',
                        }}
                      >
                        {/* 수감자명 + S1/S2/S3 죄악 속성 점 */}
                        <div className="flex items-center gap-1" style={{ marginBottom: '0.125rem' }}>
                          <span style={{ color: '#888', fontSize: '0.6875rem' }}>
                            {slotName}
                          </span>
                          {skillDots.map((sk, i) => {
                            const dotColor = SIN_COLORS[sk!.sin_affinity as keyof typeof SIN_COLORS] ?? '#555'
                            const sinCapDot = sk!.sin_affinity.charAt(0).toUpperCase() + sk!.sin_affinity.slice(1)
                            return (
                              <Image
                                key={i}
                                src={`${STORAGE_BASE}/icons/Sins/transparent/${sinCapDot}.webp`}
                                alt={sk!.sin_affinity}
                                width={10}
                                height={10}
                                title={`S${sk!.skill_order}: ${sk!.sin_affinity}`}
                                style={{ width: '0.625rem', height: '0.625rem', opacity: 0.7, filter: `drop-shadow(0 0 0.125rem ${dotColor}88)` }}
                              />
                            )
                          })}
                        </div>
                        {/* 패시브명 + 조건 배지 + 죄악 아이콘 + current/required */}
                        <div className="flex items-center gap-1.5 flex-wrap" style={{ marginBottom: '0.25rem' }}>
                          <span style={{ color: '#e8dcc8', fontSize: '0.8125rem', fontWeight: 700 }}>
                            {passiveName}
                          </span>
                          {p.active_cond && (
                            <span style={{
                              fontSize: '0.625rem',
                              fontWeight: 700,
                              padding: '0.0625rem 0.375rem',
                              borderRadius: '0.25rem',
                              background: isResonance ? 'rgba(200,144,10,0.15)' : 'rgba(90,176,208,0.15)',
                              border: `1px solid ${isResonance ? 'rgba(200,144,10,0.4)' : 'rgba(90,176,208,0.4)'}`,
                              color: isResonance ? '#c8900a' : '#5ab0d0',
                              flexShrink: 0,
                            }}>
                              {isResonance ? tDeck('stats.resonance') : tDeck('stats.stock')}
                            </span>
                          )}
                          {distributionWarning && (
                            <span
                              title={tDeck('stats.passiveWarning')}
                              style={{
                                fontSize: '0.625rem',
                                color: '#e8a020',
                                flexShrink: 0,
                                lineHeight: 1,
                              }}
                            >
                              !
                            </span>
                          )}
                          {sinCap && (
                            <div className="flex items-center gap-0.5" style={{ flexShrink: 0 }}>
                              <Image
                                src={`${STORAGE_BASE}/icons/Sins/transparent/${sinCap}.webp`}
                                alt={sinCap}
                                width={16}
                                height={16}
                                style={{ width: '1rem', height: '1rem' }}
                              />
                              {p.active_cond && p.sin_count != null ? (
                                <span style={{
                                  fontSize: '0.6875rem',
                                  fontFamily: 'var(--font-mono)',
                                  color: isMet ? '#5a8a40' : '#c83030',
                                  fontWeight: 700,
                                }}>
                                  {current}/{required}
                                </span>
                              ) : p.sin_count != null ? (
                                <span style={{ color: '#888', fontSize: '0.6875rem', fontFamily: 'var(--font-mono)' }}>
                                  {p.sin_count}
                                </span>
                              ) : null}
                            </div>
                          )}
                        </div>
                        {/* 설명 (키워드 툴팁 포함) */}
                        {passiveDescription && (
                          <SkillDescription description={passiveDescription} accentColor={pc} variant="detail" showCoinBadges={false} />
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}
