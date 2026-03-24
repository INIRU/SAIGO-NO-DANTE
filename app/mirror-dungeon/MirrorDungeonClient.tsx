'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import ImageWithFallback from '@/components/ui/ImageWithFallback'
import { Search, X } from 'lucide-react'
import Dropdown from '@/components/ui/Dropdown'
import { ATK_TYPE_ICON_MAP } from '@/lib/data/sinners'
import { useKeywordData } from '@/components/sinners/KeywordTooltip'
import type { EgoGift, Recipe, EgoGiftTheme, MirrorDungeonEvent } from '@/components/mirror-dungeon/types'
import { KEYWORD_COLORS } from '@/components/mirror-dungeon/types'
import GiftCard from '@/components/mirror-dungeon/GiftCard'
import GiftModal from '@/components/mirror-dungeon/GiftModal'
import GradeMultiDropdown from '@/components/mirror-dungeon/GradeMultiDropdown'

/* ── 타입/상수는 @/components/mirror-dungeon/types.ts에서 import ── */

/** 이벤트 텍스트의 {0}, {1} 등 수감자 플레이스홀더를 치환 */
function replaceEventPlaceholders(text: string | null | undefined): string {
  if (!text) return ''
  return text.replace(/\{(\d+)\}/g, '○○')
}

/* ── 난이도 (DB difficulty 컬럼 사용) ── */

/* ── 키워드 설정 ── */
const KEYWORDS = [
  { key: '전체', label: '전체' },
  { key: '화상', label: '화상' },
  { key: '출혈', label: '출혈' },
  { key: '진동', label: '진동' },
  { key: '파열', label: '파열' },
  { key: '침잠', label: '침잠' },
  { key: '호흡', label: '호흡' },
  { key: '충전', label: '충전' },
  { key: '참격', label: '참격' },
  { key: '관통', label: '관통' },
  { key: '타격', label: '타격' },
  { key: '공통', label: '공통' },
]


/* ── 메인 컴포넌트 ── */
export default function MirrorDungeonClient({
  gifts,
  recipes,
  themes = [],
  events = [],
}: {
  gifts: EgoGift[]
  recipes: Recipe[]
  themes?: EgoGiftTheme[]
  events?: MirrorDungeonEvent[]
}) {
  const { getIconUrl } = useKeywordData()
  const getGiftKeywordIcon = useCallback(
    (keyword: string) => getIconUrl(keyword) ?? ATK_TYPE_ICON_MAP[keyword] ?? null,
    [getIconUrl]
  )

  const [keywords, setKeywords] = useState<Set<string>>(new Set())
  const [grades, setGrades] = useState<Set<string>>(new Set())
  const [tiers, setTiers] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<EgoGift | null>(null)
  const [sortBy, setSortBy] = useState<'default' | 'name' | 'grade'>('default')
  const [sortDesc, setSortDesc] = useState(false)
  const [activeTab, setActiveTab] = useState<'gifts' | 'themes' | 'events'>('gifts')
  const [selectedThemeId, setSelectedThemeId] = useState<number | null>(null)
  const [expandedThemeId, setExpandedThemeId] = useState<number | null>(null)
  const [themeSearch, setThemeSearch] = useState('')
  const [themeSearchFocused, setThemeSearchFocused] = useState(false)
  const [themeDiffFilter, setThemeDiffFilter] = useState<string>('전체')
  const [selectedEvent, setSelectedEvent] = useState<MirrorDungeonEvent | null>(null)
  const [eventSearch, setEventSearch] = useState('')

  // 모달 열릴 때 배경 스크롤 잠금
  useEffect(() => {
    const isOpen = !!selected || expandedThemeId !== null || !!selectedEvent
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [selected, expandedThemeId, selectedEvent])

  // game_id → EgoGift 매핑 (테마팩 필터용)
  const giftByGameId = useMemo(() => {
    const map = new Map<number, EgoGift>()
    for (const g of gifts) {
      if (g.game_id) map.set(g.game_id, g)
    }
    return map
  }, [gifts])

  // 테마팩별 기프트 이름 Set (필터용)
  const themeGiftNames = useMemo(() => {
    if (!selectedThemeId) return null
    const theme = themes.find(t => t.id === selectedThemeId)
    if (!theme) return null
    const names = new Set<string>()
    for (const gid of theme.ego_gift_ids) {
      const g = giftByGameId.get(gid)
      if (g) names.add(g.name)
    }
    return names
  }, [selectedThemeId, themes, giftByGameId])

  // 기프트가 속한 테마팩 목록 (상세 모달용)
  const getThemesForGift = useCallback((gift: EgoGift) => {
    if (!gift.game_id) return []
    return themes.filter(t => t.ego_gift_ids.includes(gift.game_id!))
  }, [themes])

  // 테마팩 검색 필터
  const filteredThemes = useMemo(() => {
    let result = themes
    if (themeDiffFilter !== '전체') {
      const diffMap: Record<string, string> = { '노말': 'normal', '하드': 'hard', '익스트림': 'extreme' }
      result = result.filter(t => t.difficulty === diffMap[themeDiffFilter])
    }
    if (themeSearch.trim()) {
      const q = themeSearch.trim().toLowerCase()
      result = result.filter(t => {
        if (t.name.toLowerCase().includes(q)) return true
        // 기프트 이름으로도 검색
        return t.ego_gift_ids.some(gid => {
          const g = giftByGameId.get(gid)
          return g && g.name.toLowerCase().includes(q)
        })
      })
    }
    return result
  }, [themes, themeSearch, themeDiffFilter, giftByGameId])

  // 던전 층 매핑: 노말/하드 1-5, 평행중첩 6-10, 익스트림 11-15
  const FLOOR_OFFSET: Record<string, number> = { '노말': 0, '하드': 0, '평행중첩': 5, '익스트림': 10 }
  const FLOOR_RANGE: Record<string, [number, number]> = { '노말': [1, 5], '하드': [1, 5], '평행중첩': [6, 10], '익스트림': [11, 15] }

  const floorGroupedThemes = useMemo(() => {
    const floorKeys: string[] =
      themeDiffFilter === '전체' ? ['노말', '하드', '평행중첩', '익스트림']
      : themeDiffFilter === '하드' ? ['하드', '평행중첩']
      : [themeDiffFilter]

    const floorMap = new Map<number, EgoGiftTheme[]>()

    function addToFloor(floor: number, theme: EgoGiftTheme) {
      const arr: EgoGiftTheme[] = floorMap.get(floor) ?? []
      if (!arr.includes(theme)) arr.push(theme)
      floorMap.set(floor, arr)
    }

    for (const theme of filteredThemes) {
      if (!theme.floor_info) continue
      for (const key of floorKeys) {
        const floors: number[] | string | undefined = theme.floor_info[key]
        if (!floors) continue
        const offset = FLOOR_OFFSET[key] ?? 0

        if (Array.isArray(floors)) {
          for (const f of floors as number[]) addToFloor(f + offset, theme)
        } else if (floors === '전체') {
          const range = FLOOR_RANGE[key]
          if (range) {
            for (let f = range[0]; f <= range[1]; f++) addToFloor(f, theme)
          }
        }
      }
    }

    // floor_info가 없는 테마팩은 "기타"
    const unassigned = filteredThemes.filter(t => {
      if (!t.floor_info) return true
      return !floorKeys.some(k => t.floor_info?.[k])
    })

    // 연속 층 중 테마팩 구성이 동일하면 범위로 병합
    const sorted = [...floorMap.entries()].sort((a, b) => a[0] - b[0])
    const merged: [number, number, EgoGiftTheme[]][] = [] // [startFloor, endFloor, themes]
    for (const [floor, themes] of sorted) {
      const ids = new Set(themes.map(t => t.id))
      const prev = merged[merged.length - 1]
      if (prev && floor === prev[1] + 1) {
        const prevIds = new Set(prev[2].map(t => t.id))
        if (ids.size === prevIds.size && [...ids].every(id => prevIds.has(id))) {
          prev[1] = floor // 범위 확장
          continue
        }
      }
      merged.push([floor, floor, themes])
    }
    if (unassigned.length > 0) merged.push([0, 0, unassigned])
    return merged.length > 0 ? merged : null
  }, [filteredThemes, themeDiffFilter])

  // 자동완성 후보
  const themeSearchSuggestions = useMemo(() => {
    if (!themeSearch.trim() || themeSearch.trim().length < 1) return []
    const q = themeSearch.trim().toLowerCase()
    const suggestions: Array<{ type: 'theme' | 'gift'; label: string; sub?: string }> = []
    // 테마명 매칭
    for (const t of themes) {
      if (t.name.toLowerCase().includes(q)) {
        const diff = t.difficulty === 'hard' ? ' [하드]' : t.difficulty === 'extreme' ? ' [익스트림]' : ''
        suggestions.push({ type: 'theme', label: t.name, sub: diff })
      }
      if (suggestions.length >= 8) break
    }
    // 기프트명 매칭 (테마에 속하는 것만)
    if (suggestions.length < 8) {
      const seen = new Set<string>()
      for (const g of gifts) {
        if (g.name.toLowerCase().includes(q) && !seen.has(g.name)) {
          seen.add(g.name)
          const belongThemes = themes.filter(t => g.game_id && t.ego_gift_ids.includes(g.game_id))
          if (belongThemes.length > 0) {
            suggestions.push({ type: 'gift', label: g.name, sub: `${belongThemes.length}개 테마팩` })
          }
          if (suggestions.length >= 8) break
        }
      }
    }
    return suggestions
  }, [themeSearch, themes, gifts])

  const toggleKeyword = (key: string) => {
    setKeywords(prev => {
      if (key === '전체') return new Set()
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  const toggleTier = (t: string) => {
    setTiers(prev => {
      if (t === '전체') return new Set()
      const next = new Set(prev)
      if (next.has(t)) next.delete(t); else next.add(t)
      return next
    })
  }

  const toggleGrade = (g: string) => {
    setGrades(prev => {
      if (g === '전체') return new Set()
      const next = new Set(prev)
      if (next.has(g)) next.delete(g); else next.add(g)
      return next
    })
  }

  // 레시피 맵: result_name → Recipe
  const recipeMap = useMemo(() => {
    const map = new Map<string, Recipe>()
    recipes.forEach(r => map.set(r.result_name, r))
    return map
  }, [recipes])

  // 기프트 이름 → 이미지 URL 맵
  const giftImageMap = useMemo(() => {
    const map = new Map<string, string>()
    gifts.forEach(g => { if (g.image_url) map.set(g.name, g.image_url) })
    return map
  }, [gifts])

  // 등급 정렬용 순서
  const GRADE_ORDER: Record<string, number> = { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, 'EX': 6 }

  // 필터링 + 정렬
  const filtered = useMemo(() => {
    const DIFF_ORDER = { '노말': 0, '하드': 1, '익스트림': 2 } as const
    const result = gifts.filter(g => {
      if (keywords.size > 0 && !keywords.has(g.keyword)) return false
      if (grades.size > 0 && !grades.has(g.grade)) return false
      if (tiers.size > 0 && !g.is_synthesis) {
        const selected = [...tiers][0] as keyof typeof DIFF_ORDER
        const giftDiff = (g.difficulty || '노말') as keyof typeof DIFF_ORDER
        const selectedIdx = DIFF_ORDER[selected] ?? 2
        const giftIdx = DIFF_ORDER[giftDiff] ?? 0
        if (giftIdx > selectedIdx) return false
      }
      if (search && !g.name.includes(search)) return false
      if (themeGiftNames && !themeGiftNames.has(g.name)) return false
      return true
    })

    if (sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    } else if (sortBy === 'grade') {
      result.sort((a, b) => (GRADE_ORDER[a.grade] ?? 0) - (GRADE_ORDER[b.grade] ?? 0))
    }

    if (sortDesc) result.reverse()

    return result
  }, [gifts, keywords, grades, tiers, search, sortBy, sortDesc, themeGiftNames])

  // 무한 스크롤: 한 번에 40개씩 로드
  const PAGE_SIZE = 40
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef(false)
  const animatedCountRef = useRef(0)

  // 필터/탭 변경 시 visibleCount + 애니메이션 카운터 + loadingRef 리셋
  useEffect(() => { setVisibleCount(PAGE_SIZE); animatedCountRef.current = 0; loadingRef.current = false }, [filtered, activeTab])

  const visibleGifts = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount])

  // IntersectionObserver — 탭/필터 변경 시 재생성
  const filteredLenRef = useRef(filtered.length)
  filteredLenRef.current = filtered.length

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    loadingRef.current = false
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !loadingRef.current) {
        loadingRef.current = true
        setVisibleCount(prev => {
          const next = Math.min(prev + PAGE_SIZE, filteredLenRef.current)
          setTimeout(() => { loadingRef.current = false }, 100)
          return next
        })
      }
    }, { rootMargin: '600px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [visibleCount, filtered.length, activeTab])

  // 모달 body 스크롤 잠금
  useEffect(() => {
    if (selected) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [selected])

  // ESC로 모달 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // 헤더 GSAP 진입 애니메이션
  const headerAnimRef = useRef(false)
  useEffect(() => {
    if (headerAnimRef.current) return
    headerAnimRef.current = true
    import('gsap').then(({ gsap }) => {
      gsap.fromTo('.md-header-line', { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: 'power3.inOut' })
      gsap.fromTo('.md-header-tag', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, delay: 0.2, ease: 'power2.out' })
      gsap.fromTo('.md-header-title', { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.7, delay: 0.3, ease: 'power3.out' })
    })
  }, [])

  // GSAP 진입 애니메이션 (새로 추가된 카드에도 적용)
  useEffect(() => {
    const initGSAP = async () => {
      const { gsap } = await import('gsap')
      const cards = document.querySelectorAll('.gift-grid .gift-card')
      const newCards: Element[] = []
      cards.forEach((card, i) => {
        if (i >= animatedCountRef.current) {
          newCards.push(card)
        }
      })
      if (newCards.length > 0) {
        gsap.fromTo(newCards,
          { opacity: 0, y: 16, scale: 0.97 },
          { opacity: 1, y: 0, scale: 1, duration: 0.3, stagger: 0.008, ease: 'power2.out' }
        )
      }
      animatedCountRef.current = cards.length
    }
    initGSAP()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, visibleCount, activeTab])

  // 테마팩 카드 렌더 (층별/전체 뷰 공용)
  function renderThemeCard(theme: EgoGiftTheme) {
    const themeGifts = theme.ego_gift_ids.map(gid => giftByGameId.get(gid)).filter(Boolean) as EgoGift[]
    if (themeGifts.length === 0) return null
    const specificCount = theme.specific_ego_gift_ids.length
    const kwCount: Record<string, number> = {}
    for (const g of themeGifts) {
      kwCount[g.keyword] = (kwCount[g.keyword] || 0) + 1
    }
    const topKws = Object.entries(kwCount).sort((a, b) => b[1] - a[1]).slice(0, 3)

    return (
      <button
        key={theme.id}
        onClick={() => setExpandedThemeId(theme.id)}
        className="group text-left overflow-hidden transition-all duration-200"
        style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(200,144,10,0.35)'; e.currentTarget.style.background = 'var(--bg-card)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-panel)' }}
      >
        {theme.image_url && (
          <div className="relative w-full overflow-hidden" style={{ aspectRatio: '380/690' }}>
            <ImageWithFallback
              src={theme.image_url}
              alt={theme.name}
              fill
              fallbackType="theme"
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              style={{ opacity: 0.85 }}
            />
            {theme.boss_image_url && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-full" style={{ aspectRatio: '391/432' }}>
                  <ImageWithFallback
                    src={theme.boss_image_url}
                    alt=""
                    fill
                    fallbackType="default"
                    sizes="(max-width: 640px) 33vw, 20vw"
                    className="object-contain drop-shadow-lg transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
              </div>
            )}
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(13,11,8,0.9) 0%, rgba(13,11,8,0.3) 50%, transparent 100%)' }} />
            <div className="absolute bottom-0 left-0 right-0 px-2 pb-1.5">
              <div className="font-serif font-medium leading-tight" style={{ color: '#fff', fontSize: 'var(--text-sm)', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                {theme.name}
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <div className="flex items-center gap-1">
                  {topKws.map(([kw]) => {
                    const iconUrl = getGiftKeywordIcon(kw)
                    return iconUrl ? (
                      <Image key={kw} src={iconUrl} alt={kw} width={12} height={12} style={{ width: '0.75rem', height: '0.75rem', opacity: 0.8 }} />
                    ) : null
                  })}
                </div>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.625rem', fontFamily: 'var(--font-mono)' }}>
                  {specificCount > 0 ? `★${specificCount}` : ''} {themeGifts.length}종
                </span>
              </div>
            </div>
          </div>
        )}
        {!theme.image_url && (
          <div className="px-3 py-2.5">
            <div className="font-serif font-medium leading-tight mb-1" style={{ color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
              {theme.name}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {topKws.map(([kw]) => {
                  const iconUrl = getGiftKeywordIcon(kw)
                  return iconUrl ? (
                    <Image key={kw} src={iconUrl} alt={kw} width={12} height={12} style={{ width: '0.75rem', height: '0.75rem', opacity: 0.6 }} />
                  ) : null
                })}
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.625rem', fontFamily: 'var(--font-mono)' }}>
                {specificCount > 0 ? `★${specificCount}` : ''} {themeGifts.length}종
              </span>
            </div>
          </div>
        )}
      </button>
    )
  }

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 md:px-6 max-w-7xl mx-auto" style={{ position: 'relative', overflow: 'hidden' }}>
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
      <style>{`
        .gift-grid {
          grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr));
        }
        @media (min-width: 768px) {
          .gift-grid { grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr)); }
        }
        .gift-card {
          container-type: inline-size;
        }
        .gift-grid .gift-card {
          opacity: 0;
        }
        .gift-card:hover .gift-frame {
          filter: brightness(1.15);
        }
      `}</style>
      {/* 헤더 + 탭 통합 */}
      <div className="mb-10">
        <div className="flex items-end justify-between mb-6" style={{ position: 'relative', zIndex: 1 }}>
          <div>
            {/* 장식 라인 */}
            <div className="md-header-line" style={{
              width: '4rem',
              height: '0.0625rem',
              background: 'linear-gradient(90deg, rgba(200,144,10,0.6), transparent)',
              marginBottom: '1rem',
              transformOrigin: 'left',
              transform: 'scaleX(0)',
            }} />
            <p className="md-header-tag" style={{ opacity: 0, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: '0.625rem', letterSpacing: '0.15em', marginBottom: '0.375rem' }}>
              E.G.O GIFT ARCHIVE
            </p>
            <h1 className="md-header-title font-serif text-3xl md:text-4xl font-bold" style={{ opacity: 0, color: 'var(--gold)', textShadow: '0 0 3rem rgba(200,144,10,0.15)' }}>
              거울 던전
            </h1>
            <p className="mt-2" style={{ color: '#666688', fontSize: '0.8125rem' }}>
              E.G.O 기프트 도감 · 테마팩 · 조합 레시피
            </p>
          </div>
          {themes.length > 0 && (
            <div
              className="flex"
              style={{
                background: 'rgba(10,8,5,0.7)',
                border: '1px solid var(--border)',
                borderRadius: '0.5rem',
                padding: '0.1875rem',
                gap: '0.125rem',
              }}
            >
              {(['gifts', 'themes', 'events'] as const).map(t => {
                const isActive = activeTab === t
                const label = t === 'gifts' ? '기프트' : t === 'themes' ? '테마팩' : '이벤트'
                const count = t === 'gifts' ? gifts.length : t === 'themes' ? themes.length : events.length
                return (
                  <button
                    key={t}
                    onClick={() => setActiveTab(t)}
                    className="flex items-center gap-1.5 px-4 py-2 transition-all duration-200"
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: '0.8125rem',
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? '#0d0b08' : '#666660',
                      background: isActive
                        ? 'linear-gradient(135deg, var(--gold) 0%, #e8b030 100%)'
                        : 'transparent',
                      borderRadius: '0.375rem',
                      boxShadow: isActive ? '0 0.125rem 0.5rem rgba(200,144,10,0.3)' : 'none',
                      cursor: 'pointer',
                      minWidth: '6rem',
                      justifyContent: 'center',
                    }}
                  >
                    {label}
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        opacity: isActive ? 0.7 : 0.5,
                      }}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <div style={{ height: '1px', background: 'linear-gradient(90deg, rgba(200,144,10,0.3), transparent 60%)' }} />
      </div>

      {/* 테마팩 탭 */}
      {activeTab === 'themes' && themes.length > 0 && (<>
        {/* 테마팩 검색 + 난이도 필터 */}
        <div className="flex flex-wrap gap-3 items-center mb-4">
          <div className="relative flex-1 min-w-[12rem] max-w-[20rem]">
            <Search size={14} style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', color: '#555' }} />
            <input
              type="text"
              placeholder="테마팩 · 기프트 검색..."
              value={themeSearch}
              onChange={e => setThemeSearch(e.target.value)}
              onFocus={() => setThemeSearchFocused(true)}
              onBlur={() => setTimeout(() => setThemeSearchFocused(false), 200)}
              className="w-full pl-8 pr-8 py-1.5 rounded text-xs"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#ccc', outline: 'none', fontFamily: 'var(--font-heading)' }}
            />
            {themeSearch && (
              <button onClick={() => setThemeSearch('')} style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: '#555', cursor: 'pointer' }}>
                <X size={12} />
              </button>
            )}
            {/* 자동완성 */}
            {themeSearchFocused && themeSearchSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-lg overflow-hidden z-50" style={{ background: '#1a1510', border: '1px solid rgba(200,144,10,0.2)', boxShadow: '0 0.5rem 1.5rem rgba(0,0,0,0.5)' }}>
                {themeSearchSuggestions.map((s, i) => (
                  <button
                    key={i}
                    className="w-full text-left px-3 py-2 flex items-center gap-2 transition-colors hover:bg-white/5"
                    style={{ cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseDown={() => setThemeSearch(s.label)}
                  >
                    <span style={{ color: s.type === 'theme' ? 'var(--gold)' : '#888', fontSize: '0.5625rem', fontFamily: 'var(--font-mono)', width: '2rem' }}>
                      {s.type === 'theme' ? '테마팩' : '기프트'}
                    </span>
                    <span style={{ color: '#ccc', fontSize: '0.75rem' }}>{s.label}</span>
                    {s.sub && <span style={{ color: '#555', fontSize: '0.625rem', marginLeft: 'auto' }}>{s.sub}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-1">
            {['전체', '노말', '하드', '익스트림'].map(d => {
              const colorMap: Record<string, string> = { '익스트림': '#e04040', '하드': '#e89030', '전체': 'var(--gold)', '노말': 'var(--gold)' }
              const bgMap: Record<string, string> = { '익스트림': 'rgba(224,64,64,0.2)', '하드': 'rgba(232,144,48,0.2)', '전체': 'rgba(200,144,10,0.15)', '노말': 'rgba(200,144,10,0.15)' }
              const borderMap: Record<string, string> = { '익스트림': 'rgba(224,64,64,0.4)', '하드': 'rgba(232,144,48,0.4)', '전체': 'rgba(200,144,10,0.3)', '노말': 'rgba(200,144,10,0.3)' }
              return (
                <button
                  key={d}
                  onClick={() => setThemeDiffFilter(d)}
                  className="px-2.5 py-1.5 rounded text-[0.6875rem] transition-colors"
                  style={{
                    cursor: 'pointer',
                    background: themeDiffFilter === d ? bgMap[d] : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${themeDiffFilter === d ? borderMap[d] : 'rgba(255,255,255,0.08)'}`,
                    color: themeDiffFilter === d ? colorMap[d] : '#777',
                    fontFamily: 'var(--font-heading)',
                  }}
                >
                  {d}
                </button>
              )
            })}
          </div>
          <span style={{ color: '#555', fontSize: '0.75rem', fontFamily: 'var(--font-heading)' }}>
            {filteredThemes.length}건
          </span>
        </div>
        {/* 층별 뷰 */}
        {floorGroupedThemes ? (
          <div className="mb-8 space-y-5">
            {floorGroupedThemes.map(([startFloor, endFloor, floorThemes]) => (
              <div key={startFloor}>
                {/* 층 헤더 바 */}
                <div className="flex items-center gap-3 mb-2.5">
                  <span
                    className="flex-shrink-0 font-mono font-bold"
                    style={{
                      color: startFloor === 0 ? '#888' : 'var(--gold)',
                      fontSize: '0.875rem',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {startFloor === 0 ? '기타' : startFloor === endFloor ? `${startFloor}층` : `${startFloor}~${endFloor}층`}
                  </span>
                  <div style={{ flex: 1, height: '1px', background: `linear-gradient(to right, ${startFloor === 0 ? 'rgba(136,136,136,0.3)' : 'rgba(200,144,10,0.3)'}, transparent)` }} />
                  <span style={{ color: '#555', fontSize: '0.625rem', fontFamily: 'var(--font-mono)' }}>
                    {floorThemes.length}개
                  </span>
                </div>
                {/* 테마팩 그리드 */}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2">
                  {floorThemes.map(theme => renderThemeCard(theme))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2 mb-8">
            {filteredThemes.map(theme => renderThemeCard(theme))}
          </div>
        )}
      </>)}

      {/* 테마팩 모달 */}
      {expandedThemeId !== null && (() => {
        const theme = themes.find(t => t.id === expandedThemeId)
        if (!theme) return null
        const themeGifts = theme.ego_gift_ids.map(gid => giftByGameId.get(gid)).filter(Boolean) as EgoGift[]

        // 전용 기프트: specificEgoGiftPool에 있는 것
        const specificIds = new Set(theme.specific_ego_gift_ids)
        const exclusiveGifts = themeGifts.filter(g => g.game_id && specificIds.has(g.game_id))
        const sharedGifts = themeGifts.filter(g => !g.game_id || !specificIds.has(g.game_id))

        // 키워드별 그룹 (공유 기프트만)
        const byKeyword: Record<string, EgoGift[]> = {}
        for (const g of sharedGifts) {
          if (!byKeyword[g.keyword]) byKeyword[g.keyword] = []
          byKeyword[g.keyword].push(g)
        }

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setExpandedThemeId(null)}
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
          >
            <div
              onClick={e => e.stopPropagation()}
              className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-xl"
              style={{
                background: '#131110',
                border: '1px solid rgba(200,144,10,0.12)',
                boxShadow: '0 0 3rem rgba(200,144,10,0.08), 0 1.5rem 4rem rgba(0,0,0,0.6)',
              }}
            >
              {/* 닫기 */}
              <button
                onClick={() => setExpandedThemeId(null)}
                className="absolute top-3 right-3 z-20 p-1.5 rounded-full transition-colors hover:bg-white/10"
                style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.5)' }}
              >
                <X size={18} />
              </button>

              {/* 배너 헤더 */}
              <div className="relative overflow-hidden" style={{ height: theme.image_url ? '10rem' : '5rem' }}>
                {theme.image_url && (
                  <>
                    <ImageWithFallback src={theme.image_url} alt={theme.name} fill fallbackType="theme" sizes="(max-width: 768px) 100vw, 48rem" className="object-cover object-top" style={{ opacity: 0.4 }} />
                    {theme.boss_image_url && (
                      <div className="absolute right-0 bottom-0 z-10" style={{ width: '50%', aspectRatio: '391/432' }}>
                        <ImageWithFallback src={theme.boss_image_url} alt="" fill fallbackType="default" sizes="200px" className="object-contain object-bottom drop-shadow-lg" style={{ opacity: 0.6 }} />
                      </div>
                    )}
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #131110 0%, rgba(19,17,16,0.6) 50%, rgba(19,17,16,0.3) 100%)' }} />
                  </>
                )}
                {!theme.image_url && (
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(200,144,10,0.05) 0%, transparent 100%)' }} />
                )}
                <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
                  <h3 className="font-serif text-xl md:text-2xl font-bold" style={{ color: '#e8d8c0', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
                    {theme.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {(() => {
                      const diff = theme.difficulty || 'normal'
                      const label = diff === 'extreme' ? '익스트림' : diff === 'hard' ? '하드' : '노말'
                      const color = diff === 'extreme' ? '#e04040' : diff === 'hard' ? '#e89030' : '#999'
                      const bg = diff === 'extreme' ? 'rgba(224,64,64,0.2)' : diff === 'hard' ? 'rgba(232,144,48,0.2)' : 'rgba(255,255,255,0.08)'
                      return (
                        <span className="px-2.5 py-0.5 rounded-full text-[0.6875rem] font-bold" style={{ background: bg, color, fontFamily: 'var(--font-mono)' }}>
                          {label}
                        </span>
                      )
                    })()}
                    <span style={{ color: '#888', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}>
                      {themeGifts.length}종
                    </span>
                    {exclusiveGifts.length > 0 && (
                      <span style={{ color: 'var(--gold)', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}>
                        ★{exclusiveGifts.length} 전용
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-5 pb-5">
                {/* 출현 정보 + 키워드 분포 */}
                <div className="flex flex-wrap gap-4 mt-4 mb-5">
                  {/* 출현 정보 */}
                  {theme.floor_info && Object.keys(theme.floor_info).length > 0 && (
                    <div className="flex-1 min-w-[14rem]">
                      <p className="text-[0.6875rem] font-bold mb-2" style={{ color: '#666', fontFamily: 'var(--font-heading)', letterSpacing: '0.08em' }}>
                        출현 정보
                      </p>
                      <div className="space-y-1">
                        {Object.entries(theme.floor_info).map(([dungeon, floors]) => {
                          const dColor = dungeon === '익스트림' ? '#e04040' : dungeon === '평행중첩' ? '#b478dc' : dungeon === '하드' ? '#e89030' : '#a0a090'
                          const floorText = floors === '전체' ? '전층' : Array.isArray(floors) ? floors.map(f => `${f}층`).join(', ') : String(floors)
                          return (
                            <div key={dungeon} className="flex items-center gap-2">
                              <span className="inline-block w-16 text-right" style={{ color: dColor, fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                                {dungeon}
                              </span>
                              <span style={{ color: '#555', fontSize: '0.8125rem' }}>—</span>
                              <span style={{ color: '#bbb', fontSize: '0.8125rem' }}>{floorText}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {/* 키워드 분포 */}
                  <div className="flex-1 min-w-[10rem]">
                    <p className="text-[0.6875rem] font-bold mb-2" style={{ color: '#666', fontFamily: 'var(--font-heading)', letterSpacing: '0.08em' }}>
                      키워드 분포
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(byKeyword).sort((a, b) => b[1].length - a[1].length).slice(0, 6).map(([kw, kwGifts]) => {
                        const iconUrl = getGiftKeywordIcon(kw)
                        return (
                          <span key={kw} className="inline-flex items-center gap-1.5 px-2 py-1 rounded" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            {iconUrl && <Image src={iconUrl} alt={kw} width={14} height={14} style={{ width: '0.875rem', height: '0.875rem' }} />}
                            <span style={{ color: '#bbb', fontSize: '0.75rem' }}>{kw}</span>
                            <span style={{ color: '#555', fontSize: '0.6875rem', fontFamily: 'var(--font-mono)' }}>{kwGifts.length}</span>
                          </span>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div style={{ height: '1px', background: 'linear-gradient(90deg, rgba(200,144,10,0.2), transparent 60%)', marginBottom: '1.25rem' }} />

                {/* 전용 기프트 */}
                {exclusiveGifts.length > 0 && (
                  <div className="mb-5">
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <span style={{ color: 'var(--gold)', fontSize: '0.875rem' }}>★</span>
                      <span className="font-serif font-medium" style={{ color: 'var(--gold)', fontSize: '0.875rem' }}>전용 기프트</span>
                      <span style={{ color: '#666', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>({exclusiveGifts.length})</span>
                    </div>
                    <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(6.5rem, 1fr))' }}>
                      {exclusiveGifts.map(g => (
                        <GiftCard key={g.id} gift={g} onClick={() => { setExpandedThemeId(null); setSelected(g) }} getGiftKeywordIcon={getGiftKeywordIcon} />
                      ))}
                    </div>
                    <div className="mt-4" style={{ height: '1px', background: 'linear-gradient(90deg, var(--gold-dim), transparent)' }} />
                  </div>
                )}

              {/* 키워드별 그룹 */}
              {Object.entries(byKeyword).map(([kw, kwGifts]) => {
                const iconUrl = getGiftKeywordIcon(kw)
                return (
                  <div key={kw} className="mb-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      {iconUrl && <Image src={iconUrl} alt={kw} width={16} height={16} style={{ width: '1rem', height: '1rem' }} />}
                      <span className="font-serif font-medium" style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>{kw}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>({kwGifts.length})</span>
                    </div>
                    <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(6.5rem, 1fr))' }}>
                      {kwGifts.map(g => (
                        <GiftCard key={g.id} gift={g} onClick={() => { setExpandedThemeId(null); setSelected(g) }} getGiftKeywordIcon={getGiftKeywordIcon} />
                      ))}
                    </div>
                  </div>
                )
              })}
              </div>
            </div>
          </div>
        )
      })()}

      {/* 이벤트 탭 */}
      {activeTab === 'events' && events.length > 0 && (<>
        {/* 검색 */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-[20rem]">
            <Search size={14} style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', color: '#555' }} />
            <input
              type="text"
              placeholder="이벤트 · 기프트 검색..."
              value={eventSearch}
              onChange={e => setEventSearch(e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 rounded text-xs"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#ccc', outline: 'none', fontFamily: 'var(--font-heading)' }}
            />
            {eventSearch && (
              <button onClick={() => setEventSearch('')} style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: '#555', cursor: 'pointer' }}>
                <X size={12} />
              </button>
            )}
          </div>
          <span style={{ color: '#555', fontSize: '0.75rem', fontFamily: 'var(--font-heading)' }}>
            {(() => {
              const seenCount = new Set<string>()
              const rootEvents = events.filter(ev => {
                if (ev.parent_id) return false
                const key = ev.desc_text || String(ev.id)
                if (seenCount.has(key)) return false
                seenCount.add(key)
                return true
              })
              const q = eventSearch.trim().toLowerCase()
              if (!q) return `${rootEvents.length}건`
              return `${rootEvents.filter(ev => {
                if (ev.name?.toLowerCase().includes(q) || ev.desc_text?.toLowerCase().includes(q)) return true
                if (ev.options?.some(o => o.message?.toLowerCase().includes(q) || o.messageDesc?.toLowerCase().includes(q))) return true
                if (ev.gift_ids?.some(gid => { const g = giftByGameId.get(gid); return g && g.name.toLowerCase().includes(q) })) return true
                return false
              }).length}건`
            })()}
          </span>
        </div>

        {/* 카드 그리드 (루트 이벤트만) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 mb-8">
          {(() => {
            // 중복 제거: 같은 desc_text면 첫 번째만
            const seen = new Set<string>()
            const rootEvents = events.filter(ev => {
              if (ev.parent_id) return false
              const key = ev.desc_text || String(ev.id)
              if (seen.has(key)) return false
              seen.add(key)
              return true
            })
            const q = eventSearch.trim().toLowerCase()
            const filtered = q ? rootEvents.filter(ev => {
              if (ev.name?.toLowerCase().includes(q) || ev.desc_text?.toLowerCase().includes(q)) return true
              if (ev.options?.some(o => o.message?.toLowerCase().includes(q) || o.messageDesc?.toLowerCase().includes(q))) return true
              if (ev.gift_ids?.some(gid => { const g = giftByGameId.get(gid); return g && g.name.toLowerCase().includes(q) })) return true
              return false
            }) : rootEvents
            return filtered.map(ev => {
              const evGifts = (ev.gift_ids || []).map(gid => giftByGameId.get(gid)).filter(Boolean) as EgoGift[]
              const childCount = events.filter(c => c.parent_id === ev.id).length
              return (
                <button
                  key={ev.id}
                  onClick={() => setSelectedEvent(ev)}
                  className="group text-left overflow-hidden transition-all duration-200"
                  style={{ background: '#1a1714', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(200,144,10,0.3)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
                >
                  {ev.image_url ? (
                    <div className="relative w-full aspect-square overflow-hidden">
                      <ImageWithFallback src={ev.image_url} alt="" fill fallbackType="default" sizes="(max-width: 640px) 50vw, 20vw" className="object-cover transition-transform duration-300 group-hover:scale-105" style={{ opacity: 0.8 }} />
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(13,11,8,0.9) 0%, transparent 60%)' }} />
                      <div className="absolute bottom-0 left-0 right-0 px-2.5 pb-2">
                        <p className="font-serif font-medium leading-tight line-clamp-2" style={{ color: '#e8d8c0', fontSize: '0.75rem', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                          {ev.desc_text ? ev.desc_text.split('\n')[0].slice(0, 30) : `이벤트 #${ev.id}`}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          {evGifts.length > 0 && (
                            <span style={{ color: 'var(--gold)', fontSize: '0.5625rem', fontFamily: 'var(--font-mono)' }}>
                              {evGifts.length}종
                            </span>
                          )}
                          {ev.options && (
                            <span style={{ color: '#888', fontSize: '0.5625rem', fontFamily: 'var(--font-mono)' }}>
                              선택지 {ev.options.length}
                            </span>
                          )}
                          {childCount > 0 && (
                            <span style={{ color: '#6090d0', fontSize: '0.5625rem', fontFamily: 'var(--font-mono)' }}>
                              +{childCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="px-3 py-3">
                      <p className="font-serif font-medium leading-tight line-clamp-2 mb-1.5" style={{ color: '#ccc', fontSize: '0.75rem' }}>
                        {ev.desc_text ? ev.desc_text.split('\n')[0].slice(0, 40) : `이벤트 #${ev.id}`}
                      </p>
                      <div className="flex items-center gap-1.5">
                        {evGifts.length > 0 && <span style={{ color: 'var(--gold)', fontSize: '0.5625rem', fontFamily: 'var(--font-mono)' }}>{evGifts.length}종</span>}
                        {ev.options && <span style={{ color: '#888', fontSize: '0.5625rem', fontFamily: 'var(--font-mono)' }}>선택지 {ev.options.length}</span>}
                      </div>
                    </div>
                  )}
                </button>
              )
            })
          })()}
        </div>
      </>)}

      {/* 이벤트 모달 */}
      {selectedEvent && (() => {
        const evThemeNames = (selectedEvent.theme_ids || []).map(tid => themes.find(th => th.id === tid)).filter(Boolean)
        const children = events.filter(c => c.parent_id === selectedEvent.id)
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedEvent(null)} style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
          <div onClick={e => e.stopPropagation()} className="relative w-full overflow-hidden" style={{ maxWidth: '36rem', maxHeight: '85vh', borderRadius: '0.75rem', background: '#131110', border: '1px solid rgba(200,144,10,0.12)', boxShadow: '0 0 3rem rgba(200,144,10,0.06), 0 1.5rem 4rem rgba(0,0,0,0.6)' }}>
            {/* 닫기 버튼 */}
            <button onClick={() => setSelectedEvent(null)} className="absolute top-3 right-3 z-30 flex items-center justify-center transition-all duration-200" style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.4)', width: '2rem', height: '2rem', borderRadius: '50%', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.08)' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#e8d8c0'; e.currentTarget.style.background = 'rgba(200,144,10,0.15)'; e.currentTarget.style.borderColor = 'rgba(200,144,10,0.3)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.background = 'rgba(0,0,0,0.4)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}>
              <X size={16} />
            </button>

            {/* 스크롤 컨테이너 */}
            <div style={{ maxHeight: '85vh', overflowY: 'auto' }}>

            {/* 헤더 배너 */}
            {selectedEvent.image_url ? (
              <div className="relative overflow-hidden" style={{ height: '13rem' }}>
                <ImageWithFallback src={selectedEvent.image_url} alt="" fill fallbackType="default" sizes="36rem" className="object-cover" style={{ opacity: 0.45 }} />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #131110 0%, rgba(19,17,16,0.5) 50%, rgba(19,17,16,0.25) 100%)' }} />
                {/* 이벤트 이름 오버레이 */}
                <div className="absolute bottom-0 left-0 right-0 px-6 pb-5">
                  {evThemeNames.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {evThemeNames.slice(0, 3).map(t => t && (
                        <span key={t.id} className="inline-flex items-center gap-1 px-2 py-0.5" style={{ fontSize: '0.625rem', fontFamily: 'var(--font-mono)', color: 'rgba(200,144,10,0.8)', background: 'rgba(200,144,10,0.08)', border: '1px solid rgba(200,144,10,0.15)', borderRadius: '0.25rem', letterSpacing: '0.03em' }}>
                          {t.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <h2 className="font-serif font-bold" style={{ fontSize: '1.375rem', color: '#e8d0a0', textShadow: '0 0.125rem 1rem rgba(200,144,10,0.2), 0 0.0625rem 0.25rem rgba(0,0,0,0.8)', lineHeight: 1.3 }}>
                    {selectedEvent.name || (selectedEvent.desc_text ? selectedEvent.desc_text.split('\n')[0].slice(0, 50) : `이벤트 #${selectedEvent.id}`)}
                  </h2>
                </div>
              </div>
            ) : (
              <div className="relative overflow-hidden px-6 pt-6 pb-5" style={{ background: 'linear-gradient(135deg, rgba(200,144,10,0.04) 0%, transparent 60%)' }}>
                <div className="absolute top-0 left-0 w-full" style={{ height: '0.125rem', background: 'linear-gradient(90deg, rgba(200,144,10,0.3), transparent 70%)' }} />
                {evThemeNames.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {evThemeNames.slice(0, 3).map(t => t && (
                      <span key={t.id} className="inline-flex items-center gap-1 px-2 py-0.5" style={{ fontSize: '0.625rem', fontFamily: 'var(--font-mono)', color: 'rgba(200,144,10,0.8)', background: 'rgba(200,144,10,0.08)', border: '1px solid rgba(200,144,10,0.15)', borderRadius: '0.25rem', letterSpacing: '0.03em' }}>
                        {t.name}
                      </span>
                    ))}
                  </div>
                )}
                <h2 className="font-serif font-bold" style={{ fontSize: '1.25rem', color: '#e8d0a0', lineHeight: 1.3 }}>
                  {selectedEvent.name || (selectedEvent.desc_text ? selectedEvent.desc_text.split('\n')[0].slice(0, 50) : `이벤트 #${selectedEvent.id}`)}
                </h2>
              </div>
            )}

            <div className="px-6 pb-6 pt-4 relative">
              {/* 설명 텍스트 */}
              {selectedEvent.desc_text && (() => {
                const paragraphs = replaceEventPlaceholders(selectedEvent.desc_text).split('\n\n')
                return (
                  <div className="mb-5">
                    {paragraphs.map((para, pi) => (
                      <p key={pi} className="whitespace-pre-line" style={{
                        color: pi === 0 ? '#c8b898' : '#a89878',
                        fontSize: '0.875rem',
                        lineHeight: 1.8,
                        marginBottom: pi < paragraphs.length - 1 ? '0.75rem' : 0,
                        ...(pi === 0 ? { fontWeight: 500 } : {}),
                      }}>
                        {para}
                      </p>
                    ))}
                  </div>
                )
              })()}

              {/* 선택지 + 연계 이벤트 */}
              {selectedEvent.options && selectedEvent.options.length > 0 && (
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div style={{ width: '0.1875rem', height: '0.875rem', background: 'var(--gold)', borderRadius: '0.125rem' }} />
                    <p style={{ color: '#8a7a60', fontSize: '0.6875rem', fontFamily: 'var(--font-heading)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>선택지</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                    {selectedEvent.options.map((opt, i) => {
                      const optChildren = children.filter(c => c.option_index === i)
                      // 선택지 색상: messageDesc 기반 힌트
                      const desc = (opt.messageDesc || '').toLowerCase()
                      const isJudgment = desc.includes('심판') || desc.includes('판정')
                      const isBattle = desc.includes('전투') || desc.includes('합동')
                      const accentColor = isBattle ? '#c04040' : isJudgment ? '#4080d0' : 'rgba(200,144,10,0.5)'
                      return (
                        <div key={i} className="overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '0.5rem', borderLeft: `0.1875rem solid ${accentColor}` }}>
                          <div className="flex items-start gap-3 px-4 py-3">
                            <span className="flex-shrink-0 flex items-center justify-center" style={{ width: '1.5rem', height: '1.5rem', borderRadius: '50%', background: `${accentColor}18`, border: `1px solid ${accentColor}30`, color: accentColor, fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', fontWeight: 700, marginTop: '0.125rem' }}>
                              {i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p style={{ color: '#e8dcc8', fontSize: '0.875rem', lineHeight: 1.6 }}>{replaceEventPlaceholders(opt.message)}</p>
                              {opt.messageDesc && (
                                <span className="inline-block mt-1.5 px-2 py-0.5" style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-heading)', color: accentColor, background: `${accentColor}10`, border: `1px solid ${accentColor}20`, borderRadius: '0.25rem', lineHeight: 1.4 }}>
                                  {replaceEventPlaceholders(opt.messageDesc)}
                                </span>
                              )}
                              {opt.result && opt.result[0] && (
                                <div className="mt-2" style={{ paddingLeft: '0.75rem', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
                                  <p className="whitespace-pre-line" style={{ color: '#807060', fontSize: '0.75rem', lineHeight: 1.7 }}>
                                    {replaceEventPlaceholders(opt.result[0])}
                                  </p>
                                </div>
                              )}
                              {/* 선택지별 기프트 보상 */}
                              {selectedEvent.option_gifts && selectedEvent.option_gifts[i] && selectedEvent.option_gifts[i].length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2.5">
                                  {selectedEvent.option_gifts[i].map(gid => {
                                    const g = giftByGameId.get(gid)
                                    if (!g) return null
                                    const kw = KEYWORD_COLORS[g.keyword] ?? '#666'
                                    return (
                                      <button key={gid} onClick={() => { setSelectedEvent(null); setSelected(g) }}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors hover:bg-white/10"
                                        style={{ cursor: 'pointer', background: `${kw}12`, border: `1px solid ${kw}20`, fontSize: '0.6875rem' }}>
                                        {g.image_url && <ImageWithFallback src={g.image_url} alt="" width={14} height={14} fallbackType="gift" style={{ width: '0.875rem', height: '0.875rem' }} />}
                                        <span style={{ color: '#ccc' }}>{g.name}</span>
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                              {/* 선택지 내부 연계 이벤트 아코디언 */}
                              {optChildren.length > 0 && optChildren.map(child => (
                                <details key={child.id} className="overflow-hidden mt-2.5" style={{ borderRadius: '0.375rem', background: 'rgba(96,144,208,0.04)', border: '1px solid rgba(96,144,208,0.1)' }}>
                                  <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer list-none transition-colors" style={{ color: '#6090d0', fontSize: '0.6875rem', fontFamily: 'var(--font-heading)', borderLeft: '0.125rem solid rgba(96,144,208,0.3)' }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(96,144,208,0.06)' }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                                    <span style={{ fontSize: '0.5rem', opacity: 0.5, transition: 'transform 0.2s' }}>&#9654;</span>
                                    <span className="flex-1">{child.name || replaceEventPlaceholders(child.desc_text?.split('\n')[0]?.slice(0, 40)) || '연계 이벤트'}</span>
                                    {child.gift_ids && child.gift_ids.length > 0 && (
                                      <span style={{ fontSize: '0.5625rem', color: '#c8900a', fontFamily: 'var(--font-mono)' }}>기프트 {child.gift_ids.length}종</span>
                                    )}
                                  </summary>
                                  <div className="px-3.5 pb-3 pt-2" style={{ borderTop: '1px solid rgba(96,144,208,0.08)', marginLeft: '0.125rem', borderLeft: '0.125rem solid rgba(96,144,208,0.15)' }}>
                                    {child.desc_text && (
                                      <p className="whitespace-pre-line mb-2.5" style={{ color: '#9a8a7a', fontSize: '0.75rem', lineHeight: 1.7 }}>
                                        {replaceEventPlaceholders(child.desc_text)}
                                      </p>
                                    )}
                                    {child.options && child.options.length > 0 && (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                        {child.options.map((co, ci) => (
                                          <div key={ci} className="flex items-start gap-2" style={{ paddingLeft: '0.5rem', borderLeft: '1px solid rgba(96,144,208,0.12)' }}>
                                            <span className="flex-shrink-0 flex items-center justify-center" style={{ width: '1.125rem', height: '1.125rem', borderRadius: '50%', background: 'rgba(96,144,208,0.1)', color: '#6090d0', fontSize: '0.5625rem', fontFamily: 'var(--font-mono)', fontWeight: 700, marginTop: '0.0625rem' }}>{ci + 1}</span>
                                            <div className="flex-1">
                                              <p style={{ color: '#bbb', fontSize: '0.75rem', lineHeight: 1.5 }}>{replaceEventPlaceholders(co.message)}</p>
                                              {co.messageDesc && <span className="inline-block mt-0.5 px-1.5 py-0.5" style={{ color: '#6090d0', fontSize: '0.625rem', fontFamily: 'var(--font-heading)', background: 'rgba(96,144,208,0.06)', borderRadius: '0.1875rem', border: '1px solid rgba(96,144,208,0.1)' }}>{replaceEventPlaceholders(co.messageDesc)}</span>}
                                              {co.result && co.result[0] && (
                                                <p className="mt-1 whitespace-pre-line" style={{ color: '#706050', fontSize: '0.6875rem', lineHeight: 1.5 }}>
                                                  {replaceEventPlaceholders(co.result[0])}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {child.gift_ids && child.gift_ids.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-2.5 pt-2" style={{ borderTop: '1px solid rgba(96,144,208,0.08)' }}>
                                        {child.gift_ids.map(gid => {
                                          const g = giftByGameId.get(gid)
                                          if (!g) return null
                                          const kw = KEYWORD_COLORS[g.keyword] ?? '#666'
                                          return (
                                            <button key={gid} onClick={() => { setSelectedEvent(null); setSelected(g) }}
                                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors hover:bg-white/10"
                                              style={{ cursor: 'pointer', background: `${kw}12`, border: `1px solid ${kw}20`, fontSize: '0.625rem' }}>
                                              {g.image_url && <ImageWithFallback src={g.image_url} alt="" width={14} height={14} fallbackType="gift" style={{ width: '0.875rem', height: '0.875rem' }} />}
                                              <span style={{ color: '#ccc' }}>{g.name}</span>
                                            </button>
                                          )
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </details>
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {/* option_index가 없는 연계 이벤트 (매핑 안 된 것) */}
                  {children.filter(c => c.option_index == null).length > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div style={{ width: '0.1875rem', height: '0.75rem', background: 'rgba(96,144,208,0.4)', borderRadius: '0.125rem' }} />
                        <p style={{ color: '#506888', fontSize: '0.625rem', fontFamily: 'var(--font-heading)', fontWeight: 700, letterSpacing: '0.08em' }}>연계 이벤트</p>
                      </div>
                      {children.filter(c => c.option_index == null).map(child => (
                        <details key={child.id} className="overflow-hidden mb-2" style={{ borderRadius: '0.375rem', background: 'rgba(96,144,208,0.03)', border: '1px solid rgba(96,144,208,0.1)', borderLeft: '0.125rem solid rgba(96,144,208,0.25)' }}>
                          <summary className="flex items-center gap-2 px-3.5 py-2 cursor-pointer list-none transition-colors" style={{ color: '#6090d0', fontSize: '0.6875rem', fontFamily: 'var(--font-heading)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(96,144,208,0.05)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                            <span style={{ fontSize: '0.5rem', opacity: 0.5 }}>&#9654;</span>
                            <span className="flex-1">{child.name || replaceEventPlaceholders(child.desc_text?.split('\n')[0]?.slice(0, 40)) || `이벤트 #${child.id}`}</span>
                          </summary>
                          <div className="px-3.5 pb-3 pt-1.5" style={{ borderTop: '1px solid rgba(96,144,208,0.08)' }}>
                            {child.desc_text && (
                              <p className="whitespace-pre-line" style={{ color: '#9a8a7a', fontSize: '0.75rem', lineHeight: 1.7 }}>
                                {replaceEventPlaceholders(child.desc_text)}
                              </p>
                            )}
                          </div>
                        </details>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 출현 테마팩 */}
              {selectedEvent.theme_ids && selectedEvent.theme_ids.length > 0 && (
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-2.5">
                    <div style={{ width: '0.1875rem', height: '0.75rem', background: 'rgba(200,144,10,0.3)', borderRadius: '0.125rem' }} />
                    <p style={{ color: '#8a7a60', fontSize: '0.625rem', fontFamily: 'var(--font-heading)', fontWeight: 700, letterSpacing: '0.1em' }}>출현 테마팩</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedEvent.theme_ids.slice(0, 20).map(tid => {
                      const t = themes.find(th => th.id === tid)
                      if (!t) return null
                      const dColor = t.difficulty === 'extreme' ? '#c04040' : t.difficulty === 'hard' ? '#d08030' : '#706050'
                      return (
                        <button key={tid} onClick={() => { setSelectedEvent(null); setActiveTab('themes'); setExpandedThemeId(tid) }}
                          className="inline-flex items-center gap-1.5 px-2 py-1 transition-colors"
                          style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '0.375rem' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(200,144,10,0.2)'; e.currentTarget.style.background = 'rgba(200,144,10,0.04)' }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}>
                          {t.image_url && <ImageWithFallback src={t.image_url} alt="" width={10} height={18} fallbackType="theme" style={{ width: '0.625rem', height: '1.125rem', objectFit: 'cover', borderRadius: '1px' }} />}
                          <span style={{ color: '#b0a088', fontSize: '0.6875rem' }}>{t.name}</span>
                          <span style={{ color: dColor, fontSize: '0.5rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                            {t.difficulty === 'extreme' ? 'EX' : t.difficulty === 'hard' ? 'H' : ''}
                          </span>
                        </button>
                      )
                    })}
                    {selectedEvent.theme_ids.length > 20 && (
                      <span style={{ color: '#555', fontSize: '0.6875rem', alignSelf: 'center' }}>+{selectedEvent.theme_ids.length - 20}개</span>
                    )}
                  </div>
                </div>
              )}

              {/* 획득 가능 기프트 (option_gifts가 있으면 이미 선택지에 표시되므로 생략) */}
              {!selectedEvent.option_gifts && (() => {
                const allGiftIds = new Set(selectedEvent.gift_ids || [])
                events.filter(c => c.parent_id === selectedEvent.id).forEach(c => (c.gift_ids || []).forEach(g => allGiftIds.add(g)))
                const evGifts = [...allGiftIds].map(gid => giftByGameId.get(gid)).filter(Boolean) as EgoGift[]
                if (evGifts.length === 0) return null
                return (
                  <div style={{ borderTop: '1px solid rgba(200,144,10,0.08)', paddingTop: '1rem' }}>
                    <div className="flex items-center gap-2 mb-2.5">
                      <div style={{ width: '0.1875rem', height: '0.75rem', background: 'rgba(200,144,10,0.3)', borderRadius: '0.125rem' }} />
                      <p style={{ color: '#8a7a60', fontSize: '0.625rem', fontFamily: 'var(--font-heading)', fontWeight: 700, letterSpacing: '0.1em' }}>획득 가능 기프트</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {evGifts.map(g => {
                        const kw = KEYWORD_COLORS[g.keyword] ?? '#666'
                        return (
                          <button key={g.id} onClick={() => { setSelectedEvent(null); setSelected(g) }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors hover:bg-white/10"
                            style={{ cursor: 'pointer', background: `${kw}10`, border: `1px solid ${kw}20` }}>
                            {g.image_url && <ImageWithFallback src={g.image_url} alt="" width={18} height={18} fallbackType="gift" style={{ width: '1.125rem', height: '1.125rem' }} />}
                            <span style={{ color: '#ccc', fontSize: '0.75rem' }}>{g.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </div>

            </div>{/* 스크롤 컨테이너 끝 */}
          </div>
        </div>
        )
      })()}

      {/* 필터 영역 + 그리드 (전체 기프트 탭) */}
      {activeTab === 'gifts' && (<>
      <div className="mb-6 space-y-4">
        {/* 키워드 필터 */}
        <div className="flex flex-wrap gap-2 justify-center">
          {KEYWORDS.map(kw => {
            const isAll = kw.key === '전체'
            const active = isAll ? keywords.size === 0 : keywords.has(kw.key)
            const iconUrl = !isAll ? getGiftKeywordIcon(kw.key) : null
            return (
              <button
                key={kw.key}
                onClick={() => toggleKeyword(kw.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200"
                style={{
                  cursor: 'pointer',
                  background: active
                    ? (isAll ? 'var(--gold)' : KEYWORD_COLORS[kw.key] ?? '#666')
                    : 'rgba(255,255,255,0.05)',
                  color: active ? '#0d0b08' : '#777',
                  border: `1px solid ${active
                    ? 'transparent'
                    : 'rgba(255,255,255,0.08)'}`,
                  fontFamily: 'var(--font-heading)',
                }}
              >
                {iconUrl && (
                  <Image
                    src={iconUrl}
                    alt={kw.label}
                    width={14}
                    height={14}
                    style={{ opacity: active ? 0.9 : 0.5 }}
                  />
                )}
                {kw.label}
              </button>
            )
          })}
        </div>

        {/* 등급 + 검색 */}
        <div className="flex gap-3 justify-center items-center flex-wrap">
          {/* 등급 멀티 드롭다운 */}
          <GradeMultiDropdown grades={grades} toggleGrade={toggleGrade} />

          {/* 난이도 필터 (드롭다운) */}
          <Dropdown
            value={tiers.size === 0 ? '전체' : [...tiers][0]}
            options={[
              { value: '전체', label: '전체' },
              { value: '노말', label: '노말' },
              { value: '하드', label: '하드' },
              { value: '익스트림', label: '익스트림' },
            ]}
            onChange={v => {
              if (v === '전체') setTiers(new Set())
              else setTiers(new Set([v]))
            }}
            prefix="난이도:"
            defaultValue="전체"
            minWidth={120}
          />

          {/* 정렬 버튼 */}
          <div className="flex items-center gap-1">
            {(['default', 'name', 'grade'] as const).map(key => {
              const labels = { default: '기본', name: '이름순', grade: '등급순' }
              return (
                <button
                  key={key}
                  onClick={() => {
                    if (sortBy === key && key !== 'default') {
                      setSortDesc(v => !v)
                    } else {
                      setSortBy(key)
                      setSortDesc(false)
                    }
                  }}
                  className="px-2.5 py-1.5 rounded text-[0.6875rem] transition-colors"
                  style={{
                    cursor: 'pointer',
                    background: sortBy === key ? 'rgba(200,144,10,0.15)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${sortBy === key ? 'rgba(200,144,10,0.3)' : 'rgba(255,255,255,0.08)'}`,
                    color: sortBy === key ? 'var(--gold)' : '#777',
                    fontFamily: 'var(--font-heading)',
                  }}
                >
                  {labels[key]}
                  {sortBy === key && key !== 'default' && (
                    <span style={{ marginLeft: '3px' }}>{sortDesc ? '↓' : '↑'}</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* 검색 */}
          <div className="relative">
            <Search
              size={14}
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#555' }}
            />
            <input
              type="text"
              placeholder="기프트 검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded text-xs w-48"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#ccc',
                outline: 'none',
                fontFamily: 'var(--font-heading)',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                  color: '#555', cursor: 'pointer',
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* 결과 수 */}
          <span style={{ color: '#555', fontSize: '0.75rem', fontFamily: 'var(--font-heading)' }}>
            {filtered.length}건
          </span>
        </div>
      </div>

      {/* 그리드 */}
      {filtered.length === 0 ? (
        <div className="text-center py-20" style={{ color: '#555' }}>
          <p className="text-lg mb-2">결과 없음</p>
          <p className="text-sm">필터를 변경해 보세요.</p>
        </div>
      ) : (
        <>
          <div className="gift-grid" style={{ display: 'grid', gap: '0.625rem' }}>
            {visibleGifts.map(gift => (
              <GiftCard
                key={gift.id}
                gift={gift}
                onClick={() => setSelected(gift)}
                getGiftKeywordIcon={getGiftKeywordIcon}
              />
            ))}
          </div>
          {/* 무한 스크롤 sentinel */}
          {visibleCount < filtered.length && (
            <div ref={sentinelRef} className="flex justify-center py-6">
              <span style={{ color: '#555', fontSize: '0.75rem' }}>불러오는 중...</span>
            </div>
          )}
        </>
      )}
      </>)}

      {/* 상세 모달 */}
      {selected && (
        <GiftModal
          gift={selected}
          recipe={recipeMap.get(selected.name) ?? null}
          giftImageMap={giftImageMap}
          onClose={() => setSelected(null)}
          getGiftKeywordIcon={getGiftKeywordIcon}
          themes={getThemesForGift(selected)}
          onThemeClick={id => { setSelected(null); setActiveTab('themes'); setExpandedThemeId(id) }}
        />
      )}
    </div>
  )
}
