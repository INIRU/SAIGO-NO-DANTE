'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Search, X, ChevronRight } from 'lucide-react'
import { STORAGE_BASE } from '@/lib/data/sinners'
import { SIN_COLORS } from '@/lib/constants/sin'
import { useFormatSkillDesc } from '@/components/providers/KeywordProvider'

/* ── 타입 ── */
interface Keyword {
  name: string
  description: string | null
  max_stack: number | null
  icon_slug: string | null
  sin_affinity: string | null
}

interface Identity {
  id: string
  name: string
  name_kr: string
  sinner_id: string
  keywords: string[] | null
  rarity: number
  game_id: string | null
  folder_name: string | null
}

interface Sinner {
  id: string
  name_kr: string
}

interface EgoGift {
  name: string
  keyword: string
  grade: string
  image_url: string | null
}

interface EGO {
  id: string
  name: string
  name_kr: string | null
  sinner_id: string
  grade: string
  sin_affinity: string | null
  keywords: string[] | null
  folder_name: string | null
  image_url: string | null
}

const RARITY_ICONS: Record<number, string> = { 1: '1star', 2: '2star', 3: '3star' }

const SIN_LABELS: Record<string, string> = {
  wrath: '분노', lust: '색욕', sloth: '나태', gluttony: '탐식',
  gloom: '우울', pride: '오만', envy: '질투',
}


const GRADE_LABELS: Record<string, string> = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV', '5': 'V', 'EX': 'EX' }

export default function KeywordsClient({
  keywords, identities, sinners, gifts, egos,
}: {
  keywords: Keyword[]
  identities: Identity[]
  sinners: Sinner[]
  gifts: EgoGift[]
  egos: EGO[]
}) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Keyword | null>(null)
  const formatSkillDesc = useFormatSkillDesc()

  // 수감자 이름 맵 (slug → 한국어)
  const sinnerNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    sinners.forEach(s => { map[s.id] = s.name_kr })
    return map
  }, [sinners])

  // 키워드별 인격 수 맵
  const identityCountMap = useMemo(() => {
    const map: Record<string, number> = {}
    identities.forEach(id => {
      (id.keywords ?? []).forEach(kw => { map[kw] = (map[kw] || 0) + 1 })
    })
    return map
  }, [identities])

  // 키워드별 EGO 수 맵
  const egoCountMap = useMemo(() => {
    const map: Record<string, number> = {}
    egos.forEach(ego => {
      (ego.keywords ?? []).forEach(kw => { map[kw] = (map[kw] || 0) + 1 })
    })
    return map
  }, [egos])

  // 키워드별 기프트 수 맵
  const giftCountMap = useMemo(() => {
    const map: Record<string, number> = {}
    gifts.forEach(g => { map[g.keyword] = (map[g.keyword] || 0) + 1 })
    return map
  }, [gifts])

  // 필터링
  const filtered = useMemo(() => {
    return keywords.filter(kw => {
      if (search && !kw.name.includes(search) && !kw.description?.includes(search)) return false
      return true
    }).sort((a, b) => {
      // 관련 인격 수 + EGO 수 + 기프트 수 내림차순
      const aCount = (identityCountMap[a.name] || 0) + (egoCountMap[a.name] || 0) + (giftCountMap[a.name] || 0)
      const bCount = (identityCountMap[b.name] || 0) + (egoCountMap[b.name] || 0) + (giftCountMap[b.name] || 0)
      return bCount - aCount
    })
  }, [keywords, search, identityCountMap, giftCountMap])

  // 무한 스크롤
  const PAGE_SIZE = 60
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef(false)
  const animatedCountRef = useRef(0)

  useEffect(() => { setVisibleCount(PAGE_SIZE); animatedCountRef.current = 0 }, [filtered])

  const visibleKeywords = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !loadingRef.current) {
        loadingRef.current = true
        setVisibleCount(prev => {
          const next = Math.min(prev + PAGE_SIZE, filtered.length)
          setTimeout(() => { loadingRef.current = false }, 300)
          return next
        })
      }
    }, { rootMargin: '200px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [visibleCount, filtered.length])

  // GSAP 진입 애니메이션
  useEffect(() => {
    const init = async () => {
      const { gsap } = await import('gsap')
      const cards = document.querySelectorAll('.kw-card')
      const newCards: Element[] = []
      cards.forEach((card, i) => {
        if (i >= animatedCountRef.current) newCards.push(card)
      })
      if (newCards.length > 0) {
        gsap.fromTo(newCards,
          { opacity: 0, y: 12, scale: 0.97 },
          { opacity: 1, y: 0, scale: 1, duration: 0.25, stagger: 0.006, ease: 'power2.out' }
        )
      }
      animatedCountRef.current = cards.length
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, visibleCount])

  // 모달 body 스크롤 잠금
  useEffect(() => {
    if (selected) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
  }, [selected])

  // 선택된 키워드의 관련 인격/기프트
  const relatedIdentities = useMemo(() => {
    if (!selected) return []
    return identities.filter(id => (id.keywords ?? []).includes(selected.name))
  }, [selected, identities])

  const relatedEgos = useMemo(() => {
    if (!selected) return []
    return egos.filter(ego => (ego.keywords ?? []).includes(selected.name))
  }, [selected, egos])

  const relatedGifts = useMemo(() => {
    if (!selected) return []
    return gifts.filter(g => g.keyword === selected.name)
  }, [selected, gifts])

  const getIconUrl = useCallback((slug: string | null) => {
    if (!slug) return null
    return `${STORAGE_BASE}/icons/keywords/${slug}.webp`
  }, [])

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 md:px-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="text-center mb-10">
        <p className="font-mono text-[0.625rem] tracking-[0.3em] mb-2" style={{ color: '#c8900a' }}>
          KEYWORD ARCHIVE
        </p>
        <h1 className="font-serif text-3xl md:text-4xl font-bold mb-2" style={{ color: '#e8dcc8' }}>
          키워드 도감
        </h1>
        <p className="text-[0.8125rem]" style={{ color: '#7a6845' }}>
          {keywords.length}종의 키워드 — 관련 인격, E.G.O 기프트 모아보기
        </p>
      </div>

      {/* 장식선 */}
      <div className="flex items-center justify-center gap-2 mb-8">
        <div style={{ width: '4rem', height: '0.0625rem', background: 'linear-gradient(90deg, transparent, rgba(200,144,10,0.3))' }} />
        <div style={{ width: '0.25rem', height: '0.25rem', background: '#c8900a', transform: 'rotate(45deg)', opacity: 0.5 }} />
        <div style={{ width: '4rem', height: '0.0625rem', background: 'linear-gradient(90deg, rgba(200,144,10,0.3), transparent)' }} />
      </div>

      {/* 검색 바 */}
      <div className="mb-6 max-w-md mx-auto">
        <div
          className="relative flex items-center rounded-lg overflow-hidden"
          style={{
            background: '#1a1510',
            border: '0.0625rem solid rgba(200,144,10,0.15)',
            boxShadow: '0 0 1rem rgba(200,144,10,0.03)',
          }}
        >
          <Search size={16} className="absolute left-3" style={{ color: '#7a6845' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="키워드 이름 또는 설명으로 검색..."
            className="w-full pl-10 pr-16 py-2.5 text-[0.875rem]"
            style={{ background: 'transparent', color: '#e8dcc8', outline: 'none' }}
          />
          <div className="absolute right-3 flex items-center gap-2">
            {search && (
              <button onClick={() => setSearch('')} className="hover:opacity-80 transition-opacity" style={{ color: '#7a6845' }}>
                <X size={14} />
              </button>
            )}
            <span className="text-[0.6875rem] tabular-nums" style={{ color: '#555', fontFamily: 'var(--font-heading)' }}>
              {filtered.length}/{keywords.length}
            </span>
          </div>
        </div>
      </div>

      {/* 키워드 그리드 */}
      {filtered.length === 0 ? (
        <div className="text-center py-20" style={{ color: '#555' }}>
          <p className="text-lg mb-2">결과 없음</p>
          <p className="text-sm">검색어나 필터를 변경해 보세요.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(16rem, 1fr))' }}>
            {visibleKeywords.map(kw => {
              const iconUrl = getIconUrl(kw.icon_slug)
              const idCount = identityCountMap[kw.name] || 0
              const egoCount = egoCountMap[kw.name] || 0
              const giftCount = giftCountMap[kw.name] || 0
              const sinColor = kw.sin_affinity ? ((SIN_COLORS as Record<string, string>)[kw.sin_affinity!] || '#c8900a') : null

              return (
                <button
                  key={kw.name}
                  onClick={() => setSelected(kw)}
                  className="kw-card group text-left rounded-lg p-3 transition-all duration-200 hover:scale-[1.02]"
                  style={{
                    opacity: 0,
                    background: '#1a1510',
                    border: '0.0625rem solid rgba(200,144,10,0.08)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = sinColor ? `${sinColor}40` : 'rgba(200,144,10,0.25)'
                    e.currentTarget.style.boxShadow = `0 0 1rem ${sinColor ? `${sinColor}15` : 'rgba(200,144,10,0.08)'}`
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(200,144,10,0.08)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <div className="flex items-start gap-2.5">
                    {/* 아이콘 */}
                    <div
                      className="shrink-0 flex items-center justify-center rounded"
                      style={{
                        width: '2.25rem', height: '2.25rem',
                        background: sinColor ? `${sinColor}10` : 'rgba(200,144,10,0.06)',
                        border: `0.0625rem solid ${sinColor ? `${sinColor}20` : 'rgba(200,144,10,0.1)'}`,
                      }}
                    >
                      {iconUrl ? (
                        <Image src={iconUrl} alt={kw.name} width={20} height={20}
                          style={{ width: '1.25rem', height: '1.25rem' }} />
                      ) : (
                        <span style={{ color: '#555', fontSize: '0.75rem' }}>?</span>
                      )}
                    </div>

                    {/* 텍스트 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-bold text-[0.8125rem] truncate" style={{ color: '#e8dcc8' }}>
                          {kw.name}
                        </span>
                        {kw.max_stack && (
                          <span className="text-[0.625rem] shrink-0" style={{ color: '#7a6845' }}>
                            (최대 {kw.max_stack})
                          </span>
                        )}
                      </div>
                      {kw.description && (
                        <p className="text-[0.6875rem] leading-relaxed line-clamp-2" style={{ color: '#7a6845' }}>
                          {kw.description}
                        </p>
                      )}
                      {/* 카운트 태그 */}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {idCount > 0 && (
                          <span className="text-[0.5625rem] px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(200,144,10,0.08)', color: '#c8900a' }}>
                            인격 {idCount}
                          </span>
                        )}
                        {egoCount > 0 && (
                          <span className="text-[0.5625rem] px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(180,100,100,0.08)', color: '#b06060' }}>
                            EGO {egoCount}
                          </span>
                        )}
                        {giftCount > 0 && (
                          <span className="text-[0.5625rem] px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(100,180,100,0.08)', color: '#6a9a6a' }}>
                            기프트 {giftCount}
                          </span>
                        )}
                        {sinColor && (
                          <span className="text-[0.5625rem] px-1.5 py-0.5 rounded"
                            style={{ background: `${sinColor}10`, color: sinColor }}>
                            {SIN_LABELS[kw.sin_affinity!]}
                          </span>
                        )}
                      </div>
                    </div>

                    <ChevronRight size={14} className="shrink-0 mt-1 opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: '#c8900a' }} />
                  </div>
                </button>
              )
            })}
          </div>

          {/* 무한 스크롤 sentinel */}
          {visibleCount < filtered.length && (
            <div ref={sentinelRef} className="flex justify-center py-6">
              <span style={{ color: '#555', fontSize: '0.75rem' }}>불러오는 중...</span>
            </div>
          )}
        </>
      )}

      {/* 키워드 상세 모달 */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 pb-8"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(0.25rem)' }}
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-2xl rounded-lg overflow-hidden"
            style={{ background: '#1a1510', border: '0.0625rem solid rgba(200,144,10,0.15)', maxHeight: 'calc(100vh - 7rem)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="p-5 pb-4" style={{ borderBottom: '0.0625rem solid rgba(200,144,10,0.08)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {selected.icon_slug && (
                    <div className="flex items-center justify-center rounded"
                      style={{
                        width: '2.75rem', height: '2.75rem',
                        background: selected.sin_affinity ? `${(SIN_COLORS as Record<string, string>)[selected.sin_affinity!]}10` : 'rgba(200,144,10,0.06)',
                        border: `0.0625rem solid ${selected.sin_affinity ? `${(SIN_COLORS as Record<string, string>)[selected.sin_affinity!]}25` : 'rgba(200,144,10,0.12)'}`,
                      }}
                    >
                      <Image
                        src={`${STORAGE_BASE}/icons/keywords/${selected.icon_slug}.webp`}
                        alt={selected.name} width={28} height={28}
                        style={{ width: '1.75rem', height: '1.75rem' }}
                      />
                    </div>
                  )}
                  <div>
                    <h2 className="font-serif text-lg font-bold" style={{ color: '#e8dcc8' }}>
                      {selected.name}
                    </h2>
                    <div className="flex gap-2 mt-0.5">
                      {selected.max_stack && (
                        <span className="text-[0.625rem]" style={{ color: '#7a6845' }}>최대 {selected.max_stack}</span>
                      )}
                      {selected.sin_affinity && (
                        <span className="text-[0.625rem]" style={{ color: (SIN_COLORS as Record<string, string>)[selected.sin_affinity!] }}>
                          {SIN_LABELS[selected.sin_affinity]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="p-2 rounded hover:bg-white/5 transition-colors" style={{ color: '#555' }}>
                  <X size={18} />
                </button>
              </div>

              {/* 설명 */}
              {selected.description && (
                <div className="mt-3 text-[0.8125rem] leading-[1.7]" style={{ color: '#a89070' }}>
                  {selected.description.split('\n').filter(Boolean).map((line, i) => (
                    <p key={i}>{formatSkillDesc(line, '#a89070')}</p>
                  ))}
                </div>
              )}
            </div>

            {/* 모달 바디 — 스크롤 */}
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 18rem)' }}>
              {/* 관련 인격 */}
              {relatedIdentities.length > 0 && (
                <div className="p-5 pb-4" style={{ borderBottom: '0.0625rem solid rgba(200,144,10,0.06)' }}>
                  <h3 className="text-[0.75rem] font-bold mb-3" style={{ color: '#c8900a', fontFamily: 'var(--font-heading)', letterSpacing: '0.05em' }}>
                    관련 인격 ({relatedIdentities.length})
                  </h3>
                  <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(14rem, 1fr))' }}>
                    {relatedIdentities.map(id => (
                      <Link
                        key={id.id}
                        href={`/sinners/${id.sinner_id}/identities/${id.id}`}
                        className="flex items-center gap-2.5 p-2 rounded transition-colors hover:bg-white/[0.03] overflow-hidden"
                        style={{ border: '0.0625rem solid rgba(200,144,10,0.06)' }}
                        onClick={() => setSelected(null)}
                      >
                        {id.game_id && id.folder_name && (
                          <Image
                            src={`${STORAGE_BASE}/sinners/${id.sinner_id}/identities/${encodeURIComponent(id.folder_name)}/${id.game_id}_normal_info.webp`}
                            alt={id.name_kr} width={36} height={48}
                            className="rounded shrink-0"
                            style={{ width: '2.25rem', height: '3rem', objectFit: 'cover' }}
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-[0.75rem] truncate" style={{ color: '#e8dcc8' }}>{id.name_kr}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {RARITY_ICONS[id.rarity] && (
                              <Image
                                src={`${STORAGE_BASE}/icons/Rarity/${RARITY_ICONS[id.rarity]}.webp`}
                                alt="" width={id.rarity === 1 ? 12 : id.rarity === 2 ? 20 : 28} height={12}
                                style={{ width: id.rarity === 1 ? '0.75rem' : id.rarity === 2 ? '1.25rem' : '1.75rem', height: 'auto' }}
                              />
                            )}
                            <span className="text-[0.5625rem]" style={{ color: '#555' }}>
                              {sinnerNameMap[id.sinner_id] || id.sinner_id}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* 관련 EGO */}
              {relatedEgos.length > 0 && (
                <div className="p-5 pb-4" style={{ borderBottom: '0.0625rem solid rgba(200,144,10,0.06)' }}>
                  <h3 className="text-[0.75rem] font-bold mb-3" style={{ color: '#b06060', fontFamily: 'var(--font-heading)', letterSpacing: '0.05em' }}>
                    관련 E.G.O ({relatedEgos.length})
                  </h3>
                  <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(14rem, 1fr))' }}>
                    {relatedEgos.map(ego => (
                      <Link
                        key={ego.id}
                        href={`/sinners/${ego.sinner_id}/ego/${ego.id}`}
                        className="flex items-center gap-2.5 p-2 rounded transition-colors hover:bg-white/[0.03] overflow-hidden"
                        style={{ border: '0.0625rem solid rgba(180,100,100,0.06)' }}
                        onClick={() => setSelected(null)}
                      >
                        {ego.image_url && (
                          <Image
                            src={ego.image_url}
                            alt={ego.name_kr || ego.name} width={36} height={48}
                            className="rounded shrink-0"
                            style={{ width: '2.25rem', height: '3rem', objectFit: 'cover' }}
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-[0.75rem] truncate" style={{ color: '#e8dcc8' }}>{ego.name_kr || ego.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Image
                              src={`${STORAGE_BASE}/icons/grade/${ego.grade}.webp`}
                              alt={ego.grade} width={28} height={12}
                              style={{ width: '1.75rem', height: 'auto' }}
                            />
                            <span className="text-[0.5625rem] truncate" style={{ color: '#555' }}>
                              {sinnerNameMap[ego.sinner_id] || ego.sinner_id}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* 관련 에고 기프트 */}
              {relatedGifts.length > 0 && (
                <div className="p-5 pb-4">
                  <h3 className="text-[0.75rem] font-bold mb-3" style={{ color: '#6a9a6a', fontFamily: 'var(--font-heading)', letterSpacing: '0.05em' }}>
                    관련 E.G.O 기프트 ({relatedGifts.length})
                  </h3>
                  <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(14rem, 1fr))' }}>
                    {relatedGifts.map(g => (
                      <Link
                        key={g.name}
                        href="/mirror-dungeon"
                        className="flex items-center gap-2.5 p-2 rounded transition-colors hover:bg-white/[0.03]"
                        style={{ border: '0.0625rem solid rgba(100,180,100,0.06)' }}
                        onClick={() => setSelected(null)}
                      >
                        {g.image_url && (
                          <Image
                            src={g.image_url} alt={g.name} width={36} height={36}
                            className="rounded"
                            style={{ width: '2.25rem', height: '2.25rem', objectFit: 'contain', background: 'rgba(0,0,0,0.3)' }}
                          />
                        )}
                        <div className="min-w-0">
                          <p className="text-[0.75rem] truncate" style={{ color: '#e8dcc8' }}>{g.name}</p>
                          <p className="text-[0.5625rem]" style={{ color: '#555' }}>
                            등급 {GRADE_LABELS[g.grade] ?? g.grade}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* 관련 데이터 없음 */}
              {relatedIdentities.length === 0 && relatedEgos.length === 0 && relatedGifts.length === 0 && (
                <div className="p-8 text-center" style={{ color: '#555', fontSize: '0.8125rem' }}>
                  관련 인격이나 기프트가 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .kw-card { container-type: inline-size; }
      `}</style>
    </div>
  )
}
