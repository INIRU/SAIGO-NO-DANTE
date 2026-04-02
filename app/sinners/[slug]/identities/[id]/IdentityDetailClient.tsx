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
import IdentityReviewSection from '@/components/identity/IdentityReviewSection'
import IdentityAISection from '@/components/identity/IdentityAISection'
import { useKeywordData } from '@/components/providers/KeywordProvider'

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
  canEditGuide?: boolean
  isAdmin?: boolean
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
  canEditGuide,
  isAdmin,
  currentSeason = 7,
}: Props) {
  const [gacksung, setGacksung] = useState(false)
  const [showFullArt, setShowFullArt] = useState(false)
  const [showArtTip, setShowArtTip] = useState(false)
  const [pageTab, setPageTab] = useState<'info' | 'decks'>(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#decks') return 'decks'
    return 'info'
  })
  const [activeTab, setActiveTab] = useState<'skills' | 'passives'>('skills')
  const [uptieLevel, setUptieLevel] = useState<3 | 4>(4)
  const [showDiff, setShowDiff] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('uptie-diff') !== 'off'
  })
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

  // GSAP 입장 애니메이션
  const animRef = useRef(false)
  useEffect(() => {
    if (animRef.current) return
    animRef.current = true
    import('gsap').then(({ gsap }) => {
      gsap.fromTo('.identity-detail-portrait',
        { opacity: 0, x: -30 },
        { opacity: 1, x: 0, duration: 0.6, ease: 'power3.out' }
      )
      gsap.fromTo('.identity-detail-content',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6, delay: 0.15, ease: 'power3.out' }
      )
    })
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
        name: sk.name, skill_type: sk.skill_type, sin_affinity: sk.sin_affinity as string,
        skill_order: sk.skill_order, description: sk.description,
        iconUrl: getSkillIconUrl(identity, skillImgIdxMap[sk.id] ?? sk.skill_order),
        iconFallbackUrl: (skillImgIdxMap[sk.id] ?? sk.skill_order) >= 5 ? getSkillIconUrl(identity, 3) : undefined,
        identityName: identity.name_kr, sinnerName: sinner.name_kr,
      }
    }
    return map
  }, [filteredSkills, sinner.name_kr, identity, skillImgIdxMap, variantMap])

  const egoTokenLookup = useMemo(() => {
    const map: Record<string, NoteEgoEntry> = {}
    for (const ego of allEgos) {
      const name = ego.name_kr || ego.name
      const sinnerName = sinnerNameMap[ego.sinner_id] ?? sinner.name_kr
      map[`${sinnerName}:${name}`] = {
        name, grade: ego.grade, sin_affinity: ego.sin_affinity,
        image_url: ego.image_url, sinnerName,
      }
    }
    return map
  }, [allEgos, sinnerNameMap, sinner.name_kr])

  const identityTokenLookup = useMemo(() => {
    const map: Record<string, NoteIdentityEntry> = {}
    for (const ident of allIdentities) {
      const sinnerName = sinnerNameMap[ident.sinner_id] ?? ''
      const entry: NoteIdentityEntry = {
        name: ident.name_kr, rarity: ident.rarity,
        imageUrl: getIdentityProfileUrl(ident, false),
        sinnerName, keywords: ident.keywords,
      }
      map[`${sinnerName}:${ident.name_kr}`] = entry
      if (sinnerName === sinner.name_kr || !map[ident.name_kr]) {
        map[ident.name_kr] = entry
      }
    }
    return map
  }, [allIdentities, sinnerNameMap, sinner.name_kr])

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
      map[ps.name] = {
        name: ps.name,
        sin_affinity: sinEn,
        sin_count: ps.sin_count ?? null,
        active_cond: ps.active_cond ?? null,
        description: ps.description ?? null,
        sinnerName: sinner.name_kr,
        imageUrl: getIdentityInfoUrl(identity) || undefined,
      }
    }
    return map
  }, [filteredPassives, sinner.name_kr])

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
        label: `${orderLabel} ${sk.name}`, type: 'skill', typeLabel: '스킬', color: sc,
        iconUrl: getSkillIconUrl(identity, skillImgIdxMap[sk.id] ?? sk.skill_order),
        iconFallbackUrl: (skillImgIdxMap[sk.id] ?? sk.skill_order) >= 5 ? getSkillIconUrl(identity, 3) : undefined,
        token,
      })
    }
    for (const ps of filteredPassives) {
      const sinEn = ps.sin_affinity ? (SIN_KR_TO_EN[ps.sin_affinity] ?? ps.sin_affinity) : null
      const sc = sinEn ? (SIN_COLORS[sinEn] ?? '#88a830') : '#88a830'
      pool.push({
        label: ps.name,
        type: 'passive' as const,
        typeLabel: ps.passive_type === 'battle' ? '배틀' : '서포트',
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
        label: ident.name_kr, type: 'identity', typeLabel: sinnerName || '인격', color: sc,
        imageUrl: getIdentityProfileUrl(ident, false),
        token: `[i:${sinnerName}:${ident.name_kr}]`,
      })
    }
    for (const ego of allEgos) {
      const name = ego.name_kr || ego.name
      const sc = ego.sin_affinity ? (SIN_COLORS[ego.sin_affinity] ?? '#c8900a') : '#c8900a'
      const sinnerName = sinnerNameMap[ego.sinner_id] ?? sinner.name_kr
      pool.push({
        label: name, type: 'ego', typeLabel: sinnerName || 'E.G.O', color: sc,
        imageUrl: ego.image_url ?? undefined,
        token: `[e:${sinnerName}:${name}]`,
      })
    }
    pool.push(...buildKeywordPool(kwContext))
    pool.push(...buildEgoGiftPool(egoGifts))
    return pool
  }, [filteredSkills, filteredPassives, allIdentities, allEgos, sinnerNameMap, sinner.name_kr, identity, skillImgIdxMap, variantMap, egoGifts])

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-6">
        {/* 브레드크럼 */}
        <div className="mb-8 flex items-center gap-2 text-sm" style={{ color: '#888888' }}>
          <Link href="/sinners" className="hover:text-yellow-300 transition-colors">
            수감자 목록
          </Link>
          <span>›</span>
          <Link href={`/sinners/${sinner.id}`} className="hover:text-yellow-300 transition-colors">
            {sinner.name_kr}
          </Link>
          <span>›</span>
          <span style={{ color: sinColor }}>{identity.name_kr || identity.name}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 좌측: 인격 이미지 + 이름 (1/3) */}
          <div className="identity-detail-portrait" style={{ opacity: 0 }}>
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
          <div className="identity-detail-content lg:col-span-2 space-y-8" style={{ opacity: 0 }}>
            {/* 최상위 페이지 탭: 인격 정보 / 덱 */}
            <div className="flex" style={{ borderBottom: '0.125rem solid var(--border)' }}>
              {([
                { key: 'info' as const, label: '인격 정보' },
                { key: 'decks' as const, label: '덱' },
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
                    { key: 'ai' as const, label: 'AI 분석' },
                    { key: 'guide' as const, label: '운영법' },
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
                      { key: 'skills' as const, label: '스킬', count: filteredSkills.length },
                      { key: 'passives' as const, label: '패시브', count: filteredPassives.length },
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
                            {level === 3 ? '3동기화' : '4동기화'}
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

              <IdentitySanitySection identity={identity} />

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
                &larr; {sinner.name_kr}의 인격 목록으로
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
