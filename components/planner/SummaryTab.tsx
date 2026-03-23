'use client'

import { useState, useMemo, useRef } from 'react'
import IdentityDetailModal from '@/components/ui/IdentityDetailModal'
import EgoDetailModal from '@/components/ui/EgoDetailModal'
import Image from 'next/image'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { NoteRenderer, type NoteEgoGiftEntry } from '@/components/decks/NoteChips'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import {
  useNoteAutocomplete,
  NoteAutocompleteDropdown,
  buildKeywordPool,
  buildEgoGiftPool,
  type AutocompleteSuggestion,
} from '@/components/notes/NoteAutocomplete'
import type { PlannerState, PlannerAction, ThemeData, GiftData, RecipeData, IdentityData, SinnerData, EgoData, SkillSummary } from '@/lib/planner/types'
import { DIFFICULTY_CONFIG } from '@/lib/planner/types'
import { getIdentityImageUrl, getSinnerLogoUrl, getSkillIconUrl } from '@/lib/utils/images'
import { STORAGE_BASE, RARITY_COLORS, GRADE_COLORS } from '@/lib/constants/game'
import { SIN_COLORS, SIN_KR_TO_EN, getSinIconUrl } from '@/lib/constants/sin'
import type { PassiveData } from '@/lib/planner/types'
import { normalizeThemeKeyword } from '@/lib/constants/keywords'
import PlannerGiftModal from './PlannerGiftModal'

const S = STORAGE_BASE
const OCTAGON_CLIP = 'polygon(12% 0%, 88% 0%, 100% 12%, 100% 88%, 88% 100%, 12% 100%, 0% 88%, 0% 12%)'
const GRADE_ROMAN: Record<string, string> = { 'EX': 'EX', '5': '\u2164', '4': '\u2163', '3': '\u2162', '2': '\u2161', '1': '\u2160' }
const GRADE_ORDER = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH']

// ── 자동완성 지원 textarea ────────────────────────────────────────────────
function AcTextarea({
  value, onChange, pool, placeholder, rows, maxLength, style: extraStyle,
}: {
  value: string; onChange: (v: string) => void; pool: AutocompleteSuggestion[]
  placeholder?: string; rows?: number; maxLength?: number; style?: React.CSSProperties
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const ac = useNoteAutocomplete({ text: value, setText: onChange, textareaRef: ref, pool })
  return (
    <div style={{ position: 'relative' }}>
      <textarea
        ref={ref} value={value} rows={rows} maxLength={maxLength} placeholder={placeholder}
        onChange={e => { onChange(e.target.value); ac.onTextChange(e) }}
        onSelect={ac.onTextSelect} onKeyDown={ac.handleKeyDown}
        style={{
          background: '#0d0b08', border: '1px solid #333', borderRadius: '0.375rem',
          padding: '0.5rem 0.75rem', fontSize: '0.8125rem', color: '#e5e7eb',
          outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical',
          lineHeight: 1.6, fontFamily: 'inherit', ...extraStyle,
        }}
        onFocus={e => { e.currentTarget.style.borderColor = '#c8900a' }}
        onBlur={e => { e.currentTarget.style.borderColor = '#333' }}
      />
      <NoteAutocompleteDropdown
        suggestions={ac.suggestions} selectedIdx={ac.selectedIdx}
        onSelect={ac.select} onHover={ac.setSelectedIdx}
      />
    </div>
  )
}

const BLESSING_NAMES: Record<number, string> = {
  100: '시작의 별', 101: '쌓여가는 별무리', 102: '성간여행', 103: '쏟아지는 유성우',
  104: '쌍성계 상점', 105: '위성계 상점', 106: '성운의 총애', 107: '별빛의 인도',
  108: '우연한 혜성', 109: '완전한 가능성',
}
const BLESSING_COSTS: Record<number, [number, number, number]> = {
  100: [10, 20, 30], 101: [10, 20, 30], 102: [20, 40, 60], 103: [20, 40, 60],
  104: [30, 60, 90], 105: [30, 60, 90], 106: [40, 80, 120], 107: [40, 80, 120],
  108: [50, 100, 150], 109: [60, 120, 180],
}
const BLESSING_EFFECTS: Record<number, [string[], string[], string[]]> = {
  100: [['시작 코스트 +150', '테마팩 목록 +1', '상점 기프트 목록 +1', '상점 일반 새로고침 1회 무료'], ['시작 코스트 +250', '테마팩 목록 +1', '상점 기프트 목록 +1', '상점 일반 새로고침 1회 무료'], ['시작 코스트 +250', '테마팩 목록 +1', '상점 기프트 목록 +1', '상점 일반 새로고침 2회 무료']],
  101: [['층 이동 시, 보유 코스트 10% 증가 (최대 100)', '기프트 판매 비용 50% 증가 (상점별 1회)'], ['층 이동 시, 보유 코스트 20% 증가 (최대 125)', '기프트 판매 비용 75% 증가 (상점별 1회)'], ['층 이동 시, 보유 코스트 30% 증가 (최대 150)', '기프트 판매 비용 100% 증가 (상점별 1회)']],
  102: [['테마팩 목록 +1', '테마팩 새로고침 횟수 +2', '기록 없는 테마팩 선택 시, 모든 인격 레벨 +3'], ['테마팩 목록 +1', '테마팩 새로고침 횟수 +3', '기록 없는 테마팩 선택 시, 모든 인격 레벨 +3', '테마팩 해금 수에 따라 버프'], ['테마팩 목록 +1', '테마팩 새로고침 횟수 +4', '기록 없는 테마팩 선택 시, 모든 인격 레벨 +3', '테마팩 해금 수에 따라 버프']],
  103: [['시작 코스트 +400', '시작 기프트 수 +1'], ['시작 코스트 +500', '시작 기프트 수 +1', '별빛 전투 보상 시 코스트 +75'], ['시작 코스트 +700', '시작 기프트 수 +1', '별빛 전투 보상 시 코스트 +150']],
  104: [['상점 기프트 목록 +1', '전투 보급 코스트 +20', '높은 등급 기프트 확률 상승'], ['상점 기프트 목록 +1', '전투 보급 코스트 +30', '높은 등급 기프트 확률 상승', '기프트 등급 합 기반 코스트'], ['상점 기프트 목록 +1', '전투 보급 코스트 +40', '높은 등급 기프트 확률 상승', '기프트 등급 합 기반 코스트']],
  105: [['상점 키워드 새로고침 1회 무료', '1층 입장 시, 1등급 기프트 1개'], ['상점 키워드 새로고침 1회 무료', '1층 입장 시, 1등급 기프트 2개', '강화 상점 확률 증가'], ['상점 키워드 새로고침 2회 무료', '1층 입장 시, 1등급 기프트 3개', '강화 상점 확률 증가']],
  106: [['1층 입장 시, 인격 레벨 +3', '층 클리어 시, 인격 레벨 +1 (최대 5)'], ['1층 입장 시, 인격 레벨 +3', '층 클리어 시, 인격 레벨 +1 (최대 9)'], ['1층 입장 시, 인격 레벨 +3', '6층 입장 시, +3', '층 클리어 시, +1 (최대 9)']],
  107: [['속도 최댓값 +2', '합 위력 증가 1', '피해량 증가 1', '보호 1'], ['속도 최댓값 +3', '합 위력 증가 1', '피해량 증가 1', '보호 1'], ['속도 최댓값 +3', '합 위력 증가 1', '피해량 증가 1', '보호 1']],
  108: [['합성 판매용 기프트 1개', '3층 입장 시, 3등급 기프트 1개', '합성 시 2단계 낮은 기프트'], ['합성 판매용 기프트 2개', '3/5층 입장 시, 3등급 기프트 1개', '합성 시 2단계 낮은 기프트'], ['합성 판매용 기프트 3개', '3/5/7층 입장 시, 4등급 기프트 1개', '합성 시 1단계 낮은 기프트']],
  109: [['테마팩 목록 +1', '시작 기프트 수 +1', '키워드 3등급 기프트 1개 선택', '어두운 잔영 1개'], ['테마팩 목록 +1', '시작 기프트 수 +1', '키워드 3등급 기프트 2개 선택', '1~2등급 합성 재료'], ['테마팩 목록 +1', '시작 기프트 수 +1', '키워드 3등급 기프트 3개 선택', '1~3등급 합성 재료']],
}

const SLUG_TO_KEYWORD: Record<string, string> = {
  burn: '화상', bleed: '출혈', tremor: '진동', rupture: '파열',
  sinking: '침잠', breath: '호흡', charge: '충전', slash: '참격',
  pierce: '관통', blunt: '타격',
}
const STATS_SLUGS = new Set(['slash', 'pierce', 'blunt'])
function getKeywordSlug(kw: string | null): string | null {
  if (!kw) return null
  for (const [slug, k] of Object.entries(SLUG_TO_KEYWORD)) { if (kw.includes(k) || k.includes(kw)) return slug }
  return null
}
function getKwIconUrl(slug: string): string | null {
  if (STATS_SLUGS.has(slug)) return `${S}/icons/stats/${slug}.webp`
  return `${S}/icons/keywords/${slug}.webp`
}

interface SummaryTabProps {
  state: PlannerState
  dispatch: React.Dispatch<PlannerAction>
  themes: ThemeData[]
  gifts: GiftData[]
  recipes: RecipeData[]
  giftMap: Map<number, GiftData>
  identities: IdentityData[]
  sinners: SinnerData[]
  egos: EgoData[]
  skills: SkillSummary[]
  passives: PassiveData[]
}

export default function SummaryTab({ state, dispatch, themes, gifts, recipes, giftMap, identities, sinners, skills, passives }: SummaryTabProps) {
  const [deckSubTab, setDeckSubTab] = useState<'identity' | 'ego' | 'skillset'>('identity')
  const [passiveTab, setPassiveTab] = useState<'battle' | 'support'>('battle')
  const [expandedFloor, setExpandedFloor] = useState<number | null>(null)
  const [selectedGift, setSelectedGift] = useState<{ gift: GiftData; enhance?: number } | null>(null)
  const [identityModalId, setIdentityModalId] = useState<string | null>(null)
  const [egoModalId, setEgoModalId] = useState<string | null>(null)

  const themeMap = useMemo(() => new Map(themes.map(t => [t.id, t])), [themes])
  const identityMap = useMemo(() => new Map(identities.map(i => [i.id, i])), [identities])
  const kwContext = useKeywordData()
  const allowedKeywords = useMemo(() => new Set(Object.keys(kwContext.keywords)), [kwContext.keywords])

  // 이름 → GiftData 맵 (레시피용)
  const giftByName = useMemo(() => {
    const map = new Map<string, GiftData>()
    for (const g of gifts) map.set(g.name, g)
    return map
  }, [gifts])

  // 조합법 맵: result game_id → { materials: GiftData[], result: GiftData }
  const recipeMap = useMemo(() => {
    const map = new Map<number, { materials: GiftData[]; result: GiftData }>()
    for (const r of recipes) {
      const result = giftByName.get(r.result_name)
      if (!result) continue
      const mats = r.ingredients
        .map(name => giftByName.get(name))
        .filter(Boolean) as GiftData[]
      map.set(result.game_id, { materials: mats, result })
    }
    return map
  }, [recipes, giftByName])

  // 기프트 칩 렌더링용 lookup
  const egoGiftLookup = useMemo(() => {
    const map: Record<string, NoteEgoGiftEntry> = {}
    for (const g of gifts) {
      if (g.name && g.keyword) {
        map[g.name] = { name: g.name, keyword: g.keyword, grade: g.grade ?? '1', image_url: g.image_url, effect_base: g.effect_base }
      }
    }
    return map
  }, [gifts])

  // 자동완성 풀
  const acPool = useMemo(() => {
    const kwPool = buildKeywordPool(kwContext.keywords)
    const giftPool = buildEgoGiftPool(
      Array.from(giftMap.values()).filter(g => g.keyword && g.name).map(g => ({
        name: g.name, keyword: g.keyword!, image_url: g.image_url,
      }))
    )
    return [...kwPool, ...giftPool]
  }, [kwContext.keywords, giftMap])

  // 가호
  const blessings = useMemo(() => {
    const list: { baseId: number; name: string; level: number; cost: number }[] = []
    for (const id of state.giftInventory) {
      if (!id.startsWith('blessing_')) continue
      const [, bStr, lStr] = id.split('_')
      const baseId = parseInt(bStr), level = parseInt(lStr)
      list.push({ baseId, name: BLESSING_NAMES[baseId] ?? `가호 ${baseId}`, level, cost: BLESSING_COSTS[baseId]?.[level - 1] ?? 0 })
    }
    return list
  }, [state.giftInventory])

  const totalBlessingCost = blessings.reduce((s, b) => s + b.cost, 0)

  // 기프트 분류
  const observeGifts = useMemo(() =>
    state.giftInventory.filter(id => id.startsWith('observe_')).map(id => giftMap.get(parseInt(id.replace('observe_', '')))).filter(Boolean) as GiftData[]
  , [state.giftInventory, giftMap])

  const startGifts = useMemo(() =>
    state.giftInventory.filter(id => id.startsWith('start_')).map(id => giftMap.get(parseInt(id.replace('start_', '')))).filter(Boolean) as GiftData[]
  , [state.giftInventory, giftMap])

  const finalGifts = useMemo(() => {
    const list: { gift: GiftData; enhance: number }[] = []
    for (const id of state.giftInventory) {
      if (!id.startsWith('final_')) continue
      let enhance = 0, gid: number
      if (id.endsWith('_plusplus')) { gid = parseInt(id.replace('final_', '').replace('_plusplus', '')); enhance = 2 }
      else if (id.endsWith('_plus')) { gid = parseInt(id.replace('final_', '').replace('_plus', '')); enhance = 1 }
      else { gid = parseInt(id.replace('final_', '')) }
      const gift = giftMap.get(gid)
      if (gift) list.push({ gift, enhance })
    }
    return list
  }, [state.giftInventory, giftMap])

  // 조건 체크 (편성 vs 전체)
  const { formationKwCounts, allKwCounts } = useMemo(() => {
    const formation: Record<string, number> = {}
    const all: Record<string, number> = {}
    for (const slot of state.identitySlots) {
      if (slot.slot_order >= 99) continue // 벤치 제외
      const isFormation = slot.slot_order < 7
      const normalized = new Set<string>(slot.keywords.map(normalizeThemeKeyword))
      for (const kw of normalized) {
        all[kw] = (all[kw] ?? 0) + 1
        if (isFormation) formation[kw] = (formation[kw] ?? 0) + 1
      }
    }
    return { formationKwCounts: formation, allKwCounts: all }
  }, [state.identitySlots])

  function getConditionStatus(gift: GiftData): { level: 'warn' | 'unmet'; text: string } | null {
    const cond = gift.activation_condition
    if (!cond || !cond.count) return null
    let fHave = 0, aHave = 0, label = ''
    if (cond.type === 'keyword' && cond.keyword) {
      fHave = formationKwCounts[cond.keyword] ?? 0
      aHave = allKwCounts[cond.keyword] ?? 0
      label = cond.keyword
    } else if (cond.type === 'multi_keyword' && cond.keywords) {
      fHave = cond.keywords.reduce((s, kw) => s + (formationKwCounts[kw] ?? 0), 0)
      aHave = cond.keywords.reduce((s, kw) => s + (allKwCounts[kw] ?? 0), 0)
      label = cond.keywords.join('+')
    } else { return null }
    if (fHave >= cond.count) return null
    if (aHave >= cond.count) return { level: 'warn', text: `${label} ${fHave}/${cond.count}` }
    return { level: 'unmet', text: `${label} ${aHave}/${cond.count}` }
  }

  return (<>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── 플랜 정보 ── */}
      <section style={{ background: '#1a1510', border: '1px solid #222', borderRadius: '0.5rem', padding: '0.875rem 1rem' }}>
        <input
          type="text" placeholder="플랜 제목..." value={state.title}
          onChange={e => dispatch({ type: 'SET_TITLE', title: e.target.value })}
          maxLength={80}
          style={{ background: '#0d0b08', border: '1px solid #333', borderRadius: '0.375rem', padding: '0.5rem 0.75rem', fontSize: '0.9375rem', color: '#e8b030', fontWeight: 700, outline: 'none', width: '100%', boxSizing: 'border-box' }}
        />
        <div style={{ marginTop: '0.5rem' }}>
          <AcTextarea
            value={state.description}
            onChange={desc => dispatch({ type: 'SET_DESCRIPTION', description: desc })}
            pool={acPool}
            placeholder="설명 (선택, 키워드·기프트 자동완성 지원)..."
            rows={3}
            maxLength={500}
          />
          {state.description.trim() && (
            <div style={{
              marginTop: '0.375rem', background: '#0d0b08', border: '1px solid #222',
              borderRadius: '0.375rem', padding: '0.5rem 0.625rem',
            }}>
              <div style={{ fontSize: '0.5625rem', color: '#4b5563', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>미리보기</div>
              <NoteRenderer text={state.description} allowedKeywords={allowedKeywords} egoGiftLookup={egoGiftLookup} />
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.625rem', flexWrap: 'wrap' }}>
          {(Object.entries(DIFFICULTY_CONFIG) as [string, { label: string; floors: number }][]).map(([key, c]) => (
            <span key={key} style={{
              padding: '0.25rem 0.625rem', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 600,
              background: state.difficulty === key ? '#c8900a20' : '#0d0b08',
              color: state.difficulty === key ? '#e8b030' : '#4b5563',
              border: `1px solid ${state.difficulty === key ? '#c8900a50' : '#222'}`,
            }}>
              {c.label} ({c.floors}층)
            </span>
          ))}
        </div>
      </section>

      {/* ── 덱 편성 (DeckTab 스타일 서브탭) ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #222', marginBottom: '0.75rem' }}>
          {([
            { key: 'identity' as const, label: `인격 (${state.identitySlots.length}/12)` },
            { key: 'ego' as const, label: `EGO (${state.egoSlots.length})` },
            { key: 'skillset' as const, label: '스킬셋' },
          ]).map(tab => {
            const active = deckSubTab === tab.key
            return (
              <button key={tab.key} onClick={() => setDeckSubTab(tab.key)} style={{
                padding: '0.5rem 1rem', fontSize: '0.8125rem', fontWeight: active ? 700 : 400,
                color: active ? '#e8dcc8' : '#555', cursor: 'pointer',
                background: active ? 'rgba(200,144,10,0.05)' : 'transparent',
                borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                borderBottomWidth: '2px', borderBottomStyle: 'solid',
                borderBottomColor: active ? '#c8900a' : 'transparent',
                marginBottom: '-1px',
              }}>
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* 인격 그리드 (수감자 순서, 미편성도 표시) */}
        {deckSubTab === 'identity' && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-x-3 gap-y-4">
            {sinners.map(sinner => {
              const slot = state.identitySlots.find(s => s.sinner_id === sinner.id)
              const identData = slot ? identityMap.get(slot.identity_id) : undefined
              const rc = slot ? (RARITY_COLORS[slot.rarity] ?? RARITY_COLORS[1]) : null
              const n = slot && slot.slot_order < 99 ? slot.slot_order + 1 : null
              return (
                <div key={sinner.id}>
                  <div
                    onClick={() => slot && setIdentityModalId(slot.identity_id)}
                    style={{
                    position: 'relative', width: '100%', aspectRatio: '2/3',
                    background: 'linear-gradient(160deg, #1e1810 0%, #120e08 60%, #1a1410 100%)',
                    border: `0.09375rem ${slot ? 'solid' : 'dashed'} ${slot ? (rc?.border ?? '#2a2015') : '#2a2015'}`,
                    borderRadius: '0.25rem', overflow: 'hidden',
                    boxShadow: slot ? `0 0 0.5rem ${rc?.glow ?? 'transparent'}` : 'none',
                    cursor: slot ? 'pointer' : 'default',
                  }}>
                    {slot && identData ? (
                      <>
                        <Image
                          src={getIdentityImageUrl(identData.sinner_id, identData.folder_name ?? '', `${identData.game_id}_normal_info`)}
                          alt={slot.name_kr} fill className="object-cover object-top" sizes="120px"
                        />
                        <div style={{ position: 'absolute', top: 0, left: 0, zIndex: 10, padding: '0.1875rem' }}>
                          <Image src={`${S}/icons/Rarity/${slot.rarity}star.webp`} alt={`${slot.rarity}성`}
                            width={slot.rarity * 14} height={14}
                            style={{ height: '0.875rem', width: 'auto', objectFit: 'contain' }}
                          />
                        </div>
                        <div style={{
                          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10, textAlign: 'center',
                          background: 'linear-gradient(to top, rgba(13,11,8,0.95) 0%, transparent 100%)',
                          paddingTop: '1.25rem', paddingBottom: '0.25rem',
                        }}>
                          <p className="font-serif" style={{ color: '#e8dcc8', fontSize: '0.6875rem', lineHeight: 1.2 }}>{slot.name_kr}</p>
                        </div>
                        {n != null && (
                          <div style={{
                            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            zIndex: 15, background: 'rgba(13,11,8,0.45)', pointerEvents: 'none',
                          }}>
                            <span style={{ fontSize: '1rem', fontWeight: 700, color: n <= 7 ? '#e8b030' : '#5ab0d0', textShadow: `0 0 0.5rem ${n <= 7 ? 'rgba(200,144,10,0.7)' : 'rgba(90,176,208,0.7)'}, 0 0.125rem 0.5rem rgba(0,0,0,1)` }}>
                              {n <= 7 ? '편성' : '대기'}
                            </span>
                            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: n <= 7 ? '#e8b030' : '#5ab0d0', marginLeft: '0.1875rem', textShadow: `0 0 1rem ${n <= 7 ? 'rgba(200,144,10,0.7)' : 'rgba(90,176,208,0.7)'}, 0 0.125rem 0.5rem rgba(0,0,0,1)` }}>
                              {n}
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                          <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={32} height={32}
                            style={{ width: '2rem', height: '2rem', opacity: 0.35 }} />
                        </div>
                        <div style={{ position: 'absolute', top: 0, right: 0, width: '36%', opacity: 0.15, pointerEvents: 'none' }}>
                          <Image src={`${S}/sinners/${sinner.id}/number.webp`} alt="" width={389} height={1023} className="w-full h-auto" />
                        </div>
                        <div style={{
                          position: 'absolute', bottom: 0, left: 0, right: 0, textAlign: 'center', zIndex: 10,
                          background: 'linear-gradient(to top, rgba(13,11,8,0.95) 0%, transparent 100%)',
                          paddingTop: '1.25rem', paddingBottom: '0.375rem',
                        }}>
                          <p className="font-serif font-light" style={{ color: '#3a2a10', fontSize: '0.75rem' }}>{sinner.name_kr}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 공격 유형 분포 + 패시브 */}
        {deckSubTab === 'identity' && state.identitySlots.length > 0 && (() => {
          const slotIds = new Set(state.identitySlots.map(s => s.identity_id))
          const atkCount: Record<string, number> = { slash: 0, pierce: 0, blunt: 0 }
          const defCount: Record<string, number> = { evade: 0, defense: 0, counter: 0 }
          for (const sk of skills) {
            if (!slotIds.has(sk.identity_id)) continue
            if (sk.skill_order <= 3 && sk.skill_type in atkCount) atkCount[sk.skill_type]++
            if (sk.skill_order === 4 && sk.skill_type in defCount) defCount[sk.skill_type]++
          }
          const atkTotal = Object.values(atkCount).reduce((a, b) => a + b, 0) || 1
          const ATK_LABELS: Record<string, string> = { slash: '참격', pierce: '관통', blunt: '타격' }
          const ATK_CLR: Record<string, string> = { slash: '#cc4444', pierce: '#dd8833', blunt: '#cc8822' }
          const DEF_LABELS: Record<string, string> = { evade: '회피', defense: '수비', counter: '반격' }
          const deckSinCounts: Record<string, number> = {}
          for (const sk of skills) {
            if (!slotIds.has(sk.identity_id) || sk.skill_order > 3) continue
            const en = SIN_KR_TO_EN[sk.sin_affinity] ?? sk.sin_affinity
            if (en) deckSinCounts[en] = (deckSinCounts[en] ?? 0) + 1
          }
          const isCondMet = (p: PassiveData) => {
            if (!p.sin_affinity || !p.sin_count) return true
            const en = SIN_KR_TO_EN[p.sin_affinity] ?? p.sin_affinity
            return (deckSinCounts[en] ?? 0) >= p.sin_count
          }
          return (
            <div className="flex flex-col md:flex-row gap-4 mt-4">
              {/* 공격 유형 */}
              <div style={{ flex: '0 0 auto', width: '14rem', background: '#120e09', border: '1px solid #221a0f', borderRadius: '0.375rem', padding: '0.75rem' }}>
                <p style={{ color: '#c8900a', fontSize: '0.75rem', fontFamily: 'var(--font-serif)', marginBottom: '0.5rem' }}>공격 유형 분포</p>
                <div className="flex flex-col gap-1.5">
                  {Object.entries(atkCount).map(([type, count]) => (
                    <div key={type} className="flex items-center gap-2">
                      <Image src={`${S}/icons/stats/${type}.webp`} alt="" width={14} height={14} style={{ width: '0.875rem', height: '0.875rem', opacity: 0.8 }} />
                      <span style={{ color: ATK_CLR[type], fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', width: '2rem' }}>{ATK_LABELS[type]}</span>
                      <div style={{ flex: 1, height: '0.375rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.1875rem', overflow: 'hidden' }}>
                        <div style={{ width: `${(count / atkTotal) * 100}%`, height: '100%', background: ATK_CLR[type], borderRadius: '0.1875rem' }} />
                      </div>
                      <span style={{ color: ATK_CLR[type], fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 700, width: '1.5rem', textAlign: 'right' }}>{count}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3 mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  {Object.entries(defCount).filter(([, c]) => c > 0).map(([type, count]) => (
                    <span key={type} style={{ color: '#888', fontSize: '0.6875rem', fontFamily: 'var(--font-mono)' }}>
                      {DEF_LABELS[type]} <strong style={{ color: '#aaa' }}>{count}</strong>
                    </span>
                  ))}
                </div>
              </div>
              {/* 패시브 — 배틀/서포트 탭 */}
              <div style={{ flex: 1, background: '#120e09', border: '1px solid #221a0f', borderRadius: '0.375rem', overflow: 'hidden' }}>
                <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {(['battle', 'support'] as const).map(tab => {
                    const active = passiveTab === tab
                    const cnt = passives.filter(p => slotIds.has(p.identity_id) && p.passive_type === tab).length
                    return (
                      <button key={tab} onClick={() => setPassiveTab(tab)} style={{
                        flex: 1, padding: '0.5rem', fontSize: '0.75rem', fontWeight: active ? 700 : 400,
                        color: active ? (tab === 'battle' ? '#c84050' : '#4898b0') : '#555',
                        background: active ? (tab === 'battle' ? 'rgba(200,64,80,0.06)' : 'rgba(72,152,176,0.06)') : 'transparent',
                        borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                        borderBottom: `2px solid ${active ? (tab === 'battle' ? '#c84050' : '#4898b0') : 'transparent'}`,
                        cursor: 'pointer', fontFamily: 'var(--font-heading)',
                      }}>
                        {tab === 'battle' ? '배틀' : '서포트'} ({cnt})
                      </button>
                    )
                  })}
                </div>
                <div style={{ maxHeight: '20rem', overflowY: 'auto' }}>
                  {state.identitySlots.map((slot, idx) => {
                    const sName = sinners.find(s => s.id === slot.sinner_id)?.name_kr ?? slot.sinner_id
                    const slotP = passives
                      .filter(p => p.identity_id === slot.identity_id && p.passive_type === passiveTab)
                      .sort((a, b) => (isCondMet(b) ? 1 : 0) - (isCondMet(a) ? 1 : 0))
                    if (slotP.length === 0) return null
                    return (
                      <div key={idx} className="flex items-start gap-2 px-3 py-2"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                        <div style={{ width: '5.5rem', minWidth: 0, flexShrink: 0 }}>
                          <div className="flex items-center gap-1">
                            <Image src={getSinnerLogoUrl(slot.sinner_id)} alt="" width={12} height={12} style={{ opacity: 0.4, width: '0.75rem', height: '0.75rem' }} />
                            <span style={{ color: '#6a5e38', fontSize: '0.5625rem', fontFamily: 'var(--font-mono)' }}>{sName}</span>
                          </div>
                          <p className="truncate" style={{ color: '#c8a450', fontSize: '0.5625rem', fontWeight: 700, lineHeight: 1.3 }}>{slot.name_kr}</p>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {slotP.map((p, pi) => {
                            const sinEn = p.sin_affinity ? (SIN_KR_TO_EN[p.sin_affinity] ?? p.sin_affinity) : null
                            const pc = sinEn ? (SIN_COLORS[sinEn as keyof typeof SIN_COLORS] ?? '#888') : '#888'
                            const met = isCondMet(p)
                            return (
                              <div key={pi} style={{ marginBottom: '0.25rem', opacity: met ? 1 : 0.4 }}>
                                <div className="flex items-center gap-1" style={{ fontSize: '0.625rem' }}>
                                  {met && <span style={{ color: '#40a060', fontSize: '0.5rem', flexShrink: 0 }}>●</span>}
                                  {sinEn && <Image src={getSinIconUrl(sinEn)} alt="" width={10} height={10} style={{ width: '0.625rem', height: '0.625rem' }} />}
                                  {p.sin_count != null && <span style={{ color: pc, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>x{p.sin_count}</span>}
                                  <span style={{ color: pc, fontWeight: 600 }}>{p.active_cond === 'resonance' ? '공명' : p.active_cond === 'stock' ? '보유' : ''}</span>
                                  <span style={{ color: met ? '#8a7a60' : '#4a4030' }}>{p.name}</span>
                                </div>
                                {p.description && (
                                  <p style={{ fontSize: '0.5625rem', lineHeight: 1.5, color: met ? '#5a5040' : '#302818', marginLeft: '0.5rem', marginTop: '0.0625rem', whiteSpace: 'pre-wrap' }}>
                                    {p.description}
                                  </p>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })()}

        {/* EGO 그리드 (DeckTab 스타일) */}
        {deckSubTab === 'ego' && (
          state.identitySlots.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-4">
              {sinners.map(sinner => {
                const slot = state.identitySlots.find(s => s.sinner_id === sinner.id)
                const selectedEgos = state.egoSlots.filter(e => e.sinner_id === sinner.id)
                const egoByGrade: Record<string, typeof state.egoSlots[0]> = {}
                for (const e of selectedEgos) egoByGrade[e.grade] = e

                return (
                  <div key={sinner.id} style={{
                    background: 'linear-gradient(160deg, #1a1510 0%, #100d08 100%)',
                    border: `1px solid ${slot ? '#221a0f' : '#18120a'}`,
                    borderRadius: '0.25rem', overflow: 'hidden',
                    opacity: slot ? 1 : 0.5,
                  }}>
                    <div className="flex items-center gap-1.5" style={{ padding: '0.375rem 0.5rem', borderBottom: '1px solid #1a1208' }}>
                      <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={14} height={14}
                        style={{ width: '0.875rem', height: '0.875rem', opacity: 0.5 }} />
                      <span className="font-serif font-light truncate" style={{ color: slot ? '#8a7a60' : '#3a2a10', fontSize: '0.5625rem' }}>
                        {sinner.name_kr}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem', padding: '0.125rem' }}>
                      {GRADE_ORDER.map(grade => {
                        const ego = egoByGrade[grade]
                        const gc = GRADE_COLORS[grade] ?? '#555'
                        const sinEn = ego?.sin_affinity ? (SIN_KR_TO_EN[ego.sin_affinity] ?? ego.sin_affinity) : null
                        const ec = sinEn ? (SIN_COLORS[sinEn as keyof typeof SIN_COLORS] ?? gc) : gc
                        return (
                          <div key={grade} onClick={() => ego?.ego_id && setEgoModalId(ego.ego_id)} style={{
                            background: ego ? `${ec}1a` : 'rgba(10,8,5,0.7)',
                            border: `1px solid ${ego ? ec + '55' : '#18120a'}`,
                            borderRadius: '0.125rem',
                            padding: '0.25rem 0.3125rem',
                            display: 'flex', alignItems: 'center', gap: '0.3125rem',
                            minHeight: '1.5rem',
                            cursor: ego?.ego_id ? 'pointer' : 'default',
                          }}>
                            {grade !== 'ALEPH' ? (
                              <Image src={`${S}/icons/grade/${grade}.webp`} alt={grade} width={22} height={11} unoptimized
                                style={{ height: '0.6875rem', width: 'auto', opacity: ego ? 0.9 : 0.3, flexShrink: 0 }} />
                            ) : (
                              <span style={{ color: gc, fontSize: '0.375rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', opacity: ego ? 0.9 : 0.3, flexShrink: 0 }}>ALEPH</span>
                            )}
                            {ego ? (
                              <span style={{ color: gc, fontSize: '0.5rem', fontWeight: 700, lineHeight: 1.2, flex: 1, textAlign: 'left' }}>{ego.name_kr}</span>
                            ) : (
                              <span style={{ color: '#2a1e10', fontSize: '0.5rem', lineHeight: 1 }}>{slot ? '—' : ''}</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    {!slot && (
                      <div style={{ padding: '0.25rem 0.5rem 0.375rem', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.5rem', color: '#333' }}>인격 미선택</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState text="인격을 먼저 편성해주세요" />
          )
        )}

        {/* 스킬셋 (DeckTab 스킬 배분 스타일, 읽기 전용 기본 3/2/1) */}
        {deckSubTab === 'skillset' && (
          state.identitySlots.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-6">
              {sinners.map(sinner => {
                const slot = state.identitySlots.find(s => s.sinner_id === sinner.id)
                if (!slot) return null
                const identData = identityMap.get(slot.identity_id)
                const dist = [3, 2, 1]
                const identForIcon = identData ? { game_id: identData.game_id, sinner_id: identData.sinner_id } as { game_id: string | null; sinner_id: string } : null

                return (
                  <div key={sinner.id}>
                    {/* 미니 인격 카드 */}
                    <div style={{
                      position: 'relative', width: '100%', aspectRatio: '2/3',
                      background: 'linear-gradient(160deg, #1e1810 0%, #120e08 60%, #1a1410 100%)',
                      border: `0.09375rem solid ${(RARITY_COLORS[slot.rarity] ?? RARITY_COLORS[1]).border}`,
                      borderRadius: '0.25rem', overflow: 'hidden',
                    }}>
                      {identData && (
                        <Image
                          src={getIdentityImageUrl(identData.sinner_id, identData.folder_name ?? '', `${identData.game_id}_normal_info`)}
                          alt={slot.name_kr} fill className="object-cover object-top" sizes="120px"
                        />
                      )}
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10, textAlign: 'center',
                        background: 'linear-gradient(to top, rgba(13,11,8,0.95) 0%, transparent 100%)',
                        paddingTop: '1.25rem', paddingBottom: '0.25rem',
                      }}>
                        <p className="font-serif" style={{ color: '#e8dcc8', fontSize: '0.6875rem', lineHeight: 1.2 }}>{slot.name_kr}</p>
                      </div>
                    </div>
                    {/* 스킬 배분 (읽기 전용) */}
                    <div style={{
                      marginTop: '0.375rem',
                      background: 'linear-gradient(160deg, #1a1510 0%, #100d08 100%)',
                      border: '1px solid #221a0f',
                      borderRadius: '0.25rem', padding: '0.375rem',
                    }}>
                      {[0, 1, 2].map(idx => {
                        const skillName = skills.find(sk => sk.identity_id === slot.identity_id && sk.skill_order === idx + 1)?.name
                        return (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.125rem 0' }}>
                            {identForIcon?.game_id ? (
                              <Image
                                src={getSkillIconUrl(identForIcon as Parameters<typeof getSkillIconUrl>[0], idx + 1)}
                                alt={`S${idx + 1}`} width={24} height={24}
                                style={{ width: '1.5rem', height: '1.5rem', borderRadius: '0.125rem', flexShrink: 0 }}
                              />
                            ) : (
                              <span style={{ fontSize: '0.5625rem', color: '#c8900a', fontFamily: 'var(--font-mono)', fontWeight: 700, width: '1.5rem', flexShrink: 0, textAlign: 'center' }}>
                                S{idx + 1}
                              </span>
                            )}
                            {skillName ? (
                              <span style={{
                                fontSize: '0.5rem', color: '#8a7a60', flex: 1, minWidth: 0,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {skillName}
                              </span>
                            ) : (
                              <div style={{ flex: 1 }} />
                            )}
                            <span style={{
                              width: '1rem', textAlign: 'center', fontSize: '0.8125rem',
                              fontFamily: 'var(--font-mono)', fontWeight: 700,
                              color: dist[idx] === 0 ? '#3a2a10' : '#c8900a',
                            }}>
                              {dist[idx]}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState text="인격을 먼저 편성해주세요" />
          )
        )}
      </div>

      {/* ── 가호 (BlessingTab 스타일) ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #222', paddingBottom: '0.375rem' }}>
        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#e8dcc8' }}>가호</span>
        {blessings.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Image src={`${S}/icons/start-buffs/starlight.webp`} alt="별빛" width={16} height={16} style={{ width: '1rem', height: '1rem' }} />
            <span style={{ fontSize: '0.8125rem', color: '#c8900a', fontWeight: 700 }}>{totalBlessingCost}</span>
          </div>
        ) : (
          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>미선택</span>
        )}
      </div>
      {blessings.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {blessings.map(b => {
            const effects = BLESSING_EFFECTS[b.baseId]?.[b.level - 1] ?? []
            return (
              <div key={b.baseId} className="rounded-lg overflow-hidden flex flex-col" style={{
                background: '#1a1510', border: '1px solid #c8900a50',
                boxShadow: '0 0 12px #c8900a15',
              }}>
                <div className="flex items-center gap-2 p-3 pb-2">
                  <Image src={`${S}/icons/start-buffs/${b.baseId}.webp`} alt={b.name} width={32} height={32}
                    style={{ width: '2rem', height: '2rem', objectFit: 'contain' }} />
                  <div className="flex-1 min-w-0">
                    <div style={{ color: '#e8dcc8', fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.2 }}>{b.name}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Image src={`${S}/icons/start-buffs/starlight.webp`} alt="" width={14} height={14} style={{ width: '0.875rem', height: '0.875rem' }} />
                    <span style={{ color: '#c8900a', fontSize: '0.75rem', fontWeight: 700 }}>{b.cost}</span>
                  </div>
                </div>
                {/* 효과 목록 */}
                <div className="px-3 pb-2 flex-1">
                  {effects.map((eff, i) => (
                    <div key={i} style={{ color: '#777', fontSize: '0.625rem', lineHeight: 1.5 }}>• {eff}</div>
                  ))}
                </div>
                <div style={{
                  borderTop: '1px solid #222', padding: '0.25rem 0.75rem 0.375rem',
                  fontSize: '0.6875rem', fontWeight: 700, textAlign: 'center',
                  color: b.level === 3 ? '#c83030' : b.level === 2 ? '#4898b0' : '#e8b030',
                }}>
                  {b.level === 1 ? '기본' : b.level === 2 ? '+' : '++'}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <EmptyState text="가호가 선택되지 않았습니다" />
      )}

      {/* ── 시작 기프트 (GiftPlanTab 스타일) ── */}
      <SectionTitle title="시작 기프트" count={`${startGifts.length}개`} />
      {startGifts.length > 0 ? (
        <GiftGrid gifts={startGifts.map(g => ({ gift: g, enhance: 0 }))} onGiftClick={(g, e) => setSelectedGift({ gift: g, enhance: e })} />
      ) : (
        <EmptyState text="시작 기프트가 선택되지 않았습니다" />
      )}

      {/* ── 관측 기프트 ── */}
      <SectionTitle title="관측 기프트" count={`${observeGifts.length}/3`} />
      {observeGifts.length > 0 ? (
        <GiftGrid gifts={observeGifts.map(g => ({ gift: g, enhance: 0 }))} onGiftClick={(g, e) => setSelectedGift({ gift: g, enhance: e })} />
      ) : (
        <EmptyState text="관측 기프트가 선택되지 않았습니다" />
      )}

      {/* ── 층별 계획 (FloorTab 스타일) ── */}
      <SectionTitle title="층별 계획" count={`${state.floorPlan.filter(f => f.theme_id).length}/${state.floorPlan.length}층`} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {state.floorPlan.map(f => {
          const theme = f.theme_id ? themeMap.get(f.theme_id) : null
          const floorGifts = f.gift_ids.map(id => giftMap.get(parseInt(id))).filter(Boolean) as GiftData[]
          const isExpanded = expandedFloor === f.floor
          return (
            <div key={f.floor} style={{
              background: '#1a1510',
              border: `1px solid ${isExpanded ? '#c8900a' : theme ? '#2a2520' : '#1a1510'}`,
              borderRadius: '0.5rem', overflow: 'hidden', transition: 'border-color 0.2s',
            }}>
              {/* 헤더 (클릭으로 펼치기) */}
              <button
                onClick={() => setExpandedFloor(isExpanded ? null : f.floor)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '0.625rem',
                  padding: '0.5rem 0.75rem', background: 'transparent', border: 'none',
                  cursor: 'pointer', textAlign: 'left', color: '#e5e7eb',
                }}
              >
                <span style={{
                  width: '1.75rem', height: '1.75rem', borderRadius: '50%',
                  background: theme ? '#c8900a' : '#222',
                  color: theme ? '#0d0b08' : '#4b5563',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
                }}>{f.floor}</span>

                {theme ? (
                  <>
                    {theme.boss_image_url && (
                      <Image src={theme.boss_image_url} alt="보스" width={28} height={32}
                        style={{ width: '1.75rem', height: '2rem', objectFit: 'contain', opacity: 0.8, flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#e8b030', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {theme.name}
                      </div>
                      {!isExpanded && floorGifts.length > 0 && (
                        <div style={{ fontSize: '0.6875rem', color: '#6b7280', marginTop: '0.0625rem' }}>
                          획득 기프트 {floorGifts.length}개
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <span style={{ flex: 1, fontSize: '0.75rem', color: '#333' }}>미선택</span>
                )}
                {isExpanded
                  ? <ChevronUp size={14} color="#6b7280" style={{ flexShrink: 0 }} />
                  : <ChevronDown size={14} color="#6b7280" style={{ flexShrink: 0 }} />}
              </button>

              {/* 펼쳐진 상세 */}
              {isExpanded && theme && (
                <div style={{ borderTop: '1px solid #222', padding: '0.75rem' }}>
                  {/* 테마 정보 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.75rem' }}>
                    {theme.image_url && (
                      <Image src={theme.image_url} alt={theme.name} width={38} height={69}
                        style={{ width: '2.375rem', height: '4.3125rem', objectFit: 'cover', borderRadius: '0.25rem', flexShrink: 0 }} />
                    )}
                    {theme.boss_image_url && (
                      <Image src={theme.boss_image_url} alt="보스" width={40} height={44}
                        style={{ width: '2.5rem', height: '2.75rem', objectFit: 'contain', opacity: 0.8, flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e8b030' }}>{theme.name}</div>
                      <div style={{ fontSize: '0.6875rem', color: '#6b7280', marginTop: '0.125rem' }}>
                        기프트 {(theme.ego_gift_ids?.length ?? 0) + (theme.specific_ego_gift_ids?.length ?? 0)}종
                      </div>
                    </div>
                  </div>

                  {/* 획득 기프트 (옥타곤 카드) */}
                  {floorGifts.length > 0 && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <div style={{ fontSize: '0.6875rem', color: '#6b7280', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        획득 기프트
                      </div>
                      <GiftGrid gifts={floorGifts.map(g => ({ gift: g, enhance: 0 }))} onGiftClick={(g, e) => setSelectedGift({ gift: g, enhance: e })} />
                    </div>
                  )}

                  {/* 메모 */}
                  {f.memo && (
                    <div>
                      <div style={{ fontSize: '0.6875rem', color: '#6b7280', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        메모
                      </div>
                      <div style={{
                        background: '#0d0b08', border: '1px solid #333', borderRadius: '0.375rem',
                        padding: '0.5rem 0.625rem',
                      }}>
                        <NoteRenderer text={f.memo} allowedKeywords={allowedKeywords} egoGiftLookup={egoGiftLookup} />
                      </div>
                    </div>
                  )}

                  {!floorGifts.length && !f.memo && (
                    <div style={{ fontSize: '0.75rem', color: '#333', textAlign: 'center' }}>상세 정보 없음</div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── 최종 기프트 (GiftPlanTab 스타일 + 강화) ── */}
      <SectionTitle title="최종 기프트" count={`${finalGifts.length}개`} />
      {state.identitySlots.length > 0 && finalGifts.length > 0 && (
        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.5625rem', marginBottom: '0.25rem' }}>
          <span style={{ color: '#ef4444' }}>● 조건 미달 — 전체 인격으로도 부족</span>
          <span style={{ color: '#e8b030' }}>● 조건 주의 — 편성(1-7)만으로는 부족, 대기 포함 시 충족</span>
        </div>
      )}
      {finalGifts.length > 0 ? (
        <GiftGrid gifts={finalGifts} getCondition={getConditionStatus} onGiftClick={(g, e) => setSelectedGift({ gift: g, enhance: e })} />
      ) : (
        <EmptyState text="최종 기프트가 선택되지 않았습니다" />
      )}

      {/* 기프트 상세 모달 */}
      {selectedGift && (
        <PlannerGiftModal
          gift={selectedGift.gift}
          enhance={selectedGift.enhance}
          onClose={() => setSelectedGift(null)}
          themes={themes}
          conditionStatus={getConditionStatus(selectedGift.gift)}
          recipe={recipeMap.get(selectedGift.gift.game_id) ?? null}
        />
      )}
    </div>

    {identityModalId && (
      <IdentityDetailModal identityId={identityModalId} onClose={() => setIdentityModalId(null)} />
    )}
    {egoModalId && (
      <EgoDetailModal egoId={egoModalId} onClose={() => setEgoModalId(null)} />
    )}
  </>)
}

// ── 섹션 제목 ──────────────────────────────────────────────────────────────
function SectionTitle({ title, count }: { title: string; count: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      borderBottom: '1px solid #222', paddingBottom: '0.375rem',
    }}>
      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#e8dcc8' }}>{title}</span>
      <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{count}</span>
    </div>
  )
}

// ── 빈 상태 ────────────────────────────────────────────────────────────────
function EmptyState({ text }: { text: string }) {
  return (
    <div style={{
      background: '#1a1510', border: '1px solid #1a1510', borderRadius: '0.5rem',
      padding: '1rem', textAlign: 'center', fontSize: '0.75rem', color: '#333',
    }}>{text}</div>
  )
}

// ── 기프트 그리드 (GiftPlanTab GiftCard 스타일) ────────────────────────────
function GiftGrid({ gifts, getCondition, onGiftClick }: {
  gifts: { gift: GiftData; enhance: number }[]
  getCondition?: (gift: GiftData) => { level: 'warn' | 'unmet'; text: string } | null
  onGiftClick?: (gift: GiftData, enhance: number) => void
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
      {gifts.map(({ gift, enhance }) => {
        const cond = getCondition?.(gift)
        const kwSlug = getKeywordSlug(gift.keyword ?? null)
        const kwIconUrl = kwSlug ? getKwIconUrl(kwSlug) : null
        return (
          <div
            key={`${gift.game_id}_${enhance}`}
            title={[
              gift.name,
              gift.keyword ? `키워드: ${gift.keyword}` : null,
              gift.effect_base ? `효과: ${gift.effect_base}` : null,
              enhance === 1 && gift.effect_plus ? `+: ${gift.effect_plus}` : null,
              enhance === 2 && gift.effect_plusplus ? `++: ${gift.effect_plusplus}` : null,
              cond ? (cond.level === 'unmet'
                ? `⛔ 조건 미달: ${cond.text} — 전체 인격으로도 부족`
                : `⚠️ 조건 주의: ${cond.text} — 편성(1-7)만으로는 부족, 대기 포함 시 충족`)
              : null,
            ].filter(Boolean).join('\n')}
            onClick={() => onGiftClick?.(gift, enhance)}
            style={{ width: '4.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: onGiftClick ? 'pointer' : 'help' }}
          >
            <div style={{
              position: 'relative', width: '100%', aspectRatio: '1', overflow: 'hidden',
              backgroundImage: `url(${S}/icons/ego-gift-bg.webp)`, backgroundSize: 'cover', backgroundPosition: 'center',
              clipPath: OCTAGON_CLIP,
            }}>
              {/* Grade */}
              <span style={{
                position: 'absolute', top: '4%', left: '3%', zIndex: 10, pointerEvents: 'none',
                fontFamily: "'Bebas Neue', var(--font-title), sans-serif",
                fontWeight: 700, fontSize: '1.25rem', lineHeight: 1,
                color: (gift.grade === 'EX') ? 'rgb(198, 255, 46)' : 'rgb(251, 183, 46)',
                textShadow: (gift.grade === 'EX')
                  ? '0 0 0.625rem rgb(251,255,8), 0 0 0.25rem rgb(12,90,0), 0.0625rem 0.0625rem 0.125rem rgba(0,0,0,0.8)'
                  : '0 0 0.5rem rgb(255,114,21), 0 0 0.125rem rgba(0,0,0,0.6)',
              }}>
                {GRADE_ROMAN[gift.grade ?? '1'] ?? gift.grade}
              </span>
              {/* Keyword icon */}
              {kwIconUrl && (
                <div style={{ position: 'absolute', bottom: 0, right: 0, zIndex: 10, pointerEvents: 'none', width: '30%', height: '30%' }}>
                  <Image src={kwIconUrl} alt="" fill sizes="40px" style={{ objectFit: 'contain' }} />
                </div>
              )}
              {/* Gift image */}
              <div style={{ position: 'absolute', inset: '15%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {gift.image_url?.startsWith('http') ? (
                  <Image src={gift.image_url} alt={gift.name} fill style={{ objectFit: 'contain' }} sizes="80px" />
                ) : (
                  <div style={{ width: '1.75rem', height: '1.75rem', background: '#333', borderRadius: '50%' }} />
                )}
              </div>
              {/* Enhance badge */}
              {enhance > 0 && (
                <span style={{
                  position: 'absolute', top: '1%', right: '6%', zIndex: 15,
                  fontFamily: "'Bebas Neue', var(--font-title), sans-serif",
                  fontWeight: 800, fontSize: '1.25rem', lineHeight: 1,
                  color: enhance === 2 ? '#ff8c00' : '#e8b030',
                  textShadow: enhance === 2
                    ? '0 0 0.5rem rgba(255,140,0,0.8), 0 0.125rem 0.25rem rgba(0,0,0,0.9)'
                    : '0 0 0.375rem rgba(200,144,10,0.6), 0 0.125rem 0.25rem rgba(0,0,0,0.8)',
                  filter: enhance === 2
                    ? 'drop-shadow(0 0 0.375rem rgba(255,100,0,0.8))'
                    : 'drop-shadow(0 0 0.25rem rgba(232,176,48,0.7))',
                }}>
                  {enhance === 2 ? '++' : '+'}
                </span>
              )}
              {/* 조건 오버레이 */}
              {cond && (
                <div
                  title={cond.level === 'unmet'
                    ? `조건 미달: ${cond.text} — 전체 인격으로도 부족`
                    : `조건 주의: ${cond.text} — 편성(1-7)만으로는 부족, 대기 포함 시 충족`}
                  style={{
                    position: 'absolute', inset: 0, zIndex: 18,
                    background: cond.level === 'unmet' ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'help',
                  }}
                >
                  <span style={{
                    fontSize: '0.5rem', fontWeight: 700,
                    color: cond.level === 'unmet' ? '#ef4444' : '#e8b030',
                    textShadow: '0 0 0.25rem rgba(0,0,0,0.9)',
                    textAlign: 'center', lineHeight: 1.3,
                  }}>
                    {cond.level === 'unmet' ? '조건 미달' : '조건 주의'}
                  </span>
                </div>
              )}
            </div>
            <span style={{
              fontSize: '0.625rem',
              color: cond?.level === 'unmet' ? '#ef4444' : cond?.level === 'warn' ? '#e8b030' : '#9ca3af',
              textAlign: 'center', marginTop: '0.1875rem', lineHeight: 1.2, width: '100%',
              overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>
              {gift.name}
            </span>
            {cond && (
              <span style={{ fontSize: '0.5rem', color: cond.level === 'unmet' ? '#ef4444' : '#e8b030', textAlign: 'center', lineHeight: 1.2 }}>
                {cond.text}
              </span>
            )}
          </div>
        )
      })}
    </div>

  )
}
