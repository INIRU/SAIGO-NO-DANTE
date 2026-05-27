'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import DeckStatsPanel from '@/components/planner/DeckStatsPanel'
import FormationBoard, { type FormationBoardSlot } from '@/components/decks/FormationBoard'
import { localizeIdentityName } from '@/components/deck-detail/DeckIdentityCard'
import type {
  EgoEntry,
  IdentitySlot as DeckIdentityPreviewSlot,
  PassiveDetail,
  SkillDetail,
} from '@/components/deck-detail/DeckIdentityCard'
import type { Identity } from '@/lib/types'
import { getIdentityImageUrl, getSinnerLogoUrl, getSkillIconUrl } from '@/lib/utils/images'
import { STORAGE_BASE, RARITY_COLORS, GRADE_COLORS } from '@/lib/constants/game'
import { SIN_COLORS, SIN_KR_TO_EN } from '@/lib/constants/sin'
import { getIdentitySkillDistribution } from '@/lib/planner/types'
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
    <div style={{
      background: '#1a1510', border: '1px solid #1a1510', borderRadius: '0.5rem',
      padding: '1rem', textAlign: 'center', fontSize: '0.75rem', color: '#333',
    }}>{text}</div>
  )
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
    gacksung: slot.gacksung ?? false,
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
  skills,
  passives,
  slotGiftMap,
}: Props) {
  const locale = useLocale()
  const tDeck = useTranslations('planner.deckTab')
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
        slotOrder: slot?.slot_order ?? null,
        giftBadgeUrls: slot?.slot_order != null && slot.slot_order < 99
          ? (slotGiftMap.get(slot.slot_order + 1) ?? [])
          : [],
        ariaLabel: identityName ? `${index + 1}. ${identityName}` : `${index + 1}. ${sinner.name_kr}`,
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

  const tabs = [
    { key: 'identity' as const, label: `${tDeck('subTabs.identity')} (${deck.length}/12)`, hint: tDeck('identity.openDetailHint') },
    { key: 'ego' as const, label: `${tDeck('subTabs.ego')} (${egoSlots.length})` },
    { key: 'skillset' as const, label: tDeck('subTabs.skillset') },
  ]

  return (
    <>
      {/* 서브탭 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center',
        borderBottom: '1px solid #222', marginBottom: '0.75rem',
        overflowX: 'auto', WebkitOverflowScrolling: 'touch',
      }}>
        {tabs.map(tab => {
          const active = deckSubTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setDeckSubTab(tab.key)}
              style={{
                padding: '0.5rem 0.625rem', fontSize: '0.8125rem',
                fontWeight: active ? 700 : 400, whiteSpace: 'nowrap',
                color: active ? '#e8dcc8' : '#555', cursor: 'pointer',
                background: active ? 'rgba(200,144,10,0.05)' : 'transparent',
                border: 'none',
                borderBottom: `2px solid ${active ? '#c8900a' : 'transparent'}`,
                marginBottom: '-1px',
              }}
            >
              {tab.label}
              {'hint' in tab && active && (
                <span style={{ fontSize: '0.5625rem', color: '#5a5065', marginLeft: '0.375rem', fontWeight: 400 }}>
                  {tab.hint}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* 인격 그리드 */}
      {deckSubTab === 'identity' && (
        <div className="relative">
          <FormationBoard slots={boardSlots} className="mt-5" />
        </div>
      )}

      {/* 공격 유형 + 죄악 자원 + 패시브 */}
      {deckSubTab === 'identity' && deck.length > 0 && (() => {
        const selectedEgoIds = new Set(egoSlots.map(e => e.ego_id).filter(Boolean))
        const selectedEgoData = egos.filter(e => selectedEgoIds.has(e.id))
        const selectedEgoCosts = selectedEgoData.map(e => ({ cost: e.cost }))
        const selectedEgoSins = selectedEgoData.map(e => e.sin_affinity).filter(Boolean) as string[]
        return (
          <DeckStatsPanel
            identitySlots={deck}
            skills={skills}
            passives={passives}
            sinners={sinners}
            egoCosts={selectedEgoCosts}
            egoSinAffinities={selectedEgoSins}
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
                        <div
                          key={grade}
                          onClick={() => ego?.ego_id && setEgoModalId(ego.ego_id)}
                          style={{
                            background: ego ? `${ec}1a` : 'rgba(10,8,5,0.7)',
                            border: `1px solid ${ego ? ec + '55' : '#18120a'}`,
                            borderRadius: '0.125rem', padding: '0.25rem 0.3125rem',
                            display: 'flex', alignItems: 'center', gap: '0.3125rem',
                            minHeight: '1.5rem',
                            cursor: ego?.ego_id ? 'pointer' : 'default',
                          }}
                        >
                          {grade !== 'ALEPH' ? (
                            <Image
                              src={`${S}/icons/grade/${grade}.webp`} alt={grade} width={22} height={11} unoptimized
                              style={{ height: '0.6875rem', width: 'auto', opacity: ego ? 0.9 : 0.3, flexShrink: 0 }}
                            />
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
          <EmptyState text={tDeck('skillset.selectIdentityFirst')} />
        )
      )}

      {/* 스킬 교환 */}
      {deckSubTab === 'skillset' && (
        deck.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-6">
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
                <div
                  key={sinner.id}
                  onClick={() => slot.identity_id && setIdentityModalId(slot.identity_id)}
                  style={{ cursor: slot.identity_id ? 'pointer' : 'default' }}
                >
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
