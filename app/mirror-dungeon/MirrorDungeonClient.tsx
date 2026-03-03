'use client'

import { useState, useMemo, useEffect } from 'react'
import Image from 'next/image'
import { Search, X, FlaskConical } from 'lucide-react'
import Dropdown from '@/components/ui/Dropdown'
import { getKeywordIconUrl, ATK_TYPE_ICON_MAP } from '@/lib/data/sinners'
import { formatSkillDesc } from '@/components/sinners/KeywordTooltip'

/** 키워드 아이콘 URL (상태이상 + 참격/관통/타격 통합) */
function getGiftKeywordIcon(keyword: string): string | null {
  return getKeywordIconUrl(keyword) ?? ATK_TYPE_ICON_MAP[keyword] ?? null
}

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
  const [keyword, setKeyword] = useState('전체')
  const [grade, setGrade] = useState('전체')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<EgoGift | null>(null)
  const [sortBy, setSortBy] = useState<'default' | 'name' | 'grade'>('default')
  const [sortDesc, setSortDesc] = useState(false)

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
      if (keyword !== '전체' && g.keyword !== keyword) return false
      if (grade !== '전체' && g.grade !== grade) return false
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
  }, [gifts, keyword, grade, search, sortBy, sortDesc])

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

  // GSAP 진입 애니메이션
  useEffect(() => {
    const initGSAP = async () => {
      const { gsap } = await import('gsap')
      gsap.fromTo('.gift-card',
        { opacity: 0, y: 20, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.35, stagger: 0.012, ease: 'power2.out' }
      )
    }
    initGSAP()
  }, [filtered])

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 md:px-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="mb-8 text-center">
        <h1 className="font-serif text-3xl md:text-4xl font-bold mb-2" style={{ color: 'var(--gold)' }}>
          거울 던전
        </h1>
        <p style={{ color: '#666688', fontSize: '14px' }}>
          E.G.O 기프트 도감 — {gifts.length}종
        </p>
      </div>

      {/* 필터 영역 */}
      <div className="mb-6 space-y-4">
        {/* 키워드 필터 */}
        <div className="flex flex-wrap gap-2 justify-center">
          {KEYWORDS.map(kw => {
            const iconUrl = kw.key !== '전체' ? getGiftKeywordIcon(kw.key) : null
            return (
              <button
                key={kw.key}
                onClick={() => setKeyword(kw.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200"
                style={{
                  cursor: 'pointer',
                  background: keyword === kw.key
                    ? (kw.key === '전체' ? 'var(--gold)' : KEYWORD_COLORS[kw.key] ?? '#666')
                    : 'rgba(255,255,255,0.05)',
                  color: keyword === kw.key ? '#0d0b08' : '#777',
                  border: `1px solid ${keyword === kw.key
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
                    unoptimized
                    style={{ opacity: keyword === kw.key ? 0.9 : 0.5 }}
                  />
                )}
                {kw.label}
              </button>
            )
          })}
        </div>

        {/* 등급 + 검색 */}
        <div className="flex gap-3 justify-center items-center flex-wrap">
          {/* 등급 드롭다운 */}
          <Dropdown
            value={grade}
            options={GRADES.map(g => ({ value: g, label: g === '전체' ? '전체' : GRADE_LABELS[g] ?? g }))}
            onChange={setGrade}
            prefix="등급:"
            defaultValue="전체"
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
                  className="px-2.5 py-1.5 rounded text-[11px] transition-colors"
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
          <span style={{ color: '#555', fontSize: '12px', fontFamily: 'var(--font-heading)' }}>
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
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
          {filtered.map(gift => (
            <GiftCard
              key={gift.id}
              gift={gift}
              onClick={() => setSelected(gift)}
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
        />
      )}
    </div>
  )
}

/* ── 기프트 카드 ── */
function GiftCard({ gift, onClick }: { gift: EgoGift; onClick: () => void }) {
  const kwColor = KEYWORD_COLORS[gift.keyword] ?? '#666'
  const gradeLabel = GRADE_LABELS[gift.grade] ?? gift.grade

  return (
    <button
      onClick={onClick}
      className="gift-card group relative flex flex-col items-center rounded-lg p-2 transition-all duration-200 hover:scale-[1.04] hover:z-10"
      style={{
        cursor: 'pointer',
        opacity: 0,
        background: 'rgba(26,21,16,0.8)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* 등급 배지 */}
      <div
        className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold"
        style={{
          background: 'rgba(0,0,0,0.5)',
          color: gift.grade === 'EX' ? '#e8b030' : kwColor,
          fontFamily: 'var(--font-mono)',
        }}
      >
        {gradeLabel}
      </div>

      {/* 이미지 */}
      <div className="w-14 h-14 md:w-16 md:h-16 relative my-1 flex-shrink-0">
        {gift.image_url ? (
          <Image
            src={gift.image_url}
            alt={gift.name}
            fill
            className="object-contain drop-shadow-lg"
            sizes="64px"
            unoptimized
          />
        ) : (
          <div className="w-full h-full rounded bg-white/5 flex items-center justify-center">
            <FlaskConical size={20} style={{ color: '#444' }} />
          </div>
        )}
      </div>

      {/* 이름 */}
      <p
        className="text-[10px] md:text-[11px] leading-tight text-center mt-1 line-clamp-2"
        style={{ color: '#aaa', fontFamily: 'var(--font-heading)' }}
      >
        {gift.name}
      </p>

      {/* 가격 */}
      {gift.price != null ? (
        <p className="flex items-center gap-0.5 text-[9px] mt-1" style={{ color: '#8a7a50', fontFamily: 'var(--font-mono)' }}>
          <Image src="https://lpgqcleszdlldneiwgep.supabase.co/storage/v1/object/public/limbus-assets/icons/ui/credits.webp" alt="" width={10} height={10} unoptimized />
          {gift.price}
        </p>
      ) : gift.sell_price != null ? (
        <p className="flex items-center gap-0.5 text-[9px] mt-1" style={{ color: '#665540', fontFamily: 'var(--font-mono)' }}>
          <Image src="https://lpgqcleszdlldneiwgep.supabase.co/storage/v1/object/public/limbus-assets/icons/ui/credits.webp" alt="" width={10} height={10} unoptimized style={{ opacity: 0.6 }} />
          {gift.sell_price}
        </p>
      ) : (
        <div className="mt-1" />
      )}

      {/* 키워드 아이콘 */}
      {(() => {
        const iconUrl = getGiftKeywordIcon(gift.keyword)
        return iconUrl ? (
          <Image src={iconUrl} alt={gift.keyword} width={14} height={14} unoptimized
            className="mt-0.5 mb-0.5" style={{ opacity: 0.6 }} />
        ) : (
          <div className="w-1.5 h-1.5 rounded-full mt-0.5 mb-0.5" style={{ background: kwColor }} />
        )
      })()}

      {/* 호버 글로우 */}
      <div
        className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          boxShadow: `inset 0 0 20px ${kwColor}15, 0 0 12px ${kwColor}10`,
          border: `1px solid ${kwColor}30`,
          borderRadius: '8px',
        }}
      />
    </button>
  )
}

/* ── 상세 모달 ── */
function GiftModal({
  gift,
  recipe,
  giftImageMap,
  onClose,
}: {
  gift: EgoGift
  recipe: Recipe | null
  giftImageMap: Map<string, string>
  onClose: () => void
}) {
  const kwColor = KEYWORD_COLORS[gift.keyword] ?? '#666'
  const gradeLabel = GRADE_LABELS[gift.grade] ?? gift.grade

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

        {/* 헤더 */}
        <div className="flex items-start gap-4 p-5 pb-3">
          {/* 이미지 */}
          <div className="w-20 h-20 relative flex-shrink-0">
            {gift.image_url ? (
              <Image
                src={gift.image_url}
                alt={gift.name}
                fill
                className="object-contain drop-shadow-xl"
                sizes="80px"
                unoptimized
              />
            ) : (
              <div className="w-full h-full rounded-lg bg-white/5 flex items-center justify-center">
                <FlaskConical size={32} style={{ color: '#444' }} />
              </div>
            )}
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
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: `${kwColor}25`, color: kwColor, fontFamily: 'var(--font-heading)' }}
              >
                {(() => {
                  const iconUrl = getGiftKeywordIcon(gift.keyword)
                  return iconUrl ? <Image src={iconUrl} alt="" width={12} height={12} unoptimized /> : null
                })()}
                {gift.keyword}
              </span>
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  color: gift.grade === 'EX' ? '#e8b030' : '#999',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {gradeLabel}
              </span>
              {gift.enhancement && (
                <span
                  className="px-2 py-0.5 rounded-full text-[10px]"
                  style={{ background: 'rgba(64,160,96,0.15)', color: '#40a060', fontFamily: 'var(--font-heading)' }}
                >
                  강화 가능
                </span>
              )}
              {gift.is_synthesis && (
                <span
                  className="px-2 py-0.5 rounded-full text-[10px]"
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

          {/* 레시피 */}
          {recipe && (
            <div
              className="pt-3 mt-1"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
            >
              <p
                className="text-[11px] font-bold mb-2 flex items-center gap-1.5"
                style={{ color: '#b478dc', fontFamily: 'var(--font-heading)' }}
              >
                <FlaskConical size={13} />
                조합 레시피
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {recipe.ingredients.map((ing, i) => (
                  <span key={i} className="flex items-center">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px]"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        color: '#bbb',
                      }}
                    >
                      {giftImageMap.get(ing) && (
                        <Image src={giftImageMap.get(ing)!} alt="" width={16} height={16} unoptimized className="flex-shrink-0" />
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
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold"
                  style={{
                    background: `${kwColor}15`,
                    color: kwColor,
                  }}
                >
                  {giftImageMap.get(recipe.result_name) && (
                    <Image src={giftImageMap.get(recipe.result_name)!} alt="" width={16} height={16} unoptimized className="flex-shrink-0" />
                  )}
                  {recipe.result_name}
                </span>
              </div>
              {recipe.final_result && (
                <p className="mt-2 text-[11px]" style={{ color: '#888' }}>
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
  // "- " 구분자 또는 기존 줄바꿈 기준으로만 분리
  const lines = text
    .replace(/(?<=.)- /g, '\n- ')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)

  return (
    <div>
      <p
        className="text-[10px] font-bold mb-1.5"
        style={{ color: label === '++' ? '#e8b030' : '#666', fontFamily: 'var(--font-heading)' }}
      >
        효과 {label}
      </p>
      <div className="text-[12px] leading-[1.7] space-y-1" style={{ color }}>
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
      <span className="text-[10px]" style={{ color: '#555', fontFamily: 'var(--font-heading)' }}>
        {label}
      </span>
      {icon && <Image src={icon} alt="" width={12} height={12} unoptimized />}
      <span className="text-[11px]" style={{ color: valueColor }}>
        {value}
      </span>
    </div>
  )
}
