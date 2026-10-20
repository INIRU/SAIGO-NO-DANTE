'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useLocale, useTranslations } from 'next-intl'
import { translations } from '@/lib/i18n/translations'
import DeckInsights, { type DeckInsightIdentity } from '@/components/deck-analysis/DeckInsights'
import DeckResourceSummary from '@/components/deck-analysis/DeckResourceSummary'
import { computeDeckResources, computeSinProduction, fieldedEntries } from '@/lib/decks/deck-analysis'
import FormationBoard, { type FormationBoardSlot } from '@/components/decks/FormationBoard'
import { localizeIdentityName, localizePassiveDescription, localizePassiveName } from '@/components/deck-detail/DeckIdentityCard'
import type { EgoEntry } from '@/components/deck-detail/DeckIdentityCard'
import type { Identity } from '@/lib/types'
import { getIdentityImageUrl, getSkillIconUrl } from '@/lib/utils/images'
import { SIN_COLORS } from '@/lib/constants/sin'
import { getIdentitySkillDistribution } from '@/lib/planner/types'
import { rowsAtUptie } from '@/lib/decks/deck-identity-uptie'
import SkillExchangePanel from './SkillExchangePanel'
import { FormationEgoGrid, FormationTabs, type FormationEgo } from '@/components/decks/FormationEgoGrid'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import { isDeployedSlot } from '@/lib/constants/game'

const IdentityDetailModal = dynamic(() => import('@/components/ui/IdentityDetailModal'), { ssr: false })
const EgoDetailModal = dynamic(() => import('@/components/ui/EgoDetailModal'), { ssr: false })


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
  sin_requirements?: { sin: string; count: number }[] | null
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

  const selectedSlot = identityModalId ? deck.find(item => item.identity_id === identityModalId) ?? null : null
  const selectedSinnerId = selectedSlot ? selectedSlot.sinner_id ?? identityMap.get(identityModalId!)?.sinner_id : null

  const selectedPreviewEgos = useMemo(() => (
    adaptPreviewEgos(selectedSinnerId, egoSlots, egos)
  ), [egoSlots, egos, selectedSinnerId])

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

  const formationEgos = useMemo(() => {
    const egoById = new Map(egos.map(ego => [ego.id, ego]))
    const map: Record<string, Record<string, FormationEgo>> = {}
    for (const slot of egoSlots) {
      if (!slot.sinner_id || !slot.grade || !slot.ego_id) continue
      const ego = egoById.get(slot.ego_id)
      const name = getLocalizedName({ name_kr: ego?.name_kr ?? slot.name_kr ?? ego?.name ?? '', name_en: ego?.name_en, name_jp: ego?.name_jp }, locale as SupportedLang)
      ;(map[slot.sinner_id] ??= {})[slot.grade] = { id: slot.ego_id, name, sin_affinity: ego?.sin_affinity ?? null }
    }
    return map
  }, [egoSlots, egos, locale])

  // 키워드 분포·패시브·공격 유형·죄악 자원 (플래너 덱 탭과 같은 패널)
  const deployedIdentityIds = useMemo(() => new Set(Object.values(slotBySinner).filter(slot => slot?.identity_id && isDeployedSlot(slot.slot_order)).map(slot => slot!.identity_id!)), [slotBySinner])
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
      deck: computeSinProduction([{ skills: skills.filter(skill => skill.identity_id === slot.identity_id), distribution: getIdentitySkillDistribution(slot) }]),
    }]
  }), [identityMap, locale, passives, sinners, skills, slotBySinner, tSinner])

  const deckAnalysis = useMemo(() => {
    const skillsOf = (slot: IdentitySlot) => skills.filter(skill => skill.identity_id === slot.identity_id)
    const egoById = new Map(egos.map(ego => [ego.id, ego]))
    const entries = deck.map(slot => ({
      skills: skillsOf(slot),
      distribution: getIdentitySkillDistribution(slot),
      deployed: isDeployedSlot(slot.slot_order),
      egos: egoSlots.flatMap(ego => ego.sinner_id === slot.sinner_id && ego.ego_id ? [{ cost: egoById.get(ego.ego_id)?.cost }] : []),
    }))
    const resources = computeDeckResources(entries)
    return { resources, sinCounts: resources.production, baseSinCounts: computeSinProduction(fieldedEntries(entries).map(({ skills }) => ({ skills }))) }
  }, [deck, egoSlots, egos, skills])

  const tabs = [
    { key: 'identity' as const, label: tDeck('subTabs.identity'), count: `${deck.length}/12` },
    { key: 'ego' as const, label: tDeck('subTabs.ego'), count: String(egoSlots.length) },
    { key: 'skillset' as const, label: tDeck('subTabs.skillset'), count: null },
  ]

  return (
    <>
      <FormationTabs
        tabs={tabs}
        active={deckSubTab}
        onChange={setDeckSubTab}
        label={tDeck('subTabs.label')}
        hint={deckSubTab === 'identity' && deck.length > 0 ? tDeck('identity.openDetailHint') : null}
      />

      {/* 인격 그리드 */}
      {deckSubTab === 'identity' && (
        <div className="relative">
          <FormationBoard slots={boardSlots} className="mt-2" />
        </div>
      )}

      {deckSubTab === 'identity' && deck.length > 0 && (
        <DeckInsights
          identities={insightIdentities}
          deployedIds={deployedIdentityIds}
          sinCounts={deckAnalysis.sinCounts}
          baseSinCounts={deckAnalysis.baseSinCounts}
          summary={<DeckResourceSummary resources={deckAnalysis.resources} />}
        />
      )}

      {/* EGO 그리드 */}
      {deckSubTab === 'ego' && (
        deck.length > 0 ? (
          <FormationEgoGrid
            sinners={sinners.map(sinner => ({ id: sinner.id, name: tSinner(sinner.id as Parameters<typeof tSinner>[0]), filled: Boolean(slotBySinner[sinner.id]) }))}
            egos={formationEgos}
            onEgoClick={setEgoModalId}
            noIdentityLabel={tDeck('ego.noIdentity')}
          />
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
      {selectedSlot && identityModalId && (
        <IdentityDetailModal
          identityId={identityModalId}
          uptie={selectedSlot.uptie}
          egos={selectedPreviewEgos}
          onEgoClick={setEgoModalId}
          onClose={() => setIdentityModalId(null)}
        />
      )}
      {egoModalId && (
        <EgoDetailModal egoId={egoModalId} onClose={() => setEgoModalId(null)} />
      )}
    </>
  )
}
