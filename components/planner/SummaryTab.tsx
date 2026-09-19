'use client'

import { getEgoGradeBannerUrl } from '@/lib/utils/images'

import { isConfiguredFloor } from '@/lib/planner/stripPlanForList'

import { getGameUiAsset } from '@/lib/utils/game-ui'
import { useState, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import NoteDocumentEditor from '@/components/notes/NoteDocumentEditor'
import { NoteRenderer, type NoteEgoGiftEntry } from '@/components/decks/NoteChips'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import {
  useNoteAutocomplete,
  NoteAutocompleteDropdown,
  buildKeywordPool,
  buildEgoGiftPool,
  type AutocompleteSuggestion,
} from '@/components/notes/NoteAutocomplete'
import { getIdentitySkillDistribution, type PlannerState, type PlannerAction, type ThemeData, type GiftData, type RecipeData, type IdentityData, type SinnerData, type EgoData, type SkillSummary, type FloorDifficulty } from '@/lib/planner/types'
import { getLegacyPlanFloorDifficulty, isAllowedFloorDifficulty, isFloorDifficulty } from '@/lib/planner/floor-difficulty'
import { getIdentityImageUrl, getSinnerLogoUrl, getSkillIconUrl } from '@/lib/utils/images'
import { STORAGE_BASE, RARITY_COLORS, GRADE_COLORS } from '@/lib/constants/game'
import { SIN_COLORS, SIN_KR_TO_EN } from '@/lib/constants/sin'
import GiftCard from '@/components/ui/GiftCard'
import type { PassiveData } from '@/lib/planner/types'
import DeckStatsPanel from '@/components/planner/DeckStatsPanel'
import { getGiftActivationConditionStatus, getGiftConditionCountsForSlots } from '@/lib/planner/gift-condition-status'
import {
  getSelectedBlessingCost,
  getSelectedBlessingLevels,
  normalizeBlessingMessages,
  ReadOnlyBlessingGrid,
} from './BlessingTab'
import FormationBoard, { type FormationBoardSlot } from '@/components/decks/FormationBoard'
import { localizeIdentityName } from '@/components/deck-detail/DeckIdentityCard'
import type { Identity } from '@/lib/types'
import SkillExchangePanel from './SkillExchangePanel'
import FloorPlanPreviewBoard from './FloorPlanPreviewBoard'
import { staggerContainer, workbenchReveal, workbenchStaggerItem } from '@/lib/animations'

const IdentityDetailModal = dynamic(() => import('@/components/ui/IdentityDetailModal'), { ssr: false })
const EgoDetailModal = dynamic(() => import('@/components/ui/EgoDetailModal'), { ssr: false })
const PlannerGiftModal = dynamic(() => import('@/components/planner/PlannerGiftModal'), { ssr: false })

const S = STORAGE_BASE

const GRADE_ORDER = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH']

function adaptPlannerBoardIdentity(slot: PlannerState['identitySlots'][number], identity: IdentityData | undefined, locale: string): Identity {
  const source = identity ?? slot
  const name = localizeIdentityName(source, locale)

  return {
    id: slot.identity_id,
    sinner_id: slot.sinner_id,
    name,
    name_kr: source.name_kr,
    name_en: identity?.name_en,
    name_jp: identity?.name_jp,
    tier: 0,
    hp: 0,
    speed_min: 0,
    speed_max: 0,
    def_level: 0,
    keywords: source.keywords ?? [],
    skill_keyword_list: source.skill_keyword_list ?? undefined,
    rarity: source.rarity,
    affiliation: source.affiliation ?? undefined,
    association_list: source.association_list ?? undefined,
    game_id: source.game_id,
    folder_name: source.folder_name,
  }
}

// ── 자동완성 지원 textarea ────────────────────────────────────────────────
function AcTextarea({
  value, onChange, pool, placeholder, rows, maxLength, style: extraStyle,
}: {
  value: string; onChange: (v: string) => void; pool: AutocompleteSuggestion[]
  placeholder?: string; rows?: number; maxLength?: number; style?: React.CSSProperties
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const ac = useNoteAutocomplete({ text: value, setText: onChange, textareaRef: ref, pool })
  return (
    <div style={{ position: 'relative' }}>
      <textarea
        ref={ref} value={value} rows={rows} maxLength={maxLength} placeholder={placeholder}
        onChange={e => { onChange(e.target.value); ac.onTextChange(e) }}
        onSelect={ac.onTextSelect} onKeyDown={ac.handleKeyDown}
        onCompositionStart={ac.onCompositionStart}
        onCompositionEnd={ac.onCompositionEnd}
        style={{
          background: '#0d0b08', border: '1px solid #333', borderRadius: '0.375rem',
          padding: '0.5rem 0.75rem', fontSize: '0.8125rem', color: '#e5e7eb',
          outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical',
          lineHeight: 1.6, fontFamily: 'inherit', ...extraStyle,
        }}
        onFocus={e => { e.currentTarget.style.borderColor = '#c8900a' }}
        onBlur={e => { e.currentTarget.style.borderColor = '#333' }}
      />
      <NoteAutocompleteDropdown
        suggestions={ac.suggestions} selectedIdx={ac.selectedIdx}
        onSelect={ac.select} onHover={ac.setSelectedIdx}
      />
    </div>
  )
}

const FLOOR_DIFFICULTY_ORDER: FloorDifficulty[] = ['normal', 'hard', 'overlap', 'extreme']
const FLOOR_PLAN_SEGMENTS = [
  { start: 1, end: 5 },
  { start: 6, end: 10 },
  { start: 11, end: 15 },
] as const

function isFloorEntryConfigured(entry: PlannerState['floorPlan'][number]) {
  return isConfiguredFloor(entry)
}

function getVisibleFloorPlanEntries(floorPlan: PlannerState['floorPlan']) {
  return FLOOR_PLAN_SEGMENTS.flatMap(segment => {
    let highestConfiguredFloor = 0
    for (const entry of floorPlan) {
      if (entry.floor >= segment.start && entry.floor <= segment.end && isFloorEntryConfigured(entry)) {
        highestConfiguredFloor = Math.max(highestConfiguredFloor, entry.floor)
      }
    }
    if (highestConfiguredFloor < segment.start) return []
    return floorPlan.filter(entry => entry.floor >= segment.start && entry.floor <= highestConfiguredFloor)
  })
}

function parseFormationSlots(text: string | null): number[] {
  if (!text) return []
  const match = text.match(/\[편성[^\]]*전용\s*효과\]|\[\d[^\]]*편성\s*전용\s*효과\]/)
  if (!match) return []
  return [...match[0].matchAll(/(\d+)/g)].map(result => parseInt(result[1], 10))
}

interface SummaryTabProps {
  state: PlannerState
  dispatch: React.Dispatch<PlannerAction>
  themes: ThemeData[]
  gifts: GiftData[]
  recipes: RecipeData[]
  giftMap: Map<number, GiftData>
  identities: IdentityData[]
  sinners: SinnerData[]
  egos: EgoData[]
  skills: SkillSummary[]
  passives: PassiveData[]
}

export default function SummaryTab({ state, dispatch, themes, gifts, recipes, giftMap, identities, sinners, egos, skills, passives }: SummaryTabProps) {
  const locale = useLocale()
  const tPlanner = useTranslations('planner')
  const tDeck = useTranslations('planner.deckTab')
  const tBlessing = useTranslations('planner.blessingTab')
  const tFloor = useTranslations('planner.floorTab')
  const [deckSubTab, setDeckSubTab] = useState<'identity' | 'ego' | 'skillset'>('identity')
  const [selectedGift, setSelectedGift] = useState<{ gift: GiftData; enhance?: number } | null>(null)
  const [identityModalId, setIdentityModalId] = useState<string | null>(null)
  const [egoModalId, setEgoModalId] = useState<string | null>(null)
  const shouldReduceMotion = useReducedMotion()

  const themeMap = useMemo(() => new Map(themes.map(t => [String(t.id), t])), [themes])
  const identityMap = useMemo(() => new Map(identities.map(i => [i.id, i])), [identities])
  const slotGiftMap = useMemo(() => {
    const map = new Map<number, string[]>()
    for (const id of state.giftInventory) {
      if (!id.startsWith('final_')) continue
      let enhance = 0
      let gameId: number
      if (id.endsWith('_plusplus')) {
        gameId = parseInt(id.replace('final_', '').replace('_plusplus', ''), 10)
        enhance = 2
      } else if (id.endsWith('_plus')) {
        gameId = parseInt(id.replace('final_', '').replace('_plus', ''), 10)
        enhance = 1
      } else {
        gameId = parseInt(id.replace('final_', ''), 10)
      }
      const gift = giftMap.get(gameId)
      if (!gift?.image_url) continue
      const text = enhance === 2 ? gift.effect_plusplus : enhance === 1 ? gift.effect_plus : gift.effect_base
      for (const slotOrder of parseFormationSlots(text)) {
        const urls = map.get(slotOrder) ?? []
        urls.push(gift.image_url)
        map.set(slotOrder, urls)
      }
    }
    return map
  }, [giftMap, state.giftInventory])
  const boardSlots = useMemo(() => {
    return sinners.map((sinner, index): FormationBoardSlot => {
      const slot = state.identitySlots.find(s => s.sinner_id === sinner.id)
      const identity = slot ? identityMap.get(slot.identity_id) : undefined
      const identityName = slot ? localizeIdentityName(identity ?? slot, locale) : null

      return {
        key: `${slot?.identity_id ?? 'empty'}-${sinner.id}-${index}`,
        identity: slot ? adaptPlannerBoardIdentity(slot, identity, locale) : null,
        slotOrder: slot?.slot_order ?? null,
        giftBadgeUrls: slot?.slot_order != null && slot.slot_order < 99
          ? (slotGiftMap.get(slot.slot_order + 1) ?? [])
          : [],
        ariaLabel: identityName ? `${index + 1}. ${identityName}` : `${index + 1}. ${sinner.name_kr}`,
        onClick: slot ? () => setIdentityModalId(slot.identity_id) : undefined,
      }
    })
  }, [identityMap, locale, sinners, slotGiftMap, state.identitySlots])
  const kwContext = useKeywordData()
  const allowedKeywords = useMemo(() => new Set(Object.keys(kwContext.keywords)), [kwContext.keywords])
  const localizedBlessings = useMemo(
    () => normalizeBlessingMessages(tBlessing.raw('blessings'), baseId => tBlessing('fallbackName', { baseId })),
    [tBlessing],
  )
  const selectedBlessings = useMemo(
    () => getSelectedBlessingLevels(state.giftInventory),
    [state.giftInventory],
  )

  // 이름 → GiftData 맵 (레시피용)
  const giftByName = useMemo(() => {
    const map = new Map<string, GiftData>()
    for (const g of gifts) map.set(g.name, g)
    return map
  }, [gifts])

  // 조합법 맵: result game_id → { materials: GiftData[], result: GiftData }
  const recipeMap = useMemo(() => {
    const map = new Map<number, { materials: GiftData[]; result: GiftData }>()
    for (const r of recipes) {
      const result = giftByName.get(r.result_name)
      if (!result) continue
      const mats = r.ingredients
        .map(name => giftByName.get(name))
        .filter(Boolean) as GiftData[]
      map.set(result.game_id, { materials: mats, result })
    }
    return map
  }, [recipes, giftByName])

  // 기프트 칩 렌더링용 lookup
  const egoGiftLookup = useMemo(() => {
    const map: Record<string, NoteEgoGiftEntry> = {}
    for (const g of gifts) {
      if (g.name && g.keyword) {
        map[g.name] = { name: g.name, keyword: g.keyword, grade: g.grade ?? '1', image_url: g.image_url, effect_base: g.effect_base }
      }
    }
    return map
  }, [gifts])

  // 자동완성 풀
  const acPool = useMemo(() => {
    const kwPool = buildKeywordPool(kwContext.keywords)
    const giftPool = buildEgoGiftPool(
      Array.from(giftMap.values()).filter(g => g.keyword && g.name).map(g => ({
        name: g.name, keyword: g.keyword!, image_url: g.image_url,
      }))
    )
    return [...kwPool, ...giftPool]
  }, [kwContext.keywords, giftMap])

  const totalBlessingCost = useMemo(
    () => getSelectedBlessingCost(localizedBlessings, selectedBlessings),
    [localizedBlessings, selectedBlessings],
  )

  // 기프트 분류
  const observeGifts = useMemo(() =>
    state.giftInventory.filter(id => id.startsWith('observe_')).map(id => giftMap.get(parseInt(id.replace('observe_', '')))).filter(Boolean) as GiftData[]
  , [state.giftInventory, giftMap])

  const startGifts = useMemo(() =>
    state.giftInventory.filter(id => id.startsWith('start_')).map(id => giftMap.get(parseInt(id.replace('start_', '')))).filter(Boolean) as GiftData[]
  , [state.giftInventory, giftMap])

  const finalGifts = useMemo(() => {
    const list: { gift: GiftData; enhance: number }[] = []
    for (const id of state.giftInventory) {
      if (!id.startsWith('final_')) continue
      let enhance = 0, gid: number
      if (id.endsWith('_plusplus')) { gid = parseInt(id.replace('final_', '').replace('_plusplus', '')); enhance = 2 }
      else if (id.endsWith('_plus')) { gid = parseInt(id.replace('final_', '').replace('_plus', '')); enhance = 1 }
      else { gid = parseInt(id.replace('final_', '')) }
      const gift = giftMap.get(gid)
      if (gift) list.push({ gift, enhance })
    }
    return list
  }, [state.giftInventory, giftMap])

  const conditionCounts = useMemo(
    () => getGiftConditionCountsForSlots(state.identitySlots),
    [state.identitySlots],
  )

  function getConditionStatus(gift: GiftData): { level: 'warn' | 'unmet'; text: string } | null {
    return getGiftActivationConditionStatus({ gift, ...conditionCounts })
  }

  const floorDifficultySummary = useMemo(() => {
    const counts: Record<FloorDifficulty, number> = {
      normal: 0,
      hard: 0,
      overlap: 0,
      extreme: 0,
    }

    for (const floor of getVisibleFloorPlanEntries(state.floorPlan)) {
      const difficulty = isFloorDifficulty(floor.difficulty) && isAllowedFloorDifficulty(floor.difficulty, floor.floor)
        ? floor.difficulty
        : getLegacyPlanFloorDifficulty(state.difficulty, floor.floor)
      counts[difficulty] += 1
    }

    return FLOOR_DIFFICULTY_ORDER
      .map(difficulty => ({ difficulty, count: counts[difficulty] }))
      .filter(item => item.count > 0)
  }, [state.difficulty, state.floorPlan])

  return (<>
    <motion.div
      style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
      variants={shouldReduceMotion ? undefined : staggerContainer(0.045)}
      initial={shouldReduceMotion ? false : 'initial'}
      animate={shouldReduceMotion ? undefined : 'animate'}
    >

      {/* ── 플랜 정보 ── */}
      <motion.section
        variants={shouldReduceMotion ? undefined : workbenchStaggerItem}
        style={{ background: '#1a1510', border: '1px solid #222', borderRadius: '0.5rem', padding: '0.875rem 1rem' }}
      >
        <input
          type="text" placeholder="플랜 제목..." value={state.title}
          onChange={e => dispatch({ type: 'SET_TITLE', title: e.target.value })}
          maxLength={80}
          style={{ background: '#0d0b08', border: '1px solid #333', borderRadius: '0.375rem', padding: '0.5rem 0.75rem', fontSize: '0.9375rem', color: '#e8b030', fontWeight: 700, outline: 'none', width: '100%', boxSizing: 'border-box' }}
        />
        <div style={{ marginTop: '0.5rem' }}>
          <NoteDocumentEditor formation={[...state.identitySlots].sort((a,b) => a.slot_order-b.slot_order).map(slot => ({identityId:slot.identity_id,sinnerId:slot.sinner_id,name:(locale === 'en' ? sinners.find(s => s.id === slot.sinner_id)?.name_en : locale === 'ja' ? sinners.find(s => s.id === slot.sinner_id)?.name_jp : sinners.find(s => s.id === slot.sinner_id)?.name_kr) || sinners.find(s => s.id === slot.sinner_id)?.name_kr || slot.sinner_id}))} pool={acPool} value={state.description} onChange={description => dispatch({ type: 'SET_DESCRIPTION', description })} />
          {state.description.trim() && (
            <div style={{
              marginTop: '0.375rem', background: '#0d0b08', border: '1px solid #222',
              borderRadius: '0.375rem', padding: '0.5rem 0.625rem',
            }}>
              <div style={{ fontSize: '0.5625rem', color: '#4b5563', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>미리보기</div>
              <NoteRenderer text={state.description} allowedKeywords={allowedKeywords} egoGiftLookup={egoGiftLookup} />
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.625rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: 600 }}>
            {tFloor('difficultySummary')}
          </span>
          {floorDifficultySummary.map(({ difficulty, count }) => (
            <span key={difficulty} style={{
              padding: '0.25rem 0.625rem',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              background: 'rgba(200,144,10,0.08)',
              color: '#b9a47f',
              border: '1px solid rgba(200,144,10,0.2)',
            }}>
              {tFloor(`difficulty.${difficulty}`)} · {tFloor('difficultySummaryCount', { count })}
            </span>
          ))}
        </div>
      </motion.section>

      {/* ── 덱 편성 (DeckTab 스타일 서브탭) ── */}
      <motion.div variants={shouldReduceMotion ? undefined : workbenchStaggerItem}>
        <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #222', marginBottom: '0.75rem' }}>
          {([
            { key: 'identity' as const, label: `${tDeck('subTabs.identity')} (${state.identitySlots.length}/12)` },
            { key: 'ego' as const, label: `${tDeck('subTabs.ego')} (${state.egoSlots.length})` },
            { key: 'skillset' as const, label: tDeck('subTabs.skillset') },
          ]).map(tab => {
            const active = deckSubTab === tab.key
            return (
              <button key={tab.key} onClick={() => setDeckSubTab(tab.key)} style={{
                padding: '0.5rem 1rem', fontSize: '0.8125rem', fontWeight: active ? 700 : 400,
                color: active ? '#e8dcc8' : '#555', cursor: 'pointer',
                background: active ? 'rgba(200,144,10,0.05)' : 'transparent',
                borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                borderBottomWidth: '2px', borderBottomStyle: 'solid',
                borderBottomColor: active ? '#c8900a' : 'transparent',
                marginBottom: '-1px',
              }}>
                {tab.label}
              </button>
            )
          })}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {deckSubTab === 'identity' && (
            <motion.div
              key="identity"
              variants={shouldReduceMotion ? undefined : workbenchReveal}
              initial={shouldReduceMotion ? false : 'initial'}
              animate={shouldReduceMotion ? undefined : 'animate'}
              exit={shouldReduceMotion ? undefined : 'exit'}
            >
              <FormationBoard slots={boardSlots} className="mt-4" />
              {state.identitySlots.length > 0 && (() => {
                const selectedEgoIds = new Set(state.egoSlots.map(e => e.ego_id))
                const selectedEgoData = egos.filter(e => selectedEgoIds.has(e.id))
                const selectedEgoCosts = selectedEgoData.map(e => ({ cost: e.cost }))
                const selectedEgoSins = selectedEgoData.map(e => e.sin_affinity).filter(Boolean) as string[]
                return (
                  <DeckStatsPanel
                    identitySlots={state.identitySlots}
                    skills={skills}
                    passives={passives}
                    sinners={sinners}
                    egoCosts={selectedEgoCosts}
                    egoSinAffinities={selectedEgoSins}
                  />
                )
              })()}
            </motion.div>
          )}

          {deckSubTab === 'ego' && (
            <motion.div
              key="ego"
              variants={shouldReduceMotion ? undefined : workbenchReveal}
              initial={shouldReduceMotion ? false : 'initial'}
              animate={shouldReduceMotion ? undefined : 'animate'}
              exit={shouldReduceMotion ? undefined : 'exit'}
            >
              {state.identitySlots.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-4">
              {sinners.map(sinner => {
                const slot = state.identitySlots.find(s => s.sinner_id === sinner.id)
                const selectedEgos = state.egoSlots.filter(e => e.sinner_id === sinner.id)
                const egoByGrade: Record<string, typeof state.egoSlots[0]> = {}
                for (const e of selectedEgos) egoByGrade[e.grade] = e

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
                        const sinEn = ego?.sin_affinity ? (SIN_KR_TO_EN[ego.sin_affinity] ?? ego.sin_affinity) : null
                        const ec = sinEn ? (SIN_COLORS[sinEn as keyof typeof SIN_COLORS] ?? gc) : gc
                        return (
                          <button type="button" key={grade} onClick={() => ego?.ego_id && setEgoModalId(ego.ego_id)} disabled={!ego?.ego_id} className="border-0 p-0 text-left w-full" style={{
                            background: ego ? `${ec}1a` : 'rgba(10,8,5,0.7)',
                            border: `1px solid ${ego ? ec + '55' : '#18120a'}`,
                            borderRadius: '0.125rem',
                            padding: '0.25rem 0.3125rem',
                            display: 'flex', alignItems: 'center', gap: '0.3125rem',
                            minHeight: '1.5rem',
                            cursor: ego?.ego_id ? 'pointer' : 'default',
                          }}>
                            <Image src={getEgoGradeBannerUrl(grade)} alt={grade} width={22} height={11} unoptimized
                                style={{ height: '0.6875rem', width: 'auto', opacity: ego ? 0.9 : 0.3, flexShrink: 0 }} />
                            {ego ? (
                              <span style={{ color: gc, fontSize: '0.5rem', fontWeight: 700, lineHeight: 1.2, flex: 1, textAlign: 'left' }}>{ego.name_kr}</span>
                            ) : (
                              <span style={{ color: '#2a1e10', fontSize: '0.5rem', lineHeight: 1 }}>{slot ? '—' : ''}</span>
                            )}
                          </button>
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
                <EmptyState text={tDeck('skillset.selectIdentityFirst')} />
              )}
            </motion.div>
          )}

          {deckSubTab === 'skillset' && (
            <motion.div
              key="skillset"
              variants={shouldReduceMotion ? undefined : workbenchReveal}
              initial={shouldReduceMotion ? false : 'initial'}
              animate={shouldReduceMotion ? undefined : 'animate'}
              exit={shouldReduceMotion ? undefined : 'exit'}
            >
              {state.identitySlots.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-6">
              {sinners.map(sinner => {
                const slot = state.identitySlots.find(s => s.sinner_id === sinner.id)
                if (!slot) return null
                const identData = identityMap.get(slot.identity_id)
                const dist = getIdentitySkillDistribution(slot)
                const identForIcon = identData ? { game_id: identData.game_id, sinner_id: identData.sinner_id } as { game_id: string | null; sinner_id: string } : null
                const slotBestSkills = [1, 2, 3].map(order =>
                  skills
                    .filter(sk => sk.identity_id === slot.identity_id && sk.skill_order === order)
                    .sort((a, b) => (b.uptie_level ?? 0) - (a.uptie_level ?? 0))[0] ?? null
                )

                return (
                  <div key={sinner.id}>
                    {/* 미니 인격 카드 */}
                    <div style={{
                      position: 'relative', width: '100%', aspectRatio: '2/3',
                      background: 'linear-gradient(160deg, #1e1810 0%, #120e08 60%, #1a1410 100%)',
                      border: `0.09375rem solid ${(RARITY_COLORS[slot.rarity] ?? RARITY_COLORS[1]).border}`,
                      borderRadius: '0.25rem', overflow: 'hidden',
                    }}>
                      {identData && (
                        <Image
                          src={getIdentityImageUrl(identData.sinner_id, identData.folder_name ?? '', `${identData.game_id}_normal_info`)}
                          alt={slot.name_kr} fill className="object-cover object-top" sizes="120px"
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
                      readOnly
                      showTotal={false}
                    />
                  </div>
                )
              })}
                </div>
              ) : (
                <EmptyState text={tDeck('skillset.selectIdentityFirst')} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── 가호 (BlessingTab 스타일) ── */}
      <motion.div variants={shouldReduceMotion ? undefined : workbenchStaggerItem} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #222', paddingBottom: '0.375rem' }}>
        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#e8dcc8' }}>{tBlessing('title')}</span>
        {selectedBlessings.size > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Image src={getGameUiAsset('start-buffs/starlight')} alt={tBlessing('starlightAlt')} width={16} height={16} style={{ width: '1rem', height: '1rem' }} />
            <span style={{ fontSize: '0.8125rem', color: '#c8900a', fontWeight: 700 }}>{totalBlessingCost}</span>
          </div>
        ) : (
          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{tBlessing('none')}</span>
        )}
      </motion.div>
      <ReadOnlyBlessingGrid
        blessings={localizedBlessings}
        selectedBlessings={selectedBlessings}
        emptyText={tBlessing('empty')}
      />

      {/* ── 시작 기프트 (GiftPlanTab 스타일) ── */}
      <SectionTitle title="시작 기프트" count={`${startGifts.length}개`} />
      {startGifts.length > 0 ? (
        <GiftGrid gifts={startGifts.map(g => ({ gift: g, enhance: 0 }))} onGiftClick={(g, e) => setSelectedGift({ gift: g, enhance: e })} />
      ) : (
        <EmptyState text="시작 기프트가 선택되지 않았습니다" />
      )}

      {/* ── 관측 기프트 ── */}
      <SectionTitle title="관측 기프트" count={`${observeGifts.length}/3`} />
      {observeGifts.length > 0 ? (
        <GiftGrid gifts={observeGifts.map(g => ({ gift: g, enhance: 0 }))} onGiftClick={(g, e) => setSelectedGift({ gift: g, enhance: e })} />
      ) : (
        <EmptyState text="관측 기프트가 선택되지 않았습니다" />
      )}

      {/* ── 층별 계획 ── */}
      <SectionTitle
        title={tPlanner('tabs.floor')}
        count={tFloor('configuredFloorCount', { configured: state.floorPlan.filter(f => f.theme_id).length, total: state.floorPlan.length })}
      />
      <FloorPlanPreviewBoard
                inventory={state.giftInventory}
                recipes={recipes}
        floorPlan={state.floorPlan}
        planDifficulty={state.difficulty}
        themeMap={themeMap}
        giftMap={giftMap}
        onGiftClick={gift => setSelectedGift({ gift, enhance: 0 })}
        renderMemo={memo => (
          <NoteRenderer text={memo} allowedKeywords={allowedKeywords} egoGiftLookup={egoGiftLookup} />
        )}
      />

      {/* ── 최종 기프트 (GiftPlanTab 스타일 + 강화) ── */}
      <SectionTitle title="최종 기프트" count={`${finalGifts.length}개`} />
      {state.identitySlots.length > 0 && finalGifts.length > 0 && (
        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.5625rem', marginBottom: '0.25rem' }}>
          <span style={{ color: '#ef4444' }}>● 조건 미달 — 전체 인격으로도 부족</span>
          <span style={{ color: '#e8b030' }}>● 조건 주의 — 편성(1-7)만으로는 부족, 대기 포함 시 충족</span>
        </div>
      )}
      {finalGifts.length > 0 ? (
        <GiftGrid gifts={finalGifts} getCondition={getConditionStatus} onGiftClick={(g, e) => setSelectedGift({ gift: g, enhance: e })} />
      ) : (
        <EmptyState text="최종 기프트가 선택되지 않았습니다" />
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
    </motion.div>

    {identityModalId && (
      <IdentityDetailModal identityId={identityModalId} onClose={() => setIdentityModalId(null)} />
    )}
    {egoModalId && (
      <EgoDetailModal egoId={egoModalId} onClose={() => setEgoModalId(null)} />
    )}
  </>)
}

// ── 섹션 제목 ──────────────────────────────────────────────────────────────
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

// ── 빈 상태 ────────────────────────────────────────────────────────────────
function EmptyState({ text }: { text: string }) {
  return (
    <div style={{
      background: '#1a1510', border: '1px solid #1a1510', borderRadius: '0.5rem',
      padding: '1rem', textAlign: 'center', fontSize: '0.75rem', color: '#333',
    }}>{text}</div>
  )
}

// ── 기프트 그리드 (GiftPlanTab GiftCard 스타일) ────────────────────────────
function GiftGrid({ gifts, getCondition, onGiftClick }: {
  gifts: { gift: GiftData; enhance: number }[]
  getCondition?: (gift: GiftData) => { level: 'warn' | 'unmet'; text: string } | null
  onGiftClick?: (gift: GiftData, enhance: number) => void
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
      {gifts.map(({ gift, enhance }) => {
        const cond = getCondition?.(gift)
        return (
          <GiftCard
            key={`${gift.game_id}_${enhance}`}
            gift={gift}
            onClick={() => onGiftClick?.(gift, enhance)}
            size="4.5rem"
            enhance={enhance}
            conditionStatus={cond}
          />
        )
      })}
    </div>

  )
}
