'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { Settings } from 'lucide-react'
import { computeSkillDiffs, computePassiveDiffs } from '@/lib/utils/uptie-diff'
import {
  Sinner,
  Identity,
  Skill,
  Passive,
  EGO,
  SIN_COLORS,
  SIN_KR_TO_EN,
  SKILL_TYPE_LABELS,
  getIdentitySinColor,
  getIdentityProfileUrl,
  getIdentityInfoUrl,
  getSkillIconUrl,
  computeSkillImageIndices,
  getSinIconUrl,
} from '@/lib/data/sinners'
import { type NoteSkillEntry, type NoteEgoEntry, type NoteIdentityEntry, type NoteEgoGiftEntry, type NotePassiveEntry } from '@/components/decks/NoteChips'
import { buildKeywordPool, buildEgoGiftPool, type AutocompleteSuggestion } from '@/components/notes/NoteAutocomplete'
import IdentityDecksTab from '@/components/sinners/IdentityDecksTab'
import IdentityPortraitSection from '@/components/identity/IdentityPortraitSection'
import IdentityInfoCard from '@/components/identity/IdentityInfoCard'
import IdentityStatsCard from '@/components/identity/IdentityStatsCard'
import IdentityGuideSection, { type GuideData } from '@/components/identity/IdentityGuideSection'
import IdentitySkillsTab from '@/components/identity/IdentitySkillsTab'
import IdentityPassivesTab from '@/components/identity/IdentityPassivesTab'
import IdentitySanitySection from '@/components/identity/IdentitySanitySection'
import type { SanityCondition, PanicType } from '@/lib/types'
import IdentityReviewSection from '@/components/identity/IdentityReviewSection'
import IdentityAISection from '@/components/identity/IdentityAISection'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { useLanguage } from '@/lib/i18n'
import { getLocalizedName } from '@/lib/i18n/localize'

interface Props {
  sinner: Sinner
  identity: Identity
  skills: Skill[]
  passives: Passive[]
  guides?: GuideData[]
  allSinners: Sinner[]
  allIdentities: Identity[]
  allEgos: EGO[]
  egoGifts?: { name: string; keyword: string; grade: string; image_url: string | null; effect_base: string | null }[]
  sanityConditions?: SanityCondition[]
  panicInfo?: PanicType | null
  canEditGuide?: boolean
  isAdmin?: boolean
  isLoggedIn?: boolean
  currentSeason?: number
}

export default function IdentityDetailClient({
  sinner,
  identity,
  skills,
  passives,
  guides: initialGuides,
  allSinners,
  allIdentities,
  allEgos,
  egoGifts = [],
  sanityConditions = [],
  panicInfo,
  canEditGuide,
  isAdmin,
  isLoggedIn,
  currentSeason = 7,
}: Props) {
  const [gacksung, setGacksung] = useState(false)
  const [showFullArt, setShowFullArt] = useState(false)
  const [showArtTip, setShowArtTip] = useState(false)
  const [pageTab, setPageTab] = useState<'info' | 'decks'>('info')
  const [activeTab, setActiveTab] = useState<'skills' | 'passives'>('skills')
  const [uptieLevel, setUptieLevel] = useState<3 | 4>(4)
  const [showDiff, setShowDiff] = useState(true)
  useEffect(() => {
    if (window.location.hash === '#decks') setPageTab('decks')
  }, [])
  useEffect(() => {
    setShowDiff(localStorage.getItem('uptie-diff') !== 'off')
  }, [])
  const { lang, t } = useLanguage()
  const localSkillName = (s: Skill) =>
    lang === 'en' && s.name_en ? s.name_en : lang === 'ja' && s.name_jp ? s.name_jp : s.name
  const localPassiveName = (p: Passive) =>
    lang === 'en' && p.name_en ? p.name_en : lang === 'ja' && p.name_jp ? p.name_jp : p.name
  const localSkillDesc = (s: Skill) =>
    lang === 'en' && s.description_en ? s.description_en : lang === 'ja' && s.description_jp ? s.description_jp : s.description
  const localPassiveDesc = (p: Passive) =>
    lang === 'en' && p.description_en ? p.description_en : lang === 'ja' && p.description_jp ? p.description_jp : p.description
  const { sinMap: kwSinMap, keywords: kwContext } = useKeywordData()
  const sinColor = getIdentitySinColor(identity, kwSinMap)
  const rarityNum = identity.rarity
  const [guideTab, setGuideTab] = useState<'guide' | 'ai'>('ai')

  // 이 인격의 키워드만 허용 (화력/리듬 등 일반 단어가 키워드로 매칭되는 것 방지)
  // 스킬 설명의 [대괄호] 키워드는 formatSkillDescInner의 bracket 패턴이 별도 처리
  const allowedKeywords = useMemo(() => {
    return new Set<string>(identity.keywords || [])
  }, [identity.keywords])

  // 뒤로가기/앞으로가기 시 탭 상태 동기화
  useEffect(() => {
    const onPopState = () => {
      setPageTab(window.location.hash === '#decks' ? 'decks' : 'info')
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])


  // 풀 일러스트 클릭 안내 (첫 방문 시만)
  useEffect(() => {
    if (localStorage.getItem('art-tip-seen')) return
    const timer = setTimeout(() => setShowArtTip(true), 1500)
    return () => clearTimeout(timer)
  }, [])

  // 동기화 단계 필터링
  const hasUptieData = useMemo(() =>
    skills.some(s => (s.uptie_level ?? 3) === 4) || passives.some(p => (p.uptie_level ?? 3) === 4),
    [skills, passives]
  )
  const filteredSkills = useMemo(() => {
    const filtered = skills.filter(s => (s.uptie_level ?? 3) === uptieLevel)
    const result = filtered.length > 0 ? filtered : skills.filter(s => (s.uptie_level ?? 3) === 3)
    return result.sort((a, b) => {
      const base = (s: typeof a) => {
        const bo = s.skill_order >= 5 ? 3 : s.skill_order
        return bo === 4 ? 99 : bo
      }
      return base(a) - base(b)
    })
  }, [skills, uptieLevel])
  const filteredPassives = useMemo(() => {
    const filtered = passives.filter(p => (p.uptie_level ?? 3) === uptieLevel)
    return filtered.length > 0 ? filtered : passives.filter(p => (p.uptie_level ?? 3) === 3)
  }, [passives, uptieLevel])

  // 동기화 비교 데이터
  const level3Skills = useMemo(() =>
    skills.filter(s => (s.uptie_level ?? 3) === 3), [skills])
  const level4Skills = useMemo(() =>
    skills.filter(s => (s.uptie_level ?? 3) === 4), [skills])
  const level3Passives = useMemo(() =>
    passives.filter(p => (p.uptie_level ?? 3) === 3), [passives])
  const level4Passives = useMemo(() =>
    passives.filter(p => (p.uptie_level ?? 3) === 4), [passives])

  const skillDiffResult = useMemo(() => {
    if (uptieLevel !== 3 || !showDiff || !hasUptieData) return null
    return computeSkillDiffs(level3Skills, level4Skills)
  }, [uptieLevel, showDiff, hasUptieData, level3Skills, level4Skills])

  const passiveDiffResult = useMemo(() => {
    if (uptieLevel !== 3 || !showDiff || !hasUptieData) return null
    return computePassiveDiffs(level3Passives, level4Passives)
  }, [uptieLevel, showDiff, hasUptieData, level3Passives, level4Passives])

  // 변형 스킬 맵
  const variantMap = useMemo(() => {
    const groups = new Map<number, string[]>()
    for (const s of filteredSkills) {
      const base = s.skill_order >= 5 ? 3 : s.skill_order
      if (!groups.has(base)) groups.set(base, [])
      groups.get(base)!.push(s.id)
    }
    const map: Record<string, { baseOrder: number; idx: number; total: number }> = {}
    for (const [base, ids] of groups) {
      ids.forEach((id, i) => {
        map[id] = { baseOrder: base, idx: i + 1, total: ids.length }
      })
    }
    return map
  }, [filteredSkills])

  // 스킬 이미지 인덱스 맵
  const skillImgIdxMap = useMemo(() => computeSkillImageIndices(filteredSkills), [filteredSkills])

  // 스킬 이름 → 죄악 속성 색상 맵
  const skillNameColors = useMemo(() => {
    const colors: Record<string, string> = {}
    for (const s of filteredSkills) {
      colors[s.name] = SIN_COLORS[s.sin_affinity] || '#cccccc'
    }
    return colors
  }, [filteredSkills])

  // sinner_id → name_kr 매핑
  const sinnerNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const s of allSinners) map[s.id] = s.name_kr
    return map
  }, [allSinners])

  // sinner_id → name_en / name_jp 매핑 (chip token EN/JP 룩업용)
  const sinnerNameMapEn = useMemo(() => {
    const map: Record<string, string> = {}
    for (const s of allSinners) {
      if (s.name_en) map[s.id] = s.name_en
    }
    return map
  }, [allSinners])

  const sinnerNameMapJp = useMemo(() => {
    const map: Record<string, string> = {}
    for (const s of allSinners) {
      if (s.name_jp) map[s.id] = s.name_jp
    }
    return map
  }, [allSinners])

  // 토큰 룩업 맵들 (NoteRenderer / 자동완성용)
  const skillTokenLookup = useMemo(() => {
    const map: Record<string, NoteSkillEntry> = {}
    for (const sk of filteredSkills) {
      const v = variantMap[sk.id]
      const base = v?.baseOrder ?? (sk.skill_order >= 5 ? 3 : sk.skill_order)
      const key = v && v.total > 1
        ? `${sinner.name_kr}:${base}:${v.idx}`
        : `${sinner.name_kr}:${base}`
      map[key] = {
        name: localSkillName(sk), skill_type: sk.skill_type, sin_affinity: sk.sin_affinity as string,
        skill_order: sk.skill_order, description: localSkillDesc(sk),
        iconUrl: getSkillIconUrl(identity, skillImgIdxMap[sk.id] ?? sk.skill_order),
        iconFallbackUrl: (skillImgIdxMap[sk.id] ?? sk.skill_order) >= 5 ? getSkillIconUrl(identity, 3) : undefined,
        identityName: getLocalizedName(identity, lang), sinnerName: getLocalizedName({ name_kr: sinner.name_kr, name_en: sinner.name, name_jp: sinner.name_jp }, lang),
      }
      // EN key alias
      if (sinner.name_en) {
        const enKey = v && v.total > 1
          ? `${sinner.name_en}:${base}:${v.idx}`
          : `${sinner.name_en}:${base}`
        map[enKey] = map[key]
      }
      // JP key alias
      if (sinner.name_jp) {
        const jpKey = v && v.total > 1
          ? `${sinner.name_jp}:${base}:${v.idx}`
          : `${sinner.name_jp}:${base}`
        map[jpKey] = map[key]
      }
    }
    return map
  }, [filteredSkills, sinner.name_kr, sinner.name, sinner.name_en, sinner.name_jp, identity, skillImgIdxMap, variantMap, lang])

  const egoTokenLookup = useMemo(() => {
    const map: Record<string, NoteEgoEntry> = {}
    for (const ego of allEgos) {
      const nameKr = ego.name_kr || ego.name
      const localizedName = lang === 'en' ? (ego.name_en || nameKr) : lang === 'ja' ? (ego.name_jp || nameKr) : nameKr
      const sinnerKr = sinnerNameMap[ego.sinner_id] ?? sinner.name_kr
      const sinnerEn = sinnerNameMapEn[ego.sinner_id]
      const sinnerJp = sinnerNameMapJp[ego.sinner_id]
      const sinnerName = lang === 'en' ? (sinnerEn || sinnerKr) : lang === 'ja' ? (sinnerJp || sinnerKr) : sinnerKr
      const entry: NoteEgoEntry = {
        name: localizedName, grade: ego.grade, sin_affinity: ego.sin_affinity,
        image_url: ego.image_url, sinnerName,
      }
      // KR key (primary — AI writes Korean names)
      map[`${sinnerKr}:${nameKr}`] = entry
      // EN key alias
      if (sinnerEn) map[`${sinnerEn}:${nameKr}`] = entry
      if (sinnerEn && ego.name_en) map[`${sinnerEn}:${ego.name_en}`] = entry
      // JP key alias
      if (sinnerJp) map[`${sinnerJp}:${nameKr}`] = entry
      if (sinnerJp && ego.name_jp) map[`${sinnerJp}:${ego.name_jp}`] = entry
    }
    return map
  }, [allEgos, sinnerNameMap, sinnerNameMapEn, sinnerNameMapJp, sinner.name_kr, sinner.name, sinner.name_jp, lang])

  const identityTokenLookup = useMemo(() => {
    const map: Record<string, NoteIdentityEntry> = {}
    for (const ident of allIdentities) {
      const sinnerKr = sinnerNameMap[ident.sinner_id] ?? ''
      const sinnerEn = sinnerNameMapEn[ident.sinner_id]
      const sinnerJp = sinnerNameMapJp[ident.sinner_id]
      const entry: NoteIdentityEntry = {
        name: getLocalizedName(ident, lang), rarity: ident.rarity,
        imageUrl: getIdentityProfileUrl(ident, false),
        sinnerName: lang === 'en' ? (sinnerEn || sinnerKr) : lang === 'ja' ? (sinnerJp || sinnerKr) : sinnerKr, keywords: ident.keywords,
      }
      // KR key
      map[`${sinnerKr}:${ident.name_kr}`] = entry
      if (sinnerKr === sinner.name_kr || !map[ident.name_kr]) {
        map[ident.name_kr] = entry
      }
      // EN key aliases
      if (sinnerEn && ident.name_en) {
        map[`${sinnerEn}:${ident.name_en}`] = entry
      }
      // sinnerEn:name_kr fallback (AI might mix languages)
      if (sinnerEn) map[`${sinnerEn}:${ident.name_kr}`] = entry
      // EN identity name only
      if (ident.name_en && (sinnerKr === sinner.name_kr || !map[ident.name_en])) {
        map[ident.name_en] = entry
      }
      // JP key aliases
      if (sinnerJp && ident.name_jp) {
        map[`${sinnerJp}:${ident.name_jp}`] = entry
      }
      // sinnerJp:name_kr fallback (AI might mix languages)
      if (sinnerJp) map[`${sinnerJp}:${ident.name_kr}`] = entry
      // JP identity name only
      if (ident.name_jp && (sinnerKr === sinner.name_kr || !map[ident.name_jp])) {
        map[ident.name_jp] = entry
      }
    }
    return map
  }, [allIdentities, sinnerNameMap, sinnerNameMapEn, sinnerNameMapJp, sinner.name_kr, lang])

  const egoGiftLookup = useMemo(() => {
    const map: Record<string, NoteEgoGiftEntry> = {}
    for (const g of egoGifts) {
      map[g.name] = { name: g.name, keyword: g.keyword, grade: g.grade, image_url: g.image_url, effect_base: g.effect_base }
    }
    return map
  }, [egoGifts])

  const passiveLookup = useMemo(() => {
    const map: Record<string, NotePassiveEntry> = {}
    for (const ps of filteredPassives) {
      const sinEn = ps.sin_affinity ? (SIN_KR_TO_EN[ps.sin_affinity] ?? ps.sin_affinity) : null
      const entry: NotePassiveEntry = {
        name: localPassiveName(ps),
        sin_affinity: sinEn,
        sin_count: ps.sin_count ?? null,
        active_cond: ps.active_cond ?? null,
        description: localPassiveDesc(ps) ?? null,
        sinnerName: getLocalizedName({ name_kr: sinner.name_kr, name_en: sinner.name, name_jp: sinner.name_jp }, lang),
        imageUrl: getIdentityInfoUrl(identity) || undefined,
      }
      map[ps.name] = entry
      // EN key
      const nameEn = (ps as Record<string, unknown>).name_en as string | undefined
      if (nameEn) map[nameEn] = entry
      // JP key
      const nameJp = (ps as Record<string, unknown>).name_jp as string | undefined
      if (nameJp) map[nameJp] = entry
    }
    return map
  }, [filteredPassives, sinner.name_kr, sinner.name, sinner.name_jp, lang])

  // 자동완성 풀
  const acPool = useMemo((): AutocompleteSuggestion[] => {
    const pool: AutocompleteSuggestion[] = []
    for (const sk of filteredSkills) {
      const sc = SIN_COLORS[sk.sin_affinity] || '#cccccc'
      const v = variantMap[sk.id]
      const base = v?.baseOrder ?? (sk.skill_order >= 5 ? 3 : sk.skill_order)
      const isDefense = base === 4
      const orderLabel = isDefense
        ? (v && v.total > 1
          ? `${SKILL_TYPE_LABELS[sk.skill_type] || sk.skill_type}-${v.idx}`
          : SKILL_TYPE_LABELS[sk.skill_type] || sk.skill_type)
        : (v && v.total > 1 ? `S${base}-${v.idx}` : `S${base}`)
      const token = v && v.total > 1
        ? `[s:${sinner.name_kr}:${base}:${v.idx}]`
        : `[s:${sinner.name_kr}:${base}]`
      pool.push({
        label: `${orderLabel} ${localSkillName(sk)}`, type: 'skill', typeLabel: t('identity.tab.skills'), color: sc,
        iconUrl: getSkillIconUrl(identity, skillImgIdxMap[sk.id] ?? sk.skill_order),
        iconFallbackUrl: (skillImgIdxMap[sk.id] ?? sk.skill_order) >= 5 ? getSkillIconUrl(identity, 3) : undefined,
        token,
      })
    }
    for (const ps of filteredPassives) {
      const sinEn = ps.sin_affinity ? (SIN_KR_TO_EN[ps.sin_affinity] ?? ps.sin_affinity) : null
      const sc = sinEn ? (SIN_COLORS[sinEn] ?? '#88a830') : '#88a830'
      pool.push({
        label: localPassiveName(ps),
        type: 'passive' as const,
        typeLabel: ps.passive_type === 'battle' ? t('identity.passiveType.battle') : t('identity.passiveType.support'),
        color: sc,
        iconUrl: sinEn ? getSinIconUrl(sinEn) : undefined,
        token: `[p:${ps.name}]`,
      })
    }
    for (const ident of allIdentities) {
      const mainKw = ident.keywords?.find(kw => kwSinMap[kw])
      const sinType = mainKw ? kwSinMap[mainKw] : undefined
      const sc = sinType ? (SIN_COLORS[sinType] ?? '#c8900a') : '#c8900a'
      const sinnerName = sinnerNameMap[ident.sinner_id] ?? ''
      pool.push({
        label: getLocalizedName(ident, lang), type: 'identity', typeLabel: sinnerName || t('sinners.identities'), color: sc,
        imageUrl: getIdentityProfileUrl(ident, false),
        token: `[i:${sinnerName}:${ident.name_kr}]`,
      })
    }
    for (const ego of allEgos) {
      const nameKr = ego.name_kr || ego.name
      const localEgoName = getLocalizedName({ name_kr: ego.name_kr || ego.name, name_en: ego.name_en, name_jp: ego.name_jp }, lang)
      const sc = ego.sin_affinity ? (SIN_COLORS[ego.sin_affinity] ?? '#c8900a') : '#c8900a'
      const sinnerName = sinnerNameMap[ego.sinner_id] ?? getLocalizedName({ name_kr: sinner.name_kr, name_en: sinner.name, name_jp: sinner.name_jp }, lang)
      pool.push({
        label: localEgoName, type: 'ego', typeLabel: sinnerName || 'E.G.O', color: sc,
        imageUrl: ego.image_url ?? undefined,
        token: `[e:${sinnerName}:${nameKr}]`,
      })
    }
    pool.push(...buildKeywordPool(kwContext))
    pool.push(...buildEgoGiftPool(egoGifts))
    return pool
  }, [filteredSkills, filteredPassives, allIdentities, allEgos, sinnerNameMap, sinner.name_kr, sinner.name, sinner.name_jp, identity, skillImgIdxMap, variantMap, egoGifts, lang, t])

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-6">
        {/* 브레드크럼 */}
        <div className="mb-8 flex items-center gap-2 text-sm" style={{ color: '#888888' }}>
          <Link href="/sinners" className="hover:text-yellow-300 transition-colors">
            {t('sinners.title')}
          </Link>
          <span>›</span>
          <Link href={`/sinners/${sinner.id}`} className="hover:text-yellow-300 transition-colors">
            {getLocalizedName({ name_kr: sinner.name_kr, name_en: sinner.name, name_jp: sinner.name_jp }, lang)}
          </Link>
          <span>›</span>
          <span style={{ color: sinColor }}>{getLocalizedName(identity, lang) || identity.name}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 좌측: 인격 이미지 + 이름 (1/3) */}
          <div className="identity-detail-portrait">
          <IdentityPortraitSection
            sinner={sinner}
            identity={identity}
            gacksung={gacksung}
            setGacksung={setGacksung}
            showFullArt={showFullArt}
            setShowFullArt={setShowFullArt}
            showArtTip={showArtTip}
            setShowArtTip={setShowArtTip}
            sinColor={sinColor}
            rarityNum={rarityNum}
          />
          </div>

          {/* 우측: 스탯 + 스킬 (2/3) */}
          <div className="identity-detail-content lg:col-span-2 space-y-8">
            {/* 최상위 페이지 탭: 인격 정보 / 덱 */}
            <div className="flex" style={{ borderBottom: '0.125rem solid var(--border)' }}>
              {([
                { key: 'info' as const, label: t('identity.pageTab.info') },
                { key: 'decks' as const, label: t('identity.pageTab.decks') },
              ]).map(tab => {
                const isActive = pageTab === tab.key
                return (
                  <button
                    key={tab.key}
                    onClick={() => {
                      if (pageTab !== tab.key) {
                        const hash = tab.key === 'decks' ? '#decks' : ''
                        window.history.pushState(null, '', hash || window.location.pathname + window.location.search)
                        setPageTab(tab.key)
                      }
                    }}
                    className="relative px-6 py-3 font-semibold transition-all"
                    style={{
                      color: isActive ? 'var(--gold-light)' : '#555',
                      fontSize: '0.875rem',
                      fontFamily: 'var(--font-heading)',
                      background: isActive ? 'linear-gradient(180deg, rgba(200,144,10,0.1) 0%, transparent 100%)' : 'transparent',
                      borderBottom: isActive ? `0.125rem solid ${sinColor}` : '0.125rem solid transparent',
                      marginBottom: '-0.125rem',
                      letterSpacing: '0.08em',
                    }}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>

            {pageTab === 'decks' && (
              <IdentityDecksTab identityId={identity.id} />
            )}

            {pageTab === 'info' && (<>
              <IdentityInfoCard identity={identity} sinColor={sinColor} currentSeason={currentSeason} />

              <IdentityStatsCard identity={identity} sinColor={sinColor} />

              {/* 운영법 / AI 분석 탭 */}
              <div>
                <div className="flex" style={{ borderBottom: '1px solid var(--border)' }}>
                  {([
                    { key: 'ai' as const, label: t('identity.ai') },
                    { key: 'guide' as const, label: t('identity.guide') },
                  ]).map(tab => {
                    const active = guideTab === tab.key
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setGuideTab(tab.key)}
                        className="relative px-5 py-2.5 font-semibold transition-all"
                        style={{
                          color: active ? '#e8dcc8' : '#555',
                          fontSize: '0.8125rem',
                          background: active ? `${sinColor}12` : 'transparent',
                          borderBottom: active ? `2px solid ${sinColor}` : '2px solid transparent',
                          marginBottom: '-1px',
                        }}
                      >
                        {tab.label}
                      </button>
                    )
                  })}
                </div>
                {guideTab === 'ai' && (
                  <IdentityAISection
                    identityId={identity.id}
                    sinColor={sinColor}
                    isAdmin={isAdmin}
                    allowedKeywords={allowedKeywords}
                    skillLookup={skillTokenLookup}
                    passiveLookup={passiveLookup}
                    egoLookup={egoTokenLookup}
                    identityLookup={identityTokenLookup}
                    egoGiftLookup={egoGiftLookup}
                    skills={filteredSkills}
                    passives={filteredPassives}
                    identity={identity}
                    isLoggedIn={isLoggedIn}
                  />
                )}
                {guideTab === 'guide' && (
                  <IdentityGuideSection
                    identityId={identity.id}
                    initialGuides={initialGuides ?? []}
                    canEditGuide={canEditGuide}
                    sinColor={sinColor}
                    skillTokenLookup={skillTokenLookup}
                    passiveLookup={passiveLookup}
                    egoTokenLookup={egoTokenLookup}
                    identityTokenLookup={identityTokenLookup}
                    egoGiftLookup={egoGiftLookup}
                    acPool={acPool}
                  />
                )}
              </div>

              {/* 스킬/패시브 탭 + 컨텐츠 */}
              <div>
                {/* 탭 바 + 동기화 토글 */}
                <div className="flex items-end gap-2">
                  <div
                    className="flex flex-1 rounded-t-lg overflow-hidden"
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid var(--border)',
                      borderBottom: 'none',
                      padding: '3px 3px 0 3px',
                    }}
                  >
                    {[
                      { key: 'skills' as const, label: t('identity.tab.skills'), count: filteredSkills.length },
                      { key: 'passives' as const, label: t('identity.tab.passives'), count: filteredPassives.length },
                    ].map(tab => {
                      const isActive = activeTab === tab.key
                      return (
                        <button
                          key={tab.key}
                          onClick={() => setActiveTab(tab.key)}
                          className="flex-1 relative px-5 py-2.5 font-semibold rounded-t-md transition-all"
                          style={{
                            background: isActive ? `${sinColor}18` : 'transparent',
                            color: isActive ? '#e8dcc8' : '#555',
                            fontSize: '0.8125rem',
                            borderTop: isActive ? `1px solid ${sinColor}40` : '1px solid transparent',
                            borderLeft: isActive ? `1px solid ${sinColor}40` : '1px solid transparent',
                            borderRight: isActive ? `1px solid ${sinColor}40` : '1px solid transparent',
                            borderBottom: 'none',
                            boxShadow: isActive ? `0 0 8px ${sinColor}15` : 'none',
                          }}
                        >
                          <span>{tab.label}</span>
                          <span
                            className="font-mono"
                            style={{
                              color: isActive ? sinColor : '#444',
                              fontSize: '0.75rem',
                              marginLeft: '10px',
                            }}
                          >
                            {tab.count}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {/* 3/4동기화 토글 + 변경점 토글 */}
                  {hasUptieData && (
                    <div
                      className="flex rounded-t-lg overflow-hidden mb-0"
                      style={{
                        border: '1px solid var(--border)',
                        borderBottom: 'none',
                        background: 'rgba(0,0,0,0.3)',
                      }}
                    >
                      {([3, 4] as const).map(level => {
                        const isActive = uptieLevel === level
                        return (
                          <button
                            key={level}
                            onClick={() => setUptieLevel(level)}
                            className="px-3 py-2 text-xs font-semibold transition-all"
                            style={{
                              background: isActive ? `${sinColor}25` : 'transparent',
                              color: isActive ? sinColor : '#555',
                              borderRight: level === 3 ? `1px solid var(--border)` : 'none',
                            }}
                          >
                            {level === 3 ? t('identity.uptie.level3') : t('identity.uptie.level4')}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {activeTab === 'skills' && (
                  <IdentitySkillsTab
                    identity={identity}
                    filteredSkills={filteredSkills}
                    skillNameColors={skillNameColors}
                    skillImgIdxMap={skillImgIdxMap}
                    variantMap={variantMap}
                    allowedKeywords={allowedKeywords}
                    skillDiffs={skillDiffResult?.diffs}
                    newSkills={skillDiffResult?.newSkills}
                    showDiff={showDiff && uptieLevel === 3 && hasUptieData}
                    onToggleDiff={() => setShowDiff(d => {
                      const next = !d
                      localStorage.setItem('uptie-diff', next ? 'on' : 'off')
                      return next
                    })}
                  />
                )}

                {activeTab === 'passives' && (
                  <IdentityPassivesTab
                    filteredPassives={filteredPassives}
                    sinColor={sinColor}
                    skillNameColors={skillNameColors}
                    allowedKeywords={allowedKeywords}
                    passiveDiffs={passiveDiffResult?.diffs}
                    newPassives={passiveDiffResult?.newPassives}
                  />
                )}
              </div>

              <IdentitySanitySection sanityConditions={sanityConditions} panicInfo={panicInfo} />

              <IdentityReviewSection identityId={identity.id} sinColor={sinColor} />

              {/* 수감자 페이지로 돌아가기 */}
              <Link
                href={`/sinners/${sinner.id}`}
                className="block text-center py-3 font-medium text-sm transition-all duration-300 hover:border-opacity-60"
                style={{
                  background: 'linear-gradient(135deg, rgba(200,144,10,0.06) 0%, rgba(200,144,10,0.02) 100%)',
                  border: '0.0625rem solid rgba(200,144,10,0.15)',
                  borderRadius: '0.375rem',
                  color: 'var(--gold-dim)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(200,144,10,0.35)'
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(200,144,10,0.1) 0%, rgba(200,144,10,0.04) 100%)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(200,144,10,0.15)'
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(200,144,10,0.06) 0%, rgba(200,144,10,0.02) 100%)'
                }}
              >
                {t('identity.backToSinner')}
              </Link>
            </>)}
          </div>
        </div>
      </div>

      {isAdmin && (
        <Link
          href={`/admin/data/identities/${identity.id}`}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: 'rgba(200,144,10,0.15)',
            border: '1px solid var(--gold-dim)',
            color: 'var(--gold)',
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(200,144,10,0.35)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(200,144,10,0.15)')}
          title="관리자: 인격 편집"
        >
          <Settings size={18} />
        </Link>
      )}
    </div>
  )
}
