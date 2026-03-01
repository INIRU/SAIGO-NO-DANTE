'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { STORAGE_BASE, GRADE_COLORS, SIN_COLORS, getKeywordIconUrl, KEYWORD_SIN_MAP, normalizeSin, type SinType } from '@/lib/data/sinners'
import { Check, CheckSquare, Square, Link2 } from 'lucide-react'
import { decodeCollectionAsync, BITS_IDENTITY, BITS_EGO, BITS_PER_SINNER } from '@/lib/collection'
import type { SinnerInfo, IdentityInfo, EGOInfo, CollectionData } from '@/lib/collection'

// ── 비트 인코딩 (저장/공유용, 이 컴포넌트에서만 사용) ───────────────────────
const TOTAL_BITS = 12 * BITS_PER_SINNER
const TOTAL_BYTES = TOTAL_BITS / 8

async function encodeCollection(
  owned: Set<string>,
  sinners: SinnerInfo[],
  identities: Record<string, IdentityInfo[]>,
  egos: Record<string, EGOInfo[]>,
): Promise<string> {
  const bits = new Uint8Array(TOTAL_BYTES)

  for (let si = 0; si < 12; si++) {
    const sinner = sinners[si]
    if (!sinner) continue
    const off = si * BITS_PER_SINNER

    const ids = identities[sinner.id] ?? []
    for (let i = 0; i < ids.length && i < BITS_IDENTITY; i++) {
      if (owned.has(ids[i].id)) {
        const bitIdx = off + i
        bits[Math.floor(bitIdx / 8)] |= (1 << (7 - (bitIdx % 8)))
      }
    }

    const egoList = egos[sinner.id] ?? []
    for (let i = 0; i < egoList.length && i < BITS_EGO; i++) {
      if (owned.has(egoList[i].id)) {
        const bitIdx = off + BITS_IDENTITY + i
        bits[Math.floor(bitIdx / 8)] |= (1 << (7 - (bitIdx % 8)))
      }
    }
  }

  const cs = new CompressionStream('gzip')
  const writer = cs.writable.getWriter()
  writer.write(bits)
  writer.close()
  const compressed = await new Response(cs.readable).arrayBuffer()
  return btoa(String.fromCharCode(...new Uint8Array(compressed)))
}

// ── 이미지 URL 헬퍼 ─────────────────────────────────────────────────────────
function identityProfileUrl(identity: IdentityInfo): string {
  if (!identity.game_id || !identity.folder_name) return ''
  const folder = encodeURIComponent(identity.folder_name)
  return `${STORAGE_BASE}/sinners/${identity.sinner_id}/identities/${folder}/${identity.game_id}_normal_info.webp`
}

function sinnerLogoUrl(sinnerId: string): string {
  return `${STORAGE_BASE}/icons/Sinners/${sinnerId}.webp`
}

// ── 키워드 필터 ─────────────────────────────────────────────────────────────
const MAIN_KEYWORDS: { keyword: string; sin: SinType }[] = [
  { keyword: '출혈', sin: 'wrath' },
  { keyword: '화상', sin: 'lust' },
  { keyword: '침잠', sin: 'gloom' },
  { keyword: '파열', sin: 'gluttony' },
  { keyword: '호흡', sin: 'pride' },
  { keyword: '충전', sin: 'envy' },
  { keyword: '진동', sin: 'sloth' },
]

// ── 등급 정렬 순서 ──────────────────────────────────────────────────────────
const GRADE_ORDER = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH']

// ── 컴포넌트 ────────────────────────────────────────────────────────────────
const LOCAL_STORAGE_KEY = 'limbus-collection'

interface CollectionSectionProps {
  savedCode?: string | null
  persistMode?: 'db' | 'local'
}

export default function CollectionSection({ savedCode, persistMode = 'db' }: CollectionSectionProps) {
  const searchParams = useSearchParams()

  const [data, setData] = useState<CollectionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [owned, setOwned] = useState<Set<string>>(new Set())
  const [activeSinner, setActiveSinner] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [keywordFilter, setKeywordFilter] = useState<string | null>(null)
  const [showUnowned, setShowUnowned] = useState(persistMode === 'local')

  // 데이터 로드
  useEffect(() => {
    fetch('/api/collection')
      .then(r => r.json())
      .then(async (d: CollectionData) => {
        setData(d)
        if (d.sinners.length > 0) setActiveSinner(d.sinners[0].id)

        if (persistMode === 'local') {
          // local 모드: localStorage 우선, 없으면 로그인 유저의 DB 저장값 동기화
          const localCode = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_KEY) : null
          if (localCode && d.sinners.length > 0) {
            const decoded = await decodeCollectionAsync(localCode, d.sinners, d.identities, d.egos)
            setOwned(decoded)
          } else {
            // localStorage 비어있으면 DB에서 가져와 동기화
            try {
              const res = await fetch('/api/profile')
              if (res.ok) {
                const profile = await res.json()
                const dbCode = profile?.profile?.collection_code
                if (dbCode && d.sinners.length > 0) {
                  const decoded = await decodeCollectionAsync(dbCode, d.sinners, d.identities, d.egos)
                  setOwned(decoded)
                  localStorage.setItem(LOCAL_STORAGE_KEY, dbCode)
                }
              }
            } catch {
              // 비로그인이면 무시
            }
          }
        } else {
          // db 모드: URL 파라미터 또는 DB 저장값
          const code = searchParams.get('collection') || savedCode
          if (code && d.sinners.length > 0) {
            const decoded = await decodeCollectionAsync(code, d.sinners, d.identities, d.egos)
            setOwned(decoded)
          }
        }
      })
      .finally(() => setLoading(false))
  }, [searchParams, persistMode, savedCode])

  // 토글
  const toggle = useCallback((id: string) => {
    setOwned(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setDirty(true)
  }, [])

  // 전체 선택/해제 (현재 수감자)
  const selectAll = useCallback(() => {
    if (!data) return
    setOwned(prev => {
      const next = new Set(prev)
      for (const id of data.identities[activeSinner] ?? []) next.add(id.id)
      for (const ego of data.egos[activeSinner] ?? []) next.add(ego.id)
      return next
    })
    setDirty(true)
  }, [data, activeSinner])

  const deselectAll = useCallback(() => {
    if (!data) return
    setOwned(prev => {
      const next = new Set(prev)
      for (const id of data.identities[activeSinner] ?? []) next.delete(id.id)
      for (const ego of data.egos[activeSinner] ?? []) next.delete(ego.id)
      return next
    })
    setDirty(true)
  }, [data, activeSinner])

  // 저장 (local: localStorage, db: API)
  const saveCollection = useCallback(async () => {
    if (!data) return
    setSaving(true)
    try {
      const code = await encodeCollection(owned, data.sinners, data.identities, data.egos)
      if (persistMode === 'local') {
        localStorage.setItem(LOCAL_STORAGE_KEY, code)
        setDirty(false)
      } else {
        const res = await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ collection_code: code }),
        })
        if (res.ok) setDirty(false)
      }
    } catch {
      // 저장 실패 무시
    } finally {
      setSaving(false)
    }
  }, [data, owned, persistMode])

  // local 모드: dirty 변경 시 debounce 자동 저장
  useEffect(() => {
    if (persistMode !== 'local' || !dirty || !data) return
    const timer = setTimeout(async () => {
      const code = await encodeCollection(owned, data.sinners, data.identities, data.egos)
      localStorage.setItem(LOCAL_STORAGE_KEY, code)
      setDirty(false)
    }, 500)
    return () => clearTimeout(timer)
  }, [persistMode, dirty, data, owned])

  // 공유 링크 복사
  const copyShareLink = useCallback(async () => {
    if (!data) return
    const code = await encodeCollection(owned, data.sinners, data.identities, data.egos)
    const url = `${window.location.origin}/collection?code=${encodeURIComponent(code)}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [data, owned])

  // 통계
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

  // 수감자별 보유 수 (탭 뱃지용)
  const sinnerOwnedCount = useCallback((sinnerId: string) => {
    if (!data) return 0
    const ids = data.identities[sinnerId] ?? []
    const egoList = data.egos[sinnerId] ?? []
    return ids.filter(i => owned.has(i.id)).length + egoList.filter(e => owned.has(e.id)).length
  }, [data, owned])

  const sinnerTotalCount = useCallback((sinnerId: string) => {
    if (!data) return 0
    return (data.identities[sinnerId]?.length ?? 0) + (data.egos[sinnerId]?.length ?? 0)
  }, [data])

  const filterByKeyword = useCallback((identities: IdentityInfo[]) => {
    if (!keywordFilter) return identities
    const filterSin = KEYWORD_SIN_MAP[keywordFilter]
    return identities.filter(i =>
      i.keywords?.some(kw => kw === keywordFilter || (filterSin && KEYWORD_SIN_MAP[kw] === filterSin))
    )
  }, [keywordFilter])

  const filterEgoByKeyword = useCallback((egoList: EGOInfo[]) => {
    if (!keywordFilter) return egoList
    const filterSin = KEYWORD_SIN_MAP[keywordFilter]
    if (!filterSin) return egoList
    return egoList.filter(e => normalizeSin(e.sin_affinity) === filterSin)
  }, [keywordFilter])

  if (loading) {
    return (
      <section style={{ background: '#1a1510', border: '1px solid var(--border)', borderRadius: 8, padding: 24 }}>
        <div style={{ width: 140, height: 14, background: '#2a2015', borderRadius: 2, marginBottom: 16 }} />
        <div className="flex gap-2 mb-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} style={{ width: 40, height: 40, borderRadius: '50%', background: '#2a2015' }} />
          ))}
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} style={{ aspectRatio: '3/4', background: '#2a2015', borderRadius: 6, opacity: 0.4 + i * 0.05 }} />
          ))}
        </div>
      </section>
    )
  }

  if (!data) return null

  const allIdentities = filterByKeyword(data.identities[activeSinner] ?? [])
  const allEgos = filterEgoByKeyword(data.egos[activeSinner] ?? [])
  const currentIdentities = showUnowned ? allIdentities : allIdentities.filter(i => owned.has(i.id))
  const currentEgos = showUnowned ? allEgos : allEgos.filter(e => owned.has(e.id))

  // EGO를 등급별로 그룹핑
  const egosByGrade = GRADE_ORDER.reduce<Record<string, EGOInfo[]>>((acc, grade) => {
    const filtered = currentEgos.filter(e => e.grade === grade)
    if (filtered.length > 0) acc[grade] = filtered
    return acc
  }, {})

  return (
    <section>
      <div className="flex items-center justify-between mb-5">
        <h2 className="flex items-center gap-2">
          <span style={{ color: '#3a3050', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.15em' }}>
            MY COLLECTION
          </span>
          <span className="font-serif font-bold" style={{ color: 'var(--gold)', fontSize: '16px' }}>
            보유 현황
          </span>
        </h2>
        <div className="flex items-center gap-2" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#4a4060' }}>
          <span>인격 <span style={{ color: 'var(--gold)' }}>{stats.ownedIdentities}</span>/{stats.totalIdentities}</span>
          <span style={{ color: '#2a2035', fontFamily: 'sans-serif' }}>·</span>
          <span>EGO <span style={{ color: 'var(--gold)' }}>{stats.ownedEgos}</span>/{stats.totalEgos}</span>
        </div>
      </div>

      <div
        style={{
          background: '#1a1510',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        {/* 수감자 탭 */}
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
                  fontSize: '9px',
                  color: isActive ? 'var(--gold)' : '#4a4060',
                  fontFamily: 'var(--font-heading)',
                  whiteSpace: 'nowrap',
                }}>
                  {s.name_kr}
                </span>
                <span style={{
                  fontSize: '8px',
                  fontFamily: 'var(--font-mono)',
                  color: ownCount === totalCount ? 'var(--gold)' : '#3a3050',
                }}>
                  {ownCount}/{totalCount}
                </span>
              </button>
            )
          })}
        </div>

        <div className="p-4">
          {/* 키워드 필터 */}
          <div className="flex items-center gap-1.5 flex-wrap mb-4 pb-3" style={{ borderBottom: '1px solid rgba(58,42,21,0.3)' }}>
            <button
              onClick={() => setKeywordFilter(null)}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all duration-200"
              style={{
                background: !keywordFilter ? 'rgba(200,144,10,0.15)' : 'transparent',
                border: `1px solid ${!keywordFilter ? 'var(--gold-dim)' : 'rgba(58,42,21,0.4)'}`,
                color: !keywordFilter ? 'var(--gold)' : '#4a4060',
                cursor: 'pointer',
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
                    color: isActive ? color : '#4a4060',
                    cursor: 'pointer',
                  }}
                >
                  {getKeywordIconUrl(keyword) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getKeywordIconUrl(keyword)!}
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

          {/* 미보유 표시 토글 */}
          <div className="flex items-center justify-end mb-3">
            <button
              onClick={() => setShowUnowned(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all duration-200"
              style={{
                background: showUnowned ? 'rgba(90,80,112,0.15)' : 'transparent',
                border: `1px solid ${showUnowned ? '#5a5070' : 'rgba(58,42,21,0.4)'}`,
                color: showUnowned ? '#8a7aaa' : '#4a4060',
                cursor: 'pointer',
              }}
            >
              {showUnowned ? (
                <CheckSquare size={12} />
              ) : (
                <Square size={12} />
              )}
              미보유 표시
            </button>
          </div>

          {/* 인격 섹션 */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <span style={{ color: '#5a5070', fontSize: '11px', fontFamily: 'var(--font-heading)' }}>인격</span>
              <span style={{ color: '#3a3050', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                {currentIdentities.filter(i => owned.has(i.id)).length}/{currentIdentities.length}
              </span>
            </div>

            {currentIdentities.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
              {currentIdentities.map(identity => {
                const isOwned = owned.has(identity.id)
                const url = identityProfileUrl(identity)
                return (
                  <button
                    key={identity.id}
                    onClick={() => toggle(identity.id)}
                    className="relative rounded overflow-hidden transition-all duration-200"
                    style={{
                      aspectRatio: '3/4',
                      border: `2px solid ${isOwned ? 'var(--gold-dim)' : 'rgba(58,42,21,0.3)'}`,
                      cursor: 'pointer',
                      background: '#0a0806',
                    }}
                  >
                    {url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={url}
                        alt={identity.name_kr}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          objectPosition: 'center top',
                          display: 'block',
                          filter: isOwned ? 'none' : 'grayscale(1) brightness(0.3)',
                          transition: 'filter 0.2s',
                        }}
                        loading="lazy"
                      />
                    )}
                    {/* 체크 표시 */}
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
                    {/* 이름 */}
                    <div
                      style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        background: 'linear-gradient(to top, rgba(10,8,6,0.95) 0%, transparent 100%)',
                        padding: '16px 4px 4px',
                      }}
                    >
                      <p style={{
                        fontSize: '9px',
                        color: isOwned ? '#c8a450' : '#4a4060',
                        textAlign: 'center',
                        fontFamily: 'var(--font-heading)',
                        lineHeight: 1.2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {identity.name_kr}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
            ) : (
              <p className="text-center py-6" style={{ color: '#3a3050', fontSize: '12px' }}>
                해당 키워드의 인격이 없습니다
              </p>
            )}
          </div>

          {/* EGO 섹션 */}
          {Object.keys(egosByGrade).length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span style={{ color: '#5a5070', fontSize: '11px', fontFamily: 'var(--font-heading)' }}>E.G.O</span>
                <span style={{ color: '#3a3050', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                  {currentEgos.filter(e => owned.has(e.id)).length}/{currentEgos.length}
                </span>
              </div>

              {Object.entries(egosByGrade).map(([grade, egoList]) => (
                <div key={grade} className="mb-3">
                  <p className="mb-1.5" style={{
                    fontSize: '9px',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.1em',
                    color: GRADE_COLORS[grade] ?? '#555',
                  }}>
                    {grade}
                  </p>
                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
                    {egoList.map(ego => {
                      const isOwned = owned.has(ego.id)
                      return (
                        <button
                          key={ego.id}
                          onClick={() => toggle(ego.id)}
                          className="relative rounded overflow-hidden transition-all duration-200"
                          style={{
                            aspectRatio: '1',
                            border: `2px solid ${isOwned ? (GRADE_COLORS[grade] ?? 'var(--gold-dim)') : 'rgba(58,42,21,0.3)'}`,
                            cursor: 'pointer',
                            background: '#0a0806',
                          }}
                        >
                          {ego.image_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={ego.image_url}
                              alt={ego.name_kr ?? ''}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                display: 'block',
                                filter: isOwned ? 'none' : 'grayscale(1) brightness(0.3)',
                                transition: 'filter 0.2s',
                              }}
                              loading="lazy"
                            />
                          )}
                          {isOwned && (
                            <div style={{
                              position: 'absolute', top: 2, right: 2,
                              width: 14, height: 14, borderRadius: '50%',
                              background: GRADE_COLORS[grade] ?? 'var(--gold)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <Check size={8} style={{ color: '#0d0b08' }} />
                            </div>
                          )}
                          <div
                            style={{
                              position: 'absolute', bottom: 0, left: 0, right: 0,
                              background: 'linear-gradient(to top, rgba(10,8,6,0.95) 0%, transparent 100%)',
                              padding: '12px 3px 3px',
                            }}
                          >
                            <p style={{
                              fontSize: '8px',
                              color: isOwned ? '#c8a450' : '#4a4060',
                              textAlign: 'center',
                              fontFamily: 'var(--font-heading)',
                              lineHeight: 1.2,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {ego.name_kr}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 하단 액션 바 */}
          <div
            className="flex flex-wrap items-center gap-2 pt-4 mt-4"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            <button
              onClick={selectAll}
              className="flex items-center gap-1 px-3 py-1.5 rounded text-xs transition-opacity hover:opacity-80"
              style={{ color: '#7a6845', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'var(--font-heading)' }}
            >
              <CheckSquare size={11} />
              전체 선택
            </button>
            <button
              onClick={deselectAll}
              className="flex items-center gap-1 px-3 py-1.5 rounded text-xs transition-opacity hover:opacity-80"
              style={{ color: '#7a6845', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'var(--font-heading)' }}
            >
              <Square size={11} />
              전체 해제
            </button>
            <div className="flex-1" />
            {dirty && (
              <button
                onClick={saveCollection}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-medium transition-all duration-200 hover:brightness-110"
                style={{
                  background: 'rgba(200,144,10,0.15)',
                  color: 'var(--gold)',
                  border: '1px solid var(--gold-dim)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-heading)',
                }}
              >
                <Check size={12} />
                {saving ? '저장 중...' : '저장'}
              </button>
            )}
            <button
              onClick={copyShareLink}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-medium transition-all duration-200 hover:brightness-110"
              style={{
                background: copied ? 'rgba(26,100,26,0.8)' : 'var(--gold)',
                color: copied ? '#80ff80' : 'var(--bg-deep)',
                cursor: 'pointer',
                fontFamily: 'var(--font-heading)',
              }}
            >
              {copied ? <Check size={12} /> : <Link2 size={12} />}
              {copied ? '복사 완료!' : '공유 링크 복사'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
