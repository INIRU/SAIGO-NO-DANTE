'use client'

import { useMemo, useState, useCallback, useEffect, type CSSProperties } from 'react'
import Image from 'next/image'
import { Users, Sparkles, SlidersHorizontal } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
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
import { getIdentityImageUrl, getSkillIconUrl } from '@/lib/utils/images'
import { RARITY_COLORS, STORAGE_BASE } from '@/lib/constants/game'
import { SIN_COLORS } from '@/lib/constants/sin'
import KeywordChart from './KeywordChart'
import SkillDescription from '@/components/skill/SkillDescription'
import { localizeIdentityName, localizePassiveDescription, localizePassiveName } from '@/components/deck-detail/DeckIdentityCard'
import { localizeDeckKeyword } from '@/components/decks/decks-types'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { useLocale, useTranslations } from 'next-intl'
import type { SupportedLang } from '@/lib/i18n/types'
import SkillExchangePanel from './SkillExchangePanel'
import {
  PLANNER_EGO_GRADE_ORDER,
  PlannerEgoBoard,
  PlannerEgoSelectModal,
  PlannerIdentityBoard,
  PlannerIdentitySelectModal,
  type PlannerDeckEgo,
  type PlannerEgoBoardSlot,
  type PlannerIdentityBoardSlot,
} from '@/components/planner/deck/PlannerDeckSelection'
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

export default function DeckTab({ state, dispatch, identities, sinners, passives, skills, egos }: Props) {
  const tDeck = useTranslations('planner.deckTab')
  const tSinner = useTranslations('sinner')
  const locale = useLocale() as SupportedLang
  const { getIconUrl, keywords: keywordInfo } = useKeywordData()
  const [subTab, setSubTab] = useState<DeckSubTab>('identity')
  const [gacksungSlots, setGacksungSlots] = useState<Record<string, boolean>>({})
  const [passiveSubTab, setPassiveSubTab] = useState<'battle' | 'support'>('battle')
  const reduceMotion = useReducedMotion()

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

  const getLocalizedKeywordLabel = useCallback(
    (keyword: string) => localizeDeckKeyword(keyword, keywordInfo[keyword], locale),
    [keywordInfo, locale],
  )

  const identityBoardSlots = useMemo<Record<string, PlannerIdentityBoardSlot>>(() => {
    const slots: Record<string, PlannerIdentityBoardSlot> = {}
    for (const sinner of sinners) {
      const slot = getSelectedIdentity(sinner.id)
      const identity = slot ? identityById.get(slot.identity_id) : undefined
      slots[sinner.id] = {
        sinnerId: sinner.id,
        identity: identity ?? null,
        identityName: slot ? getIdentitySlotName(slot) : undefined,
        slotOrder: slot?.slot_order ?? null,
        gacksung: gacksungSlots[sinner.id] ?? false,
      }
    }
    return slots
  }, [getIdentitySlotName, getSelectedIdentity, gacksungSlots, identityById, sinners])

  // EGO grouped by sinner (grade order within each group)
  const sinnerEgosMap = useMemo(() => {
    const map = new Map<string, EgoData[]>()
    for (const ego of egos) {
      if (!map.has(ego.sinner_id)) map.set(ego.sinner_id, [])
      map.get(ego.sinner_id)!.push(ego)
    }
    for (const [, list] of map) {
      list.sort((a, b) => PLANNER_EGO_GRADE_ORDER.indexOf(a.grade as (typeof PLANNER_EGO_GRADE_ORDER)[number]) - PLANNER_EGO_GRADE_ORDER.indexOf(b.grade as (typeof PLANNER_EGO_GRADE_ORDER)[number]))
    }
    return map
  }, [egos])

  const egoBoardSlots = useMemo<Record<string, PlannerEgoBoardSlot>>(() => {
    const slots: Record<string, PlannerEgoBoardSlot> = {}
    for (const sinner of sinners) {
      const selectedIdentity = getSelectedIdentity(sinner.id)
      const egosByGrade: Record<string, PlannerDeckEgo | undefined> = {}
      for (const slot of state.egoSlots.filter(e => e.sinner_id === sinner.id)) {
        egosByGrade[slot.grade] = egoById.get(slot.ego_id) ?? {
          id: slot.ego_id,
          sinner_id: slot.sinner_id,
          name: slot.name_kr,
          name_kr: slot.name_kr,
          grade: slot.grade,
          sin_affinity: slot.sin_affinity,
          image_url: null,
          cost: null,
        }
      }
      slots[sinner.id] = {
        sinnerId: sinner.id,
        enabled: !!selectedIdentity,
        egosByGrade,
      }
    }
    return slots
  }, [egoById, getSelectedIdentity, sinners, state.egoSlots])

  const egoModalSelectedByGrade = useMemo<Record<string, PlannerDeckEgo | undefined>>(() => {
    if (!egoModalSinner) return {}
    const selectedByGrade: Record<string, PlannerDeckEgo | undefined> = {}
    for (const slot of state.egoSlots.filter(e => e.sinner_id === egoModalSinner)) {
      selectedByGrade[slot.grade] = egoById.get(slot.ego_id) ?? {
        id: slot.ego_id,
        sinner_id: slot.sinner_id,
        name: slot.name_kr,
        name_kr: slot.name_kr,
        grade: slot.grade,
        sin_affinity: slot.sin_affinity,
        image_url: null,
        cost: null,
      }
    }
    return selectedByGrade
  }, [egoById, egoModalSinner, state.egoSlots])

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

  const handleFormationToggle = (sinnerId: string) => {
    const slot = state.identitySlots.find(item => item.sinner_id === sinnerId)
    if (!slot) return

    if (slot.slot_order < 99) {
      const removed = slot.slot_order
      const updated = state.identitySlots.map(item => {
        if (item.sinner_id === sinnerId) return { ...item, slot_order: 99 }
        if (item.slot_order < 99 && item.slot_order > removed) return { ...item, slot_order: item.slot_order - 1 }
        return item
      })
      dispatch({ type: 'LOAD_PLAN', state: { identitySlots: updated } })
      return
    }

    const nextOrder = state.identitySlots.filter(item => item.slot_order < 99).length
    dispatch({ type: 'ADD_IDENTITY', slot: { ...slot, slot_order: nextOrder } })
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
  const modalSinner = identityModalSinner ? sinners.find(s => s.id === identityModalSinner) ?? null : null
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
            <motion.button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSubTab(tab.key)}
              className="flex flex-shrink-0 items-center gap-1.5 transition-[background-color,border-color,color] duration-200"
              style={{
                ...COMPACT_KOTRA_STYLE,
                padding: '0.5rem 1rem',
                fontSize: '0.9375rem',
                color: active ? '#e8dcc8' : '#555',
                borderBottom: active ? '2px solid #c8900a' : '2px solid transparent',
                background: active ? 'rgba(200,144,10,0.05)' : 'transparent',
                cursor: 'pointer',
              }}
              whileHover={reduceMotion ? undefined : { y: -1 }}
              whileTap={reduceMotion ? undefined : { scale: 0.985 }}
              transition={{ type: 'spring', stiffness: 430, damping: 32, mass: 0.5 }}
            >
              <Icon style={{ width: '0.875rem', height: '0.875rem' }} />
              {tDeck(tab.labelKey)}
            </motion.button>
          )
        })}
        <div className="ml-auto flex flex-shrink-0 items-center font-mono" style={{ fontSize: '0.875rem', color: '#666', paddingRight: '0.5rem' }}>
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
              <motion.button
                key={keyword}
                type="button"
                className="planner-main-keyword"
                data-selected={selected}
                disabled={disabled}
                onClick={() => handleMainKeywordToggle(keyword)}
                aria-pressed={selected}
                aria-label={accessibleName}
                title={accessibleName}
                whileHover={reduceMotion || disabled ? undefined : { y: -1 }}
                whileTap={reduceMotion || disabled ? undefined : { scale: 0.985 }}
                transition={{ type: 'spring', stiffness: 430, damping: 32, mass: 0.5 }}
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
              </motion.button>
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
        <PlannerIdentityBoard
          sinners={sinners}
          slots={identityBoardSlots}
          onOpenIdentityModal={setIdentityModalSinner}
          onFormationToggle={handleFormationToggle}
          onGacksungToggle={handleGacksungToggle}
        />
      )}

      {/* ── 인격 선택 모달 ── */}
      <PlannerIdentitySelectModal
        open={!!identityModalSinner}
        sinner={modalSinner}
        identities={modalIdentities}
        selectedIdentityId={modalSlot?.identity_id ?? null}
        onClose={() => setIdentityModalSinner(null)}
        onSelect={identity => handleSelectIdentity(identity as IdentityData)}
        onDeselect={modalSlot ? () => handleDeselectIdentity(identityModalSinner!) : undefined}
      />

      {/* ── EGO 탭 ── */}
      {subTab === 'ego' && (
        <PlannerEgoBoard
          sinners={sinners}
          slots={egoBoardSlots}
          onOpenEgoModal={setEgoModalSinner}
        />
      )}

      {/* ── EGO 선택 모달 ── */}
      <PlannerEgoSelectModal
        open={!!egoModalSinner}
        sinner={egoModalSinner ? sinners.find(s => s.id === egoModalSinner) ?? null : null}
        egos={egoModalSinner ? (sinnerEgosMap.get(egoModalSinner) ?? []) : []}
        selectedEgosByGrade={egoModalSelectedByGrade}
        onClose={() => setEgoModalSinner(null)}
        onSelect={ego => {
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
        onDeselect={(_, ego) => dispatch({ type: 'REMOVE_EGO', egoId: ego.id })}
      />

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
                          <span style={{ color: '#888', fontSize: '0.875rem' }}>
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
                          <span style={{ color: '#e8dcc8', fontSize: '0.875rem', fontWeight: 600 }}>
                            {passiveName}
                          </span>
                          {p.active_cond && (
                            <span style={{
                              fontSize: '0.75rem',
                              fontWeight: 600,
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
                                  fontSize: '0.875rem',
                                  fontFamily: 'var(--font-mono)',
                                  color: isMet ? '#5a8a40' : '#c83030',
                                  fontWeight: 600,
                                }}>
                                  {current}/{required}
                                </span>
                              ) : p.sin_count != null ? (
                                <span style={{ color: '#888', fontSize: '0.875rem', fontFamily: 'var(--font-mono)' }}>
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
