'use client'

import { getEgoGradeBannerUrl } from '@/lib/utils/images'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { translations } from '@/lib/i18n/translations'
import DeckInsights, { type DeckInsightIdentity } from '@/components/deck-analysis/DeckInsights'
import DeckResourceSummary from '@/components/deck-analysis/DeckResourceSummary'
import { computeAttackTypeCounts, computeEgoCostTotals, computeSinProduction } from '@/lib/decks/deck-analysis'
import FormationBoard, { type FormationBoardSlot } from '@/components/decks/FormationBoard'
import { localizeIdentityName, localizePassiveDescription, localizePassiveName } from '@/components/deck-detail/DeckIdentityCard'
import type {
  EgoEntry,
  IdentitySlot as DeckIdentityPreviewSlot,
  PassiveDetail,
  SkillDetail,
} from '@/components/deck-detail/DeckIdentityCard'
import type { Identity } from '@/lib/types'
import { getIdentityImageUrl, getSinnerLogoUrl, getSkillIconUrl } from '@/lib/utils/images'
import { STORAGE_BASE, GRADE_COLORS } from '@/lib/constants/game'
import { SIN_COLORS, SIN_KR_TO_EN } from '@/lib/constants/sin'
import { getIdentitySkillDistribution } from '@/lib/planner/types'
import { isAwakenedUptie, rowsAtUptie } from '@/lib/decks/deck-identity-uptie'
import SkillExchangePanel from './SkillExchangePanel'

const DeckIdentityPreviewModal = dynamic(() => import('@/components/deck-detail/DeckIdentityPreviewModal'), { ssr: false })
const EgoDetailModal = dynamic(() => import('@/components/ui/EgoDetailModal'), { ssr: false })

const S = STORAGE_BASE
const GRADE_ORDER = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH']

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
  /** Uptie 1–4; missing = 4. */
  uptie?: number
}

type EgoSlot = {
  ego_id?: string
  sinner_id?: string
  name_kr?: string
  grade?: string
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

interface Props {
  deck: IdentitySlot[]
  egoSlots: EgoSlot[]
  identities: IdentityData[]
  sinners: SinnerData[]
  egos: EgoData[]
  skills: SkillSummary[]
  passives: PassiveSummary[]
  /** Map of formation slot number → gift image URLs (from formation slot effects) */
  slotGiftMap: Map<number, string[]>
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="border-l-2 border-[#2e2417] py-1 pl-3 text-[0.9375rem] leading-relaxed text-[#7f7364]">{text}</p>
  )
}

function getIdentityKeywordSource(slot: IdentitySlot, sourceIdentity: IdentityData | undefined): string[] {
  return slot.skill_keyword_list
    ?? sourceIdentity?.skill_keyword_list
    ?? slot.keywords
    ?? sourceIdentity?.keywords
    ?? []
}

function adaptPlanBoardIdentity(slot: IdentitySlot, identity: IdentityData | undefined, locale: string): Identity {
  const source = identity ?? slot
  const name = localizeIdentityName(source, locale)

  return {
    id: slot.identity_id ?? '',
    sinner_id: slot.sinner_id ?? identity?.sinner_id ?? '',
    name,
    name_kr: source.name_kr ?? name,
    name_en: identity?.name_en ?? slot.name_en,
    name_jp: identity?.name_jp ?? slot.name_jp,
    tier: 0,
    hp: 0,
    speed_min: 0,
    speed_max: 0,
    def_level: 0,
    keywords: source.keywords ?? [],
    skill_keyword_list: source.skill_keyword_list ?? undefined,
    rarity: source.rarity ?? 1,
    game_id: source.game_id ?? null,
    folder_name: source.folder_name ?? null,
  }
}

function adaptPreviewSkills(identityId: string, skills: SkillSummary[]): SkillDetail[] {
  return skills
    .filter(skill => skill.identity_id === identityId)
    .map(skill => ({
      id: skill.id,
      name: skill.name,
      name_en: skill.name_en,
      name_jp: skill.name_jp,
      skill_type: skill.skill_type,
      atk_type: skill.atk_type,
      sin_affinity: skill.sin_affinity,
      coins: skill.coins ?? 0,
      base_power: skill.base_power ?? 0,
      coin_power: skill.coin_power ?? 0,
      skill_order: skill.skill_order,
      atk_weight: skill.atk_weight,
      offense_level: skill.offense_level,
      description: skill.description,
      description_en: skill.description_en,
      description_jp: skill.description_jp,
      uptie_level: skill.uptie_level,
      variant_order: skill.variant_order,
    }))
}

function adaptPreviewPassives(identityId: string, passives: PassiveSummary[]): Array<PassiveDetail & { id?: string }> {
  return passives
    .filter(passive => passive.identity_id === identityId)
    .map(passive => ({
      id: passive.id,
      name: passive.name,
      name_en: passive.name_en,
      name_jp: passive.name_jp,
      passive_type: passive.passive_type,
      sin_affinity: passive.sin_affinity,
      sin_count: passive.sin_count,
      active_cond: passive.active_cond,
      description: passive.description ?? '',
      description_en: passive.description_en,
      description_jp: passive.description_jp,
      passive_order: passive.passive_order,
      uptie_level: passive.uptie_level,
    }))
}

function adaptPreviewSlot(
  slot: IdentitySlot,
  identity: IdentityData | undefined,
  skills: SkillSummary[],
  passives: PassiveSummary[],
): DeckIdentityPreviewSlot | null {
  const identityId = slot.identity_id ?? identity?.id
  const sinnerId = slot.sinner_id ?? identity?.sinner_id
  if (!identityId || !sinnerId) return null

  const source = identity ?? slot
  const nameKr = source.name_kr ?? slot.name_kr ?? identityId

  return {
    slot_order: slot.slot_order ?? 99,
    gacksung: isAwakenedUptie(slot.uptie),
    s1_count: slot.s1_count ?? undefined,
    s2_count: slot.s2_count ?? undefined,
    s3_count: slot.s3_count ?? undefined,
    identities: {
      id: identityId,
      sinner_id: sinnerId,
      folder_name: source.folder_name ?? null,
      game_id: source.game_id ?? null,
      keywords: source.keywords ?? [],
      skill_keyword_list: source.skill_keyword_list ?? null,
      affiliation: identity?.affiliation ?? null,
      association_list: identity?.association_list ?? null,
      name: identity?.name ?? null,
      name_kr: nameKr,
      name_en: identity?.name_en ?? slot.name_en ?? null,
      name_jp: identity?.name_jp ?? slot.name_jp ?? null,
      tier: identity?.tier ?? 0,
      rarity: source.rarity ?? 1,
      hp: identity?.hp ?? null,
      speed_min: identity?.speed_min ?? null,
      speed_max: identity?.speed_max ?? null,
      def_level: identity?.def_level ?? null,
      slash_res: identity?.slash_res ?? null,
      pierce_res: identity?.pierce_res ?? null,
      blunt_res: identity?.blunt_res ?? null,
      skills: adaptPreviewSkills(identityId, skills),
      passives: adaptPreviewPassives(identityId, passives),
    },
  }
}

function adaptPreviewEgos(sinnerId: string | null | undefined, egoSlots: EgoSlot[], egos: EgoData[]): EgoEntry[] {
  if (!sinnerId) return []
  const egoMap = new Map(egos.map(ego => [ego.id, ego]))
  return egoSlots
    .filter(slot => slot.sinner_id === sinnerId && slot.ego_id)
    .map((slot): EgoEntry | null => {
      const ego = egoMap.get(slot.ego_id!)
      if (!ego) return null
      return {
        grade: slot.grade ?? ego.grade,
        ego: {
          id: ego.id,
          name: ego.name,
          name_kr: ego.name_kr,
          name_en: ego.name_en,
          name_jp: ego.name_jp,
          grade: ego.grade,
          sin_affinity: ego.sin_affinity,
          sinner_id: ego.sinner_id,
          folder_name: ego.folder_name ?? null,
          image_url: ego.image_url,
        },
      }
    })
    .filter((entry): entry is EgoEntry => Boolean(entry))
}

export default function PlanDeckTabs({
  deck,
  egoSlots,
  identities,
  sinners,
  egos,
  skills: allSkills,
  passives: allPassives,
  slotGiftMap,
}: Props) {
  const locale = useLocale()
  // Skills/passives follow each slot's uptie (nearest level the data has).
  const slotUpties = useMemo(() => new Map(deck.flatMap(slot => slot.identity_id ? [[slot.identity_id, slot.uptie] as const] : [])), [deck])
  const skills = useMemo(() => rowsAtUptie(allSkills, slotUpties), [allSkills, slotUpties])
  const passives = useMemo(() => rowsAtUptie(allPassives, slotUpties), [allPassives, slotUpties])
  const tDeck = useTranslations('planner.deckTab')
  const tSinner = useTranslations('sinner')
  const [deckSubTab, setDeckSubTab] = useState<'identity' | 'ego' | 'skillset'>('identity')
  const [identityModalId, setIdentityModalId] = useState<string | null>(null)
  const [egoModalId, setEgoModalId] = useState<string | null>(null)

  const identityMap = useMemo(() => new Map(identities.map(i => [i.id, i])), [identities])

  const selectedPreviewSlot = useMemo(() => {
    if (!identityModalId) return null
    const slot = deck.find(item => item.identity_id === identityModalId)
    if (!slot) return null
    return adaptPreviewSlot(slot, identityMap.get(identityModalId), skills, passives)
  }, [deck, identityMap, identityModalId, passives, skills])

  const selectedPreviewEgos = useMemo(() => (
    adaptPreviewEgos(selectedPreviewSlot?.identities?.sinner_id, egoSlots, egos)
  ), [egoSlots, egos, selectedPreviewSlot?.identities?.sinner_id])

  const slotBySinner = useMemo(() => {
    const map: Record<string, IdentitySlot> = {}
    for (const s of deck) {
      if (s.sinner_id) map[s.sinner_id] = s
    }
    return map
  }, [deck])

  const boardSlots = useMemo(() => {
    return sinners.map((sinner, index): FormationBoardSlot => {
      const slot = slotBySinner[sinner.id]
      const identity = slot?.identity_id ? identityMap.get(slot.identity_id) : undefined
      const identityName = slot ? localizeIdentityName(identity ?? slot, locale) : null

      return {
        key: `${slot?.identity_id ?? 'empty'}-${sinner.id}-${index}`,
        identity: slot ? adaptPlanBoardIdentity(slot, identity, locale) : null,
        sinnerId: sinner.id,
        slotOrder: slot?.slot_order ?? null,
        uptie: slot?.uptie,
        giftBadgeUrls: slot?.slot_order != null && slot.slot_order < 99
          ? (slotGiftMap.get(slot.slot_order + 1) ?? [])
          : [],
        ariaLabel: identityName ? `${index + 1}. ${identityName}` : `${index + 1}. ${translations[`sinner.${sinner.id}` as keyof typeof translations]?.[locale as 'ko' | 'en' | 'ja'] ?? sinner.name_kr}`,
        onClick: slot?.identity_id ? () => setIdentityModalId(slot.identity_id!) : undefined,
      }
    })
  }, [identityMap, locale, sinners, slotBySinner, slotGiftMap])

  const egoByGradeMap = useMemo(() => {
    const map: Record<string, Record<string, EgoSlot>> = {}
    for (const e of egoSlots) {
      if (!e.sinner_id || !e.grade) continue
      if (!map[e.sinner_id]) map[e.sinner_id] = {}
      map[e.sinner_id][e.grade] = e
    }
    return map
  }, [egoSlots])

  // 키워드 분포·패시브·공격 유형·죄악 자원 (플래너 덱 탭과 같은 패널)
  const insightIdentities = useMemo<DeckInsightIdentity[]>(() => sinners.flatMap(sinner => {
    const slot = slotBySinner[sinner.id]
    if (!slot?.identity_id) return []
    const source = identityMap.get(slot.identity_id)
    const image = source ?? slot
    return [{
      id: slot.identity_id,
      name: localizeIdentityName(source ?? slot, locale),
      sinnerName: tSinner(sinner.id as Parameters<typeof tSinner>[0]),
      imageUrl: image.sinner_id && image.folder_name && image.game_id
        ? getIdentityImageUrl(image.sinner_id, image.folder_name, `${image.game_id}_normal_info`)
        : '',
      keywords: getIdentityKeywordSource(slot, source),
      passives: passives
        .filter(passive => passive.identity_id === slot.identity_id)
        .map(passive => ({ ...passive, name: localizePassiveName(passive, locale), description: localizePassiveDescription(passive, locale) ?? null })),
    }]
  }), [identityMap, locale, passives, sinners, slotBySinner, tSinner])

  const deckAnalysis = useMemo(() => {
    const skillsOf = (slot: IdentitySlot) => skills.filter(skill => skill.identity_id === slot.identity_id)
    const selectedEgoIds = new Set(egoSlots.map(slot => slot.ego_id).filter(Boolean))
    return {
      sinCounts: computeSinProduction(deck.map(slot => ({ skills: skillsOf(slot), distribution: getIdentitySkillDistribution(slot) }))),
      baseSinCounts: computeSinProduction(deck.map(slot => ({ skills: skillsOf(slot) }))),
      ...computeAttackTypeCounts(deck.map(skillsOf)),
      egoCost: computeEgoCostTotals(egos.filter(ego => selectedEgoIds.has(ego.id)).map(ego => ego.cost)),
    }
  }, [deck, egoSlots, egos, skills])

  const tabs = [
    { key: 'identity' as const, label: tDeck('subTabs.identity'), count: `${deck.length}/12` },
    { key: 'ego' as const, label: tDeck('subTabs.ego'), count: String(egoSlots.length) },
    { key: 'skillset' as const, label: tDeck('subTabs.skillset'), count: null },
  ]

  return (
    <>
      {/* 서브탭 헤더 — the baseline is an inset line under the tabs, so the active underline covers it
          without the strip overflowing its own box (a negative margin made the scrollable strip show a vertical scrollbar). */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <div role="tablist" aria-label={tDeck('subTabs.label')} className="flex min-w-0 max-w-full overflow-x-auto shadow-[inset_0_-1px_0_#2e2417]">
        {tabs.map(tab => {
          const active = deckSubTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setDeckSubTab(tab.key)}
              className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 text-[0.9375rem] transition-colors first:pl-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#e8b030] motion-reduce:transition-none ${active
                ? 'border-[#c8900a] font-semibold text-[#e8dcc8]'
                : 'border-transparent text-[#9c8b73] hover:text-[#e8dcc8]'}`}
            >
              {tab.label}
              {tab.count && <span className="font-normal tabular-nums text-[#7f7364]">{tab.count}</span>}
            </button>
          )
        })}
      </div>
      {deckSubTab === 'identity' && deck.length > 0 && (
        <p className="pb-2 text-[0.8125rem] text-[#7f7364]">{tDeck('identity.openDetailHint')}</p>
      )}
      </div>

      {/* 인격 그리드 */}
      {deckSubTab === 'identity' && (
        <div className="relative">
          <FormationBoard slots={boardSlots} className="mt-2" />
        </div>
      )}

      {deckSubTab === 'identity' && deck.length > 0 && (
        <DeckInsights
          identities={insightIdentities}
          sinCounts={deckAnalysis.sinCounts}
          baseSinCounts={deckAnalysis.baseSinCounts}
          summary={<DeckResourceSummary attack={deckAnalysis.attack} defense={deckAnalysis.defense} production={deckAnalysis.sinCounts} egoCost={deckAnalysis.egoCost} />}
        />
      )}

      {/* EGO 그리드 */}
      {deckSubTab === 'ego' && (
        deck.length > 0 ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {sinners.map(sinner => {
              const slot = slotBySinner[sinner.id]
              const egoByGrade = egoByGradeMap[sinner.id] ?? {}
              return (
                <li key={sinner.id} className={`min-w-0 overflow-hidden rounded border border-[#241c14] bg-[#17120c] ${slot ? '' : 'opacity-50'}`}>
                  <div className="flex items-center gap-2 border-b border-[#241c14] px-2.5 py-2">
                    <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={16} height={16} className="h-4 w-4 opacity-60" />
                    <span className={`truncate font-[family-name:var(--font-heading)] text-[0.875rem] ${slot ? 'text-[#cfc2ad]' : 'text-[#7f7364]'}`}>
                      {sinner.name_kr}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5 p-1">
                    {GRADE_ORDER.map(grade => {
                      const ego = egoByGrade[grade]
                      const gc = GRADE_COLORS[grade] ?? '#555'
                      const egoFull = ego ? egos.find(e => e.id === ego.ego_id) : null
                      const sinEn = egoFull?.sin_affinity ? (SIN_KR_TO_EN[egoFull.sin_affinity] ?? egoFull.sin_affinity) : null
                      const ec = sinEn ? (SIN_COLORS[sinEn as keyof typeof SIN_COLORS] ?? gc) : gc
                      const banner = (
                        <Image
                          src={getEgoGradeBannerUrl(grade)} alt={grade} width={22} height={11} unoptimized
                          className={`h-3 w-auto shrink-0 ${ego ? 'opacity-90' : 'opacity-30'}`}
                        />
                      )
                      return ego?.ego_id ? (
                        <button
                          key={grade}
                          type="button"
                          onClick={() => setEgoModalId(ego.ego_id!)}
                          className="flex min-h-8 items-center gap-2 rounded-sm border px-1.5 py-1 text-left transition-[filter] hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e8b030]"
                          style={{ background: `${ec}1a`, borderColor: `${ec}55` }}
                        >
                          {banner}
                          <span className="min-w-0 flex-1 text-[0.75rem] font-semibold leading-tight" style={{ color: gc }}>{ego.name_kr}</span>
                        </button>
                      ) : (
                        <div key={grade} className="flex min-h-8 items-center gap-2 rounded-sm border border-transparent px-1.5 py-1">
                          {banner}
                          {slot && <span className="text-[0.75rem] text-[#4a3f31]" aria-hidden="true">—</span>}
                        </div>
                      )
                    })}
                  </div>
                  {!slot && (
                    <p className="px-2 pb-2 text-center text-[0.75rem] text-[#7f7364]">{tDeck('ego.noIdentity')}</p>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState text={tDeck('skillset.selectIdentityFirst')} />
        )
      )}

      {/* 스킬 교환 */}
      {deckSubTab === 'skillset' && (
        deck.length > 0 ? (
          <div className="skill-exchange-list">
            {sinners.map(sinner => {
              const slot = slotBySinner[sinner.id]
              if (!slot) return null
              const identData = slot.identity_id ? identityMap.get(slot.identity_id) : undefined
              const dist = getIdentitySkillDistribution(slot)
              const identForIcon = identData ? { game_id: identData.game_id, sinner_id: identData.sinner_id } : null
              const slotBestSkills = [1, 2, 3].map(order =>
                skills
                  .filter(sk => sk.identity_id === slot.identity_id && sk.skill_order === order)
                  .sort((a, b) => (b.uptie_level ?? 0) - (a.uptie_level ?? 0))[0] ?? null
              )

              return (
                  <SkillExchangePanel
                    key={sinner.id}
                    identity={{
                      imageUrl: identData ? getIdentityImageUrl(identData.sinner_id, identData.folder_name ?? '', `${identData.game_id}_normal_info`) : null,
                      name: localizeIdentityName(identData ?? slot, locale),
                      sinnerName: tSinner(sinner.id as Parameters<typeof tSinner>[0]),
                    }}
                    onIdentityClick={slot.identity_id ? () => setIdentityModalId(slot.identity_id!) : undefined}
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
              )
            })}
          </div>
        ) : (
          <EmptyState text={tDeck('skillset.selectIdentityFirst')} />
        )
      )}

      {/* 모달 */}
      <DeckIdentityPreviewModal
        open={Boolean(selectedPreviewSlot)}
        slot={selectedPreviewSlot}
        egos={selectedPreviewEgos}
        onEgoClick={setEgoModalId}
        onClose={() => setIdentityModalId(null)}
      />
      {egoModalId && (
        <EgoDetailModal egoId={egoModalId} onClose={() => setEgoModalId(null)} />
      )}
    </>
  )
}
