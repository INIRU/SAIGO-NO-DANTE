'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Image from 'next/image'
import {
  Sinner, SinType, SIN_COLORS, GRADE_COLORS,
  RARITY_ICON_MAP, getSinnerLogoUrl, STORAGE_BASE,
} from '@/lib/data/sinners'
import SinBadge from '@/components/ui/SinBadge'
import { useKeywordData } from '@/components/providers/KeywordProvider'

// ── 타입 ──────────────────────────────────────────────────────
type Tab = 'identity' | 'keyword' | 'synergy' | 'ego'
type IdentitySubTab = 'battle' | 'support'

interface IdentityStat {
  identity_id: string
  sinner_id: string
  name_kr: string
  keywords: string[]
  rarity: number
  folder_name: string | null
  game_id: string | null
  count: number
}

interface KeywordStat { keyword: string; count: number }

interface Synergy {
  a_id: string; a_name: string; a_sinner_id: string; a_folder: string | null; a_game_id: string | null
  b_id: string; b_name: string; b_sinner_id: string; b_folder: string | null; b_game_id: string | null
  count: number
}

interface EGOStat {
  ego_id: string
  sinner_id: string
  name_kr: string
  grade: string
  sin_affinity: string | null
  image_url: string | null
  count: number
}

interface MetaData {
  totalDecks: number
  battleIdentityStats: IdentityStat[]
  supportIdentityStats: IdentityStat[]
  usageBySinner: Record<string, number>
  usageBySin: Record<string, number>
  keywordUsage: KeywordStat[]
  synergies: Synergy[]
  egoStats: EGOStat[]
}

// ── 상수 ──────────────────────────────────────────────────────
const TAB_LIST: { key: Tab; label: string }[] = [
  { key: 'identity', label: '인격 채용률' },
  { key: 'keyword', label: '키워드' },
  { key: 'synergy', label: '시너지' },
  { key: 'ego', label: 'EGO' },
]

const GRADE_ORDER = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH']
const GRADE_ICON_URL: Record<string, string> = {
  ZAYIN: `${STORAGE_BASE}/icons/grade/ZAYIN.webp`,
  TETH:  `${STORAGE_BASE}/icons/grade/TETH.webp`,
  HE:    `${STORAGE_BASE}/icons/grade/HE.webp`,
  WAW:   `${STORAGE_BASE}/icons/grade/WAW.webp`,
}
const MAIN_KEYWORDS = new Set(['출혈', '화상', '침잠', '파열', '호흡', '충전', '진동'])

/** 스크롤에 따라 점진적으로 아이템을 표시하는 훅 */
function useProgressiveRender(total: number, step = 8) {
  const [visible, setVisible] = useState(step)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setVisible(step)
  }, [total, step])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(prev => Math.min(prev + step, total))
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [total, step])

  return { visible, sentinelRef }
}

function mainKeywordColor(keywords: string[], sinMap: Record<string, string>): string {
  for (const kw of keywords) {
    const sin = sinMap[kw]
    if (sin) return SIN_COLORS[sin as SinType]
  }
  return '#888888'
}

/** 키워드 중 sinMap에 매칭되는 것만 (최대 3개) */
function mainKeywords(keywords: string[], sinMap: Record<string, string>): string[] {
  return keywords.filter(kw => sinMap[kw]).slice(0, 3)
}

// ── 키워드 배지 (IdentityCard 스타일) ─────────────────────────
function KeywordBadge({ keyword }: { keyword: string }) {
  const { sinMap: kwSinMap, getIconUrl } = useKeywordData()
  const sin = kwSinMap[keyword]
  const color = sin ? SIN_COLORS[sin] : '#888'
  const iconUrl = getIconUrl(keyword)

  return (
    <span
      className="inline-flex items-center gap-1"
      style={{
        background: `${color}18`,
        color,
        border: `1px solid ${color}35`,
        borderRadius: '3px',
        fontSize: '0.625rem',
        padding: '1px 5px',
        lineHeight: '16px',
      }}
    >
      {iconUrl && (
        <Image src={iconUrl} alt="" width={12} height={12} style={{ display: 'inline-block' }} />
      )}
      {keyword}
    </span>
  )
}

// ── 컴포넌트 ──────────────────────────────────────────────────
interface Props { sinners: Sinner[] }

export default function MetaClient({ sinners }: Props) {
  const [tab, setTab] = useState<Tab>('identity')
  const [identitySubTab, setIdentitySubTab] = useState<IdentitySubTab>('battle')
  const [data, setData] = useState<MetaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [sinnerFilter, setSinnerFilter] = useState<string | null>(null)

  const sinnerMap = useMemo(() => {
    const m = new Map<string, Sinner>()
    sinners.forEach(s => m.set(s.id, s))
    return m
  }, [sinners])

  // ── API fetch ───────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/meta/usage')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // ── GSAP ────────────────────────────────────────────────────
  const runAnimations = useCallback(async () => {
    const { gsap } = await import('gsap')
    const { ScrollTrigger } = await import('gsap/ScrollTrigger')
    gsap.registerPlugin(ScrollTrigger)
    ScrollTrigger.getAll().forEach(t => t.kill())

    gsap.fromTo('.usage-bar', { scaleX: 0 }, {
      scaleX: 1, duration: 0.8, stagger: 0.04,
      ease: 'power2.out', transformOrigin: 'left center',
      scrollTrigger: { trigger: '.usage-chart', start: 'top 85%' },
    })

    document.querySelectorAll('.count-up').forEach(el => {
      const target = parseInt(el.getAttribute('data-target') || '0')
      const proxy = { val: 0 }
      gsap.to(proxy, {
        val: target, duration: 1.2, ease: 'power2.out',
        onUpdate: () => { el.textContent = Math.round(proxy.val).toString() },
        scrollTrigger: { trigger: el, start: 'top 90%' },
      })
    })
  }, [])

  useEffect(() => {
    if (loading || !data) return
    const timer = setTimeout(runAnimations, 60)
    return () => clearTimeout(timer)
  }, [loading, data, tab, sinnerFilter, runAnimations])

  // ── 파생 ────────────────────────────────────────────────────
  const filteredBattleStats = useMemo(() => {
    if (!data) return []
    const stats = sinnerFilter
      ? data.battleIdentityStats.filter(s => s.sinner_id === sinnerFilter)
      : data.battleIdentityStats
    return stats.slice(0, 20)
  }, [data, sinnerFilter])

  const filteredSupportStats = useMemo(() => {
    if (!data) return []
    const stats = sinnerFilter
      ? data.supportIdentityStats.filter(s => s.sinner_id === sinnerFilter)
      : data.supportIdentityStats
    return stats.slice(0, 20)
  }, [data, sinnerFilter])

  const egoByGrade = useMemo(() => {
    if (!data) return {} as Record<string, EGOStat[]>
    const groups: Record<string, EGOStat[]> = {}
    for (const ego of data.egoStats) {
      if (!groups[ego.grade]) groups[ego.grade] = []
      groups[ego.grade].push(ego)
    }
    return groups
  }, [data])

  // ── 로딩 ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-16 px-6 max-w-7xl mx-auto" style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Background atmospheric glow */}
        <div style={{
          position: 'fixed',
          top: '-10rem',
          right: '-5rem',
          width: '35rem',
          height: '35rem',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(200,144,10,0.04) 0%, rgba(200,144,10,0.015) 40%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }} />
        <div className="mb-12">
          <p style={{ color: 'var(--gold-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.625rem', letterSpacing: '0.3em', marginBottom: '0.5rem' }}>USAGE ANALYTICS</p>
          <h1 className="font-serif text-4xl md:text-5xl font-bold mb-2" style={{ color: 'var(--gold)' }}>
            메타 분석
          </h1>
          <p style={{ color: '#666688' }}>덱 데이터 기반 통계 분석</p>
          <div style={{ width: '8rem', height: '0.0625rem', background: 'linear-gradient(90deg, var(--gold), transparent)', marginTop: '1rem' }} />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-lg animate-pulse"
              style={{ background: 'var(--bg-elevated)', opacity: 1 - i * 0.08 }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (!data) return null
  const totalDecks = data.totalDecks || 1

  return (
    <div className="min-h-screen pt-24 pb-16 px-3 md:px-6 max-w-7xl mx-auto" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Background atmospheric glow */}
      <div style={{
        position: 'fixed',
        top: '-10rem',
        right: '-5rem',
        width: '35rem',
        height: '35rem',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(200,144,10,0.04) 0%, rgba(200,144,10,0.015) 40%, transparent 70%)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />
      {/* 헤더 */}
      <div className="mb-6 md:mb-8">
        <p style={{ color: 'var(--gold-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.625rem', letterSpacing: '0.3em', marginBottom: '0.5rem' }}>USAGE ANALYTICS</p>
        <h1 className="font-serif text-3xl md:text-5xl font-bold mb-1" style={{ color: 'var(--gold)' }}>
          메타 분석
        </h1>
        <p className="text-xs md:text-sm" style={{ color: '#666688' }}>
          전체 <span className="font-mono" style={{ color: 'var(--gold)' }}>{totalDecks}</span>개 덱 기반 통계
        </p>
        <div style={{ width: '8rem', height: '0.0625rem', background: 'linear-gradient(90deg, var(--gold), transparent)', marginTop: '1rem' }} />
      </div>

      {/* 탭 */}
      <div className="flex gap-0 mb-6 md:mb-8 rounded overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        {TAB_LIST.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSinnerFilter(null) }}
            className="flex-1 py-2.5 md:py-3 text-xs md:text-sm font-medium transition-all duration-200"
            style={{
              background: tab === t.key ? 'var(--gold)' : 'transparent',
              color: tab === t.key ? 'var(--bg-deep)' : '#666688',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'identity' && (
        <IdentityTab
          data={data}
          totalDecks={totalDecks}
          sinners={sinners}
          sinnerMap={sinnerMap}
          sinnerFilter={sinnerFilter}
          setSinnerFilter={setSinnerFilter}
          filteredStats={identitySubTab === 'battle' ? filteredBattleStats : filteredSupportStats}
          label={identitySubTab === 'battle' ? '배틀 채용률' : '서포트 채용률'}
          subTab={identitySubTab}
          setSubTab={setIdentitySubTab}
        />
      )}
      {tab === 'keyword' && <KeywordTab data={data} />}
      {tab === 'synergy' && <SynergyTab data={data} sinnerMap={sinnerMap} />}
      {tab === 'ego' && <EGOTab data={data} sinnerMap={sinnerMap} egoByGrade={egoByGrade} />}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// ① 인격 채용률
// ══════════════════════════════════════════════════════════════
function IdentityTab({
  data, totalDecks, sinners, sinnerMap, sinnerFilter, setSinnerFilter, filteredStats, label, subTab, setSubTab,
}: {
  data: MetaData
  totalDecks: number
  sinners: Sinner[]
  sinnerMap: Map<string, Sinner>
  sinnerFilter: string | null
  setSinnerFilter: (v: string | null) => void
  filteredStats: IdentityStat[]
  label: string
  subTab: IdentitySubTab
  setSubTab: (v: IdentitySubTab) => void
}) {
  const { sinMap: kwSinMap, getIconUrl } = useKeywordData()
  const maxCount = filteredStats[0]?.count || 1
  const { visible, sentinelRef } = useProgressiveRender(filteredStats.length)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* 좌: 랭킹 */}
      <div className="lg:col-span-2">
        {/* 배틀/서포트 서브탭 */}
        <div className="flex gap-2 mb-4">
          {([
            { key: 'battle' as IdentitySubTab, label: '배틀' },
            { key: 'support' as IdentitySubTab, label: '서포트' },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setSubTab(t.key)}
              className="px-4 py-1.5 rounded text-xs font-medium transition-all"
              style={{
                background: subTab === t.key
                  ? (t.key === 'battle' ? 'rgba(200,48,64,0.15)' : 'rgba(72,120,160,0.15)')
                  : 'rgba(255,255,255,0.05)',
                color: subTab === t.key
                  ? (t.key === 'battle' ? '#e05060' : '#4898b0')
                  : '#666688',
                border: `1px solid ${subTab === t.key
                  ? (t.key === 'battle' ? 'rgba(200,48,64,0.4)' : 'rgba(72,120,160,0.4)')
                  : 'transparent'}`,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 수감자 필터 */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setSinnerFilter(null)}
            className="px-3 py-1.5 rounded text-xs font-medium transition-all"
            style={{
              background: !sinnerFilter ? 'var(--gold)' : 'rgba(255,255,255,0.05)',
              color: !sinnerFilter ? 'var(--bg-deep)' : '#666688',
            }}
          >
            전체
          </button>
          {sinners.map(s => (
            <button
              key={s.id}
              onClick={() => setSinnerFilter(sinnerFilter === s.id ? null : s.id)}
              className="relative w-8 h-8 rounded-full overflow-hidden transition-all"
              title={s.name_kr}
              style={{
                border: sinnerFilter === s.id ? '2px solid var(--gold)' : '2px solid transparent',
                opacity: sinnerFilter && sinnerFilter !== s.id ? 0.35 : 1,
              }}
            >
              <Image src={getSinnerLogoUrl(s.id)} alt={s.name_kr} fill className="object-contain" />
            </button>
          ))}
        </div>

        <h2 className="font-serif text-xl font-semibold mb-5" style={{ color: 'var(--gold-light)' }}>
          {sinnerFilter
            ? `${sinnerMap.get(sinnerFilter)?.name_kr ?? ''} ${label}`
            : `${label} TOP 20`}
        </h2>

        <div className="usage-chart space-y-2">
          {filteredStats.slice(0, visible).map((stat, i) => {
            const pct = (stat.count / maxCount) * 100
            const rate = ((stat.count / totalDecks) * 100).toFixed(1)
            const color = mainKeywordColor(stat.keywords, kwSinMap)
            const sName = sinnerMap.get(stat.sinner_id)?.name_kr ?? ''
            const kws = mainKeywords(stat.keywords, kwSinMap)
            const rarityWidth = stat.rarity === 3 ? 36 : stat.rarity === 2 ? 26 : 16

            return (
              <div
                key={stat.identity_id}
                className="rounded-lg p-3 transition-colors"
                style={{
                  background: 'rgba(26,21,16,0.6)',
                  border: i < 3 ? `1px solid ${color}30` : '1px solid transparent',
                }}
              >
                <div className="flex items-center gap-3 mb-2">
                  {/* 순위 */}
                  <span
                    className="font-mono text-sm w-6 text-center font-bold"
                    style={{
                      color: i === 0 ? '#e8b030' : i === 1 ? '#b0a088' : i === 2 ? '#a07040' : '#555566',
                    }}
                  >
                    {i + 1}
                  </span>

                  {/* 초상화 */}
                  {stat.folder_name && stat.game_id ? (
                    <div className="relative overflow-hidden shrink-0" style={{ width: 36, height: 48, borderRadius: 4, background: '#0a0806', border: `1px solid ${i < 3 ? color + '40' : 'rgba(58,42,21,0.4)'}` }}>
                      <Image
                        src={`${STORAGE_BASE}/sinners/${stat.sinner_id}/identities/${encodeURIComponent(stat.folder_name)}/${stat.game_id}_normal_info.webp`}
                        alt=""
                        fill
                        sizes="36px"
                        quality={50}
                        style={{ objectFit: 'cover', objectPosition: 'center top' }}
                      />
                    </div>
                  ) : (
                    <div style={{ width: 36, height: 48, borderRadius: 4, background: '#0a0806', border: '1px solid rgba(58,42,21,0.4)' }} />
                  )}

                  {/* 등급 + 인격명 + 수감자 */}
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {RARITY_ICON_MAP[stat.rarity] && (
                        <Image
                          src={RARITY_ICON_MAP[stat.rarity]}
                          alt={`${stat.rarity}성`}
                          width={rarityWidth}
                          height={14}
                         
                          style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }}
                        />
                      )}
                      <span className="text-xs shrink-0" style={{ color: '#555566' }}>{sName}</span>
                    </div>
                    <span className="text-sm font-medium truncate" style={{ color: '#e8e4d8' }}>
                      {stat.name_kr}
                    </span>
                  </div>

                  {/* 채용률 + 카운트 */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs" style={{ color: '#666688' }}>{rate}%</span>
                    <span
                      className="count-up font-mono text-sm font-bold"
                      data-target={stat.count}
                      style={{ color, minWidth: '24px', textAlign: 'right' }}
                    >
                      {stat.count}
                    </span>
                  </div>
                </div>

                {/* 키워드 배지 + 바 */}
                <div className="flex items-center gap-3">
                  <div className="w-6" /> {/* 순위 공간 맞춤 */}
                  <div className="flex-1">
                    {/* 바 */}
                    <div className="h-1.5 rounded-full overflow-hidden mb-1.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div
                        className="usage-bar h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: `linear-gradient(to right, ${color}60, ${color})`,
                        }}
                      />
                    </div>
                    {/* 키워드 */}
                    {kws.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {kws.map(kw => <KeywordBadge key={kw} keyword={kw} />)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          {filteredStats.length === 0 && (
            <p className="text-center py-12" style={{ color: '#555566' }}>데이터가 없습니다</p>
          )}
          <div ref={sentinelRef} />
        </div>
      </div>

      {/* 우: 키워드 분포 */}
      <div>
        <h2 className="font-serif text-xl font-semibold mb-5" style={{ color: 'var(--gold-light)' }}>
          키워드 분포
        </h2>
        <div className="card p-5 space-y-4">
          {(() => {
            const filtered = data.keywordUsage.filter(k => MAIN_KEYWORDS.has(k.keyword))
            const maxKw = filtered[0]?.count || 1
            return filtered.slice(0, 10).map(kw => {
              const pct = (kw.count / maxKw) * 100
              const sin = kwSinMap[kw.keyword]
              const color = sin ? SIN_COLORS[sin] : '#888'
              const iconUrl = getIconUrl(kw.keyword)
              return (
                <div key={kw.keyword}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div
                      className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                      style={{ background: `${color}15`, border: `1px solid ${color}30` }}
                    >
                      {iconUrl && (
                        <Image src={iconUrl} alt="" width={14} height={14} />
                      )}
                    </div>
                    <span className="flex-1 text-xs" style={{ color: '#e8e4d8' }}>{kw.keyword}</span>
                    <span className="font-mono text-xs font-bold" style={{ color }}>{kw.count}</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <div
                      className="usage-bar h-full rounded-full"
                      style={{ width: `${pct}%`, background: `linear-gradient(to right, ${color}80, ${color})` }}
                    />
                  </div>
                </div>
              )
            })
          })()}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// ② 키워드 트렌드
// ══════════════════════════════════════════════════════════════
function KeywordTab({ data }: { data: MetaData }) {
  const { sinMap: kwSinMap, getIconUrl } = useKeywordData()
  const keywords = data.keywordUsage.filter(kw => MAIN_KEYWORDS.has(kw.keyword)).slice(0, 15)
  const maxCount = keywords[0]?.count || 1

  return (
    <div className="max-w-3xl">
      <h2 className="font-serif text-xl font-semibold mb-2" style={{ color: 'var(--gold-light)' }}>
        키워드 트렌드 TOP 15
      </h2>
      <p className="text-xs mb-6" style={{ color: '#555566' }}>
        각 덱에서 등장한 키워드 수 (덱 내 중복 제거)
      </p>
      <div className="usage-chart space-y-2">
        {keywords.map((kw, i) => {
          const pct = (kw.count / maxCount) * 100
          const sin = kwSinMap[kw.keyword]
          const color = sin ? SIN_COLORS[sin] : '#888888'
          const iconUrl = getIconUrl(kw.keyword)

          return (
            <div
              key={kw.keyword}
              className="rounded-lg p-3 flex items-center gap-3"
              style={{
                background: 'rgba(26,21,16,0.6)',
                border: i < 3 ? `1px solid ${color}30` : '1px solid transparent',
              }}
            >
              {/* 순위 */}
              <span
                className="font-mono text-sm w-6 text-center font-bold"
                style={{
                  color: i === 0 ? '#e8b030' : i === 1 ? '#b0a088' : i === 2 ? '#a07040' : '#555566',
                }}
              >
                {i + 1}
              </span>

              {/* 아이콘 */}
              <div
                className="w-8 h-8 rounded flex items-center justify-center shrink-0"
                style={{ background: `${color}15`, border: `1px solid ${color}30` }}
              >
                {iconUrl ? (
                  <Image src={iconUrl} alt="" width={20} height={20} style={{ objectFit: 'contain' }} />
                ) : (
                  <div className="w-5 h-5" />
                )}
              </div>

              {/* 이름 + 바 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: '#e8e4d8' }}>{kw.keyword}</span>
                  </div>
                  <span
                    className="count-up font-mono text-sm font-bold shrink-0"
                    data-target={kw.count}
                    style={{ color }}
                  >
                    {kw.count}
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div
                    className="usage-bar h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: `linear-gradient(to right, ${color}60, ${color})`,
                    }}
                  />
                </div>
              </div>
            </div>
          )
        })}
        {keywords.length === 0 && (
          <p className="text-center py-12" style={{ color: '#555566' }}>데이터가 없습니다</p>
        )}
      </div>
    </div>
  )
}

// ── 인격 카드 이미지 URL 헬퍼 ────────────────────────────────
function identityCardUrl(sinnerId: string, folder: string | null, gameId: string | null): string {
  if (!folder || !gameId) return ''
  return `${STORAGE_BASE}/sinners/${sinnerId}/identities/${folder}/${gameId}_normal_info.webp`
}

// ══════════════════════════════════════════════════════════════
// ③ 시너지
// ══════════════════════════════════════════════════════════════
function SynergyTab({ data, sinnerMap }: { data: MetaData; sinnerMap: Map<string, Sinner> }) {
  const maxCount = data.synergies[0]?.count || 1
  const { visible, sentinelRef } = useProgressiveRender(data.synergies.length)

  return (
    <div className="max-w-4xl">
      <h2 className="font-serif text-xl font-semibold mb-2" style={{ color: 'var(--gold-light)' }}>
        동시 편성 TOP 20
      </h2>
      <p className="text-xs mb-6" style={{ color: '#555566' }}>
        같은 덱에서 함께 편성된 인격 조합
      </p>
      <div className="usage-chart space-y-3">
        {data.synergies.slice(0, visible).map((syn, i) => {
          const pct = (syn.count / maxCount) * 100
          const aImg = identityCardUrl(syn.a_sinner_id, syn.a_folder, syn.a_game_id)
          const bImg = identityCardUrl(syn.b_sinner_id, syn.b_folder, syn.b_game_id)
          const aSinnerName = sinnerMap.get(syn.a_sinner_id)?.name_kr ?? ''
          const bSinnerName = sinnerMap.get(syn.b_sinner_id)?.name_kr ?? ''

          return (
            <div
              key={`${syn.a_id}-${syn.b_id}`}
              className="rounded-lg overflow-hidden"
              style={{
                background: 'rgba(26,21,16,0.6)',
                border: i < 3 ? '1px solid rgba(200,144,10,0.25)' : '1px solid rgba(255,255,255,0.03)',
              }}
            >
              <div className="p-2.5 md:p-3">
                {/* 상단: 순위 + 카운트 */}
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="font-mono text-base md:text-lg w-7 text-center font-bold"
                    style={{
                      color: i === 0 ? '#e8b030' : i === 1 ? '#b0a088' : i === 2 ? '#a07040' : '#6a6a80',
                    }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span
                      className="count-up font-mono text-sm font-bold"
                      data-target={syn.count}
                      style={{ color: 'var(--gold)' }}
                    >
                      {syn.count}
                    </span>
                    <span className="text-[0.625rem]" style={{ color: '#555566' }}>덱</span>
                  </div>
                </div>

                {/* 인격 카드 쌍 */}
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-3">
                  {/* 인격 A */}
                  <div
                    className="flex items-center gap-2.5 flex-1 min-w-0 px-2.5 py-2 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                  >
                    {aImg ? (
                      <div className="relative w-9 h-12 md:w-10 md:h-14 shrink-0 rounded overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                        <Image src={aImg} alt="" fill className="object-cover" />
                      </div>
                    ) : syn.a_sinner_id && (
                      <div className="relative w-5 h-5 shrink-0">
                        <Image src={getSinnerLogoUrl(syn.a_sinner_id)} alt="" fill className="object-contain" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="text-xs md:text-sm font-medium truncate block" style={{ color: '#e8e4d8' }}>{syn.a_name}</span>
                      {aSinnerName && (
                        <span className="text-[0.625rem] block mt-0.5" style={{ color: '#555566' }}>{aSinnerName}</span>
                      )}
                    </div>
                  </div>

                  {/* 연결 */}
                  <div
                    className="w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center shrink-0 self-center"
                    style={{ background: 'rgba(200,144,10,0.1)', border: '1px solid rgba(200,144,10,0.25)' }}
                  >
                    <span className="text-[0.625rem] md:text-xs font-bold" style={{ color: 'var(--gold-dim)' }}>+</span>
                  </div>

                  {/* 인격 B */}
                  <div
                    className="flex items-center gap-2.5 flex-1 min-w-0 px-2.5 py-2 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                  >
                    {bImg ? (
                      <div className="relative w-9 h-12 md:w-10 md:h-14 shrink-0 rounded overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                        <Image src={bImg} alt="" fill className="object-cover" />
                      </div>
                    ) : syn.b_sinner_id && (
                      <div className="relative w-5 h-5 shrink-0">
                        <Image src={getSinnerLogoUrl(syn.b_sinner_id)} alt="" fill className="object-contain" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="text-xs md:text-sm font-medium truncate block" style={{ color: '#e8e4d8' }}>{syn.b_name}</span>
                      {bSinnerName && (
                        <span className="text-[0.625rem] block mt-0.5" style={{ color: '#555566' }}>{bSinnerName}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 바 */}
              <div className="h-1 overflow-hidden">
                <div
                  className="usage-bar h-full"
                  style={{
                    width: `${pct}%`,
                    background: 'linear-gradient(to right, rgba(200,144,10,0.2), var(--gold))',
                  }}
                />
              </div>
            </div>
          )
        })}
        {data.synergies.length === 0 && (
          <p className="text-center py-12" style={{ color: '#555566' }}>데이터가 없습니다</p>
        )}
        <div ref={sentinelRef} />
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// ④ EGO
// ══════════════════════════════════════════════════════════════
function EGOTab({
  data, sinnerMap, egoByGrade,
}: {
  data: MetaData
  sinnerMap: Map<string, Sinner>
  egoByGrade: Record<string, EGOStat[]>
}) {
  const [gradeTab, setGradeTab] = useState<string>('ALL')
  const globalMax = data.egoStats[0]?.count || 1

  // 표시할 등급 목록 (데이터 있는 것만)
  const availableGrades = GRADE_ORDER.filter(g => egoByGrade[g]?.length)

  // 선택된 등급의 EGO 목록
  const displayEgos = gradeTab === 'ALL'
    ? data.egoStats.slice(0, 30)
    : (egoByGrade[gradeTab] ?? [])
  const displayMax = displayEgos[0]?.count || 1
  const { visible: egoVisible, sentinelRef: egoSentinelRef } = useProgressiveRender(displayEgos.length)

  return (
    <div className="max-w-4xl">
      <h2 className="font-serif text-xl font-semibold mb-2" style={{ color: 'var(--gold-light)' }}>
        EGO 채용률
      </h2>
      <p className="text-xs mb-6" style={{ color: '#555566' }}>
        등급별 EGO 사용 현황
      </p>

      {/* 등급 서브탭 */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setGradeTab('ALL')}
          className="px-3 py-1.5 rounded text-xs font-mono font-bold tracking-wider transition-all"
          style={{
            background: gradeTab === 'ALL' ? 'var(--gold)' : 'rgba(255,255,255,0.05)',
            color: gradeTab === 'ALL' ? 'var(--bg-deep)' : '#666688',
          }}
        >
          전체
        </button>
        {availableGrades.map(grade => {
          const gc = GRADE_COLORS[grade] || '#666'
          const active = gradeTab === grade
          return (
            <button
              key={grade}
              onClick={() => setGradeTab(active ? 'ALL' : grade)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-bold tracking-wider transition-all"
              style={{
                background: active ? `${gc}30` : 'rgba(255,255,255,0.05)',
                color: active ? gc : '#555566',
                border: active ? `1px solid ${gc}50` : '1px solid transparent',
              }}
            >
              {GRADE_ICON_URL[grade] ? (
                <Image src={GRADE_ICON_URL[grade]} alt={grade} width={28} height={11} style={{ opacity: active ? 1 : 0.5 }} />
              ) : (
                grade
              )}
              <span className="text-[0.625rem]" style={{ color: '#555566' }}>
                {egoByGrade[grade]?.length ?? 0}
              </span>
            </button>
          )
        })}
      </div>

      {/* EGO 리스트 */}
      <div className="usage-chart space-y-2">
        {displayEgos.slice(0, egoVisible).map((ego, i) => {
          const pct = (ego.count / (gradeTab === 'ALL' ? globalMax : displayMax)) * 100
          const gradeColor = GRADE_COLORS[ego.grade] || '#666'
          const sinColor = ego.sin_affinity
            ? SIN_COLORS[ego.sin_affinity as SinType] || gradeColor
            : gradeColor
          const sName = sinnerMap.get(ego.sinner_id)?.name_kr ?? ''

          return (
            <div
              key={ego.ego_id}
              className="rounded-lg overflow-hidden"
              style={{
                background: 'rgba(26,21,16,0.6)',
                border: i < 3 ? `1px solid ${gradeColor}25` : '1px solid rgba(255,255,255,0.03)',
              }}
            >
              <div className="p-3 flex items-center gap-3">
                {/* 순위 */}
                <span
                  className="font-mono text-sm w-6 text-center font-bold shrink-0"
                  style={{
                    color: i === 0 ? '#e8b030' : i === 1 ? '#b0a088' : i === 2 ? '#a07040' : '#555566',
                  }}
                >
                  {i + 1}
                </span>

                {/* 등급 이미지 */}
                <div className="w-8 flex items-center justify-center shrink-0">
                  {GRADE_ICON_URL[ego.grade] ? (
                    <Image src={GRADE_ICON_URL[ego.grade]} alt={ego.grade} width={30} height={12} />
                  ) : (
                    <span
                      className="font-mono text-[0.625rem] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: `${gradeColor}15`, color: gradeColor, border: `1px solid ${gradeColor}30` }}
                    >
                      {ego.grade}
                    </span>
                  )}
                </div>

                {/* EGO 초상화 */}
                <div className="relative shrink-0 overflow-hidden" style={{ width: 36, height: 36, borderRadius: '50%', border: `1.5px solid ${gradeColor}40`, background: '#0d0b08' }}>
                  {ego.image_url ? (
                    <Image src={ego.image_url} alt="" fill className="object-cover" style={{ objectPosition: '50% 15%' }} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Image src={getSinnerLogoUrl(ego.sinner_id)} alt="" width={18} height={18} style={{ opacity: 0.5 }} />
                    </div>
                  )}
                </div>

                {/* EGO명 + 수감자 + 죄악 */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-sm font-medium truncate" style={{ color: '#e8e4d8' }}>
                    {ego.name_kr}
                  </span>
                  <span className="text-xs shrink-0" style={{ color: '#555566' }}>
                    {sName}
                  </span>
                  {ego.sin_affinity && (
                    <SinBadge sin={ego.sin_affinity as SinType} size="sm" showLabel={false} />
                  )}
                </div>

                {/* 카운트 */}
                <span
                  className="count-up font-mono text-sm font-bold shrink-0 w-8 text-right"
                  data-target={ego.count}
                  style={{ color: gradeColor }}
                >
                  {ego.count}
                </span>
              </div>

              {/* 바 */}
              <div className="h-1 overflow-hidden">
                <div
                  className="usage-bar h-full"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(to right, ${sinColor}30, ${sinColor})`,
                  }}
                />
              </div>
            </div>
          )
        })}
        {displayEgos.length === 0 && (
          <p className="text-center py-12" style={{ color: '#555566' }}>데이터가 없습니다</p>
        )}
        <div ref={egoSentinelRef} />
      </div>
    </div>
  )
}
