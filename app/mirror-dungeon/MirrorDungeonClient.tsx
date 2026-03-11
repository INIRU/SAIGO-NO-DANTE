'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Search, X, FlaskConical, ChevronDown } from 'lucide-react'
import { ATK_TYPE_ICON_MAP, STORAGE_BASE } from '@/lib/data/sinners'
import { useFormatSkillDesc, useKeywordData } from '@/components/sinners/KeywordTooltip'

/* ── 타입 ── */
interface EgoGift {
  id: string
  name: string
  keyword: string
  grade: string
  tier: string | null
  enhancement: boolean
  price: number | null
  sell_price: number | null
  buy_disabled: boolean
  effect_base: string | null
  effect_plus: string | null
  effect_plusplus: string | null
  activation_condition: {
    type: 'keyword' | 'multi_keyword' | 'affiliation' | 'skill'
    keyword?: string
    keywords?: string[]
    affiliation?: string
    affiliations?: string[]
    skill_condition?: string
    count: number
  } | null
  is_synthesis: boolean
  first_appearance: string | null
  related: string | null
  image_url: string | null
  acquisition: string | null
}

interface Recipe {
  id: string
  result_name: string
  keyword: string
  ingredients: string[]
  final_result: string | null
}

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

const KEYWORD_COLORS: Record<string, string> = {
  화상: '#e85830',
  출혈: '#c83030',
  진동: '#d0a020',
  파열: '#8040c0',
  침잠: '#3060b0',
  호흡: '#40a060',
  충전: '#e0c020',
  참격: '#cc4444',
  관통: '#dd8833',
  타격: '#cc8822',
  공통: '#888888',
}

const GRADES = ['전체', '1', '2', '3', '4', '5', 'EX']

const GRADE_LABELS: Record<string, string> = {
  '1': 'Ⅰ',
  '2': 'Ⅱ',
  '3': 'Ⅲ',
  '4': 'Ⅳ',
  '5': 'Ⅴ',
  'EX': 'EX',
}

/* ── 메인 컴포넌트 ── */
export default function MirrorDungeonClient({
  gifts,
  recipes,
}: {
  gifts: EgoGift[]
  recipes: Recipe[]
}) {
  const { getIconUrl } = useKeywordData()
  const getGiftKeywordIcon = (keyword: string) => getIconUrl(keyword) ?? ATK_TYPE_ICON_MAP[keyword] ?? null

  const [keywords, setKeywords] = useState<Set<string>>(new Set())
  const [grades, setGrades] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<EgoGift | null>(null)
  const [sortBy, setSortBy] = useState<'default' | 'name' | 'grade'>('default')
  const [sortDesc, setSortDesc] = useState(false)

  const toggleKeyword = (key: string) => {
    setKeywords(prev => {
      if (key === '전체') return new Set()
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
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
    const result = gifts.filter(g => {
      if (keywords.size > 0 && !keywords.has(g.keyword)) return false
      if (grades.size > 0 && !grades.has(g.grade)) return false
      if (search && !g.name.includes(search)) return false
      return true
    })

    if (sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    } else if (sortBy === 'grade') {
      result.sort((a, b) => (GRADE_ORDER[a.grade] ?? 0) - (GRADE_ORDER[b.grade] ?? 0))
    }

    if (sortDesc) result.reverse()

    return result
  }, [gifts, keywords, grades, search, sortBy, sortDesc])

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

  // GSAP 진입 애니메이션 (뷰포트 내 카드만, 나머지는 즉시 표시)
  useEffect(() => {
    const initGSAP = async () => {
      const { gsap } = await import('gsap')
      const cards = document.querySelectorAll('.gift-card')
      const viewportH = window.innerHeight
      const visibleCards: Element[] = []
      cards.forEach(card => {
        const rect = card.getBoundingClientRect()
        if (rect.top < viewportH + 100) {
          visibleCards.push(card)
        } else {
          ;(card as HTMLElement).style.opacity = '1'
        }
      })
      if (visibleCards.length > 0) {
        gsap.fromTo(visibleCards,
          { opacity: 0, y: 16, scale: 0.97 },
          { opacity: 1, y: 0, scale: 1, duration: 0.3, stagger: 0.008, ease: 'power2.out' }
        )
      }
    }
    initGSAP()
  }, [filtered])

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 md:px-6 max-w-7xl mx-auto">
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
        .gift-card:hover .gift-frame {
          filter: brightness(1.2) drop-shadow(0 2px 8px rgba(200,144,10,0.4));
        }
      `}</style>
      {/* 헤더 */}
      <div className="mb-8 text-center">
        <h1 className="font-serif text-3xl md:text-4xl font-bold mb-2" style={{ color: 'var(--gold)' }}>
          거울 던전
        </h1>
        <p style={{ color: '#666688', fontSize: '0.875rem' }}>
          E.G.O 기프트 도감 — {gifts.length}종
        </p>
      </div>

      {/* 필터 영역 */}
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
        <div className="gift-grid" style={{ display: 'grid', gap: '0.625rem' }}>
          {filtered.map(gift => (
            <GiftCard
              key={gift.id}
              gift={gift}
              onClick={() => setSelected(gift)}
              getGiftKeywordIcon={getGiftKeywordIcon}
            />
          ))}
        </div>
      )}

      {/* 상세 모달 */}
      {selected && (
        <GiftModal
          gift={selected}
          recipe={recipeMap.get(selected.name) ?? null}
          giftImageMap={giftImageMap}
          onClose={() => setSelected(null)}
          getGiftKeywordIcon={getGiftKeywordIcon}
        />
      )}
    </div>
  )
}

/* ── 기프트 카드 ── */
function GiftCard({ gift, onClick, getGiftKeywordIcon }: { gift: EgoGift; onClick: () => void; getGiftKeywordIcon: (keyword: string) => string | null }) {
  const gradeLabel = GRADE_LABELS[gift.grade] ?? gift.grade
  const isEX = gift.grade === 'EX'

  return (
    <button
      onClick={onClick}
      className="gift-card group relative flex flex-col items-center transition-all duration-200 hover:scale-[1.06] hover:z-10"
      style={{ cursor: 'pointer', opacity: 0 }}
    >
      {/* 카드 프레임 */}
      <div
        className="gift-frame relative w-full aspect-square overflow-hidden"
        style={{
          backgroundImage: `url(${STORAGE_BASE}/icons/ego-gift-bg.webp)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          transition: 'filter 0.3s, box-shadow 0.3s',
        }}
      >
        {/* 등급 — 왼쪽 위, Bebas Neue 스타일 */}
        <span
          className="absolute top-[4%] left-[3%] z-10 pointer-events-none"
          style={{
            fontFamily: "'Bebas Neue', var(--font-title), sans-serif",
            fontWeight: 700,
            fontSize: 'clamp(20px, 42cqw, 48px)',
            lineHeight: 1,
            letterSpacing: '0.02em',
            color: isEX ? 'rgb(198, 255, 46)' : 'rgb(251, 183, 46)',
            textShadow: isEX
              ? '0 0 14px rgb(251,255,8), 0 0 6px rgb(12,90,0), 1px 1px 2px rgba(0,0,0,0.8)'
              : '0 0 8px rgb(255,114,21), 0 0 2px rgba(0,0,0,0.6)',
            filter: isEX ? 'brightness(1.1) drop-shadow(0 0 3px rgb(12,90,0))' : undefined,
          }}
        >
          {gradeLabel}
        </span>

        {/* 키워드 아이콘 — 오른쪽 아래 */}
        <div className="absolute bottom-0 right-0 z-10 w-[30%] h-[30%] pointer-events-none">
          {(() => {
            const iconUrl = getGiftKeywordIcon(gift.keyword)
            return iconUrl ? (
              <Image src={iconUrl} alt={gift.keyword} fill sizes="40px" className="object-contain" />
            ) : null
          })()}
        </div>

        {/* 기프트 이미지 — 중앙 74% */}
        <div className="absolute inset-[13%] flex items-center justify-center">
          {gift.image_url ? (
            <div className="relative w-full h-full">
              <Image
                src={gift.image_url}
                alt={gift.name}
                fill
                className="object-contain drop-shadow-lg"
                sizes="120px"
              />
            </div>
          ) : (
            <FlaskConical size={28} style={{ color: '#444' }} />
          )}
        </div>

        {/* 호버 글로우 (CSS에서 .gift-card:hover .gift-frame으로 처리) */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, rgba(251,183,46,0.15) 0%, transparent 50%)',
          }}
        />
      </div>

      {/* 이름 */}
      <p
        className="text-[0.625rem] md:text-[0.6875rem] leading-tight text-center mt-1.5 line-clamp-2 w-full"
        style={{ color: '#aaa', fontFamily: 'var(--font-heading)' }}
      >
        {gift.name}
      </p>
    </button>
  )
}

/* ── 상세 모달 ── */
function GiftModal({
  gift,
  recipe,
  giftImageMap,
  onClose,
  getGiftKeywordIcon,
}: {
  gift: EgoGift
  recipe: Recipe | null
  giftImageMap: Map<string, string>
  onClose: () => void
  getGiftKeywordIcon: (keyword: string) => string | null
}) {
  const kwColor = KEYWORD_COLORS[gift.keyword] ?? '#666'
  const gradeLabel = GRADE_LABELS[gift.grade] ?? gift.grade
  const isEX = gift.grade === 'EX'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* 배경 오버레이 */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* 모달 */}
      <div
        className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl"
        style={{
          background: '#131110',
          border: `1px solid ${kwColor}40`,
          boxShadow: `0 0 40px ${kwColor}15, 0 20px 60px rgba(0,0,0,0.6)`,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 닫기 */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full transition-colors hover:bg-white/10"
          style={{ cursor: 'pointer', color: '#777' }}
        >
          <X size={18} />
        </button>

        {/* 헤더: 카드 프레임 + 정보 */}
        <div className="flex items-start gap-4 p-5 pb-3">
          {/* 카드 스타일 이미지 프레임 */}
          <div
            className="relative flex-shrink-0 overflow-hidden"
            style={{
              width: '5.5rem',
              height: '5.5rem',
              backgroundImage: `url(${STORAGE_BASE}/icons/ego-gift-bg.webp)`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            {/* 등급 라벨 */}
            <span
              className="absolute top-[4%] left-[5%] z-10 pointer-events-none"
              style={{
                fontFamily: "'Bebas Neue', var(--font-title), sans-serif",
                fontWeight: 700,
                fontSize: '1.75rem',
                lineHeight: 1,
                color: isEX ? 'rgb(198, 255, 46)' : 'rgb(251, 183, 46)',
                textShadow: isEX
                  ? '0 0 10px rgb(251,255,8), 0 0 4px rgb(12,90,0), 1px 1px 2px rgba(0,0,0,0.8)'
                  : '0 0 6px rgb(255,114,21), 0 0 2px rgba(0,0,0,0.6)',
              }}
            >
              {gradeLabel}
            </span>

            {/* 키워드 아이콘 */}
            <div className="absolute bottom-0 right-0 z-10 w-[30%] h-[30%] pointer-events-none">
              {(() => {
                const iconUrl = getGiftKeywordIcon(gift.keyword)
                return iconUrl ? (
                  <Image src={iconUrl} alt={gift.keyword} fill sizes="28px" className="object-contain" />
                ) : null
              })()}
            </div>

            {/* 기프트 이미지 */}
            <div className="absolute inset-[13%] flex items-center justify-center">
              {gift.image_url ? (
                <div className="relative w-full h-full">
                  <Image
                    src={gift.image_url}
                    alt={gift.name}
                    fill
                    className="object-contain drop-shadow-lg"
                    sizes="80px"
                  />
                </div>
              ) : (
                <FlaskConical size="1.75rem" style={{ color: '#444' }} />
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0 pt-1">
            <h2
              className="font-serif text-lg md:text-xl font-bold leading-tight"
              style={{ color: '#e8d8c0' }}
            >
              {gift.name}
            </h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.625rem] font-bold"
                style={{ background: `${kwColor}25`, color: kwColor, fontFamily: 'var(--font-heading)' }}
              >
                {(() => {
                  const iconUrl = getGiftKeywordIcon(gift.keyword)
                  return iconUrl ? <Image src={iconUrl} alt="" width={12} height={12} /> : null
                })()}
                {gift.keyword}
              </span>
              {gift.enhancement && (
                <span
                  className="px-2 py-0.5 rounded-full text-[0.625rem]"
                  style={{ background: 'rgba(64,160,96,0.15)', color: '#40a060', fontFamily: 'var(--font-heading)' }}
                >
                  강화 가능
                </span>
              )}
              {gift.is_synthesis && (
                <span
                  className="px-2 py-0.5 rounded-full text-[0.625rem]"
                  style={{ background: 'rgba(180,120,220,0.15)', color: '#b478dc', fontFamily: 'var(--font-heading)' }}
                >
                  합성
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 효과 */}
        <div className="px-5 pb-4 space-y-3">
          {/* 기본 효과 */}
          {gift.effect_base && (
            <EffectBlock label="기본" text={gift.effect_base} color="#888" />
          )}
          {gift.effect_plus && (
            <EffectBlock label="+" text={gift.effect_plus} color="#a0a0a0" />
          )}
          {gift.effect_plusplus && (
            <EffectBlock label="++" text={gift.effect_plusplus} color="#e8b030" />
          )}

          {/* 메타 정보 */}
          <div
            className="grid grid-cols-2 gap-2 pt-2"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
          >
            {gift.price != null && (
              <MetaItem label="가격" value={`${gift.price}`} icon="https://lpgqcleszdlldneiwgep.supabase.co/storage/v1/object/public/limbus-assets/icons/ui/credits.webp" />
            )}
            {gift.sell_price != null && (
              <MetaItem label="판매가" value={`${gift.sell_price}`} icon="https://lpgqcleszdlldneiwgep.supabase.co/storage/v1/object/public/limbus-assets/icons/ui/credits.webp" />
            )}
            {gift.buy_disabled && (
              <MetaItem label="구매" value="불가" valueColor="#c83030" />
            )}
            {gift.activation_condition != null && (() => {
              const c = gift.activation_condition
              let label = '발동 조건'
              let value = `${c.count}인`
              if (c.type === 'keyword') {
                label = `${c.keyword} 인격`; value = `${c.count}인 이상`
              } else if (c.type === 'multi_keyword') {
                label = `${c.keywords!.join('+')} 인격`; value = `${c.count}인 이상`
              } else if (c.type === 'affiliation') {
                label = `${c.affiliation ?? c.affiliations!.join('/')} 소속`; value = `${c.count}인 이상`
              } else if (c.type === 'skill') {
                label = c.skill_condition!; value = `${c.count}인 이상`
              }
              return <MetaItem label={label} value={value} valueColor="#6090d0" />
            })()}
            {gift.first_appearance && (
              <MetaItem label="첫 등장" value={gift.first_appearance} />
            )}
            {gift.related && gift.related !== '불명' && gift.related !== '-' && (
              <MetaItem label="관련" value={gift.related} />
            )}
          </div>

          {/* 획득 방법 */}
          {gift.acquisition && (
            <div
              className="pt-2"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
            >
              <p
                className="font-bold mb-1"
                style={{ color: '#666', fontFamily: 'var(--font-heading)', fontSize: '0.625rem' }}
              >
                획득 방법
              </p>
              <p style={{ color: '#a09880', fontSize: '0.75rem', lineHeight: 1.6 }}>
                {gift.acquisition}
              </p>
            </div>
          )}

          {/* 레시피 */}
          {recipe && (
            <div
              className="pt-3 mt-1"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
            >
              <p
                className="text-[0.6875rem] font-bold mb-2 flex items-center gap-1.5"
                style={{ color: '#b478dc', fontFamily: 'var(--font-heading)' }}
              >
                <FlaskConical size={13} />
                조합 레시피
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {recipe.ingredients.map((ing, i) => (
                  <span key={i} className="flex items-center">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[0.6875rem]"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        color: '#bbb',
                      }}
                    >
                      {giftImageMap.get(ing) && (
                        <Image src={giftImageMap.get(ing)!} alt="" width={16} height={16} className="flex-shrink-0" />
                      )}
                      {ing}
                    </span>
                    {i < recipe.ingredients.length - 1 && (
                      <span style={{ color: '#444', margin: '0 2px', fontFamily: 'sans-serif' }}>+</span>
                    )}
                  </span>
                ))}
                <span style={{ color: '#555', margin: '0 4px', fontFamily: 'sans-serif' }}>=</span>
                <span
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[0.6875rem] font-bold"
                  style={{
                    background: `${kwColor}15`,
                    color: kwColor,
                  }}
                >
                  {giftImageMap.get(recipe.result_name) && (
                    <Image src={giftImageMap.get(recipe.result_name)!} alt="" width={16} height={16} className="flex-shrink-0" />
                  )}
                  {recipe.result_name}
                </span>
              </div>
              {recipe.final_result && (
                <p className="mt-2 text-[0.6875rem]" style={{ color: '#888' }}>
                  <span style={{ color: '#666' }}>최종 합성:</span>{' '}
                  <span style={{ color: '#e8b030' }}>{recipe.final_result}</span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── 효과 블록 ── */
function EffectBlock({ label, text, color }: { label: string; text: string; color: string }) {
  const formatSkillDesc = useFormatSkillDesc()
  // "- " 구분자 또는 기존 줄바꿈 기준으로만 분리
  const lines = text
    .replace(/(?<=.)- /g, '\n- ')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)

  return (
    <div>
      <p
        className="text-[0.625rem] font-bold mb-1.5"
        style={{ color: label === '++' ? '#e8b030' : '#666', fontFamily: 'var(--font-heading)' }}
      >
        효과 {label}
      </p>
      <div className="text-[0.75rem] leading-[1.7] space-y-1" style={{ color }}>
        {lines.map((line, i) => (
          <p key={i}>{formatSkillDesc(line, color)}</p>
        ))}
      </div>
    </div>
  )
}

/* ── 메타 항목 ── */
function MetaItem({
  label,
  value,
  valueColor = '#999',
  icon,
}: {
  label: string
  value: string
  valueColor?: string
  icon?: string
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[0.625rem]" style={{ color: '#555', fontFamily: 'var(--font-heading)' }}>
        {label}
      </span>
      {icon && <Image src={icon} alt="" width={12} height={12} />}
      <span className="text-[0.6875rem]" style={{ color: valueColor }}>
        {value}
      </span>
    </div>
  )
}

/* ── 등급 멀티 드롭다운 ── */
function GradeMultiDropdown({ grades, toggleGrade }: { grades: Set<string>; toggleGrade: (g: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const isActive = grades.size > 0
  const label = !isActive ? '전체' : `${grades.size}개 선택`

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors"
        style={{
          cursor: 'pointer',
          background: 'rgba(255,255,255,0.05)',
          border: `1px solid ${isActive ? 'var(--gold-dim)' : 'rgba(255,255,255,0.1)'}`,
          color: isActive ? 'var(--gold)' : '#777',
          fontFamily: 'var(--font-heading)',
          minWidth: 100,
        }}
      >
        등급: {label}
        <ChevronDown
          size={14}
          style={{
            opacity: 0.5,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        />
      </button>
      {open && (
        <div
          className="absolute top-full mt-1 left-0 z-30 rounded overflow-hidden"
          style={{
            background: '#1a1510',
            border: '1px solid var(--border)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            minWidth: 120,
          }}
        >
          {GRADES.map(g => {
            const isAll = g === '전체'
            const checked = isAll ? grades.size === 0 : grades.has(g)
            return (
              <button
                key={g}
                onClick={() => toggleGrade(g)}
                className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white/5"
                style={{
                  cursor: 'pointer',
                  color: checked ? 'var(--gold)' : '#777',
                  fontFamily: 'var(--font-heading)',
                }}
              >
                <span
                  className="inline-block w-3 h-3 rounded-sm border shrink-0"
                  style={{
                    borderColor: checked ? 'var(--gold)' : '#555',
                    background: checked ? 'var(--gold)' : 'transparent',
                  }}
                >
                  {checked && (
                    <svg viewBox="0 0 12 12" fill="none" style={{ width: '100%', height: '100%' }}>
                      <path d="M3 6l2 2 4-4" stroke="#0d0b08" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                {isAll ? '전체' : GRADE_LABELS[g] ?? g}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
