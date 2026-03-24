'use client'

import { useState, useMemo, useCallback } from 'react'
import { Search, X } from 'lucide-react'
import { useFormatSkillDesc } from '@/components/providers/KeywordProvider'
import KeywordGrid from './KeywordGrid'
import KeywordModal from './KeywordModal'

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

  // 수감자 이름 맵
  const sinnerNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    sinners.forEach(s => { map[s.id] = s.name_kr })
    return map
  }, [sinners])

  // 카운트 맵
  const identityCountMap = useMemo(() => {
    const map: Record<string, number> = {}
    identities.forEach(id => {
      (id.keywords ?? []).forEach(kw => { map[kw] = (map[kw] || 0) + 1 })
    })
    return map
  }, [identities])

  const egoCountMap = useMemo(() => {
    const map: Record<string, number> = {}
    egos.forEach(ego => {
      (ego.keywords ?? []).forEach(kw => { map[kw] = (map[kw] || 0) + 1 })
    })
    return map
  }, [egos])

  const giftCountMap = useMemo(() => {
    const map: Record<string, number> = {}
    gifts.forEach(g => { map[g.keyword] = (map[g.keyword] || 0) + 1 })
    return map
  }, [gifts])

  // 필터링 + 정렬
  const filtered = useMemo(() => {
    return keywords.filter(kw => {
      if (search && !kw.name.includes(search) && !kw.description?.includes(search)) return false
      return true
    }).sort((a, b) => {
      const aCount = (identityCountMap[a.name] || 0) + (egoCountMap[a.name] || 0) + (giftCountMap[a.name] || 0)
      const bCount = (identityCountMap[b.name] || 0) + (egoCountMap[b.name] || 0) + (giftCountMap[b.name] || 0)
      return bCount - aCount
    })
  }, [keywords, search, identityCountMap, egoCountMap, giftCountMap])

  // 선택된 키워드의 관련 데이터
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

  const handleClose = useCallback(() => setSelected(null), [])

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
      <div className="mb-8 max-w-md mx-auto">
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

      {/* 그리드 */}
      <KeywordGrid
        keywords={filtered}
        countMaps={{ identity: identityCountMap, ego: egoCountMap, gift: giftCountMap }}
        onSelect={setSelected}
      />

      {/* 모달 */}
      {selected && (
        <KeywordModal
          keyword={selected}
          relatedIdentities={relatedIdentities}
          relatedEgos={relatedEgos}
          relatedGifts={relatedGifts}
          sinnerNameMap={sinnerNameMap}
          formatSkillDesc={formatSkillDesc}
          onClose={handleClose}
        />
      )}

      {/* CSS 애니메이션 — opacity 버그 수정 핵심 */}
      <style>{`
        @keyframes kwCardIn {
          from { opacity: 0; transform: translateY(0.75rem); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
