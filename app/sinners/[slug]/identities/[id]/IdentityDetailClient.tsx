'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Swords, Pencil, X, Check, ChevronDown, Plus, Trash2 } from 'lucide-react'
import {
  Sinner,
  Identity,
  Skill,
  Passive,
  EGO,
  SIN_COLORS,
  KEYWORD_SIN_MAP,
  STORAGE_BASE,
  SIN_KR_TO_EN,
  RARITY_ICON_MAP,
  SKILL_TYPE_LABELS,
  getIdentityInfoUrl,
  getIdentityProfileUrl,
  getSinnerLogoUrl,
  getIdentitySinColor,
  getSkillIconUrl,
  computeSkillImageIndices,
  getSinIconUrl,
} from '@/lib/data/sinners'
import { KeywordWithTooltip, formatSkillDesc } from '@/components/sinners/KeywordTooltip'
import { NoteRenderer, type NoteSkillEntry, type NoteEgoEntry, type NoteIdentityEntry, type NoteEgoGiftEntry } from '@/components/decks/NoteChips'
import { useNoteAutocomplete, NoteAutocompleteDropdown, buildKeywordPool, buildEgoGiftPool, type AutocompleteSuggestion } from '@/components/notes/NoteAutocomplete'
import IdentityDecksTab from '@/components/sinners/IdentityDecksTab'

interface GuideData {
  id: string
  title: string
  content: string
  author_name: string | null
  updated_at: string
}

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
}

export default function IdentityDetailClient({ sinner, identity, skills, passives, guides: initialGuides, allSinners, allIdentities, allEgos, egoGifts = [], canEditGuide }: Props) {
  const [gacksung, setGacksung] = useState(false)
  const [showFullArt, setShowFullArt] = useState(false)
  const [pageTab, setPageTab] = useState<'info' | 'decks'>(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#decks') return 'decks'
    return 'info'
  })
  const [activeTab, setActiveTab] = useState<'skills' | 'passives'>('skills')
  const [uptieLevel, setUptieLevel] = useState<3 | 4>(4)
  const sinColor = getIdentitySinColor(identity)

  // 뒤로가기/앞으로가기 시 탭 상태 동기화
  useEffect(() => {
    const onPopState = () => {
      setPageTab(window.location.hash === '#decks' ? 'decks' : 'info')
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // 동기화 단계 필터링
  const hasUptieData = useMemo(() =>
    skills.some(s => (s.uptie_level ?? 3) === 4) || passives.some(p => (p.uptie_level ?? 3) === 4),
    [skills, passives]
  )
  const filteredSkills = useMemo(() => {
    const filtered = skills.filter(s => (s.uptie_level ?? 3) === uptieLevel)
    // 4동기화 데이터가 없으면 3동기화로 폴백
    const result = filtered.length > 0 ? filtered : skills.filter(s => (s.uptie_level ?? 3) === 3)
    // 정렬: S1 → S2 → S3 → 수비(order=4) 순, 같은 슬롯 변형은 DB 순서 유지
    // skill_order >= 5 는 S3 변형(구 데이터)
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

  // 변형 스킬 맵: 같은 슬롯에 여러 스킬이 있는 경우 감지
  // skill_order >= 5 는 S3 변형(구 데이터), 같은 skill_order 중복은 변형 스킬
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

  // 운영법 상태
  const [guides, setGuides] = useState<GuideData[]>(initialGuides ?? [])
  const [openGuideIds, setOpenGuideIds] = useState<Set<string>>(() => {
    const first = (initialGuides ?? [])[0]
    return first ? new Set([first.id]) : new Set()
  })
  const [editingGuideId, setEditingGuideId] = useState<string | null>(null) // 'new' for new guide
  const [guideTitle, setGuideTitle] = useState('')
  const [guideContent, setGuideContent] = useState('')
  const [guideSaving, setGuideSaving] = useState(false)
  const guideTextareaRef = useRef<HTMLTextAreaElement>(null)

  // 토큰 룩업 (NoteRenderer용) — variantMap으로 변형 스킬 키 생성
  const skillImgIdxMap = useMemo(() => computeSkillImageIndices(filteredSkills), [filteredSkills])
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
        identityName: identity.name_kr, sinnerName: sinner.name_kr,
      }
    }
    return map
  }, [filteredSkills, sinner.name_kr, identity, skillImgIdxMap, variantMap])

  // sinner_id → name_kr 매핑 (자동완성용)
  const sinnerNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const s of allSinners) map[s.id] = s.name_kr
    return map
  }, [allSinners])

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
    // 전체 인격 (sinnerName:name_kr 형식)
    for (const ident of allIdentities) {
      const sinnerName = sinnerNameMap[ident.sinner_id] ?? ''
      const entry: NoteIdentityEntry = {
        name: ident.name_kr, rarity: ident.rarity,
        imageUrl: getIdentityProfileUrl(ident, false),
        sinnerName, keywords: ident.keywords,
      }
      map[`${sinnerName}:${ident.name_kr}`] = entry
      // 기존 가이드 호환: name_kr만으로도 조회 가능 (현재 수감자 우선)
      if (sinnerName === sinner.name_kr || !map[ident.name_kr]) {
        map[ident.name_kr] = entry
      }
    }
    return map
  }, [allIdentities, sinnerNameMap, sinner.name_kr])

  // EGO 기프트 룩업 (NoteRenderer용)
  const egoGiftLookup = useMemo(() => {
    const map: Record<string, NoteEgoGiftEntry> = {}
    for (const g of egoGifts) {
      map[g.name] = { name: g.name, keyword: g.keyword, grade: g.grade, image_url: g.image_url, effect_base: g.effect_base }
    }
    return map
  }, [egoGifts])

  // 자동완성 풀 (키워드 + 스킬 + 인격 + 에고)
  // 스킬만 현재 인격 한정, 인격/에고/키워드는 전체
  const acPool = useMemo((): AutocompleteSuggestion[] => {
    const pool: AutocompleteSuggestion[] = []
    // 스킬 — 현재 인격의 스킬만
    for (const sk of filteredSkills) {
      const sc = SIN_COLORS[sk.sin_affinity] || sinColor
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
        token,
      })
    }
    // 인격 — 전체 수감자
    for (const ident of allIdentities) {
      const mainKw = ident.keywords?.find(kw => KEYWORD_SIN_MAP[kw])
      const sinType = mainKw ? KEYWORD_SIN_MAP[mainKw] : undefined
      const sc = sinType ? (SIN_COLORS[sinType] ?? '#c8900a') : '#c8900a'
      const sinnerName = sinnerNameMap[ident.sinner_id] ?? ''
      pool.push({
        label: ident.name_kr, type: 'identity', typeLabel: sinnerName || '인격', color: sc,
        imageUrl: getIdentityProfileUrl(ident, false),
        token: `[i:${sinnerName}:${ident.name_kr}]`,
      })
    }
    // 에고 — 전체 수감자
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
    // 키워드
    pool.push(...buildKeywordPool())
    // EGO 기프트
    pool.push(...buildEgoGiftPool(egoGifts))
    return pool
  }, [filteredSkills, allIdentities, allEgos, sinnerNameMap, sinner.name_kr, identity, sinColor, skillImgIdxMap, variantMap, egoGifts])

  const ac = useNoteAutocomplete({
    text: guideContent,
    setText: setGuideContent,
    textareaRef: guideTextareaRef,
    pool: acPool,
  })

  const toggleGuide = useCallback((id: string) => {
    setOpenGuideIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const startEditGuide = useCallback((g: GuideData) => {
    setEditingGuideId(g.id)
    setGuideTitle(g.title)
    setGuideContent(g.content)
    setOpenGuideIds(prev => new Set(prev).add(g.id))
    setTimeout(() => guideTextareaRef.current?.focus(), 50)
  }, [])

  const startNewGuide = useCallback(() => {
    setEditingGuideId('new')
    setGuideTitle('')
    setGuideContent('')
    setTimeout(() => guideTextareaRef.current?.focus(), 50)
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingGuideId(null)
    setGuideTitle('')
    setGuideContent('')
  }, [])

  const refreshGuides = useCallback(async () => {
    const res = await fetch(`/api/guides?identity_id=${identity.id}`)
    const data = await res.json()
    setGuides(Array.isArray(data) ? data : [])
    return Array.isArray(data) ? data as GuideData[] : []
  }, [identity.id])

  const handleGuideSave = useCallback(async () => {
    if (!guideTitle.trim() || !guideContent.trim()) return
    setGuideSaving(true)
    try {
      if (editingGuideId === 'new') {
        await fetch('/api/guides', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identity_id: identity.id, title: guideTitle, content: guideContent }),
        })
      } else {
        await fetch(`/api/guides/${editingGuideId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: guideTitle, content: guideContent }),
        })
      }
      const updated = await refreshGuides()
      if (editingGuideId === 'new' && updated.length > 0) {
        const newest = updated[updated.length - 1]
        setOpenGuideIds(prev => new Set(prev).add(newest.id))
      }
      setEditingGuideId(null)
      setGuideTitle('')
      setGuideContent('')
    } finally {
      setGuideSaving(false)
    }
  }, [editingGuideId, guideTitle, guideContent, identity.id, refreshGuides])

  const handleGuideDelete = useCallback(async (guideId: string) => {
    if (!confirm('이 운영법을 삭제하시겠습니까?')) return
    await fetch(`/api/guides/${guideId}`, { method: 'DELETE' })
    await refreshGuides()
  }, [refreshGuides])
  const rarityNum = identity.rarity === '3성' ? 3 : identity.rarity === '2성' ? 2 : 1

  const infoUrl = getIdentityInfoUrl(identity, gacksung)
  const fallbackInfoUrl = gacksung ? getIdentityInfoUrl(identity, false) : ''

  const [infoSrc, setInfoSrc] = useState(infoUrl)
  const [infoKey, setInfoKey] = useState(infoUrl)

  if (infoKey !== infoUrl) {
    setInfoSrc(infoUrl)
    setInfoKey(infoUrl)
  }

  // 스킬 이름 → 죄악 속성 색상 맵 (스킬 설명에서 다른 스킬 이름 강조용)
  const skillNameColors: Record<string, string> = {}
  for (const s of filteredSkills) {
    skillNameColors[s.name] = SIN_COLORS[s.sin_affinity] || sinColor
  }

  const fullArtNormal = getIdentityProfileUrl(identity, false)
  const fullArtGacksung = getIdentityProfileUrl(identity, true)
  const [gacksungArtFailed, setGacksungArtFailed] = useState(false)

  // 동기화 모드면 동기화 일러스트 시도, 실패했으면 일반으로 폴백
  const fullArtSrc = gacksung && !gacksungArtFailed ? fullArtGacksung : fullArtNormal

  return (
    <div className="min-h-screen pt-24 pb-16">
      {/* 풀 일러스트 오버레이 */}
      {showFullArt && fullArtSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center cursor-pointer"
          style={{ background: 'rgba(0,0,0,0.9)' }}
          onClick={() => setShowFullArt(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={fullArtSrc}
            src={fullArtSrc}
            alt={identity.name_kr || identity.name}
            className="max-w-full max-h-[90vh] object-contain"
            style={{ opacity: 0 }}
            onLoad={(ev) => { (ev.target as HTMLImageElement).style.opacity = '1' }}
            onError={() => {
              if (gacksung && !gacksungArtFailed) {
                setGacksungArtFailed(true)
              } else {
                setShowFullArt(false)
              }
            }}
          />
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6">
        {/* 브레드크럼 */}
        <div className="mb-8 flex items-center gap-2 text-sm" style={{ color: '#555566' }}>
          <Link href="/sinners" className="hover:text-yellow-300 transition-colors">
            수감자 목록
          </Link>
          <span>›</span>
          <Link
            href={`/sinners/${sinner.id}`}
            className="hover:text-yellow-300 transition-colors"
          >
            {sinner.name_kr}
          </Link>
          <span>›</span>
          <span style={{ color: sinColor }}>{identity.name_kr || identity.name}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 좌측: 인격 이미지 + 이름 (1/3) */}
          <div className="lg:sticky lg:top-24 lg:self-start space-y-4">
            {/* 인격 이름 헤더 */}
            <div className="flex items-center gap-2">
              <Image
                src={getSinnerLogoUrl(sinner.id)}
                alt=""
                width={28}
                height={28}
                unoptimized
                style={{ filter: 'drop-shadow(0 0 4px rgba(200,144,10,0.3))', opacity: 0.9 }}
              />
              <div className="flex-1 min-w-0">
                <h1
                  className="font-serif font-bold truncate"
                  style={{ color: '#e8dcc8', fontSize: '18px', lineHeight: 1.2 }}
                >
                  {identity.name_kr || identity.name}
                </h1>
                <p className="truncate" style={{ color: '#7a6845', fontSize: '11px' }}>
                  {identity.name}
                </p>
              </div>
            </div>

            {/* 일반/각성 토글 */}
            <div className="flex gap-1.5">
              <button
                onClick={() => setGacksung(false)}
                className="flex-1 py-1.5 text-xs font-medium rounded transition-all"
                style={{
                  background: !gacksung ? sinColor : 'transparent',
                  color: !gacksung ? '#0d0b08' : '#666',
                  border: `1px solid ${!gacksung ? sinColor : 'var(--border)'}`,
                }}
              >
                일러스트
              </button>
              <button
                onClick={() => setGacksung(true)}
                className="flex-1 py-1.5 text-xs font-medium rounded transition-all"
                style={{
                  background: gacksung ? '#ff6b6b' : 'transparent',
                  color: gacksung ? '#0d0b08' : '#666',
                  border: `1px solid ${gacksung ? '#ff6b6b' : 'var(--border)'}`,
                }}
              >
                동기화 일러스트
              </button>
            </div>

            {/* 인격 정보 이미지 (클릭하면 풀 일러스트) */}
            {infoSrc && (
              <div
                className={`game-card rarity-${rarityNum} ${gacksung ? 'gacksung' : ''} overflow-hidden cursor-pointer`}
                onClick={() => setShowFullArt(true)}
                title="클릭하면 풀 일러스트 보기"
              >
                <Image
                  src={infoSrc}
                  alt="인격 정보"
                  width={480}
                  height={320}
                  unoptimized
                  className="w-full h-auto max-w-[320px] mx-auto"
                  onError={() => {
                    if (fallbackInfoUrl && infoSrc !== fallbackInfoUrl) {
                      setInfoSrc(fallbackInfoUrl)
                    }
                  }}
                />
              </div>
            )}

            {/* 인격 대사 */}
            {identity.quote && (
              <div
                className="text-xs italic px-3 py-2.5 rounded leading-relaxed"
                style={{
                  background: `${sinColor}08`,
                  borderLeft: `2px solid ${sinColor}60`,
                  color: '#9e9e9e',
                }}
              >
                &ldquo;{identity.quote}&rdquo;
              </div>
            )}
          </div>

          {/* 우측: 스탯 + 스킬 (2/3) */}
          <div className="lg:col-span-2 space-y-8">
            {/* 최상위 페이지 탭: 인격 정보 / 덱 */}
            <div
              className="flex"
              style={{
                borderBottom: '2px solid var(--border)',
              }}
            >
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
                      color: isActive ? 'var(--gold)' : '#555',
                      fontSize: '14px',
                      fontFamily: 'var(--font-heading)',
                      background: 'transparent',
                      borderBottom: isActive ? '2px solid var(--gold)' : '2px solid transparent',
                      marginBottom: '-2px',
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
            {/* 기본 정보 */}
            <div className="card p-6">
              <h2
                className="font-serif font-bold mb-4"
                style={{ color: 'var(--gold)', fontSize: '16px' }}
              >
                기본 정보
              </h2>

              <div
                className="flex items-center gap-3 px-4 py-2.5 rounded"
                style={{
                  background: 'linear-gradient(135deg, rgba(200,144,10,0.06) 0%, rgba(200,144,10,0.02) 100%)',
                  border: '1px solid var(--border)',
                }}
              >
                {/* 등급 */}
                <div className="flex items-center gap-2">
                  {RARITY_ICON_MAP[identity.rarity] && (
                    <Image
                      src={RARITY_ICON_MAP[identity.rarity]}
                      alt=""
                      width={identity.rarity === '1성' ? 16 : identity.rarity === '2성' ? 28 : 40}
                      height={16}
                      unoptimized
                      style={{ filter: 'drop-shadow(0 0 3px rgba(200,144,10,0.4))' }}
                    />
                  )}
                </div>

                {/* 키워드 (메인 상태이상만) */}
                {identity.keywords && identity.keywords.filter(kw => KEYWORD_SIN_MAP[kw]).length > 0 && (
                  <>
                    <div style={{ width: '1px', height: '18px', background: 'var(--border)' }} />
                    <div className="flex items-center gap-2 flex-wrap">
                      {identity.keywords.filter(kw => KEYWORD_SIN_MAP[kw]).map(kw => {
                        const kwColor = SIN_COLORS[KEYWORD_SIN_MAP[kw]] || '#888'
                        return (
                          <KeywordWithTooltip key={kw} keyword={kw}>
                            <span
                              className="inline-flex items-center gap-1 text-xs font-semibold"
                              style={{ color: kwColor }}
                            >
                              {kw}
                            </span>
                          </KeywordWithTooltip>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* 내성 */}
              {(identity.slash_res || identity.pierce_res || identity.blunt_res) && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-6 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
                  {([
                    { label: '참격', res: identity.slash_res, icon: 'slash' },
                    { label: '관통', res: identity.pierce_res, icon: 'pierce' },
                    { label: '타격', res: identity.blunt_res, icon: 'blunt' },
                  ] as const).map(({ label, res, icon }) => {
                    const resColor = res === '취약' ? '#ff6b6b' : res === '내성' ? '#6bbbff' : '#888'
                    return (
                      <div
                        key={label}
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded"
                        style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)' }}
                      >
                        <Image
                          src={`${STORAGE_BASE}/icons/stats/${icon}.webp`}
                          alt=""
                          width={14}
                          height={14}
                          unoptimized
                        />
                        <span style={{ color: resColor, fontSize: '11px', fontWeight: 600 }}>
                          {res}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* 소속 */}
              {identity.affiliation && (
                <div className="mt-6 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
                  <div style={{ color: '#666', fontSize: '10px', marginBottom: '6px' }}>소속</div>
                  <span
                    className="px-2.5 py-1 rounded text-xs font-medium inline-flex items-center gap-1"
                    style={{
                      background: `${sinColor}18`,
                      color: sinColor,
                      border: `1px solid ${sinColor}40`,
                    }}
                  >
                    {identity.affiliation}
                  </span>
                </div>
              )}

              {/* 출시시기 & 획득 방법 */}
              {(identity.release_date || identity.acquisition) && (
                <div className="mt-5 space-y-2">
                  {identity.release_date && (
                    <div className="flex items-center gap-2">
                      <span style={{ color: '#666', fontSize: '10px', minWidth: '52px' }}>출시시기</span>
                      <span style={{ color: '#aaa', fontSize: '12px' }}>{identity.release_date}</span>
                    </div>
                  )}
                  {identity.acquisition && (
                    <div className="flex items-start gap-2">
                      <span style={{ color: '#666', fontSize: '10px', minWidth: '52px', marginTop: '2px' }}>획득 방법</span>
                      <span style={{ color: '#aaa', fontSize: '11px', lineHeight: 1.5 }}>{identity.acquisition}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 스탯 */}
            <div className="card p-6">
              <h2
                className="font-serif font-bold mb-4"
                style={{ color: 'var(--gold)', fontSize: '16px' }}
              >
                스탯
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(() => {
                  const defCorr = identity.def_level - 60
                  const defCorrStr = defCorr === 0 ? '' : defCorr > 0 ? `(+${defCorr})` : `(${defCorr})`
                  return [
                    { label: 'HP', value: String(identity.hp), iconUrl: `${STORAGE_BASE}/icons/stats/health.webp` },
                    { label: '속도', value: `${identity.speed_min}-${identity.speed_max}`, iconUrl: `${STORAGE_BASE}/icons/stats/speed.webp` },
                    { label: '방어 레벨', value: `${identity.def_level}${defCorrStr}`, iconUrl: `${STORAGE_BASE}/icons/stats/defense.webp` },
                  ]
                })().map(({ label, value, iconUrl }) => (
                  <div
                    key={label}
                    className="text-center py-3 rounded"
                    style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex justify-center mb-1">
                      <Image src={iconUrl} alt="" width={20} height={20} unoptimized />
                    </div>
                    <div
                      className="font-mono font-bold"
                      style={{ color: sinColor, fontSize: '20px' }}
                    >
                      {value}
                    </div>
                    <div style={{ color: '#555', fontSize: '10px', marginTop: '2px' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 운영법 섹션 */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Swords size={16} style={{ color: 'var(--gold)' }} />
                  <h2
                    className="font-serif font-bold"
                    style={{ color: 'var(--gold)', fontSize: '16px' }}
                  >
                    운영법
                  </h2>
                  {guides.length > 0 && (
                    <span style={{ color: '#555', fontSize: '11px' }}>({guides.length})</span>
                  )}
                </div>
                {canEditGuide && editingGuideId === null && (
                  <button
                    onClick={startNewGuide}
                    className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all hover:opacity-80"
                    style={{
                      background: 'rgba(200,144,10,0.1)',
                      border: '1px solid var(--gold-dim)',
                      color: 'var(--gold)',
                    }}
                  >
                    <Plus size={12} />
                    추가하기
                  </button>
                )}
              </div>

              {/* 새 운영법 작성 폼 */}
              {editingGuideId === 'new' && (
                <div className="mb-4 p-4 pb-5 rounded-lg" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)' }}>
                  <input
                    type="text"
                    value={guideTitle}
                    onChange={e => setGuideTitle(e.target.value)}
                    placeholder="운영법 제목을 입력하세요"
                    className="w-full rounded px-3 py-2 text-sm font-serif mb-3"
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid var(--border)',
                      color: 'var(--gold)',
                      outline: 'none',
                    }}
                  />
                  <div className="relative">
                    <NoteAutocompleteDropdown
                      suggestions={ac.suggestions}
                      selectedIdx={ac.selectedIdx}
                      onSelect={ac.select}
                      onHover={ac.setSelectedIdx}
                    />
                    <textarea
                      ref={guideTextareaRef}
                      value={guideContent}
                      onChange={e => {
                        setGuideContent(e.target.value)
                        ac.onTextChange(e)
                      }}
                      onSelect={ac.onTextSelect}
                      onKeyDown={ac.handleKeyDown}
                      placeholder="이 인격의 운영법을 작성하세요. 키워드/스킬/인격/에고 이름을 입력하면 자동완성됩니다."
                      rows={8}
                      className="w-full rounded p-3 text-sm resize-y"
                      style={{
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid var(--border)',
                        color: '#c8b89a',
                        outline: 'none',
                        lineHeight: 1.8,
                      }}
                    />
                  </div>
                  {guideContent.trim() && (
                    <div className="mt-3 p-3 rounded" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)' }}>
                      <div style={{ color: '#555', fontSize: '10px', marginBottom: '6px' }}>미리보기</div>
                      <div style={{ color: '#b0a898', fontSize: '12px', lineHeight: 1.8, whiteSpace: 'pre-line' }}>
                        <NoteRenderer text={guideContent} skillLookup={skillTokenLookup} egoLookup={egoTokenLookup} identityLookup={identityTokenLookup} egoGiftLookup={egoGiftLookup} />
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={handleGuideSave}
                      disabled={guideSaving || !guideTitle.trim() || !guideContent.trim()}
                      className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-all hover:opacity-80"
                      style={{ background: sinColor, color: '#0d0b08', opacity: guideSaving || !guideTitle.trim() || !guideContent.trim() ? 0.4 : 1 }}
                    >
                      <Check size={12} />
                      {guideSaving ? '저장 중...' : '저장'}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-all hover:opacity-80"
                      style={{ background: 'transparent', border: '1px solid var(--border)', color: '#888' }}
                    >
                      <X size={12} />
                      취소
                    </button>
                  </div>
                </div>
              )}

              {/* 운영법 아코디언 목록 */}
              {guides.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {guides.map(g => {
                    const isOpen = openGuideIds.has(g.id)
                    const isEditing = editingGuideId === g.id
                    return (
                      <div key={g.id} className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)', background: 'rgba(0,0,0,0.15)' }}>
                        {/* 아코디언 헤더 */}
                        <button
                          onClick={() => toggleGuide(g.id)}
                          className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:brightness-110"
                          style={{ background: isOpen ? 'rgba(200,144,10,0.06)' : 'transparent' }}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <ChevronDown
                              size={14}
                              style={{
                                color: 'var(--gold-dim)',
                                transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                                transition: 'transform 0.2s',
                                flexShrink: 0,
                              }}
                            />
                            <span className="font-serif text-sm truncate" style={{ color: 'var(--gold)' }}>
                              {g.title || '제목 없음'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            {g.author_name && (
                              <span style={{ color: '#555', fontSize: '10px' }}>
                                {g.author_name}
                              </span>
                            )}
                            {g.updated_at && (
                              <span style={{ color: '#444', fontSize: '10px' }}>
                                {new Date(g.updated_at).toLocaleDateString('ko-KR')}
                              </span>
                            )}
                          </div>
                        </button>

                        {/* 아코디언 바디 */}
                        {isOpen && (
                          <div className="px-4 pb-5" style={{ borderTop: '1px solid var(--border)' }}>
                            {isEditing ? (
                              <div className="pt-3">
                                <input
                                  type="text"
                                  value={guideTitle}
                                  onChange={e => setGuideTitle(e.target.value)}
                                  placeholder="운영법 제목"
                                  className="w-full rounded px-3 py-2 text-sm font-serif mb-3"
                                  style={{
                                    background: 'rgba(0,0,0,0.3)',
                                    border: '1px solid var(--border)',
                                    color: 'var(--gold)',
                                    outline: 'none',
                                  }}
                                />
                                <div className="relative">
                                  <NoteAutocompleteDropdown
                                    suggestions={ac.suggestions}
                                    selectedIdx={ac.selectedIdx}
                                    onSelect={ac.select}
                                    onHover={ac.setSelectedIdx}
                                  />
                                  <textarea
                                    ref={guideTextareaRef}
                                    value={guideContent}
                                    onChange={e => {
                                      setGuideContent(e.target.value)
                                      ac.onTextChange(e)
                                    }}
                                    onSelect={ac.onTextSelect}
                                    onKeyDown={ac.handleKeyDown}
                                    placeholder="운영법 내용을 작성하세요."
                                    rows={8}
                                    className="w-full rounded p-3 text-sm resize-y"
                                    style={{
                                      background: 'rgba(0,0,0,0.3)',
                                      border: '1px solid var(--border)',
                                      color: '#c8b89a',
                                      outline: 'none',
                                      lineHeight: 1.8,
                                    }}
                                  />
                                </div>
                                {guideContent.trim() && (
                                  <div className="mt-3 p-3 rounded" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)' }}>
                                    <div style={{ color: '#555', fontSize: '10px', marginBottom: '6px' }}>미리보기</div>
                                    <div style={{ color: '#b0a898', fontSize: '12px', lineHeight: 1.8, whiteSpace: 'pre-line' }}>
                                      <NoteRenderer text={guideContent} skillLookup={skillTokenLookup} egoLookup={egoTokenLookup} identityLookup={identityTokenLookup} egoGiftLookup={egoGiftLookup} />
                                    </div>
                                  </div>
                                )}
                                <div className="flex items-center gap-2 mt-3">
                                  <button
                                    onClick={handleGuideSave}
                                    disabled={guideSaving || !guideTitle.trim() || !guideContent.trim()}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-all hover:opacity-80"
                                    style={{ background: sinColor, color: '#0d0b08', opacity: guideSaving || !guideTitle.trim() || !guideContent.trim() ? 0.4 : 1 }}
                                  >
                                    <Check size={12} />
                                    {guideSaving ? '저장 중...' : '저장'}
                                  </button>
                                  <button
                                    onClick={cancelEdit}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-all hover:opacity-80"
                                    style={{ background: 'transparent', border: '1px solid var(--border)', color: '#888' }}
                                  >
                                    <X size={12} />
                                    취소
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="pt-3">
                                <div style={{ color: '#b0a898', fontSize: '12px', lineHeight: 1.8, whiteSpace: 'pre-line' }}>
                                  <NoteRenderer text={g.content} skillLookup={skillTokenLookup} egoLookup={egoTokenLookup} identityLookup={identityTokenLookup} egoGiftLookup={egoGiftLookup} />
                                </div>
                                {canEditGuide && editingGuideId === null && (
                                  <div className="flex items-center gap-2 mt-5 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                                    <button
                                      onClick={() => startEditGuide(g)}
                                      className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all hover:opacity-80"
                                      style={{ background: 'rgba(200,144,10,0.1)', border: '1px solid var(--gold-dim)', color: 'var(--gold)' }}
                                    >
                                      <Pencil size={11} />
                                      수정
                                    </button>
                                    <button
                                      onClick={() => handleGuideDelete(g.id)}
                                      className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all hover:opacity-80"
                                      style={{ background: 'rgba(200,50,50,0.1)', border: '1px solid rgba(200,50,50,0.3)', color: '#c85050' }}
                                    >
                                      <Trash2 size={11} />
                                      삭제
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : editingGuideId !== 'new' && (
                <div className="text-center py-6" style={{ color: '#555566' }}>
                  <p className="text-sm italic">아직 운영법이 작성되지 않았습니다.</p>
                  <a
                    href="https://discord.com/users/340124004599988234"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded text-xs font-medium transition-all hover:brightness-110"
                    style={{
                      background: 'rgba(88,101,242,0.15)',
                      border: '1px solid rgba(88,101,242,0.3)',
                      color: '#7289da',
                      fontFamily: 'var(--font-heading)',
                    }}
                  >
                    운영법 작성 지원하기 (Discord)
                  </a>
                </div>
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
                          fontSize: '13px',
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
                            fontSize: '12px',
                            marginLeft: '10px',
                          }}
                        >
                          {tab.count}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* 3/4동기화 토글 */}
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

              {/* 스킬 탭 */}
              {activeTab === 'skills' && (filteredSkills.length > 0 ? (
                <div className="card p-6" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
                <h2
                  className="font-serif font-bold mb-4"
                  style={{ color: 'var(--gold)', fontSize: '16px' }}
                >
                  스킬
                </h2>

                <div className="space-y-4">
                  {(() => {
                    return filteredSkills.map(skill => {
                    const skillSinColor = SIN_COLORS[skill.sin_affinity] || sinColor
                    const imgIdx = skillImgIdxMap[skill.id] ?? skill.skill_order
                    const skillIconUrl = getSkillIconUrl(identity, imgIdx)
                    const v = variantMap[skill.id]
                    const baseOrder = v?.baseOrder ?? (skill.skill_order >= 5 ? 3 : skill.skill_order)
                    const skillIconFallback = imgIdx >= 5 ? getSkillIconUrl(identity, baseOrder) : undefined
                    const offCorr = skill.offense_level != null ? skill.offense_level - 60 : null
                    const offCorrStr = offCorr === null ? '' : offCorr === 0 ? '' : offCorr > 0 ? `(+${offCorr})` : `(${offCorr})`
                    const isAttackSkill = baseOrder !== 4

                    // 파괴 불가 코인 감지: [코인 N] 파괴 불가 코인
                    const unbreakableCoins = new Set<number>()
                    if (skill.description) {
                      const ubMatches = skill.description.matchAll(/\[코인\s?(\d+)\]\s*파괴 불가 코인/g)
                      for (const m of ubMatches) unbreakableCoins.add(parseInt(m[1]))
                    }

                    // 변형 스킬 라벨: S1-1/S1-2, S3-1/S3-2 등
                    const isDefense = baseOrder === 4
                    const skillLabel = isDefense
                      ? (v && v.total > 1
                        ? `${SKILL_TYPE_LABELS[skill.skill_type] || skill.skill_type}-${v.idx}`
                        : SKILL_TYPE_LABELS[skill.skill_type] || skill.skill_type)
                      : (v && v.total > 1 ? `S${baseOrder}-${v.idx}` : `S${baseOrder}`)

                    return (
                      <div
                        key={skill.id}
                        className="p-4 rounded"
                        style={{
                          background: `${skillSinColor}08`,
                          border: `1px solid ${skillSinColor}30`,
                        }}
                      >
                        <div className="flex flex-col gap-1.5 mb-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              {/* 스킬 아이콘 */}
                              {skillIconUrl && (
                                <Image
                                  src={skillIconUrl}
                                  alt=""
                                  width={28}
                                  height={28}
                                  unoptimized
                                  className="rounded shrink-0"
                                  style={{ border: `1px solid ${skillSinColor}40` }}
                                  onError={skillIconFallback ? (e) => { (e.target as HTMLImageElement).src = skillIconFallback } : undefined}
                                />
                              )}
                              <span
                                className="font-mono text-xs px-1.5 py-0.5 rounded shrink-0"
                                style={{
                                  background: `${skillSinColor}20`,
                                  color: skillSinColor,
                                  border: `1px solid ${skillSinColor}40`,
                                }}
                              >
                                {skillLabel}
                              </span>
                              <span className="font-semibold truncate" style={{ color: skillSinColor, fontSize: '13px' }}>
                                {skill.name}
                              </span>
                            </div>
                            {/* 스킬 타입 (우측) */}
                            {isAttackSkill && skill.skill_type && (
                              <div className="flex items-center gap-1 shrink-0 ml-2">
                                {['slash', 'pierce', 'blunt'].includes(skill.skill_type) && (
                                  <Image
                                    src={`${STORAGE_BASE}/icons/stats/${skill.skill_type}.webp`}
                                    alt=""
                                    width={14}
                                    height={14}
                                    unoptimized
                                  />
                                )}
                                <span style={{ color: '#666', fontSize: '11px' }}>
                                  {SKILL_TYPE_LABELS[skill.skill_type] || skill.skill_type}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3 pl-0.5">
                            {/* 가중치 */}
                            {isAttackSkill && (
                              <div className="flex items-center gap-1">
                                <span style={{ color: '#666', fontSize: '10px' }}>가중치</span>
                                <div className="flex items-center gap-0.5">
                                  {Array.from({ length: skill.atk_weight || 1 }).map((_, i) => (
                                    <div
                                      key={i}
                                      className="w-2.5 h-2.5 rounded-sm"
                                      style={{
                                        background: `${skillSinColor}50`,
                                        border: `1.5px solid ${skillSinColor}`,
                                      }}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                            {/* 공격/방어 레벨 */}
                            {skill.offense_level != null && (
                              <div className="flex items-center gap-1">
                                <span style={{ color: '#666', fontSize: '10px' }}>
                                  {isAttackSkill ? '공격 레벨' : '방어 레벨'}
                                </span>
                                <span className="font-mono text-xs font-bold" style={{ color: '#aaa' }}>
                                  {skill.offense_level}{offCorrStr}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 코인 정보 */}
                        <div className="flex items-center gap-4 mb-2">
                          <div className="flex items-center gap-1">
                            <span style={{ color: '#888', fontSize: '11px' }}>위력</span>
                            <span className="font-mono font-bold" style={{ color: skillSinColor, fontSize: '13px' }}>
                              {skill.base_power}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span style={{ color: '#888', fontSize: '11px' }}>코인</span>
                            <span className="font-mono font-bold" style={{ color: 'var(--gold)', fontSize: '13px' }}>
                              {skill.coins}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span style={{ color: '#888', fontSize: '11px' }}>코인 위력</span>
                            <span className="font-mono font-bold" style={{ color: skillSinColor, fontSize: '13px' }}>
                              +{skill.coin_power}
                            </span>
                          </div>
                          {/* 최종 위력 */}
                          <div className="flex items-center gap-1 ml-auto">
                            <span style={{ color: '#888', fontSize: '11px' }}>최대</span>
                            <span className="font-mono font-bold" style={{ color: '#e8dcc8', fontSize: '13px' }}>
                              {skill.base_power + skill.coins * skill.coin_power}
                            </span>
                          </div>
                        </div>

                        {/* 코인 시각화 */}
                        <div className="flex items-center gap-1 mb-2">
                          {Array.from({ length: skill.coins }).map((_, i) => {
                            const isUnbreakable = unbreakableCoins.has(i + 1)
                            return (
                              <Image
                                key={i}
                                src={`${STORAGE_BASE}/icons/stats/${isUnbreakable ? 'unbreakable_coin' : 'coin'}.webp`}
                                alt={isUnbreakable ? '파괴 불가 코인' : '코인'}
                                width={18}
                                height={18}
                                unoptimized
                                style={{ filter: `drop-shadow(0 0 2px ${skillSinColor}60)` }}
                              />
                            )
                          })}
                        </div>

                        {skill.description && (
                          <div style={{ color: '#888', fontSize: '11px', lineHeight: 1.8, whiteSpace: 'pre-line' }}>
                            {skill.description.split('\n').map((line, li) => {
                              // 코인 구간 전환 시 구분선 추가 (예: [코인 2] 시작 전)
                              const isCoinStart = /^\[코인\s?\d/.test(line)
                              const prevIsDifferentSection = li > 0 && isCoinStart
                              return (
                                <div key={li}>
                                  {prevIsDifferentSection && (
                                    <div
                                      style={{
                                        borderTop: `1px solid ${skillSinColor}25`,
                                        margin: '6px 0',
                                      }}
                                    />
                                  )}
                                  {formatSkillDesc(line, skillSinColor, skillNameColors)}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })
                  })()}
                </div>
              </div>
              ) : (
                <div
                  className="card p-8 text-center"
                  style={{ color: '#555566', borderTopLeftRadius: 0, borderTopRightRadius: 0 }}
                >
                  <p className="font-serif text-lg italic">
                    스킬 정보는 준비 중입니다.
                  </p>
                </div>
              ))}

              {/* 패시브 탭 */}
              {activeTab === 'passives' && (filteredPassives.length > 0 ? (() => {
              const battlePassives = filteredPassives.filter(p => p.passive_type === 'battle')
              const supportPassives = filteredPassives.filter(p => p.passive_type === 'support')

              const renderPassive = (p: Passive) => {
                // sin_affinity가 한국어 → SinType 변환, 복수면 첫 번째만 아이콘용
                const sinNames = p.sin_affinity ? p.sin_affinity.split(', ').map(s => s.trim()) : []
                const sinTypes = sinNames.map(s => SIN_KR_TO_EN[s]).filter(Boolean)
                const primaryColor = sinTypes[0] ? SIN_COLORS[sinTypes[0]] : sinColor

                return (
                  <div
                    key={p.id}
                    className="p-3 rounded"
                    style={{
                      background: `${primaryColor}08`,
                      border: `1px solid ${primaryColor}25`,
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-semibold" style={{ color: primaryColor, fontSize: '13px' }}>
                        {p.name}
                      </span>
                    </div>

                    {/* 발동 조건 */}
                    {(sinTypes.length > 0 || p.active_cond) && (
                      <div className="flex items-center gap-1.5 mb-2">
                        {sinTypes.map((st, i) => (
                          <Image
                            key={i}
                            src={getSinIconUrl(st)}
                            alt=""
                            width={16}
                            height={16}
                            unoptimized
                            style={{ filter: `drop-shadow(0 0 2px ${SIN_COLORS[st]}60)` }}
                          />
                        ))}
                        {p.sin_count && (
                          <span className="font-mono font-bold" style={{ color: primaryColor, fontSize: '12px' }}>
                            x{p.sin_count}
                          </span>
                        )}
                        {p.active_cond && (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded"
                            style={{
                              background: `${primaryColor}18`,
                              color: primaryColor,
                              border: `1px solid ${primaryColor}35`,
                            }}
                          >
                            {p.active_cond}
                          </span>
                        )}
                      </div>
                    )}

                    {/* 설명 */}
                    {p.description && (
                      <div style={{ color: '#888', fontSize: '11px', lineHeight: 1.8, whiteSpace: 'pre-line' }}>
                        {formatSkillDesc(p.description, primaryColor, skillNameColors)}
                      </div>
                    )}
                  </div>
                )
              }

              return (
                <div className="card p-6" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
                  <h2
                    className="font-serif font-bold mb-4"
                    style={{ color: 'var(--gold)', fontSize: '16px' }}
                  >
                    패시브
                  </h2>

                  {battlePassives.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded"
                          style={{ background: `${sinColor}20`, color: sinColor, border: `1px solid ${sinColor}40` }}>
                          배틀 패시브
                        </span>
                      </div>
                      <div className="space-y-2">
                        {battlePassives.map(renderPassive)}
                      </div>
                    </div>
                  )}

                  {supportPassives.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded"
                          style={{ background: 'rgba(100,140,180,0.15)', color: '#6b9bc0', border: '1px solid rgba(100,140,180,0.3)' }}>
                          서포트 패시브
                        </span>
                      </div>
                      <div className="space-y-2">
                        {supportPassives.map(renderPassive)}
                      </div>
                    </div>
                  )}
                </div>
              )
              })() : (
                <div
                  className="card p-8 text-center"
                  style={{ color: '#555566', borderTopLeftRadius: 0, borderTopRightRadius: 0 }}
                >
                  <p className="font-serif text-lg italic">
                    패시브 정보는 준비 중입니다.
                  </p>
                </div>
              ))}
            </div>

            {/* 패닉 유형 + 정신력 증감 조건 */}
            {(identity.panic_type || identity.sanity_increase || identity.sanity_decrease) && (
              <div className="card p-6">
                <h2
                  className="font-serif font-bold mb-4"
                  style={{ color: 'var(--gold)', fontSize: '16px' }}
                >
                  정신력
                </h2>

                <div className="space-y-4">
                  {/* 패닉 유형 */}
                  {identity.panic_type && (
                    <div
                      className="p-3 rounded"
                      style={{
                        background: 'rgba(180,50,50,0.08)',
                        border: '1px solid rgba(180,50,50,0.25)',
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <Image
                          src={`${STORAGE_BASE}/icons/stats/panic.webp`}
                          alt=""
                          width={18}
                          height={18}
                          unoptimized
                          style={{ filter: 'drop-shadow(0 0 3px rgba(180,50,50,0.5))' }}
                        />
                        <span className="text-xs font-semibold px-2 py-0.5 rounded"
                          style={{ background: 'rgba(180,50,50,0.15)', color: '#c05050', border: '1px solid rgba(180,50,50,0.3)' }}>
                          패닉 유형
                        </span>
                        <span className="font-semibold" style={{ color: '#c05050', fontSize: '13px' }}>
                          {identity.panic_type}
                        </span>
                      </div>
                      {identity.panic_description && (
                        <p style={{ color: '#888', fontSize: '11px', lineHeight: 1.6, paddingLeft: '26px' }}>
                          {identity.panic_description}
                        </p>
                      )}
                    </div>
                  )}

                  {/* 정신력 증가 조건 */}
                  {identity.sanity_increase && (
                    <div
                      className="p-3 rounded"
                      style={{
                        background: 'rgba(80,160,100,0.08)',
                        border: '1px solid rgba(80,160,100,0.25)',
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '18px',
                            height: '18px',
                            fontSize: '13px',
                            fontWeight: 700,
                            color: '#50a064',
                            filter: 'drop-shadow(0 0 3px rgba(80,160,100,0.4))',
                          }}
                        >
                          +
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded"
                          style={{ background: 'rgba(80,160,100,0.15)', color: '#50a064', border: '1px solid rgba(80,160,100,0.3)' }}>
                          정신력 증가 조건
                        </span>
                      </div>
                      <div style={{ color: '#888', fontSize: '11px', lineHeight: 1.8, whiteSpace: 'pre-line', paddingLeft: '26px' }}>
                        {identity.sanity_increase}
                      </div>
                    </div>
                  )}

                  {/* 정신력 감소 조건 */}
                  {identity.sanity_decrease && (
                    <div
                      className="p-3 rounded"
                      style={{
                        background: 'rgba(100,130,200,0.08)',
                        border: '1px solid rgba(100,130,200,0.25)',
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '18px',
                            height: '18px',
                            fontSize: '13px',
                            fontWeight: 700,
                            color: '#6482c8',
                            filter: 'drop-shadow(0 0 3px rgba(100,130,200,0.4))',
                          }}
                        >
                          -
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded"
                          style={{ background: 'rgba(100,130,200,0.15)', color: '#6482c8', border: '1px solid rgba(100,130,200,0.3)' }}>
                          정신력 감소 조건
                        </span>
                      </div>
                      <div style={{ color: '#888', fontSize: '11px', lineHeight: 1.8, whiteSpace: 'pre-line', paddingLeft: '26px' }}>
                        {identity.sanity_decrease}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 수감자 페이지로 돌아가기 */}
            <Link
              href={`/sinners/${sinner.id}`}
              className="block text-center py-3 rounded font-medium text-sm transition-all hover:opacity-80"
              style={{
                background: 'rgba(200,144,10,0.1)',
                border: '1px solid var(--border)',
                color: 'var(--gold-dim)',
              }}
            >
              ← {sinner.name_kr}의 인격 목록으로
            </Link>
            </>)}
          </div>
        </div>
      </div>
    </div>
  )
}
