'use client'

import { Suspense, useEffect, useState, useMemo, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { STORAGE_BASE, GRADE_COLORS } from '@/lib/constants/game'
import { SIN_COLORS, normalizeSin } from '@/lib/constants/sin'
import type { SinType } from '@/lib/types'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { Check, CheckSquare, Square } from 'lucide-react'
import { decodeCollectionAsync } from '@/lib/collection'
import type { IdentityInfo, EGOInfo, CollectionData } from '@/lib/collection'
import CollectionSection from '@/components/mypage/CollectionSection'

const MAIN_KEYWORDS: { keyword: string; sin: SinType }[] = [
  { keyword: '출혈', sin: 'wrath' },
  { keyword: '화상', sin: 'lust' },
  { keyword: '침잠', sin: 'gloom' },
  { keyword: '파열', sin: 'gluttony' },
  { keyword: '호흡', sin: 'pride' },
  { keyword: '충전', sin: 'envy' },
  { keyword: '진동', sin: 'sloth' },
]

function identityInfoUrl(identity: IdentityInfo): string {
  if (!identity.game_id || !identity.folder_name) return ''
  const folder = encodeURIComponent(identity.folder_name)
  return `${STORAGE_BASE}/sinners/${identity.sinner_id}/identities/${folder}/${identity.game_id}_normal_info.webp`
}

function sinnerLogoUrl(sinnerId: string): string {
  return `${STORAGE_BASE}/icons/Sinners/${sinnerId}.webp`
}

const GRADE_ORDER = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH']

type ViewMode = 'sinner' | 'all'

// ── 카드 렌더링 헬퍼 ─────────────────────────────────────────────────────

function IdentityCard({ identity, isOwned }: { identity: IdentityInfo; isOwned: boolean }) {
  const url = identityInfoUrl(identity)
  return (
    <div
      className="relative rounded overflow-hidden"
      style={{
        aspectRatio: '3/4',
        border: `2px solid ${isOwned ? 'var(--gold-dim)' : 'rgba(58,42,21,0.3)'}`,
        background: '#0a0806',
      }}
    >
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={identity.name_kr}
          style={{
            width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center top',
            display: 'block',
            filter: isOwned ? 'none' : 'grayscale(1) brightness(0.3)',
          }}
          loading="lazy"
        />
      )}
      {isOwned && (
        <div style={{
          position: 'absolute', top: 3, right: 3,
          width: 16, height: 16, borderRadius: '50%',
          background: 'var(--gold)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Check size={10} style={{ color: '#0d0b08' }} />
        </div>
      )}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(to top, rgba(10,8,6,0.95) 0%, transparent 100%)',
        padding: '16px 4px 4px',
      }}>
        <p style={{
          fontSize: '0.5625rem', color: isOwned ? '#c8a450' : '#6a6080',
          textAlign: 'center', fontFamily: 'var(--font-heading)',
          lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {identity.name_kr}
        </p>
      </div>
    </div>
  )
}

function EgoCard({ ego, isOwned }: { ego: EGOInfo; isOwned: boolean }) {
  const sinType = normalizeSin(ego.sin_affinity)
  const egoSinColor = sinType ? SIN_COLORS[sinType] : 'var(--gold-dim)'
  return (
    <div
      className="relative rounded overflow-hidden"
      style={{
        aspectRatio: '1',
        border: `2px solid ${isOwned ? egoSinColor : 'rgba(58,42,21,0.3)'}`,
        background: '#0a0806',
      }}
    >
      {ego.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={ego.image_url}
          alt={ego.name_kr ?? ''}
          style={{
            width: '100%', height: '100%',
            objectFit: 'cover', display: 'block',
            filter: isOwned ? 'none' : 'grayscale(1) brightness(0.3)',
          }}
          loading="lazy"
        />
      )}
      {isOwned && (
        <div style={{
          position: 'absolute', top: 2, right: 2,
          width: 14, height: 14, borderRadius: '50%',
          background: egoSinColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Check size={8} style={{ color: '#0d0b08' }} />
        </div>
      )}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(to top, rgba(10,8,6,0.95) 0%, transparent 100%)',
        padding: '12px 3px 3px',
      }}>
        <p style={{
          fontSize: '0.5rem', color: isOwned ? '#c8a450' : '#6a6080',
          textAlign: 'center', fontFamily: 'var(--font-heading)',
          lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {ego.name_kr}
        </p>
      </div>
    </div>
  )
}

// ── 키워드 필터 UI ───────────────────────────────────────────────────────

function KeywordFilterBar({ keywordFilter, setKeywordFilter }: {
  keywordFilter: string | null
  setKeywordFilter: (v: string | null) => void
}) {
  const { getIconUrl } = useKeywordData()
  return (
    <div className="flex items-center gap-1.5 flex-wrap mb-4 pb-3" style={{ borderBottom: '1px solid rgba(58,42,21,0.3)' }}>
      <button
        onClick={() => setKeywordFilter(null)}
        className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all duration-200"
        style={{
          background: !keywordFilter ? 'rgba(200,144,10,0.15)' : 'transparent',
          border: `1px solid ${!keywordFilter ? 'var(--gold-dim)' : 'rgba(58,42,21,0.4)'}`,
          color: !keywordFilter ? 'var(--gold)' : '#6a6080',
        }}
      >
        전체
      </button>
      {MAIN_KEYWORDS.map(({ keyword, sin }) => {
        const isActive = keywordFilter === keyword
        const color = SIN_COLORS[sin]
        return (
          <button
            key={keyword}
            onClick={() => setKeywordFilter(isActive ? null : keyword)}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all duration-200"
            style={{
              background: isActive ? `${color}20` : 'transparent',
              border: `1px solid ${isActive ? color : 'rgba(58,42,21,0.4)'}`,
              color: isActive ? color : '#6a6080',
            }}
          >
            {getIconUrl(keyword) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={getIconUrl(keyword)!}
                alt={keyword}
                style={{
                  width: '14px', height: '14px',
                  filter: isActive ? `drop-shadow(0 0 3px ${color}80)` : 'grayscale(0.7) brightness(0.5)',
                }}
              />
            )}
            {keyword}
          </button>
        )
      })}
    </div>
  )
}

// ── EGO 섹션 렌더 ────────────────────────────────────────────────────────

function EgoSection({ egoList, owned, compact }: { egoList: EGOInfo[]; owned: Set<string>; compact?: boolean }) {
  const egosByGrade = GRADE_ORDER.reduce<Record<string, EGOInfo[]>>((acc, grade) => {
    const filtered = egoList.filter(e => e.grade === grade)
    if (filtered.length > 0) acc[grade] = filtered
    return acc
  }, {})
  if (Object.keys(egosByGrade).length === 0) return null
  return (
    <div>
      {!compact && (
        <div className="flex items-center gap-2 mb-3">
          <span style={{ color: '#8a80a0', fontSize: '0.6875rem', fontFamily: 'var(--font-heading)' }}>E.G.O</span>
          <span style={{ color: '#8a80a0', fontSize: '0.625rem', fontFamily: 'var(--font-mono)' }}>
            {egoList.filter(e => owned.has(e.id)).length}/{egoList.length}
          </span>
        </div>
      )}
      {Object.entries(egosByGrade).map(([grade, list]) => (
        <div key={grade} className="mb-3">
          <p className="mb-1.5" style={{
            fontSize: '0.5625rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em',
            color: GRADE_COLORS[grade] ?? '#555',
          }}>
            {grade}
          </p>
          <div className={compact
            ? 'grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5'
            : 'grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2'
          }>
            {list.map(ego => (
              <EgoCard key={ego.id} ego={ego} isOwned={owned.has(ego.id)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── 메인 뷰어 ────────────────────────────────────────────────────────────

function CollectionViewer() {
  const searchParams = useSearchParams()
  const code = searchParams.get('code')

  const [data, setData] = useState<CollectionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [owned, setOwned] = useState<Set<string>>(new Set())
  const [activeSinner, setActiveSinner] = useState<string>('')
  const [keywordFilter, setKeywordFilter] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('sinner')
  const [showUnowned, setShowUnowned] = useState(true)
  const { sinMap: kwSinMap } = useKeywordData()
  const animatedRef = useRef(false)

  useEffect(() => {
    fetch('/api/collection')
      .then(r => r.json())
      .then(async (d: CollectionData) => {
        setData(d)
        if (d.sinners.length > 0) setActiveSinner(d.sinners[0].id)
        if (code && d.sinners.length > 0) {
          const decoded = await decodeCollectionAsync(code, d.sinners, d.identities, d.egos)
          setOwned(decoded)
        }
      })
      .catch((e) => console.error('컬렉션 로드 실패:', e))
      .finally(() => {
        setLoading(false)
        if (!animatedRef.current) {
          animatedRef.current = true
          import('gsap').then(({ gsap }) => {
            gsap.fromTo('.collection-header',
              { opacity: 0, y: -20 },
              { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }
            )
            gsap.fromTo('.collection-content',
              { opacity: 0, y: 20 },
              { opacity: 1, y: 0, duration: 0.5, delay: 0.2, ease: 'power2.out' }
            )
          })
        }
      })
  }, [code])

  const stats = useMemo(() => {
    if (!data) return { ownedIdentities: 0, totalIdentities: 0, ownedEgos: 0, totalEgos: 0 }
    let totalIdentities = 0, ownedIdentities = 0, totalEgos = 0, ownedEgos = 0
    for (const s of data.sinners) {
      const ids = data.identities[s.id] ?? []
      const egoList = data.egos[s.id] ?? []
      totalIdentities += ids.length
      totalEgos += egoList.length
      ownedIdentities += ids.filter(i => owned.has(i.id)).length
      ownedEgos += egoList.filter(e => owned.has(e.id)).length
    }
    return { ownedIdentities, totalIdentities, ownedEgos, totalEgos }
  }, [data, owned])

  const filterByKeyword = (identities: IdentityInfo[]) => {
    if (!keywordFilter) return identities
    const filterSin = kwSinMap[keywordFilter]
    return identities.filter(i =>
      i.keywords?.some(kw => kw === keywordFilter || (filterSin && kwSinMap[kw] === filterSin))
    )
  }

  const filterEgoByKeyword = (egoList: EGOInfo[]) => {
    if (!keywordFilter) return egoList
    const filterSin = kwSinMap[keywordFilter]
    if (!filterSin) return egoList
    return egoList.filter(e => normalizeSin(e.sin_affinity) === filterSin)
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div style={{ width: 200, height: 32, background: '#2a2015', borderRadius: 4, marginBottom: 16 }} />
          <div className="flex gap-2 mb-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} style={{ width: 40, height: 40, borderRadius: '50%', background: '#2a2015' }} />
            ))}
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} style={{ aspectRatio: '3/4', background: '#2a2015', borderRadius: 6, opacity: 0.4 + i * 0.03 }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!data || !code) {
    return (
      <div className="min-h-screen pt-24 pb-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6">
            <p style={{ color: 'var(--gold-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.625rem', letterSpacing: '0.3em', marginBottom: '0.5rem' }}>
              MY COLLECTION
            </p>
            <h1 className="font-serif text-3xl md:text-4xl font-bold" style={{ color: 'var(--gold)' }}>
              보유 현황 설정
            </h1>
            <p className="mt-2" style={{ color: '#6a6080', fontSize: '0.75rem', fontFamily: 'var(--font-heading)' }}>
              로그인 없이 보유 인격/EGO를 설정하고 공유 링크를 만들 수 있습니다.
            </p>
            <div style={{ width: '8rem', height: '0.0625rem', background: 'linear-gradient(90deg, var(--gold), transparent)', marginTop: '1rem' }} />
          </div>
          <CollectionSection persistMode="local" />
        </div>
      </div>
    )
  }

  const sinnerOwnedCount = (sinnerId: string) => {
    const ids = data.identities[sinnerId] ?? []
    const egoList = data.egos[sinnerId] ?? []
    return ids.filter(i => owned.has(i.id)).length + egoList.filter(e => owned.has(e.id)).length
  }
  const sinnerTotalCount = (sinnerId: string) => {
    return (data.identities[sinnerId]?.length ?? 0) + (data.egos[sinnerId]?.length ?? 0)
  }

  // ── 수감자별 모드 데이터 ──
  const filteredIdentities = filterByKeyword(data.identities[activeSinner] ?? [])
  const filteredEgos = filterEgoByKeyword(data.egos[activeSinner] ?? [])
  const currentIdentities = showUnowned ? filteredIdentities : filteredIdentities.filter(i => owned.has(i.id))
  const currentEgos = showUnowned ? filteredEgos : filteredEgos.filter(e => owned.has(e.id))

  return (
    <div className="min-h-screen pt-24 pb-16 px-6" style={{ position: 'relative', overflow: 'hidden' }}>
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
      <div className="max-w-5xl mx-auto">
        {/* 헤더 */}
        <div className="collection-header mb-6" style={{ opacity: 0 }}>
          <p style={{ color: 'var(--gold-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.625rem', letterSpacing: '0.3em', marginBottom: '0.5rem' }}>
            MY COLLECTION
          </p>
          <h1 className="font-serif text-3xl md:text-4xl font-bold" style={{ color: 'var(--gold)' }}>
            보유 현황
          </h1>
          <div className="mt-3 flex items-center gap-3" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: '#6a6080' }}>
            <span>인격 <span style={{ color: 'var(--gold)' }}>{stats.ownedIdentities}</span>/{stats.totalIdentities}</span>
            <span style={{ color: '#5a5065', fontFamily: 'sans-serif' }}>·</span>
            <span>EGO <span style={{ color: 'var(--gold)' }}>{stats.ownedEgos}</span>/{stats.totalEgos}</span>
          </div>
          <div style={{ width: '8rem', height: '0.0625rem', background: 'linear-gradient(90deg, var(--gold), transparent)', marginTop: '1rem' }} />
        </div>

        {/* 보기 모드 토글 */}
        <div
          className="collection-content flex gap-0 mb-4 rounded overflow-hidden"
          style={{ border: '1px solid var(--border)' }}
        >
          {([['sinner', '수감자별'], ['all', '전체']] as [ViewMode, string][]).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className="flex-1 py-2 text-xs font-medium transition-all duration-200"
              style={{
                background: viewMode === mode ? 'var(--gold)' : 'transparent',
                color: viewMode === mode ? '#0d0b08' : '#6a6080',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div
          style={{
            background: '#1a1510',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        >
          {/* 수감자 탭 (수감자별 모드) */}
          {viewMode === 'sinner' && (
            <div
              className="flex gap-1 p-3 overflow-x-auto"
              style={{ borderBottom: '1px solid var(--border)', background: '#150f0a' }}
            >
              {data.sinners.map(s => {
                const isActive = s.id === activeSinner
                const ownCount = sinnerOwnedCount(s.id)
                const totalCount = sinnerTotalCount(s.id)
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveSinner(s.id)}
                    className="flex flex-col items-center gap-1 px-2 py-1.5 rounded transition-all flex-shrink-0"
                    style={{
                      background: isActive ? 'rgba(200,144,10,0.12)' : 'transparent',
                      border: `1px solid ${isActive ? 'var(--gold-dim)' : 'transparent'}`,
                      cursor: 'pointer',
                      minWidth: 52,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={sinnerLogoUrl(s.id)}
                      alt={s.name_kr}
                      width={28}
                      height={28}
                      style={{
                        borderRadius: '50%',
                        opacity: isActive ? 1 : 0.4,
                        transition: 'opacity 0.2s',
                        filter: isActive ? 'none' : 'grayscale(0.5)',
                      }}
                    />
                    <span style={{
                      fontSize: '0.5625rem',
                      color: isActive ? 'var(--gold)' : '#6a6080',
                      fontFamily: 'var(--font-heading)',
                      whiteSpace: 'nowrap',
                    }}>
                      {s.name_kr}
                    </span>
                    <span style={{
                      fontSize: '0.5rem',
                      fontFamily: 'var(--font-mono)',
                      color: ownCount === totalCount ? 'var(--gold)' : '#5a5070',
                    }}>
                      {ownCount}/{totalCount}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          <div className="p-4">
            {/* 키워드 필터 */}
            <KeywordFilterBar keywordFilter={keywordFilter} setKeywordFilter={setKeywordFilter} />

            {/* 미보유 표시 토글 */}
            <div className="flex items-center justify-end mb-3">
              <button
                onClick={() => setShowUnowned(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all duration-200"
                style={{
                  background: showUnowned ? 'rgba(90,80,112,0.15)' : 'transparent',
                  border: `1px solid ${showUnowned ? '#5a5070' : 'rgba(58,42,21,0.4)'}`,
                  color: showUnowned ? '#8a7aaa' : '#6a6080',
                  cursor: 'pointer',
                }}
              >
                {showUnowned ? <CheckSquare size={12} /> : <Square size={12} />}
                미보유 표시
              </button>
            </div>

            {/* ── 수감자별 보기 ──────────────────────────────── */}
            {viewMode === 'sinner' && (
              <>
                {/* 인격 */}
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span style={{ color: '#8a80a0', fontSize: '0.6875rem', fontFamily: 'var(--font-heading)' }}>인격</span>
                    <span style={{ color: '#8a80a0', fontSize: '0.625rem', fontFamily: 'var(--font-mono)' }}>
                      {currentIdentities.filter(i => owned.has(i.id)).length}/{currentIdentities.length}
                    </span>
                  </div>
                  {currentIdentities.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                      {currentIdentities.map(identity => (
                        <IdentityCard key={identity.id} identity={identity} isOwned={owned.has(identity.id)} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-8" style={{ color: '#8a80a0', fontSize: '0.75rem' }}>
                      해당 키워드의 인격이 없습니다
                    </p>
                  )}
                </div>

                {/* EGO */}
                <EgoSection egoList={currentEgos} owned={owned} />
              </>
            )}

            {/* ── 전체 보기 ─────────────────────────────────── */}
            {viewMode === 'all' && (
              <div className="space-y-6">
                {data.sinners.map(sinner => {
                  const allIds = filterByKeyword(data.identities[sinner.id] ?? [])
                  const allEgoList = filterEgoByKeyword(data.egos[sinner.id] ?? [])
                  const ids = showUnowned ? allIds : allIds.filter(i => owned.has(i.id))
                  const egoList = showUnowned ? allEgoList : allEgoList.filter(e => owned.has(e.id))
                  if (ids.length === 0 && egoList.length === 0) return null
                  const ownedIdCount = ids.filter(i => owned.has(i.id)).length
                  const ownedEgoCount = egoList.filter(e => owned.has(e.id)).length

                  return (
                    <section key={sinner.id}>
                      {/* 수감자 헤더 */}
                      <div className="flex items-center gap-2.5 mb-2.5 pb-2" style={{ borderBottom: '1px solid rgba(58,42,21,0.35)' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={sinnerLogoUrl(sinner.id)}
                          alt=""
                          width={22}
                          height={22}
                          style={{ borderRadius: '50%', opacity: 0.85 }}
                        />
                        <span style={{ color: 'var(--gold-light)', fontSize: '0.8125rem', fontFamily: 'var(--font-heading)', fontWeight: 600 }}>
                          {sinner.name_kr}
                        </span>
                        <span style={{ color: '#8a80a0', fontSize: '0.625rem', fontFamily: 'var(--font-mono)' }}>
                          {ownedIdCount + ownedEgoCount}/{ids.length + egoList.length}
                        </span>
                      </div>

                      {/* 인격 그리드 */}
                      {ids.length > 0 && (
                        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-1.5 mb-3">
                          {ids.map(identity => (
                            <IdentityCard key={identity.id} identity={identity} isOwned={owned.has(identity.id)} />
                          ))}
                        </div>
                      )}

                      {/* EGO */}
                      <EgoSection egoList={egoList} owned={owned} compact />
                    </section>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CollectionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen pt-24 pb-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div style={{ width: 200, height: 32, background: '#2a2015', borderRadius: 4 }} />
        </div>
      </div>
    }>
      <CollectionViewer />
    </Suspense>
  )
}
