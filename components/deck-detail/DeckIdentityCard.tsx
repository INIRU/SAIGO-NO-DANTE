'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  STORAGE_BASE,
  getSinnerLogoUrl,
  GRADE_COLORS,
  RARITY_ICON_MAP,
  computeSkillImageIndices,
  SIN_COLORS,
  SIN_KR_TO_EN,
  type SinType,
} from '@/lib/data/sinners'
import { useFormatSkillDesc, useKeywordData } from '@/components/sinners/KeywordTooltip'
import SkillDescription from '@/components/skill/SkillDescription'

// ── 타입 ──────────────────────────────────────────────────────────────────
export type SkillDetail = {
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
  uptie_level?: number | null
}

export type PassiveDetail = {
  name: string
  passive_type: string
  sin_affinity: string | null
  sin_count: number | null
  active_cond: string | null
  description: string
  passive_order: number
  uptie_level?: number | null
}

export type IdentityDetail = {
  id: string
  sinner_id: string
  folder_name: string | null
  game_id: string | null
  keywords: string[] | null
  name_kr: string
  tier: number
  rarity: number
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

export type IdentitySlot = {
  slot_order: number
  gacksung: boolean
  s1_count?: number
  s2_count?: number
  s3_count?: number
  identities: IdentityDetail | null
}

export type EgoEntry = {
  grade: string
  ego: {
    id: string
    name_kr: string | null
    grade: string
    sin_affinity: string | null
    sinner_id: string
    folder_name: string | null
    image_url: string | null
  }
}

// ── 상수 ──────────────────────────────────────────────────────────────────
import { THEME_KEYWORDS, normalizeThemeKeyword } from '@/lib/constants/keywords'
const THEME_KW_SET = new Set<string>(THEME_KEYWORDS)

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

const ATK_ICON_URL: Record<string, string> = {
  'slash': `${STORAGE_BASE}/icons/stats/slash.webp`,
  'pierce': `${STORAGE_BASE}/icons/stats/pierce.webp`,
  'blunt': `${STORAGE_BASE}/icons/stats/blunt.webp`,
}

const STAT_ICON_URL: Record<string, string> = {
  hp:  `${STORAGE_BASE}/icons/stats/health.webp`,
  spd: `${STORAGE_BASE}/icons/stats/speed.webp`,
  def: `${STORAGE_BASE}/icons/stats/defense.webp`,
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
function sinIconUrl(sin: string): string {
  const cap = sin.charAt(0).toUpperCase() + sin.slice(1)
  return `${STORAGE_BASE}/icons/Sins/transparent/${cap}.webp`
}

function sinColor(sin: string): string {
  return SIN_COLORS[sin as SinType] ?? '#cccccc'
}

export function portraitUrl(
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

// ── 컴포넌트 ──────────────────────────────────────────────────────────────
export default function DeckIdentityCard({
  slot,
  egos,
  keywordMeta,
}: {
  slot: IdentitySlot
  egos?: EgoEntry[]
  keywordMeta?: Record<string, { description: string }>
}) {
  const formatSkillDesc = useFormatSkillDesc()
  const { getIconUrl } = useKeywordData()
  const id_ = slot.identities!
  const [activeTab, setActiveTab] = useState<'skills' | 'passives' | 'ego'>('skills')

  const rarityColor = RARITY_COLORS[id_.rarity] ?? '#667788'
  const imgUrl = portraitUrl(id_.sinner_id, id_.folder_name, id_.game_id, slot.gacksung)
  const normalUrl = portraitUrl(id_.sinner_id, id_.folder_name, id_.game_id, false)
  const themeKws = [...new Set((id_.keywords ?? []).map(normalizeThemeKeyword).filter(kw => THEME_KW_SET.has(kw)))]

  // 4동기화 우선: 같은 (skill_order, variant_order)에서 최고 uptie_level만 유지
  const rawSkills = id_.skills ?? []
  const skillBest = new Map<string, typeof rawSkills[0]>()
  for (const s of rawSkills) {
    const key = `${s.skill_order}:${(s as Record<string, unknown>).variant_order ?? 0}`
    const ex = skillBest.get(key)
    if (!ex || (s.uptie_level ?? 3) > (ex.uptie_level ?? 3)) skillBest.set(key, s)
  }
  const sortedSkills = [...skillBest.values()].sort((a, b) => a.skill_order - b.skill_order || ((a as Record<string, unknown>).variant_order as number ?? 0) - ((b as Record<string, unknown>).variant_order as number ?? 0))

  // 4동기화 우선: 같은 (passive_type, passive_order)에서 최고 uptie_level만 유지
  const rawPassives = id_.passives ?? []
  const passiveBest = new Map<string, typeof rawPassives[0]>()
  for (const p of rawPassives) {
    const key = `${p.passive_type}:${p.passive_order}`
    const ex = passiveBest.get(key)
    if (!ex || (p.uptie_level ?? 3) > (ex.uptie_level ?? 3)) passiveBest.set(key, p)
  }
  const sortedPassives = [...passiveBest.values()].sort((a, b) => a.passive_order - b.passive_order)

  const skillImageIdx = computeSkillImageIndices(sortedSkills)

  const s1 = sortedSkills.find(s => s.skill_order === 1) ?? sortedSkills[0]
  const primaryColor = s1 ? sinColor(s1.sin_affinity) : rarityColor

  const skillIconUrl = (order: number) =>
    id_.game_id ? `${STORAGE_BASE}/icons/skills/${id_.sinner_id}/${id_.game_id}${String(order).padStart(2, '0')}.webp` : ''

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
            <Image src={getSinnerLogoUrl(id_.sinner_id)} alt="" width={18} height={18} style={{ opacity: 0.3 }} />
          </div>
        </div>

        {/* 정보 영역 */}
        <div className="flex-1 min-w-0 p-3">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <Link href={`/sinners/${id_.sinner_id}/identities/${id_.id}`} className="font-serif font-bold text-base leading-tight hover:underline" style={{ color: '#e8e0d0' }}>{id_.name_kr}</Link>
            </div>
            {RARITY_ICON_MAP[id_.rarity] ? (
              <Image src={RARITY_ICON_MAP[id_.rarity]} alt={`${id_.rarity}성`} width={id_.rarity === 1 ? 16 : id_.rarity === 2 ? 30 : 36} height={14} style={{ flexShrink: 0, opacity: 0.9 }} />
            ) : (
              <span className="flex-shrink-0 px-1.5 py-px rounded" style={{ background: `${rarityColor}18`, color: rarityColor, border: `1px solid ${rarityColor}38`, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                {id_.rarity}성
              </span>
            )}
          </div>

          {/* 테마 키워드 */}
          {themeKws.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2.5">
              {themeKws.map(kw => {
                const iconUrl = getIconUrl(kw)
                const desc = keywordMeta?.[kw]?.description
                return (
                  <span key={kw} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded" title={desc} style={{ background: 'rgba(120,76,28,0.12)', color: '#907040', border: '1px solid rgba(120,76,28,0.22)', fontFamily: 'var(--font-heading)', fontSize: '0.75rem', cursor: desc ? 'help' : 'default' }}>
                    {iconUrl && <Image src={iconUrl} alt="" width={14} height={14} />}
                    {kw}
                  </span>
                )
              })}
            </div>
          )}

          {/* 스탯 */}
          <div className="flex items-center gap-3 mb-2.5">
            {id_.hp != null && (
              <span className="flex items-center gap-1" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem' }}>
                <Image src={STAT_ICON_URL.hp} alt="HP" width={16} height={16} style={{ opacity: 0.9 }} />
                <strong style={{ color: '#cc5050' }}>{id_.hp}</strong>
              </span>
            )}
            {id_.speed_min != null && id_.speed_max != null && (
              <span className="flex items-center gap-1" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem' }}>
                <Image src={STAT_ICON_URL.spd} alt="SPD" width={16} height={16} style={{ opacity: 0.9 }} />
                <strong style={{ color: '#88a830' }}>{id_.speed_min}-{id_.speed_max}</strong>
              </span>
            )}
            {id_.def_level != null && (
              <span className="flex items-center gap-1" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem' }}>
                <Image src={STAT_ICON_URL.def} alt="DEF" width={16} height={16} style={{ opacity: 0.9 }} />
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
                <span key={label} className="inline-flex items-center gap-0.5 px-1.5 py-px rounded" style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}`, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                  <Image src={RES_ATK_ICON[label]} alt={label} width={12} height={12} style={{ opacity: 0.75 }} />
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
                color: isActive ? '#d0c8b8' : '#5a5070',
                borderBottom: `2px solid ${isActive ? primaryColor + '55' : 'transparent'}`,
                fontFamily: 'var(--font-heading)',
                letterSpacing: '0.05em',
              }}
            >
              {tab.label}
              <span className="ml-2" style={{ color: isActive ? primaryColor : '#5a5065', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', opacity: 0.8 }}>
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
            <p style={{ color: '#8a8095', fontSize: '0.6875rem', fontStyle: 'italic', fontFamily: 'var(--font-body)' }}>스킬 정보 없음</p>
          ) : (() => {
            const atkSkills = sortedSkills.filter(s => !['evade', 'defense', 'counter'].includes(s.skill_type))
            const labelCount: Record<number, number> = {}
            // 각 skill_order에 몇 개의 변형이 있는지 카운트
            for (const sk of atkSkills) labelCount[sk.skill_order] = (labelCount[sk.skill_order] ?? 0) + 1
            const labelIdx: Record<number, number> = {}
            return atkSkills.map(skill => {
            const varIdx = labelIdx[skill.skill_order] ?? 0
            labelIdx[skill.skill_order] = varIdx + 1
            const hasVariants = (labelCount[skill.skill_order] ?? 1) > 1
            const sc = sinColor(skill.sin_affinity)
            const maxPower = skill.base_power + skill.coins * skill.coin_power
            const coinPowerStr = skill.coin_power >= 0 ? `+${skill.coin_power}` : `${skill.coin_power}`
            const skillLabel = hasVariants ? `S${skill.skill_order}-${varIdx + 1}` : `S${skill.skill_order}`
            const imgIdx = skillImageIdx[skill.id] ?? skill.skill_order
            const iconUrl = skillIconUrl(imgIdx)
            const iconFallback = imgIdx >= 5 ? skillIconUrl(3) : undefined
            return (
              <div key={skill.id} className="p-3 rounded" style={{ background: `${sc}08`, border: `1px solid ${sc}28` }}>
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
                    <span className="font-semibold truncate" style={{ color: sc, fontSize: '0.8125rem' }}>{skill.name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {skill.atk_weight != null && skill.atk_weight > 0 && (
                      <div className="flex gap-0.5">
                        {Array.from({ length: skill.atk_weight }).map((_, i) => (
                          <div key={i} style={{ width: 7, height: 7, borderRadius: 1, background: `${sc}50`, border: `1.5px solid ${sc}` }} />
                        ))}
                      </div>
                    )}
                    {skill.offense_level != null && (
                      <span style={{ color: '#999', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>ATK Lv.{skill.offense_level}</span>
                    )}
                    {ATK_ICON_URL[skill.skill_type] && (
                      <Image src={ATK_ICON_URL[skill.skill_type]} alt={skill.skill_type} width={16} height={16} style={{ opacity: 0.65 }} />
                    )}
                  </div>
                </div>

                {/* 위력 수치 */}
                <div className="flex items-center gap-3 mb-2">
                  <span style={{ fontSize: '0.75rem', color: '#999' }}>위력 <strong style={{ color: sc, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{skill.base_power}</strong></span>
                  <span style={{ fontSize: '0.75rem', color: '#999' }}>코인 <strong style={{ color: 'var(--gold)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{skill.coins}</strong></span>
                  <span style={{ fontSize: '0.75rem', color: '#999' }}>코인위력 <strong style={{ color: sc, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{coinPowerStr}</strong></span>
                  <span style={{ fontSize: '0.75rem', color: '#999', marginLeft: 'auto' }}>최대 <strong style={{ color: '#e8dcc8', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{maxPower}</strong></span>
                </div>

                {/* 코인 시각화 */}
                <div className="flex gap-1">
                  {Array.from({ length: skill.coins }).map((_, i) => (
                    <Image key={i} src={`${STORAGE_BASE}/icons/stats/coin.webp`} alt="" width={16} height={16} style={{ filter: `drop-shadow(0 0 2px ${sc}60)` }} />
                  ))}
                </div>

                {/* 스킬 설명 */}
                {skill.description && (
                  <div style={{ marginTop: 8, borderTop: `1px solid ${sc}18`, paddingTop: 8 }}>
                    <SkillDescription description={skill.description} accentColor={sc} variant="compact" />
                  </div>
                )}
              </div>
            )
          })
          })()}
        </div>
      )}

      {/* 패시브 탭 */}
      {activeTab === 'passives' && (
        <div className="flex flex-col gap-2 p-3">
          {sortedPassives.length === 0 ? (
            <p style={{ color: '#8a8095', fontSize: '0.6875rem', fontStyle: 'italic', fontFamily: 'var(--font-body)' }}>패시브 정보 없음</p>
          ) : sortedPassives.map((passive, idx) => {
            const isBattle = passive.passive_type === 'battle'
            const sinNames = passive.sin_affinity ? passive.sin_affinity.split(',').map(s => s.trim()) : []
            const sinTypes = sinNames.map(s => SIN_KR_TO_EN[s]).filter(Boolean) as SinType[]
            const pc = sinTypes[0] ? (SIN_COLORS[sinTypes[0]] ?? '#cccccc') : '#cccccc'
            return (
              <div key={idx} className="p-3 rounded" style={{ background: `${pc}08`, border: `1px solid ${pc}25` }}>
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
                  <span className="font-semibold" style={{ color: pc, fontSize: '0.8125rem' }}>{passive.name}</span>
                </div>

                {(sinTypes.length > 0 || passive.active_cond) && (
                  <div className="flex items-center gap-1.5 mb-2">
                    {sinTypes.map((st, i) => (
                      <Image key={i} src={sinIconUrl(st)} alt="" width={20} height={20} style={{ filter: `drop-shadow(0 0 2px ${SIN_COLORS[st] ?? pc}60)` }} />
                    ))}
                    {sinTypes.length > 0 && passive.sin_count != null && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', fontWeight: 700, color: pc }}>x{passive.sin_count}</span>
                    )}
                    {passive.active_cond && (
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${pc}18`, color: pc, border: `1px solid ${pc}35` }}>
                        {passive.active_cond}
                      </span>
                    )}
                  </div>
                )}

                {passive.description && (
                  <div style={{ fontSize: '0.6875rem', lineHeight: 1.8 }}>
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
            const sc = sinEn ? (SIN_COLORS[sinEn as SinType] ?? gc) : gc
            return (
              <div key={ego.id} className="p-3 rounded flex items-center gap-3"
                style={{ background: `${gc}08`, border: `1px solid ${gc}28` }}>
                <div style={{ width: 2, alignSelf: 'stretch', background: gc, borderRadius: 1, flexShrink: 0 }} />
                {ego.image_url ? (
                  <Image src={ego.image_url} alt={ego.name_kr ?? ''} width={52} height={52}
                    style={{ borderRadius: 4, objectFit: 'cover', border: `1px solid ${gc}30`, flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 52, height: 52, borderRadius: 4, background: '#0a0806', border: `1px solid ${gc}20`, flexShrink: 0 }} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="px-1.5 py-px rounded" style={{ background: `${gc}18`, color: gc, border: `1px solid ${gc}38`, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                      E.G.O
                    </span>
                    {GRADE_ICON_URL[grade] ? (
                      <Image src={GRADE_ICON_URL[grade]} alt={grade} width={32} height={12} style={{ opacity: 0.9 }} />
                    ) : (
                      <span style={{ color: gc, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{grade}</span>
                    )}
                    {sinEn && (
                      <Image src={sinIconUrl(sinEn)} alt="" width={12} height={12} style={{ opacity: 0.8 }} />
                    )}
                  </div>
                  <span className="font-serif font-bold" style={{ color: sc, fontSize: '0.8125rem' }}>{ego.name_kr ?? ego.id}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
