'use client'

import { getEgoGradeBannerUrl } from '@/lib/utils/images'

import { useMemo, useState, useCallback } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { X, Users, Sparkles, SlidersHorizontal } from 'lucide-react'
import BaseModal from '@/components/ui/BaseModal'

const IdentityDetailModal = dynamic(() => import('@/features/catalog/components/IdentityDetailModal'), { ssr: false })
import type { RunState, RunAction } from '@/features/planner/lib/run-types'
import { getIdentitySkillDistribution, type IdentityData, type SinnerData, type SkillSummary, type EgoData, type PassiveData, type GiftData } from '@/lib/planner/types'
import DeckStatsPanel from '@/features/planner/components/DeckStatsPanel'
import KeywordChart from '@/features/planner/components/KeywordChart'
import { computeKeywordDistribution } from '@/lib/planner/fusion'
import { getIdentityGiftConditionKeywords } from '@/lib/planner/gift-condition-status'
import { rowsAtUptie } from '@/features/decks'
import { PlannerIdentityBoard, PlannerIdentitySelectModal } from '@/features/planner/components/PlannerDeckSelection'
import SkillExchangePanel, { type SkillExchangeSkill } from '@/features/planner/components/SkillExchangePanel'
import { localizeIdentityName } from '@/features/decks/components/DeckIdentityCard'
import { getIdentityImageUrl, getSinnerLogoUrl, getSkillIconUrl } from '@/lib/utils/images'
import { GRADE_COLORS, isDeployedSlot } from '@/lib/constants/game'
import { SIN_COLORS, SIN_KR_TO_EN, getSinIconUrl, normalizeSin } from '@/lib/constants/sin'
import { toggleFormationSlot } from '@/features/planner/lib/formation-toggle'
import { gameTextToPlain } from '@/lib/game-text/rich-text'

type DeckSubTab = 'identity' | 'ego' | 'skillset'
const GRADE_ORDER = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH']

const SUB_TABS: { key: DeckSubTab; icon: typeof Users }[] = [
  { key: 'identity', icon: Users },
  { key: 'ego', icon: Sparkles },
  { key: 'skillset', icon: SlidersHorizontal },
]

interface Props {
  state: RunState
  dispatch: React.Dispatch<RunAction>
  identities: IdentityData[]
  sinners: SinnerData[]
  skills: SkillSummary[]
  passives: PassiveData[]
  egos: EgoData[]
  giftMap?: Map<number, GiftData>
}

export default function DeckSection({ state, dispatch, identities, sinners, skills: allSkills, passives: allPassives, egos, giftMap }: Props) {
  // Skills/passives follow each slot's uptie (nearest level the data has).
  const slotUpties = useMemo(() => new Map(state.identitySlots.map(slot => [slot.identity_id, slot.uptie])), [state.identitySlots])
  const skills = useMemo(() => rowsAtUptie(allSkills, slotUpties), [allSkills, slotUpties])
  const passives = useMemo(() => rowsAtUptie(allPassives, slotUpties), [allPassives, slotUpties])
  const t = useTranslations('planner.run')
  const tSinner = useTranslations('sinner')
  const keywordDist = useMemo(() => computeKeywordDistribution(
    state.identitySlots.map(getIdentityGiftConditionKeywords),
    state.identitySlots.map(slot => isDeployedSlot(slot.slot_order)),
  ), [state.identitySlots])
  const locale = useLocale()
  const [subTab, setSubTab] = useState<DeckSubTab>('identity')
  const [swapSinner, setSwapSinner] = useState<string | null>(null)
  const [egoSinner, setEgoSinner] = useState<string | null>(null)
  const [skillDist, setSkillDist] = useState<Record<string, [number, number, number]>>({})
  const [detailIdentityId, setDetailIdentityId] = useState<string | null>(null)

  const handleSkillChange = (sinnerId: string, idx: number, delta: number) => {
    const slot = state.identitySlots.find(item => item.sinner_id === sinnerId)
    if (!slot) return
    const dist = skillDist[sinnerId] ?? getIdentitySkillDistribution(slot)
    const next: [number, number, number] = [dist[0], dist[1], dist[2]]
    const total = next[0] + next[1] + next[2]
    const newVal = next[idx] + delta
    if (newVal < 0 || total + delta > 6) return
    next[idx] = newVal
    if (next[0] + next[1] + next[2] === 6) {
      dispatch({ type: 'SET_SKILL_DISTRIBUTION', sinnerId, distribution: next })
      setSkillDist(prev => { const updated = { ...prev }; delete updated[sinnerId]; return updated })
    } else {
      setSkillDist(prev => ({ ...prev, [sinnerId]: next }))
    }
  }

  const sinnerIdentities = useMemo(() => {
    const map = new Map<string, IdentityData[]>()
    for (const ident of identities) {
      if (!map.has(ident.sinner_id)) map.set(ident.sinner_id, [])
      map.get(ident.sinner_id)!.push(ident)
    }
    for (const [, list] of map) list.sort((a, b) => b.rarity - a.rarity)
    return map
  }, [identities])

  const identityById = useMemo(() => {
    const map = new Map<string, IdentityData>()
    for (const ident of identities) map.set(ident.id, ident)
    return map
  }, [identities])

  // The keywords go with each slot: plain keywords of an identity's passive texts are searched among that identity's own keywords.
  const statSlots = useMemo(
    () => state.identitySlots.map(slot => ({ ...slot, keywords: identityById.get(slot.identity_id)?.keywords })),
    [state.identitySlots, identityById],
  )

  const sinnerEgos = useMemo(() => {
    const map = new Map<string, EgoData[]>()
    for (const ego of egos) {
      if (!map.has(ego.sinner_id)) map.set(ego.sinner_id, [])
      map.get(ego.sinner_id)!.push(ego)
    }
    for (const [, list] of map) list.sort((a, b) => GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade))
    return map
  }, [egos])



  // 편성 슬롯 → 기프트 이미지 매핑 (플래너 디테일 패턴: 효과 텍스트에서 "[편성 N번 전용 효과]" 파싱)
  const slotGiftImages = useMemo(() => {
    if (!giftMap) return new Map<number, string[]>()
    const map = new Map<number, string[]>()
    const invGifts = state.giftInventory.map(id => giftMap.get(Number(id))).filter(Boolean) as GiftData[]
    for (const gift of invGifts) {
      const txt = gift.effect_base ?? ''
      // Game text may put colour tags (digits and all) inside the bracket label; read the text as shown.
      const m = gameTextToPlain(txt).match(/\[편성[^\]]*전용\s*효과\]|\[\d[^\]]*편성\s*전용\s*효과\]/)
      if (!m || !gift.image_url) continue
      const slots = [...m[0].matchAll(/(\d+)/g)].map(r => parseInt(r[1]))
      for (const s of slots) {
        if (!map.has(s)) map.set(s, [])
        map.get(s)!.push(gift.image_url)
      }
    }
    return map
  }, [giftMap, state.giftInventory])

  const getSelected = useCallback(
    (sinnerId: string) => state.identitySlots.find(s => s.sinner_id === sinnerId),
    [state.identitySlots]
  )

  const getInfoImageUrl = useCallback((ident: IdentityData) => {
    if (!ident.game_id || !ident.folder_name) return ''
    return getIdentityImageUrl(ident.sinner_id, ident.folder_name, `${ident.game_id}_normal_info`)
  }, [])

  const handleSelect = (ident: IdentityData, uptie: number) => {
    const previous = getSelected(ident.sinner_id)
    const sameIdentity = previous?.identity_id === ident.id
    if (!sameIdentity) setSkillDist(prev => { const next = { ...prev }; delete next[ident.sinner_id]; return next })
    dispatch({
      type: 'SWAP_IDENTITY', sinnerId: ident.sinner_id,
      newSlot: {
        identity_id: ident.id, sinner_id: ident.sinner_id, name_kr: ident.name_kr,
        rarity: ident.rarity, keywords: ident.keywords ?? [],
        game_id: ident.game_id, folder_name: ident.folder_name,
        slot_order: previous?.slot_order ?? 99,
        ...(sameIdentity ? { s1_count: previous.s1_count, s2_count: previous.s2_count, s3_count: previous.s3_count } : {}),
        ...(uptie === 4 ? {} : { uptie }),
      },
    })
    setSwapSinner(null)
  }

  const handleToggleFormation = (sinnerId: string) => {
    if (!getSelected(sinnerId)) return
    // 편성→벤치면 뒤 번호가 당겨지고, 벤치→편성이면 다음 번호를 받는다
    const updated = toggleFormationSlot(state.identitySlots, sinnerId)
    const toggled = updated.find(item => item.sinner_id === sinnerId)!
    for (const item of [toggled, ...updated.filter((item, index) => item !== toggled && item !== state.identitySlots[index])]) {
      dispatch({ type: 'SWAP_IDENTITY', sinnerId: item.sinner_id, newSlot: item })
    }
  }

  const handleSelectEgo = (ego: EgoData) => {
    dispatch({
      type: 'SWAP_EGO', sinnerId: ego.sinner_id,
      newEgo: { ego_id: ego.id, sinner_id: ego.sinner_id, name_kr: ego.name_kr, grade: ego.grade, sin_affinity: ego.sin_affinity },
    })
    setEgoSinner(null)
  }

  return (
    <div>
      {/* 서브탭 */}
      <div className="flex gap-1 mb-4" style={{ borderBottom: '1px solid var(--bg-card)', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
        {SUB_TABS.map(tab => {
          const active = subTab === tab.key
          const Icon = tab.icon
          return (
            <button key={tab.key} onClick={() => setSubTab(tab.key)} className="flex items-center gap-1 transition shrink-0"
              style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', fontWeight: active ? 700 : 400, color: active ? 'var(--text-primary)' : '#555', borderBottom: `2px solid ${active ? 'var(--gold)' : 'transparent'}`, minHeight: '2.75rem' }}>
              <Icon style={{ width: '0.75rem', height: '0.75rem' }} /> {t(`deckTab_${tab.key}`)}
            </button>
          )
        })}
        <span className="ml-auto shrink-0" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', padding: '0.5rem 0.25rem' }}>
          {state.identitySlots.length}/12
        </span>
      </div>

      {/* ── 인격 탭 ── */}
      {subTab === 'identity' && (<>
        <PlannerIdentityBoard
          sinners={sinners}
          slots={Object.fromEntries(sinners.map(sinner => {
            const slot = getSelected(sinner.id)
            const identity = slot ? identityById.get(slot.identity_id) ?? null : null
            return [sinner.id, {
              sinnerId: sinner.id,
              identity,
              slotOrder: slot?.slot_order ?? null,
              uptie: slot?.uptie,
              giftBadgeUrls: slot && slot.slot_order < 99 ? slotGiftImages.get(slot.slot_order + 1) : undefined,
            }]
          }))}
          onOpenIdentityModal={setSwapSinner}
          onFormationToggle={handleToggleFormation}
          onLongPress={sinnerId => { const slot = getSelected(sinnerId); if (slot) setDetailIdentityId(slot.identity_id) }}
        />

        {keywordDist.length > 0 && (
          <section aria-labelledby="run-keyword-distribution" className="mt-5">
            <h3 id="run-keyword-distribution" className="mb-2 font-[family-name:var(--font-heading)] text-sm text-[var(--gold)]">{t('keywordDistribution')}</h3>
            <KeywordChart distribution={keywordDist} />
          </section>
        )}

        {/* 공격 유형 + 죄악 자원 + 패시브 */}
        {state.identitySlots.length > 0 && (() => {
          const selectedEgoIds = new Set(state.egoSlots.map(e => e.ego_id).filter(Boolean))
          const selectedEgoData = egos.filter(e => selectedEgoIds.has(e.id))
          const selectedEgoCosts = selectedEgoData.map(e => ({ cost: e.cost }))
          const selectedEgoSins = selectedEgoData.map(e => e.sin_affinity).filter(Boolean) as string[]
          return (
            <DeckStatsPanel
              identitySlots={statSlots}
              skills={skills}
              passives={passives}
              sinners={sinners}
              egoCosts={selectedEgoCosts}
              egoSinAffinities={selectedEgoSins}
            />
          )
        })()}
      </>)}

      {/* ── EGO 탭 ── */}
      {subTab === 'ego' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-3 gap-y-3" style={{ position: 'relative', zIndex: 0 }}>
          {sinners.map(sinner => {
            const slot = getSelected(sinner.id)
            const selectedEgos = state.egoSlots.filter(e => e.sinner_id === sinner.id)
            const egoByGrade: Record<string, typeof state.egoSlots[0]> = {}
            for (const e of selectedEgos) egoByGrade[e.grade] = e

            return (
              <button type="button" key={sinner.id}
                onClick={() => { if (slot) setEgoSinner(sinner.id) }}
                disabled={!slot}
                className="text-left border-0 p-0 w-full"
                style={{
                  background: 'linear-gradient(160deg, var(--bg-card) 0%, #100d08 100%)',
                  border: `1px solid ${slot ? '#221a0f' : '#18120a'}`,
                  borderRadius: '0.25rem', overflow: 'hidden',
                  opacity: slot ? 1 : 0.4, cursor: slot ? 'pointer' : 'default',
                }}
              >
                <div className="flex items-center gap-1" style={{ padding: '0.375rem 0.5rem', borderBottom: '1px solid #1a1208' }}>
                  <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={14} height={14} style={{ width: '0.875rem', height: 'auto', opacity: 0.5 }} />
                  <span className="font-serif truncate" style={{ color: slot ? '#8a7a60' : '#3a2a10', fontSize: '0.5625rem' }}>{sinner.name_kr}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem', padding: '0.125rem' }}>
                  {GRADE_ORDER.map(grade => {
                    const ego = egoByGrade[grade]
                    const gc = GRADE_COLORS[grade] ?? '#555'
                    const sinEn = ego?.sin_affinity ? (SIN_KR_TO_EN[ego.sin_affinity] ?? ego.sin_affinity) : null
                    const ec = sinEn ? (SIN_COLORS[sinEn as keyof typeof SIN_COLORS] ?? gc) : gc
                    return (
                      <div key={grade} style={{
                        background: ego ? `${ec}1a` : 'rgba(10,8,5,0.7)',
                        border: `1px solid ${ego ? ec + '55' : '#18120a'}`,
                        borderRadius: '0.125rem', padding: '0.25rem 0.3125rem',
                        display: 'flex', alignItems: 'center', gap: '0.3125rem',
                        minHeight: '1.5rem',
                      }}>
                        {grade !== 'ALEPH' ? (
                          <Image src={getEgoGradeBannerUrl(grade)} alt={grade} width={22} height={11} unoptimized
                            style={{ height: '0.6875rem', width: 'auto', opacity: ego ? 0.9 : 0.3, flexShrink: 0 }} />
                        ) : (
                          <span style={{ color: gc, fontSize: '0.375rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', opacity: ego ? 0.9 : 0.3, flexShrink: 0 }}>ALEPH</span>
                        )}
                        {ego ? (
                          <span style={{ color: gc, fontSize: '0.5rem', fontWeight: 700, lineHeight: 1.2, flex: 1, textAlign: 'left' }}>{ego.name_kr ?? ''}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.5rem' }}>{slot ? '—' : ''}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* ── 스킬셋 탭 (DeckTab 패턴: 미니 카드 + S1/S2/S3 개수 조절) ── */}
      {subTab === 'skillset' && (
        <div>
          {state.identitySlots.length === 0 ? (
            <div className="text-center" style={{ padding: '3rem 1rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
              {t('chooseIdentityFirst')}
            </div>
          ) : (
            <div className="skill-exchange-list">
              {sinners.map(sinner => {
                const slot = getSelected(sinner.id)
                if (!slot) return null
                const identData = identityById.get(slot.identity_id)
                const dist = skillDist[sinner.id] ?? getIdentitySkillDistribution(slot)
                const total = dist[0] + dist[1] + dist[2]
                return (
                  <SkillExchangePanel
                    key={sinner.id}
                    identity={{
                      imageUrl: identData ? getInfoImageUrl(identData) : null,
                      name: identData ? localizeIdentityName(identData, locale) : slot.name_kr,
                      sinnerName: tSinner(sinner.id as Parameters<typeof tSinner>[0]),
                    }}
                    distribution={dist}
                    skills={[1, 2, 3].map(order => {
                      const best = skills
                        .filter(skill => skill.identity_id === slot.identity_id && skill.skill_order === order)
                        .sort((a, b) => (b.uptie_level ?? 0) - (a.uptie_level ?? 0))[0]
                      const sin = normalizeSin(best?.sin_affinity ?? null)
                      return {
                        name: best?.name ?? null,
                        iconSrc: identData?.game_id ? getSkillIconUrl({ game_id: identData.game_id, sinner_id: identData.sinner_id }, order) : null,
                        sinColor: sin ? SIN_COLORS[sin] : null,
                      }
                    }) as [SkillExchangeSkill, SkillExchangeSkill, SkillExchangeSkill]}
                    canIncrease={() => total < 6}
                    onAdjust={(idx, delta) => handleSkillChange(sinner.id, idx, delta)}
                    onPresetSelect={preset => {
                      dispatch({ type: 'SET_SKILL_DISTRIBUTION', sinnerId: sinner.id, distribution: preset })
                      setSkillDist(prev => { const next = { ...prev }; delete next[sinner.id]; return next })
                    }}
                  />
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 인격 선택 모달 ── */}
      <PlannerIdentitySelectModal
        open={!!swapSinner}
        sinner={swapSinner ? sinners.find(s => s.id === swapSinner) ?? null : null}
        identities={swapSinner ? sinnerIdentities.get(swapSinner) ?? [] : []}
        selectedIdentityId={swapSinner ? getSelected(swapSinner)?.identity_id ?? null : null}
        selectedUptie={swapSinner ? getSelected(swapSinner)?.uptie ?? 4 : 4}
        onClose={() => setSwapSinner(null)}
        onSelect={(identity, uptie) => handleSelect(identity as IdentityData, uptie)}
      />

      {/* ── EGO 선택 모달 (DeckTab 패턴: 등급별 섹션 + 이미지) ── */}
      <BaseModal open={!!egoSinner} onClose={() => setEgoSinner(null)} maxWidth="42rem" padding="env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)" title={t('chooseEgo')}>
        {egoSinner && (() => {
          const modalSinnerEgo = sinners.find(s => s.id === egoSinner)
          const availableEgos = sinnerEgos.get(egoSinner) ?? []
          const selectedEgos = state.egoSlots.filter(e => e.sinner_id === egoSinner)
          const egoByGrade: Record<string, typeof state.egoSlots[0]> = {}
          for (const e of selectedEgos) egoByGrade[e.grade] = e

          return (
          <div className="relative w-full" style={{ background: 'var(--bg-card)', border: '1px solid #333', borderRadius: '0.5rem', maxHeight: '85vh', overflowY: 'auto', scrollbarGutter: 'stable', boxShadow: '0 1rem 3rem rgba(0,0,0,0.8)' }}>
            {/* 헤더 */}
            <div className="flex items-center justify-between sticky top-0 z-10" style={{ padding: '1rem 1.25rem', background: 'var(--bg-card)', borderBottom: '1px solid #222' }}>
              <div className="flex items-center gap-2 min-w-0">
                {modalSinnerEgo && <Image src={getSinnerLogoUrl(modalSinnerEgo.id)} alt="" width={20} height={20} style={{ width: '1.25rem', height: '1.25rem', opacity: 0.7, flexShrink: 0 }} />}
                <span className="font-serif truncate" style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>{modalSinnerEgo?.name_kr} — {t('chooseEgo')}</span>
              </div>
              <button onClick={() => setEgoSinner(null)} className="shrink-0 flex items-center justify-center" style={{ color: 'var(--text-muted)', cursor: 'pointer', minWidth: '2.75rem', minHeight: '2.75rem' }}><X style={{ width: '1.25rem', height: '1.25rem' }} /></button>
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
                        <Image src={getEgoGradeBannerUrl(grade)} alt={grade} width={22} height={11} unoptimized style={{ height: '0.75rem', width: 'auto' }} />
                      ) : (
                        <span style={{ color: gc, fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>ALEPH</span>
                      )}
                      <div style={{ flex: 1, height: '1px', background: gc + '30' }} />
                      {selectedForGrade && (
                        <button onClick={() => dispatch({ type: 'REMOVE_EGO', egoId: selectedForGrade.ego_id })}
                          style={{ color: 'var(--error-text)', fontSize: '0.625rem', cursor: 'pointer', padding: '0.125rem 0.375rem', border: '1px solid #3a1515', borderRadius: '0.25rem', background: 'rgba(200,48,64,0.08)' }}>
                          {t('clearSelection')}
                        </button>
                      )}
                    </div>

                    {gradeEgos.length === 0 ? (
                      <div style={{ padding: '0.625rem', background: 'rgba(10,8,5,0.5)', borderRadius: '0.25rem', border: `1px solid ${gc}15`, textAlign: 'center' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.6875rem' }}>{t('noEgoGrade')}</span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4" style={{ gap: '0.5rem' }}>
                        {gradeEgos.map(ego => {
                          const isSelected = selectedForGrade?.ego_id === ego.id
                          const egoSinEn = ego.sin_affinity ? (SIN_KR_TO_EN[ego.sin_affinity] ?? ego.sin_affinity) : null
                          const egoSc = egoSinEn ? (SIN_COLORS[egoSinEn as keyof typeof SIN_COLORS] ?? gc) : gc
                          return (
                            <button key={ego.id} onClick={() => handleSelectEgo(ego)} className="text-left transition" style={{
                              background: isSelected ? `linear-gradient(160deg, ${egoSc}22 0%, ${egoSc}0d 100%)` : 'linear-gradient(160deg, #1e1810 0%, #120e08 100%)',
                              border: `1px solid ${isSelected ? egoSc + 'aa' : egoSc + '20'}`,
                              borderRadius: '0.375rem', overflow: 'hidden', cursor: 'pointer',
                              boxShadow: isSelected ? `0 0 0.625rem ${egoSc}44` : 'none',
                            }}>
                              {/* EGO 이미지 */}
                              {ego.image_url?.startsWith('http') && (
                                <div className="relative w-full" style={{ aspectRatio: '1/1', overflow: 'hidden', background: 'var(--bg-deep)' }}>
                                  <Image src={ego.image_url} alt={ego.name_kr} fill className="object-contain" sizes="(max-width:640px) 50vw, 25vw" />
                                </div>
                              )}
                              {/* EGO 정보 */}
                              <div style={{ padding: '0.375rem 0.5rem 0.5rem' }}>
                                <p className="font-serif truncate" style={{ color: isSelected ? 'var(--text-primary)' : '#b0a898', fontSize: '0.625rem', lineHeight: 1.3 }}>
                                  {ego.name_kr}
                                </p>
                                <div className="flex items-center gap-1" style={{ marginTop: '0.25rem' }}>
                                  {normalizeSin(ego.sin_affinity) && (
                                    <Image src={getSinIconUrl(normalizeSin(ego.sin_affinity)!)}
                                      alt={ego.sin_affinity ?? ''} width={14} height={14} style={{ width: '0.875rem', height: '0.875rem' }} />
                                  )}
                                  <span style={{ color: gc, fontSize: '0.5rem', fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.05em' }}>{grade}</span>
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          )
        })()}
      </BaseModal>

      {/* 인격 상세 모달 (꾹 눌러서 열림) */}
      {detailIdentityId && (
        <IdentityDetailModal identityId={detailIdentityId} uptie={state.identitySlots.find(item => item.identity_id === detailIdentityId)?.uptie} onClose={() => setDetailIdentityId(null)} />
      )}
    </div>
  )
}
