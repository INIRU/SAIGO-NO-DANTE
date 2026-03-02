'use client'

import { use, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Heart, Copy, Check, Pencil } from 'lucide-react'
import { STORAGE_BASE, getKeywordIconUrl, getSinnerLogoUrl, GRADE_COLORS, RARITY_ICON_MAP, computeSkillImageIndices } from '@/lib/data/sinners'
import { formatSkillDesc } from '@/components/sinners/KeywordTooltip'
import { NoteRenderer, type NoteSkillEntry, type NotePassiveEntry, type NoteEgoEntry } from '@/components/decks/NoteChips'

// ── 타입 ──────────────────────────────────────────────────────────────────
type SkillDetail = {
  id: string
  name: string
  skill_type: string
  sin_affinity: string
  coins: number
  base_power: number
  coin_power: number
  skill_order: number
  atk_weight: number | null
  offense_level: number | null
  description?: string | null
}

type PassiveDetail = {
  name: string
  passive_type: string
  sin_affinity: string | null
  sin_count: number | null
  active_cond: string | null
  description: string
  passive_order: number
}

type IdentityDetail = {
  sinner_id: string
  folder_name: string | null
  game_id: string | null
  keywords: string[] | null
  name_kr: string
  tier: number
  rarity: string
  hp: number | null
  speed_min: number | null
  speed_max: number | null
  def_level: number | null
  slash_res: string | null
  pierce_res: string | null
  blunt_res: string | null
  skills: SkillDetail[]
  passives: PassiveDetail[]
}

type IdentitySlot = {
  slot_order: number
  gacksung: boolean
  s1_count?: number
  s2_count?: number
  s3_count?: number
  identities: IdentityDetail | null
}

type EgoSlot = {
  grade: string
  ego: {
    id: string
    name_kr: string | null
    grade: string
    sin_affinity: string | null
    sinner_id: string
    folder_name: string | null
    image_url: string | null
  } | null
}

type SinnerEgo = {
  sinner_id: string
  name_kr: string | null
  grade: string
  sin_affinity: string | null
  image_url: string | null
}

type DeckDetail = {
  id: string
  title: string
  description: string | null
  tags: string[]
  vote_count: number
  view_count: number
  created_at: string
  deck_code?: string
  is_owner?: boolean
  is_admin?: boolean
  profiles: { username: string } | null
  deck_identities: IdentitySlot[]
  deck_egos?: EgoSlot[]
  all_sinner_egos?: SinnerEgo[]
}

// ── 상수 ──────────────────────────────────────────────────────────────────
const THEME_KEYWORDS = new Set(['침잠', '출혈', '파열', '화상', '진동', '충전', '호흡'])
const SIN_ORDER = ['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy'] as const

const RARITY_COLORS: Record<string, string> = {
  '1성': '#667788',
  '2성': '#4898b0',
  '3성': '#c8900a',
}


const GRADE_ICON_URL: Record<string, string> = {
  ZAYIN: `${STORAGE_BASE}/icons/grade/ZAYIN.webp`,
  TETH:  `${STORAGE_BASE}/icons/grade/TETH.webp`,
  HE:    `${STORAGE_BASE}/icons/grade/HE.webp`,
  WAW:   `${STORAGE_BASE}/icons/grade/WAW.webp`,
}

const SIN_COLORS: Record<string, string> = {
  wrath:    '#c83030',
  lust:     '#d06030',
  sloth:    '#d4b830',
  gluttony: '#88b028',
  gloom:    '#4898b0',
  pride:    '#3870b0',
  envy:     '#8058a8',
}

const SIN_KR_TO_EN: Record<string, string> = {
  '분노': 'wrath',
  '색욕': 'lust',
  '나태': 'sloth',
  '탐식': 'gluttony',
  '우울': 'gloom',
  '오만': 'pride',
  '질투': 'envy',
}

const SKILL_TYPE_KR: Record<string, string> = {
  'evade': '회피',
  'defense': '수비',
  'counter': '반격',
}

const ATK_ICON_URL: Record<string, string> = {
  'slash': `${STORAGE_BASE}/icons/stats/slash.webp`,
  'pierce': `${STORAGE_BASE}/icons/stats/pierce.webp`,
  'blunt': `${STORAGE_BASE}/icons/stats/blunt.webp`,
}

const STAT_ICON_URL: Record<string, string> = {
  hp:    `${STORAGE_BASE}/icons/stats/health.webp`,
  spd:   `${STORAGE_BASE}/icons/stats/speed.webp`,
  def:   `${STORAGE_BASE}/icons/stats/defense.webp`,
}

const RES_ATK_ICON: Record<string, string> = {
  '참': `${STORAGE_BASE}/icons/stats/slash.webp`,
  '관': `${STORAGE_BASE}/icons/stats/pierce.webp`,
  '타': `${STORAGE_BASE}/icons/stats/blunt.webp`,
}

const RES_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  '효율': { color: '#e06070', bg: 'rgba(200,64,80,0.12)', border: 'rgba(200,64,80,0.3)' },
  '취약': { color: '#e06070', bg: 'rgba(200,64,80,0.12)', border: 'rgba(200,64,80,0.3)' },
  '보통': { color: '#556677', bg: 'rgba(48,48,64,0.15)', border: 'rgba(80,80,100,0.2)' },
  '내성': { color: '#4898b0', bg: 'rgba(52,120,160,0.12)', border: 'rgba(52,120,160,0.3)' },
  '견딤': { color: '#4898b0', bg: 'rgba(52,120,160,0.12)', border: 'rgba(52,120,160,0.3)' },
  '무효': { color: '#334455', bg: 'rgba(20,28,36,0.3)', border: 'rgba(40,56,72,0.2)' },
}

// ── 헬퍼 ──────────────────────────────────────────────────────────────────
function sinIconUrl(sin: string | null, isKr = false): string {
  if (!sin) return ''
  const en = isKr ? (SIN_KR_TO_EN[sin] ?? sin) : sin
  const cap = en.charAt(0).toUpperCase() + en.slice(1)
  return `${STORAGE_BASE}/icons/Sins/transparent/${cap}.webp`
}

function sinColor(sin: string, isKr = false): string {
  const en = isKr ? (SIN_KR_TO_EN[sin] ?? sin) : sin
  return SIN_COLORS[en] ?? '#888888'
}

function portraitUrl(
  sinner_id: string,
  folder_name: string | null,
  game_id: string | null,
  gacksung: boolean,
): string {
  if (!game_id || !folder_name) return ''
  const prefix = gacksung ? 'gacksung' : 'normal'
  const folder = encodeURIComponent(folder_name)
  return `${STORAGE_BASE}/sinners/${sinner_id}/identities/${folder}/${game_id}_${prefix}_info.webp`
}

function topKeywords(slots: IdentitySlot[]): string[] {
  const freq: Record<string, number> = {}
  for (const slot of slots) {
    for (const kw of slot.identities?.keywords ?? []) {
      if (THEME_KEYWORDS.has(kw)) freq[kw] = (freq[kw] ?? 0) + 1
    }
  }
  return Object.entries(freq)
    .filter(([, n]) => n >= 5)
    .sort((a, b) => b[1] - a[1])
    .map(([kw]) => kw)
}

// ── 수감자 이름 ──────────────────────────────────────────────────────────
const SINNER_NAMES: Record<string, string> = {
  'yi-sang': '이상', 'faust': '파우스트', 'don-quixote': '돈키호테',
  'ryoshu': '료슈', 'meursault': '뫼르소', 'hong-lu': '홍루',
  'heathcliff': '히스클리프', 'ishmael': '이스마엘', 'rodion': '로쟈',
  'sinclair': '싱클레어', 'outis': '오티스', 'gregor': '그레고르',
}

function buildNoteLookups(slots: IdentitySlot[], allEgos: SinnerEgo[]) {
  const skillLookup: Record<string, NoteSkillEntry> = {}
  const passiveLookup: Record<string, NotePassiveEntry> = {}
  const egoLookup: Record<string, NoteEgoEntry> = {}

  for (const slot of slots) {
    const id_ = slot.identities
    if (!id_) continue
    const sName = SINNER_NAMES[id_.sinner_id] ?? id_.sinner_id

    // 스킬: computeSkillImageIndices로 올바른 이미지 인덱스 + 변형 스킬 지원
    const sortedSkills = [...id_.skills].sort((a, b) => a.skill_order - b.skill_order || a.id.localeCompare(b.id))
    const imgIdx = computeSkillImageIndices(sortedSkills)
    const orderCount: Record<number, number> = {}
    for (const sk of sortedSkills) {
      const subIdx = orderCount[sk.skill_order] || 0
      orderCount[sk.skill_order] = subIdx + 1
      const key = subIdx === 0
        ? `${sName}:${sk.skill_order}`
        : `${sName}:${sk.skill_order}:${subIdx}`
      const iconUrl = id_.game_id
        ? `${STORAGE_BASE}/icons/skills/${id_.game_id}${String(imgIdx[sk.id] ?? sk.skill_order).padStart(2, '0')}.webp`
        : undefined
      skillLookup[key] = {
        name: sk.name, skill_type: sk.skill_type, sin_affinity: sk.sin_affinity,
        skill_order: sk.skill_order, description: sk.description,
        iconUrl, identityName: id_.name_kr, sinnerName: sName,
      }
    }
    for (const pa of id_.passives) {
      passiveLookup[pa.name] = {
        name: pa.name, sin_affinity: pa.sin_affinity,
        sin_count: pa.sin_count, active_cond: pa.active_cond,
        description: pa.description, sinnerName: sName,
      }
    }
  }
  // 에고: 덱 내 수감자의 전체 에고 사용 (에디터 미리보기와 동일)
  for (const ego of allEgos) {
    const sName = SINNER_NAMES[ego.sinner_id] ?? ego.sinner_id
    const name = ego.name_kr ?? sName
    egoLookup[`${sName}:${name}`] = {
      name, grade: ego.grade, sin_affinity: ego.sin_affinity,
      image_url: ego.image_url, sinnerName: sName,
    }
  }
  return { skillLookup, passiveLookup, egoLookup }
}

// ── 스켈레톤 ──────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="min-h-screen" style={{ background: '#0d0b08' }}>
      <div style={{ height: '360px', background: 'linear-gradient(to bottom, #080604, #0d0b08)' }} />
      <div className="max-w-5xl mx-auto px-4 md:px-6 pt-6 flex gap-5">
        <div className="hidden lg:block" style={{ width: 252, flexShrink: 0 }}>
          <div className="rounded-lg h-36 mb-3" style={{ background: '#120e09' }} />
          <div className="rounded-lg h-48" style={{ background: '#120e09', opacity: 0.6 }} />
        </div>
        <div className="flex-1 flex flex-col gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-lg" style={{ height: 128, background: '#120e09', opacity: 0.2 + i * 0.15 }} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── IdentityCard ───────────────────────────────────────────────────────────
type EgoEntry = { grade: string; ego: NonNullable<EgoSlot['ego']> }

function IdentityCard({ slot, egos, keywordMeta }: { slot: IdentitySlot; egos?: EgoEntry[]; keywordMeta?: Record<string, { description: string }> }) {
  const id_ = slot.identities!
  const [activeTab, setActiveTab] = useState<'skills' | 'passives' | 'ego'>('skills')

  const rarityColor = RARITY_COLORS[id_.rarity] ?? '#667788'
  const imgUrl = portraitUrl(id_.sinner_id, id_.folder_name, id_.game_id, slot.gacksung)
  const normalUrl = portraitUrl(id_.sinner_id, id_.folder_name, id_.game_id, false)
  const themeKws = (id_.keywords ?? []).filter(kw => THEME_KEYWORDS.has(kw))
  const sortedSkills = [...(id_.skills ?? [])].sort((a, b) => a.skill_order - b.skill_order)
  const sortedPassives = [...(id_.passives ?? [])].sort((a, b) => a.passive_order - b.passive_order)

  // 스킬 이미지 인덱스 계산: base(S1/S2/S3/DefSkill) 먼저, 변형(S3-2 등) 마지막
  const skillImageIdx = computeSkillImageIndices(sortedSkills)

  // S1 기준 인격 주요 색상
  const s1 = sortedSkills.find(s => s.skill_order === 1) ?? sortedSkills[0]
  const primaryColor = s1 ? sinColor(s1.sin_affinity) : rarityColor

  // 스킬 아이콘 URL
  const skillIconUrl = (order: number) =>
    id_.game_id ? `${STORAGE_BASE}/icons/skills/${id_.game_id}${String(order).padStart(2, '0')}.webp` : ''

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: '#0f0c09', border: '1px solid rgba(38,24,10,0.9)' }}
    >
      {/* 등급 컬러 바 */}
      <div style={{ height: '2px', background: rarityColor }} />

      {/* 상단: 포트레이트 + 기본 정보 */}
      <div className="flex">
        {/* 포트레이트 */}
        <div className="flex-shrink-0 flex flex-col" style={{ width: 88, borderRight: '1px solid rgba(32,20,8,0.7)' }}>
          <div className="relative overflow-hidden" style={{ width: 88, height: 116 }}>
            {imgUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imgUrl}
                alt={id_.name_kr}
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
                loading="lazy"
                onError={e => {
                  if (slot.gacksung && e.currentTarget.src !== normalUrl) e.currentTarget.src = normalUrl
                }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', background: '#0a0806' }} />
            )}
          </div>
          <div className="flex items-center justify-center flex-1" style={{ minHeight: 28 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={getSinnerLogoUrl(id_.sinner_id)} alt="" width={18} height={18} style={{ opacity: 0.3 }} />
          </div>
        </div>

        {/* 정보 영역 */}
        <div className="flex-1 min-w-0 p-3">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className="font-serif font-bold text-base leading-tight" style={{ color: '#e8e0d0' }}>{id_.name_kr}</span>
            </div>
            {RARITY_ICON_MAP[id_.rarity] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={RARITY_ICON_MAP[id_.rarity]} alt={id_.rarity} width={id_.rarity === '1성' ? 16 : id_.rarity === '2성' ? 30 : 36} height={14} style={{ flexShrink: 0, opacity: 0.9 }} />
            ) : (
              <span className="flex-shrink-0 px-1.5 py-px rounded" style={{ background: `${rarityColor}18`, color: rarityColor, border: `1px solid ${rarityColor}38`, fontFamily: 'var(--font-mono)', fontSize: '9px' }}>
                {id_.rarity}
              </span>
            )}
          </div>

          {/* 테마 키워드 */}
          {themeKws.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2.5">
              {themeKws.map(kw => {
                const iconUrl = getKeywordIconUrl(kw)
                const desc = keywordMeta?.[kw]?.description
                return (
                  <span key={kw} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded" title={desc} style={{ background: 'rgba(120,76,28,0.12)', color: '#907040', border: '1px solid rgba(120,76,28,0.22)', fontFamily: 'var(--font-heading)', fontSize: '10px', cursor: desc ? 'help' : 'default' }}>
                    {iconUrl && <img src={iconUrl} alt="" width={10} height={10} />} {/* eslint-disable-line @next/next/no-img-element */}
                    {kw}
                  </span>
                )
              })}
            </div>
          )}

          {/* 스탯 */}
          <div className="flex items-center gap-3 mb-2.5">
            {id_.hp != null && (
              <span className="flex items-center gap-1" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={STAT_ICON_URL.hp} alt="HP" width={13} height={13} style={{ opacity: 0.9 }} />
                <strong style={{ color: '#cc5050' }}>{id_.hp}</strong>
              </span>
            )}
            {id_.speed_min != null && id_.speed_max != null && (
              <span className="flex items-center gap-1" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={STAT_ICON_URL.spd} alt="SPD" width={13} height={13} style={{ opacity: 0.9 }} />
                <strong style={{ color: '#88a830' }}>{id_.speed_min}-{id_.speed_max}</strong>
              </span>
            )}
            {id_.def_level != null && (
              <span className="flex items-center gap-1" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={STAT_ICON_URL.def} alt="DEF" width={13} height={13} style={{ opacity: 0.9 }} />
                <strong style={{ color: '#4898b0' }}>{id_.def_level}</strong>
              </span>
            )}
          </div>

          {/* 저항 */}
          <div className="flex flex-wrap gap-1">
            {([
              { label: '참', val: id_.slash_res },
              { label: '관', val: id_.pierce_res },
              { label: '타', val: id_.blunt_res },
            ] as { label: string; val: string | null }[]).map(({ label, val }) => {
              if (!val) return null
              const st = RES_STYLE[val] ?? { color: '#556677', bg: 'rgba(48,48,64,0.15)', border: 'rgba(80,80,100,0.2)' }
              return (
                <span key={label} className="inline-flex items-center gap-0.5 px-1.5 py-px rounded" style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}`, fontFamily: 'var(--font-mono)', fontSize: '9px' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={RES_ATK_ICON[label]} alt={label} width={9} height={9} style={{ opacity: 0.75 }} />
                  {val}
                </span>
              )
            })}
          </div>
        </div>
      </div>

      {/* 스킬 / 패시브 / E.G.O 탭 바 */}
      <div className="flex" style={{ borderTop: '1px solid rgba(28,16,6,0.9)', background: 'rgba(0,0,0,0.18)' }}>
        {([
          { key: 'skills' as const, label: '스킬', count: sortedSkills.length },
          { key: 'passives' as const, label: '패시브', count: sortedPassives.length },
          ...(egos && egos.length > 0 ? [{ key: 'ego' as const, label: 'E.G.O', count: egos.length }] : []),
        ]).map(tab => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex-1 py-2 text-xs transition-all"
              style={{
                background: isActive ? `${primaryColor}12` : 'transparent',
                color: isActive ? '#d0c8b8' : '#3a3050',
                borderBottom: `2px solid ${isActive ? primaryColor + '55' : 'transparent'}`,
                fontFamily: 'var(--font-heading)',
                letterSpacing: '0.05em',
              }}
            >
              {tab.label}
              <span className="ml-2" style={{ color: isActive ? primaryColor : '#2a2035', fontFamily: 'var(--font-mono)', fontSize: '10px', opacity: 0.8 }}>
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* 스킬 탭 */}
      {activeTab === 'skills' && (
        <div className="flex flex-col gap-2 p-3">
          {sortedSkills.length === 0 ? (
            <p style={{ color: '#2a2035', fontSize: '11px', fontStyle: 'italic', fontFamily: 'var(--font-body)' }}>스킬 정보 없음</p>
          ) : sortedSkills.filter(s => s.skill_order >= 1 && s.skill_order <= 3).filter((s, i, arr) => arr.findIndex(x => x.skill_order === s.skill_order) === i).map((skill, idx) => {
            const sc = sinColor(skill.sin_affinity)
            const maxPower = skill.base_power + skill.coins * skill.coin_power
            const coinPowerStr = skill.coin_power >= 0 ? `+${skill.coin_power}` : `${skill.coin_power}`
            const skillLabel = skill.skill_order <= 3 ? `S${skill.skill_order}` : (SKILL_TYPE_KR[skill.skill_type] ?? skill.skill_type)
            const imgIdx = skillImageIdx[skill.id] ?? idx + 1
            const iconUrl = skillIconUrl(imgIdx)
            const iconFallback = imgIdx >= 5 ? skillIconUrl(3) : undefined
            return (
              <div key={idx} className="p-3 rounded" style={{ background: `${sc}08`, border: `1px solid ${sc}28` }}>
                {/* 헤더 */}
                <div className="flex items-center justify-between mb-2 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {iconUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={iconUrl} alt="" width={24} height={24} style={{ borderRadius: 3, border: `1px solid ${sc}40`, flexShrink: 0 }} onError={iconFallback ? (e) => { (e.target as HTMLImageElement).src = iconFallback } : undefined} />
                    )}
                    <span className="font-mono text-xs px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: `${sc}20`, color: sc, border: `1px solid ${sc}40` }}>
                      {skillLabel}
                    </span>
                    <span className="font-semibold truncate" style={{ color: sc, fontSize: '13px' }}>{skill.name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* 가중치 */}
                    {skill.atk_weight != null && skill.atk_weight > 0 && (
                      <div className="flex gap-0.5">
                        {Array.from({ length: skill.atk_weight }).map((_, i) => (
                          <div key={i} style={{ width: 7, height: 7, borderRadius: 1, background: `${sc}50`, border: `1.5px solid ${sc}` }} />
                        ))}
                      </div>
                    )}
                    {/* 공격 레벨 */}
                    {skill.offense_level != null && (
                      <span style={{ color: '#555566', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>ATK Lv.{skill.offense_level}</span>
                    )}
                    {/* 공격 타입 */}
                    {ATK_ICON_URL[skill.skill_type] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ATK_ICON_URL[skill.skill_type]} alt={skill.skill_type} width={13} height={13} style={{ opacity: 0.65 }} />
                    )}
                  </div>
                </div>

                {/* 위력 수치 */}
                <div className="flex items-center gap-3 mb-2">
                  <span style={{ fontSize: '10px', color: '#555566' }}>위력 <strong style={{ color: sc, fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{skill.base_power}</strong></span>
                  <span style={{ fontSize: '10px', color: '#555566' }}>코인 <strong style={{ color: 'var(--gold)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{skill.coins}</strong></span>
                  <span style={{ fontSize: '10px', color: '#555566' }}>코인위력 <strong style={{ color: sc, fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{coinPowerStr}</strong></span>
                  <span style={{ fontSize: '10px', color: '#555566', marginLeft: 'auto' }}>최대 <strong style={{ color: '#e8dcc8', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{maxPower}</strong></span>
                </div>

                {/* 코인 시각화 */}
                <div className="flex gap-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {Array.from({ length: skill.coins }).map((_, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={`${STORAGE_BASE}/icons/stats/coin.webp`} alt="" width={16} height={16} style={{ filter: `drop-shadow(0 0 2px ${sc}60)` }} />
                  ))}
                </div>

                {/* 스킬 설명 */}
                {skill.description && (
                  <div style={{ fontSize: '11px', lineHeight: 1.8, marginTop: 8, borderTop: `1px solid ${sc}18`, paddingTop: 8 }}>
                    {skill.description.split('\n').map((line, li) => {
                      const isCoinStart = /^\[코인\s?\d/.test(line)
                      return (
                        <div key={li}>
                          {li > 0 && isCoinStart && (
                            <div style={{ borderTop: `1px solid ${sc}20`, margin: '5px 0' }} />
                          )}
                          <span style={{ color: '#686050', whiteSpace: 'pre-wrap' }}>{formatSkillDesc(line, sc)}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 패시브 탭 */}
      {activeTab === 'passives' && (
        <div className="flex flex-col gap-2 p-3">
          {sortedPassives.length === 0 ? (
            <p style={{ color: '#2a2035', fontSize: '11px', fontStyle: 'italic', fontFamily: 'var(--font-body)' }}>패시브 정보 없음</p>
          ) : sortedPassives.map((passive, idx) => {
            const isBattle = passive.passive_type === 'battle'
            // sin_affinity가 "나태, 오만, 우울" 처럼 쉼표로 구분될 수 있으므로 첫 번째만 사용
            const firstSinKr = passive.sin_affinity ? passive.sin_affinity.split(',')[0].trim() : null
            const sinEn = firstSinKr ? (SIN_KR_TO_EN[firstSinKr] ?? null) : null
            const pc = sinEn ? (SIN_COLORS[sinEn] ?? '#888888') : '#888888'
            return (
              <div key={idx} className="p-3 rounded" style={{ background: `${pc}08`, border: `1px solid ${pc}25` }}>
                {/* 이름 + 배틀/서포트 */}
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className="text-xs px-1.5 py-0.5 rounded font-semibold flex-shrink-0"
                    style={{
                      background: isBattle ? 'rgba(200,64,80,0.15)' : 'rgba(72,120,160,0.15)',
                      color: isBattle ? '#c84050' : '#4898b0',
                      border: `1px solid ${isBattle ? 'rgba(200,64,80,0.3)' : 'rgba(72,120,160,0.3)'}`,
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {isBattle ? '배틀' : '서포트'}
                  </span>
                  <span className="font-semibold" style={{ color: pc, fontSize: '13px' }}>{passive.name}</span>
                </div>

                {/* 발동 조건: 아이콘 1개 + x수량 */}
                {sinEn && passive.sin_count != null && (
                  <div className="flex items-center gap-1.5 mb-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={sinIconUrl(sinEn)} alt="" width={16} height={16} style={{ filter: `drop-shadow(0 0 2px ${pc}60)` }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: pc }}>x{passive.sin_count}</span>
                    {passive.active_cond && (
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${pc}18`, color: pc, border: `1px solid ${pc}35` }}>
                        {passive.active_cond}
                      </span>
                    )}
                  </div>
                )}

                {/* 설명 */}
                {passive.description && (
                  <div style={{ fontSize: '11px', lineHeight: 1.8 }}>
                    {passive.description.split('\n').map((line, li) => (
                      <div key={li}>
                        <span style={{ color: '#686050', whiteSpace: 'pre-wrap' }}>{formatSkillDesc(line, pc)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* E.G.O 탭 */}
      {activeTab === 'ego' && egos && (
        <div className="flex flex-col gap-2 p-3">
          {egos.map(({ grade, ego }) => {
            const gc = GRADE_COLORS[grade] ?? '#667788'
            const sinEn = ego.sin_affinity ? (SIN_KR_TO_EN[ego.sin_affinity] ?? ego.sin_affinity) : null
            const sc = sinEn ? (SIN_COLORS[sinEn] ?? gc) : gc
            return (
              <div key={ego.id} className="p-3 rounded flex items-center gap-3"
                style={{ background: `${gc}08`, border: `1px solid ${gc}28` }}>
                <div style={{ width: 2, alignSelf: 'stretch', background: gc, borderRadius: 1, flexShrink: 0 }} />
                {ego.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ego.image_url} alt={ego.name_kr ?? ''} width={52} height={52}
                    style={{ borderRadius: 4, objectFit: 'cover', border: `1px solid ${gc}30`, flexShrink: 0 }} loading="lazy" />
                ) : (
                  <div style={{ width: 52, height: 52, borderRadius: 4, background: '#0a0806', border: `1px solid ${gc}20`, flexShrink: 0 }} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="px-1.5 py-px rounded" style={{ background: `${gc}18`, color: gc, border: `1px solid ${gc}38`, fontFamily: 'var(--font-mono)', fontSize: '8px' }}>
                      E.G.O
                    </span>
                    {GRADE_ICON_URL[grade] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={GRADE_ICON_URL[grade]} alt={grade} width={32} height={12} style={{ opacity: 0.9 }} />
                    ) : (
                      <span style={{ color: gc, fontFamily: 'var(--font-mono)', fontSize: '8px' }}>{grade}</span>
                    )}
                    {sinEn && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={sinIconUrl(sinEn)} alt="" width={12} height={12} style={{ opacity: 0.8 }} />
                    )}
                  </div>
                  <span className="font-serif font-bold" style={{ color: sc, fontSize: '13px' }}>{ego.name_kr ?? ego.id}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── 메인 ──────────────────────────────────────────────────────────────────
export default function DeckDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { status: authStatus } = useSession()

  const [deck, setDeck] = useState<DeckDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [voted, setVoted] = useState(false)
  const [voteCount, setVoteCount] = useState(0)
  const [voting, setVoting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [selectedSinner, setSelectedSinner] = useState<string | null>(null)
  const [keywordMeta, setKeywordMeta] = useState<Record<string, { description: string }>>({})
  const [notesOpen, setNotesOpen] = useState(true)

  useEffect(() => {
    fetch('/api/keyword-meta')
      .then(r => r.ok ? r.json() : [])
      .then((rows: { name: string; description: string }[]) => {
        const map: Record<string, { description: string }> = {}
        for (const r of rows) map[r.name] = { description: r.description }
        setKeywordMeta(map)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch(`/api/decks/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && !data.error) {
          const fixed: DeckDetail = {
            ...data,
            deck_identities: (data.deck_identities ?? []).map((slot: IdentitySlot & { identities: unknown }) => ({
              ...slot,
              identities: Array.isArray(slot.identities)
                ? (slot.identities[0] as IdentityDetail | undefined) ?? null
                : slot.identities as unknown as IdentityDetail | null,
            })),
            deck_egos: (data.deck_egos ?? []).map((es: EgoSlot & { ego: unknown }) => ({
              ...es,
              ego: Array.isArray(es.ego)
                ? (es.ego[0] as EgoSlot['ego'] | undefined) ?? null
                : es.ego as EgoSlot['ego'],
            })),
          }
          setDeck(fixed)
          setVoteCount(data.vote_count ?? 0)
        }
      })
      .finally(() => setLoading(false))
  }, [id])

  // 투표 상태 로드
  useEffect(() => {
    if (authStatus !== 'authenticated') return
    fetch(`/api/decks/${id}/vote`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setVoted(data.voted) })
      .catch(() => {})
  }, [id, authStatus])

  const handleVote = useCallback(async () => {
    if (authStatus !== 'authenticated' || voting) return
    setVoting(true)
    try {
      const res = await fetch(`/api/decks/${id}/vote`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setVoted(data.voted)
        setVoteCount(c => data.voted ? c + 1 : c - 1)
      }
    } finally {
      setVoting(false)
    }
  }, [authStatus, id, voting])

  const handleCopyCode = useCallback(async () => {
    if (!deck?.deck_code) return
    await navigator.clipboard.writeText(deck.deck_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [deck?.deck_code])

  if (loading) return <Skeleton />

  if (!deck) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center">
          <p className="font-serif text-2xl mb-4" style={{ color: 'var(--gold)' }}>덱을 찾을 수 없습니다</p>
          <Link href="/decks" style={{ color: '#555566' }} className="hover:text-yellow-300 transition-colors">
            ← 게시판으로 돌아가기
          </Link>
        </div>
      </div>
    )
  }

  // 정렬
  const sorted = [...deck.deck_identities].sort((a, b) => {
    if (a.slot_order === 99 && b.slot_order !== 99) return 1
    if (b.slot_order === 99 && a.slot_order !== 99) return -1
    return a.slot_order - b.slot_order
  })
  const slots = Array.from({ length: 12 }, (_, i) => sorted[i] ?? null)
  const keywords = topKeywords(sorted)
  const filledSlots = sorted.filter(s => s.identities)
  const customSkillSlots = filledSlots.filter(s => {
    const s1 = s.s1_count ?? 3, s2 = s.s2_count ?? 2, s3 = s.s3_count ?? 1
    return !(s1 === 3 && s2 === 2 && s3 === 1)
  })

  // 죄악 자원 & 공격 유형 종합
  const sinAffinityTotals: Record<string, number> = {}
  const atkTypeTotals: Record<string, number> = { slash: 0, pierce: 0, blunt: 0 }
  for (const slot of filledSlots) {
    for (const sk of slot.identities!.skills) {
      if (sk.sin_affinity) {
        const en = SIN_KR_TO_EN[sk.sin_affinity] ?? sk.sin_affinity
        sinAffinityTotals[en] = (sinAffinityTotals[en] ?? 0) + 1
      }
      if (sk.skill_type in atkTypeTotals) atkTypeTotals[sk.skill_type]++
    }
  }

  // EGO 그룹핑
  const gradeOrder = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH']
  const egoGrouped: Record<string, { grade: string; ego: NonNullable<EgoSlot['ego']> }[]> = {}
  for (const row of deck.deck_egos ?? []) {
    if (!row.ego) continue
    const sid = row.ego.sinner_id
    ;(egoGrouped[sid] ??= []).push({ grade: row.grade, ego: row.ego })
  }
  for (const sid of Object.keys(egoGrouped)) {
    egoGrouped[sid].sort((a, b) => gradeOrder.indexOf(a.grade) - gradeOrder.indexOf(b.grade))
  }
  const egoSinnerIds = Object.keys(egoGrouped)

  // 수감자별 그룹핑
  const slotsBySinner = filledSlots.reduce<Record<string, IdentitySlot[]>>((acc, slot) => {
    const sid = slot.identities!.sinner_id
    ;(acc[sid] ??= []).push(slot)
    return acc
  }, {})
  // 인격 + EGO 수감자 합산 (인격 순서 우선)
  const sinnerIds = [
    ...Object.keys(slotsBySinner),
    ...egoSinnerIds.filter(sid => !slotsBySinner[sid]),
  ]
  const activeSinner = selectedSinner ?? sinnerIds[0] ?? null
  const activeSlots = activeSinner ? (slotsBySinner[activeSinner] ?? []) : []
  const activeEgos = activeSinner ? (egoGrouped[activeSinner] ?? []) : []

  const date = new Date(deck.created_at).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="min-h-screen" style={{ background: '#0d0b08' }}>

      {/* ── 히어로 파노라마 ── */}
      <div className="relative" style={{ paddingTop: '64px' }}>
        <div className="relative overflow-hidden" style={{ height: '340px' }}>

          {/* 12 포트레이트 스트립 */}
          <div className="absolute inset-0" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)' }}>
            {slots.map((slot, i) => {
              const id_ = slot?.identities
              const imgUrl = id_
                ? portraitUrl(id_.sinner_id, id_.folder_name, id_.game_id, slot?.gacksung ?? false)
                : ''
              const normalImgUrl = id_
                ? portraitUrl(id_.sinner_id, id_.folder_name, id_.game_id, false)
                : ''
              const rarityColor = id_?.rarity ? (RARITY_COLORS[id_.rarity] ?? null) : null
              return (
                <div key={i} className="relative overflow-hidden">
                  {imgUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imgUrl}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block', filter: 'brightness(0.65) saturate(0.85)' }}
                      loading="lazy"
                      onError={e => {
                        if (slot?.gacksung && e.currentTarget.src !== normalImgUrl) {
                          e.currentTarget.src = normalImgUrl
                        }
                      }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: '#08060410' }} />
                  )}
                  {/* 스트립 구분 그림자 */}
                  {i > 0 && (
                    <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '1px', background: 'rgba(0,0,0,0.5)' }} />
                  )}
                  {/* 등급 상단 바 */}
                  {rarityColor && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: rarityColor, opacity: 0.6 }} />
                  )}
                </div>
              )
            })}
          </div>

          {/* 그라디언트: 상하 */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to bottom, rgba(13,11,8,0.1) 0%, rgba(13,11,8,0.0) 25%, rgba(13,11,8,0.55) 60%, rgba(13,11,8,0.96) 90%, rgba(13,11,8,1) 100%)',
              pointerEvents: 'none',
            }}
          />
          {/* 그라디언트: 좌우 */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to right, rgba(13,11,8,0.65) 0%, transparent 18%, transparent 82%, rgba(13,11,8,0.65) 100%)',
              pointerEvents: 'none',
            }}
          />

          {/* 타이틀 오버레이 */}
          <div className="absolute bottom-0 left-0 right-0">
            <div className="max-w-5xl mx-auto px-4 md:px-6 pb-7">
              <Link
                href="/decks"
                className="inline-flex items-center gap-1.5 mb-3 transition-opacity hover:opacity-70"
                style={{ color: '#3a3850', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.1em' }}
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                  <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                DECK ARCHIVE
              </Link>
              <h1
                className="font-serif font-bold mb-2 leading-tight"
                style={{ color: '#f0ece0', fontSize: 'clamp(1.4rem, 3.5vw, 2.1rem)', textShadow: '0 2px 24px rgba(0,0,0,0.9)' }}
              >
                {deck.title}
              </h1>
              <div className="flex items-center gap-2.5" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#333344' }}>
                {deck.profiles?.username && (
                  <span style={{ color: '#4a4060' }}>{deck.profiles.username}</span>
                )}
                {deck.profiles?.username && <span style={{ fontFamily: 'sans-serif' }}>·</span>}
                <span>{date}</span>
                <span style={{ fontFamily: 'sans-serif' }}>·</span>
                <span className="flex items-center gap-1">
                  <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
                    <ellipse cx="8" cy="8" rx="7" ry="4.5" stroke="currentColor" strokeWidth="1.4"/>
                    <circle cx="8" cy="8" r="2" fill="currentColor"/>
                  </svg>
                  {deck.view_count}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 콘텐츠 ── */}
      <div className="max-w-5xl mx-auto px-4 md:px-6 pb-24 pt-6">

          {/* ── 모바일 액션바 (lg 미만에서만 표시) ── */}
          <div className="flex lg:hidden flex-wrap items-center gap-2.5 mb-5 rounded-lg px-4 py-3" style={{ background: '#120e09', border: '1px solid var(--border)' }}>
            {/* 추천 */}
            <button
              onClick={handleVote}
              disabled={voting || authStatus !== 'authenticated'}
              className="inline-flex items-center gap-2 transition-all duration-200"
              style={{ opacity: voting ? 0.5 : 1, cursor: authStatus !== 'authenticated' ? 'default' : 'pointer' }}
              title={authStatus !== 'authenticated' ? '로그인 후 추천 가능' : voted ? '추천 취소' : '추천'}
            >
              <div
                className="flex items-center justify-center rounded-full transition-all duration-300"
                style={{
                  width: 32, height: 32,
                  background: voted ? 'rgba(200,48,64,0.14)' : 'rgba(44,28,12,0.5)',
                  border: `1px solid ${voted ? 'rgba(200,48,64,0.45)' : 'rgba(58,40,18,0.7)'}`,
                  boxShadow: voted ? '0 0 12px rgba(200,48,64,0.18)' : 'none',
                }}
              >
                <Heart
                  size={14}
                  fill={voted ? 'currentColor' : 'none'}
                  style={{ color: voted ? '#e05060' : '#3a3050' }}
                />
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700, lineHeight: 1, color: voted ? '#e05060' : '#444455' }}>
                {voteCount}
              </span>
            </button>

            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.06)' }} />

            {/* 수정 */}
            {(deck.is_owner || deck.is_admin) && (
              <Link
                href={`/decks/${id}/edit`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all duration-150 hover:brightness-125"
                style={{
                  background: 'rgba(200,144,10,0.1)',
                  border: '1px solid rgba(200,144,10,0.3)',
                  color: 'var(--gold)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  letterSpacing: '0.1em',
                }}
              >
                <Pencil size={10} />
                EDIT
              </Link>
            )}

            {/* 편성코드 */}
            {deck.deck_code && (
              <button
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all duration-150"
                style={{
                  background: copied ? 'rgba(88,136,40,0.12)' : 'rgba(44,28,12,0.3)',
                  border: `1px solid ${copied ? 'rgba(88,136,40,0.4)' : 'rgba(58,40,18,0.5)'}`,
                  color: copied ? '#88a830' : '#484858',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  letterSpacing: '0.1em',
                }}
              >
                {copied ? <Check size={10} /> : <Copy size={10} />}
                {copied ? 'COPIED!' : 'COPY CODE'}
              </button>
            )}

            {/* 죄악 자원 + 공격 유형 */}
            {filledSlots.length > 0 && (
              <>
                <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.06)' }} />
                <div className="flex items-center gap-2 flex-wrap">
                  {SIN_ORDER.map(sin => {
                    const count = sinAffinityTotals[sin] ?? 0
                    if (count === 0) return null
                    return (
                      <div key={sin} className="flex items-center gap-0.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={sinIconUrl(sin)} alt="" style={{ width: 14, height: 14 }} />
                        <span style={{ color: SIN_COLORS[sin], fontSize: '12px', fontFamily: 'var(--font-mono)', fontWeight: 700, lineHeight: 1 }}>{count}</span>
                      </div>
                    )
                  })}
                  <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.04)' }} />
                  {(['slash', 'pierce', 'blunt'] as const).map(type => {
                    const count = atkTypeTotals[type]
                    if (count === 0) return null
                    return (
                      <div key={type} className="flex items-center gap-0.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={ATK_ICON_URL[type]} alt="" style={{ width: 13, height: 13 }} />
                        <span style={{ color: '#999', fontSize: '12px', fontFamily: 'var(--font-mono)', fontWeight: 700, lineHeight: 1 }}>{count}</span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* 태그 */}
            {deck.tags.length > 0 && (
              <>
                <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.06)' }} />
                <div className="flex flex-wrap gap-1">
                  {deck.tags.map(tag => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(200,144,10,0.07)', color: 'var(--gold-dim)', border: '1px solid rgba(200,144,10,0.16)', fontFamily: 'var(--font-body)' }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

        <div className="flex gap-5 items-start">

          {/* ── 데스크탑 사이드바 (lg 이상에서만 표시) ── */}
          <aside className="hidden lg:block" style={{ width: 252, flexShrink: 0 }}>
            <div className="flex flex-col gap-3" style={{ position: 'sticky', top: 88 }}>

              {/* 추천 */}
              <div
                className="rounded-lg flex flex-col items-center py-5 gap-2"
                style={{ background: '#120e09', border: '1px solid var(--border)' }}
              >
                <button
                  onClick={handleVote}
                  disabled={voting || authStatus !== 'authenticated'}
                  className="flex flex-col items-center gap-2 transition-all duration-200"
                  style={{ opacity: voting ? 0.5 : 1, cursor: authStatus !== 'authenticated' ? 'default' : 'pointer' }}
                  title={authStatus !== 'authenticated' ? '로그인 후 추천 가능' : voted ? '추천 취소' : '추천'}
                >
                  <div
                    className="flex items-center justify-center rounded-full transition-all duration-300"
                    style={{
                      width: 48, height: 48,
                      background: voted ? 'rgba(200,48,64,0.14)' : 'rgba(44,28,12,0.5)',
                      border: `1px solid ${voted ? 'rgba(200,48,64,0.45)' : 'rgba(58,40,18,0.7)'}`,
                      boxShadow: voted ? '0 0 16px rgba(200,48,64,0.18)' : 'none',
                    }}
                  >
                    <Heart
                      size={20}
                      fill={voted ? 'currentColor' : 'none'}
                      style={{ color: voted ? '#e05060' : '#3a3050' }}
                    />
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 700, lineHeight: 1, color: voted ? '#e05060' : '#444455' }}>
                    {voteCount}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.12em', color: voted ? '#c84050' : (authStatus !== 'authenticated' ? '#222233' : '#333344') }}>
                    {authStatus !== 'authenticated' ? 'LOGIN TO VOTE' : voted ? 'LIKED' : 'LIKE'}
                  </span>
                </button>
              </div>

              {/* 수정 */}
              {(deck.is_owner || deck.is_admin) && (
                <Link
                  href={`/decks/${id}/edit`}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all duration-150 hover:brightness-125"
                  style={{
                    background: 'rgba(200,144,10,0.1)',
                    border: '1px solid rgba(200,144,10,0.3)',
                    color: 'var(--gold)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    letterSpacing: '0.1em',
                  }}
                >
                  <Pencil size={11} />
                  EDIT DECK
                </Link>
              )}

              {/* 편성코드 */}
              {deck.deck_code && (
                <button
                  onClick={handleCopyCode}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all duration-150"
                  style={{
                    background: copied ? 'rgba(88,136,40,0.12)' : '#120e09',
                    border: `1px solid ${copied ? 'rgba(88,136,40,0.4)' : 'var(--border)'}`,
                    color: copied ? '#88a830' : '#484858',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    letterSpacing: '0.1em',
                  }}
                >
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                  {copied ? 'COPIED!' : 'COPY DECK CODE'}
                </button>
              )}

              {/* 태그 + 키워드 */}
              {(deck.tags.length > 0 || keywords.length > 0) && (
                <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: '#120e09', border: '1px solid var(--border)' }}>
                  {deck.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {deck.tags.map(tag => (
                        <span
                          key={tag}
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(200,144,10,0.07)', color: 'var(--gold-dim)', border: '1px solid rgba(200,144,10,0.16)', fontFamily: 'var(--font-body)' }}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {keywords.map(kw => {
                        const iconUrl = getKeywordIconUrl(kw)
                        return (
                          <span
                            key={kw}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded"
                            style={{ background: 'rgba(136,88,40,0.14)', color: '#c8a450', border: '1px solid rgba(136,88,40,0.24)', fontFamily: 'var(--font-heading)', fontSize: '11px' }}
                          >
                            {iconUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={iconUrl} alt="" width={11} height={11} />
                            )}
                            {kw}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 죄악 자원 & 공격 유형 종합 */}
              {filledSlots.length > 0 && (
                <div className="rounded-lg p-3 flex flex-col gap-3" style={{ background: '#120e09', border: '1px solid var(--border)' }}>
                  {/* 죄악 자원 */}
                  <div>
                    <div style={{ color: '#444455', fontSize: '9px', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', marginBottom: 6 }}>죄악 자원</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {SIN_ORDER.map(sin => {
                        const count = sinAffinityTotals[sin] ?? 0
                        if (count === 0) return null
                        return (
                          <div key={sin} className="flex items-center gap-1">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={sinIconUrl(sin)} alt="" style={{ width: 16, height: 16 }} />
                            <span style={{ color: SIN_COLORS[sin], fontSize: '13px', fontFamily: 'var(--font-mono)', fontWeight: 700, lineHeight: 1 }}>{count}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }} />

                  {/* 공격 유형 */}
                  <div>
                    <div style={{ color: '#444455', fontSize: '9px', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', marginBottom: 6 }}>공격 유형</div>
                    <div className="flex items-center gap-3">
                      {(['slash', 'pierce', 'blunt'] as const).map(type => {
                        const count = atkTypeTotals[type]
                        if (count === 0) return null
                        return (
                          <div key={type} className="flex items-center gap-1">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={ATK_ICON_URL[type]} alt="" style={{ width: 15, height: 15 }} />
                            <span style={{ color: '#aaaaaa', fontSize: '13px', fontFamily: 'var(--font-mono)', fontWeight: 700, lineHeight: 1 }}>{count}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </aside>

          {/* ── 수감자 탭 + 인격 상세 ── */}
          <main className="flex-1 min-w-0">
            {filledSlots.length === 0 ? (
              <p className="text-sm italic" style={{ color: '#2a2a3a', fontFamily: 'var(--font-body)' }}>인격 정보 없음</p>
            ) : (
              <>
                {/* 수감자 탭 그리드 */}
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 mb-4">
                  {sinnerIds.map(sid => {
                    const firstSlot = slotsBySinner[sid]?.[0] ?? null
                    const id_ = firstSlot?.identities ?? null
                    const imgUrl = id_ ? portraitUrl(id_.sinner_id, id_.folder_name, id_.game_id, firstSlot?.gacksung ?? false) : (egoGrouped[sid]?.[0]?.ego.image_url ?? '')
                    const normalUrl = id_ ? portraitUrl(id_.sinner_id, id_.folder_name, id_.game_id, false) : imgUrl
                    const rc = id_ ? (RARITY_COLORS[id_.rarity] ?? '#667788') : (GRADE_COLORS[egoGrouped[sid]?.[0]?.grade ?? ''] ?? '#667788')
                    const isActive = activeSinner === sid
                    return (
                      <button
                        key={sid}
                        onClick={() => setSelectedSinner(sid)}
                        className="relative overflow-hidden"
                        style={{
                          aspectRatio: '2/3',
                          borderRadius: 4,
                          border: `1.5px solid ${isActive ? rc : 'rgba(38,24,10,0.5)'}`,
                          background: '#0a0806',
                          cursor: 'pointer',
                          transition: 'border-color 0.15s, box-shadow 0.15s',
                          boxShadow: isActive ? `0 0 12px ${rc}28` : 'none',
                          padding: 0,
                        }}
                      >
                        {imgUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={imgUrl}
                            alt={id_?.name_kr ?? ''}
                            style={{
                              width: '100%', height: '100%',
                              objectFit: 'cover', objectPosition: 'center top',
                              display: 'block',
                              filter: isActive ? 'brightness(0.88)' : 'brightness(0.45) saturate(0.65)',
                              transition: 'filter 0.15s',
                            }}
                            onError={e => {
                              if (firstSlot?.gacksung && e.currentTarget.src !== normalUrl) {
                                e.currentTarget.src = normalUrl
                              }
                            }}
                          />
                        ) : (
                          <div style={{ width: '100%', height: '100%', background: '#080604' }} />
                        )}
                        {/* 등급 바 */}
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: rc, opacity: isActive ? 1 : 0.4 }} />
                        {/* 수감자 로고 */}
                        <div
                          className="absolute bottom-0 left-0 right-0 flex items-end justify-center"
                          style={{ background: 'linear-gradient(to top, rgba(8,6,4,0.92) 0%, transparent 100%)', paddingBottom: 5, paddingTop: 16 }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={getSinnerLogoUrl(sid)} alt="" width={14} height={14} style={{ opacity: isActive ? 0.75 : 0.3, transition: 'opacity 0.15s' }} />
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* 덱 노트 (접기/펼치기) */}
                {(deck.description || customSkillSlots.length > 0) && (
                  <div className="mb-3 rounded-lg overflow-hidden" style={{ background: '#120e09', border: '1px solid var(--border)' }}>
                    <button
                      onClick={() => setNotesOpen(v => !v)}
                      className="w-full flex items-center justify-between px-4 py-2.5 transition-colors"
                      style={{ background: notesOpen ? 'rgba(200,144,10,0.04)' : 'transparent', borderBottom: notesOpen ? '1px solid rgba(32,20,8,0.7)' : 'none' }}
                    >
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: notesOpen ? '#8a7040' : '#3a3050', letterSpacing: '0.12em' }}>
                        DECK NOTES
                      </span>
                      <svg
                        width="12" height="12" viewBox="0 0 16 16" fill="none"
                        style={{ color: notesOpen ? '#8a7040' : '#2a2035', transition: 'transform 0.2s', transform: notesOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                      >
                        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    {notesOpen && (
                      <div className="px-4 py-3">
                        {deck.description && (
                          <NoteRenderer
                            text={deck.description}
                            {...buildNoteLookups(sorted, deck.all_sinner_egos ?? [])}
                          />
                        )}

                        {/* 스킬 편성 (거전) */}
                        {customSkillSlots.length > 0 && (
                          <div style={{ marginTop: deck.description ? '12px' : 0, borderTop: deck.description ? '1px solid rgba(32,20,8,0.5)' : 'none', paddingTop: deck.description ? '12px' : 0 }}>
                            <div className="flex items-center gap-2 mb-2">
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#8a6010', letterSpacing: '0.08em', fontWeight: 700 }}>SKILL DISTRIBUTION</span>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              {customSkillSlots.map((slot, i) => {
                                const id_ = slot.identities!
                                const dist = [slot.s1_count ?? 3, slot.s2_count ?? 2, slot.s3_count ?? 1]
                                const sortedSk = [...(id_.skills ?? [])].sort((a, b) => a.skill_order - b.skill_order)
                                const skillIconBase = id_.game_id ? `${STORAGE_BASE}/icons/skills/${id_.game_id}` : ''
                                return (
                                  <div key={i} className="flex items-center gap-2 rounded px-2.5 py-1.5" style={{ background: 'rgba(200,144,10,0.04)', border: '1px solid rgba(200,144,10,0.15)' }}>
                                    {/* 수감자 로고 + 인격명 */}
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={getSinnerLogoUrl(id_.sinner_id)} alt="" width={16} height={16} style={{ opacity: 0.5, flexShrink: 0 }} />
                                    <span className="truncate" style={{ fontSize: '11px', color: '#a09080', fontFamily: 'var(--font-body)', minWidth: 0, flex: '0 1 auto', maxWidth: '120px' }}>
                                      {id_.name_kr}
                                    </span>
                                    <div style={{ flex: 1 }} />
                                    {/* S1 / S2 / S3 */}
                                    {[0, 1, 2].map(idx => {
                                      const skill = sortedSk.find(s => s.skill_order === idx + 1)
                                      const sc = skill ? sinColor(skill.sin_affinity) : '#888'
                                      const iconUrl = skillIconBase ? `${skillIconBase}${String(idx + 1).padStart(2, '0')}.webp` : ''
                                      return (
                                        <div key={idx} className="flex items-center gap-1" style={{ minWidth: '42px' }}>
                                          {iconUrl && (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={iconUrl} alt={`S${idx + 1}`} style={{ width: '18px', height: '18px', borderRadius: '3px', border: `1px solid ${sc}40` }} />
                                          )}
                                          <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: dist[idx] > 0 ? sc : '#2a2015' }}>
                                            {dist[idx]}
                                          </span>
                                        </div>
                                      )
                                    })}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 선택된 수감자 인격 상세 (첫 번째 카드에 EGO 탭 포함) */}
                <div className="flex flex-col gap-2">
                  {activeSlots.map((slot, i) => (
                    <IdentityCard key={i} slot={slot} egos={i === 0 ? activeEgos : undefined} keywordMeta={keywordMeta} />
                  ))}
                </div>
              </>
            )}
          </main>

        </div>
      </div>
    </div>
  )
}
