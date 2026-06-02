'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { X } from 'lucide-react'
import { STORAGE_BASE, ATK_TYPE_ICON_MAP, RARITY_ICON_MAP } from '@/lib/constants/game'
import { SIN_COLORS, SIN_KR_TO_EN } from '@/lib/constants/sin'
import type { SinType } from '@/lib/types'
import SkillDescription from '@/components/skill/SkillDescription'
import IdentitySkillFrameCard from '@/components/identity/IdentitySkillFrameCard'
import BaseModal from '@/components/ui/BaseModal'
import { useLocale } from 'next-intl'

// ── 타입 ──────────────────────────────────────────────────────────────────
type SkillData = {
  id: string
  name: string
  name_en?: string | null
  name_jp?: string | null
  skill_type: string
  sin_affinity: string
  coins: number
  base_power: number
  coin_power: number
  description: string | null
  description_en?: string | null
  description_jp?: string | null
  flavor?: string | null
  flavor_en?: string | null
  flavor_jp?: string | null
  skill_order: number
  atk_weight: number | null
  offense_level: number | null
  uptie_level: number | null
  variant_order: number | null
}

type PassiveData = {
  id: string
  name: string
  name_en?: string | null
  name_jp?: string | null
  passive_type: string
  sin_affinity: string | null
  sin_count: number | null
  active_cond: string | null
  description: string
  description_en?: string | null
  description_jp?: string | null
  flavor?: string | null
  flavor_en?: string | null
  flavor_jp?: string | null
  passive_order: number
  uptie_level: number | null
}

type IdentityData = {
  id: string
  sinner_id: string
  name: string
  name_kr: string
  tier: number
  rarity: number
  hp: number | null
  speed_min: number | null
  speed_max: number | null
  def_level: number | null
  keywords: string[] | null
  skill_keyword_list?: string[] | null
  slash_res: string | null
  pierce_res: string | null
  blunt_res: string | null
  panic_type: number | null
  break_section: number[] | null
  game_id: string | null
  folder_name: string | null
}

type SanityConditionData = {
  template_id: string
  condition_type: 'increase' | 'decrease'
  text: string
  sort_order: number
}

type PanicInfoData = {
  id: number
  name: string
  description: string
}

type ApiResponse = {
  identity: IdentityData
  sinner_name: string | null
  skills: SkillData[]
  passives: PassiveData[]
  sanity_conditions: SanityConditionData[]
  panic_info: PanicInfoData | null
}

// ── 상수 ──────────────────────────────────────────────────────────────────
const STAT_ICON_URL: Record<string, string> = {
  hp: `${STORAGE_BASE}/icons/stats/health.webp`,
  spd: `${STORAGE_BASE}/icons/stats/speed.webp`,
  def: `${STORAGE_BASE}/icons/stats/defense.webp`,
}

const RES_STYLE: Record<string, { color: string; label: string }> = {
  '치명': { color: '#e04040', label: '치명' },
  '효율': { color: '#e06070', label: '효율' },
  '취약': { color: '#e06070', label: '취약' },
  '보통': { color: '#667788', label: '보통' },
  '내성': { color: '#4898b0', label: '내성' },
  '견딤': { color: '#4898b0', label: '견딤' },
  '무효': { color: '#40c060', label: '무효' },
  '면역': { color: '#40c060', label: '면역' },
}




// ── 정신력 이미지 상수 ────────────────────────────────────────────────────
const PANIC_IMG_URL = `${STORAGE_BASE}/icons/stats/panic.webp`
const PANIC_LOVE_HATE_URL = `${STORAGE_BASE}/icons/stats/panic_love_hate.webp`
const SANITY_INCREASE_BG = `${STORAGE_BASE}/icons/stats/sanity_increase_bg.webp`
const SANITY_DECREASE_BG = `${STORAGE_BASE}/icons/stats/sanity_decrease_bg.webp`

// ── 정신력 텍스트 파서 ────────────────────────────────────────────────────
function parseMarkupTags(text: string): React.ReactNode[] {
  const cleaned = text
    .replace(/<size=\d+%>/g, '')
    .replace(/<\/size>/g, '')

  const parts: React.ReactNode[] = []
  let remaining = cleaned
  let key = 0

  const colorRegex = /<color=([^>]+)>([\s\S]*?)<\/color>/
  let match = colorRegex.exec(remaining)
  while (match) {
    if (match.index > 0) parts.push(remaining.slice(0, match.index))
    parts.push(<span key={key++} style={{ color: match[1], fontWeight: 600 }}>{match[2]}</span>)
    remaining = remaining.slice(match.index + match[0].length)
    match = colorRegex.exec(remaining)
  }
  if (remaining) parts.push(remaining)
  return parts
}

function renderSanityText(text: string, bulletColor?: string): React.ReactNode {
  const lines = text.split('\n')
  const items: React.ReactNode[] = []
  lines.forEach((line, i) => {
    const trimmed = line.trim()
    if (!trimmed) return
    const isBullet = trimmed.startsWith('·')
    const isSub = trimmed.startsWith('(')
    const content = isBullet ? trimmed.slice(1) : trimmed
    if (isSub) {
      items.push(
        <div key={i} style={{ paddingLeft: '1rem', color: '#999', fontSize: '0.6875rem', lineHeight: 1.7 }}>
          {parseMarkupTags(content)}
        </div>
      )
    } else {
      items.push(
        <div key={i} className="flex gap-2" style={{ lineHeight: 1.8, marginTop: i > 0 && !lines[i - 1]?.trim().startsWith('(') ? '2px' : '0' }}>
          <div style={{ width: '5px', height: '5px', borderRadius: '1px', backgroundColor: bulletColor ?? '#666', flexShrink: 0, marginTop: '0.5rem' }} />
          <span>{parseMarkupTags(content)}</span>
        </div>
      )
    }
  })
  return <div>{items}</div>
}

// ── 헬퍼 ──────────────────────────────────────────────────────────────────
function sinColor(sin: string): string {
  return SIN_COLORS[sin as SinType] ?? '#cccccc'
}

function sinIconUrl(sin: string): string {
  const cap = sin.charAt(0).toUpperCase() + sin.slice(1)
  return `${STORAGE_BASE}/icons/Sins/transparent/${cap}.webp`
}

function localizedText(
  lang: string | undefined,
  fallback: string | null | undefined,
  en?: string | null,
  jp?: string | null,
): string | null | undefined {
  if (lang === 'en') return en || fallback
  if (lang === 'ja') return jp || fallback
  return fallback
}

function getRepresentativeKeywords(identity: IdentityData) {
  return identity.skill_keyword_list && identity.skill_keyword_list.length > 0
    ? identity.skill_keyword_list
    : (identity.keywords ?? [])
}

function bestUptie<T extends { uptie_level: number | null }>(items: T[], groupKey: (item: T) => string): T[] {
  const best = new Map<string, T>()
  for (const item of items) {
    const key = groupKey(item)
    const ex = best.get(key)
    if (!ex || (item.uptie_level ?? 3) > (ex.uptie_level ?? 3)) best.set(key, item)
  }
  return [...best.values()]
}

// ── 컴포넌트 ──────────────────────────────────────────────────────────────
interface IdentityDetailModalProps {
  identityId: string
  onClose: () => void
}

export default function IdentityDetailModal({ identityId, onClose }: IdentityDetailModalProps) {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/identity/${identityId}`)
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then((d: ApiResponse) => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setError('데이터를 불러올 수 없습니다') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [identityId])

  return (
    <BaseModal open={!!identityId} onClose={onClose} maxWidth="52rem" padding="1rem" title="인격 상세">
      <div
        className="relative overflow-y-auto rounded-xl"
        style={{
          maxHeight: '85vh',
          background: '#131110',
          border: '1px solid rgba(200,144,10,0.15)',
          boxShadow: '0 0 3rem rgba(200,144,10,0.05), 0 1.5rem 4rem rgba(0,0,0,0.6)',
        }}
      >
        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          aria-label="닫기"
          className="absolute top-3 right-3 z-20 p-1.5 rounded-full transition-colors hover:bg-white/10"
          style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.5)' }}
        >
          <X size={18} />
        </button>

        {loading && <LoadingSkeleton />}
        {error && (
          <div className="p-6 text-center" style={{ color: '#c84050', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}
        {data && !loading && <ModalContent data={data} />}
      </div>
    </BaseModal>
  )
}

// ── 로딩 스켈레톤 ────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="rounded" style={{ width: '3rem', height: '3rem', background: '#1a1510' }} />
        <div className="flex-1 space-y-2">
          <div className="rounded" style={{ width: '60%', height: '1rem', background: '#1a1510' }} />
          <div className="rounded" style={{ width: '40%', height: '0.75rem', background: '#1a1510' }} />
        </div>
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} className="rounded-lg" style={{ height: '4rem', background: '#1a1510' }} />
      ))}
    </div>
  )
}

// ── 탭 정의 ───────────────────────────────────────────────────────────────
const MODAL_TABS = [
  { key: 'skill', label: '스킬' },
  { key: 'passive', label: '패시브' },
  { key: 'sanity', label: '정신력' },
] as const
type ModalTab = typeof MODAL_TABS[number]['key']

// ── 모달 본문 ─────────────────────────────────────────────────────────────
function ModalContent({ data }: { data: ApiResponse }) {
  const { identity, sinner_name, skills, passives, sanity_conditions: sanityConditions = [], panic_info: panicInfo = null } = data
  const [activeTab, setActiveTab] = useState<ModalTab>('skill')
  const lang = useLocale()

  // 4동기화 우선 스킬
  const sortedSkills = bestUptie(skills, s => `${s.skill_order}:${s.variant_order ?? 0}`)
    .sort((a, b) => a.skill_order - b.skill_order || (a.variant_order ?? 0) - (b.variant_order ?? 0))

  // 4동기화 우선 패시브
  const sortedPassives = bestUptie(passives, p => `${p.passive_type}:${p.passive_order}`)
    .sort((a, b) => a.passive_order - b.passive_order)

  const atkSkills = sortedSkills.filter(s => !['evade', 'defense', 'counter'].includes(s.skill_type))
  const defSkills = sortedSkills.filter(s => ['evade', 'defense', 'counter'].includes(s.skill_type))

  const rarityColor = identity.rarity === 3 ? '#c8900a' : identity.rarity === 2 ? '#4898b0' : '#667788'

  const portraitUrl = identity.game_id && identity.folder_name
    ? `${STORAGE_BASE}/sinners/${identity.sinner_id}/identities/${encodeURIComponent(identity.folder_name)}/${identity.game_id}_normal_info.webp`
    : null
  const representativeKeywords = getRepresentativeKeywords(identity)

  return (
    <div>
      {/* ── 헤더 ──────────────────────────────────────────────── */}
      <div className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${rarityColor}12 0%, transparent 60%)` }}>
        <div className="flex gap-3 p-5 pb-4">
          {portraitUrl && (
            <div className="flex-shrink-0 rounded-lg overflow-hidden" style={{ width: '4.5rem', height: '6rem', border: `1px solid ${rarityColor}40` }}>
              <Image
                src={portraitUrl} alt={identity.name_kr}
                width={72} height={96}
                style={{ width: '4.5rem', height: '6rem', objectFit: 'cover', objectPosition: 'center top' }}
              />
            </div>
          )}
          <div className="flex-1 min-w-0 pt-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-serif" style={{ color: '#e8dcc8', fontSize: '1.0625rem', lineHeight: 1.2 }}>
                {identity.name_kr}
              </span>
              {RARITY_ICON_MAP[identity.rarity] && (
                <Image
                  src={RARITY_ICON_MAP[identity.rarity]}
                  alt={`${identity.rarity}성`}
                  width={identity.rarity === 1 ? 16 : identity.rarity === 2 ? 30 : 36}
                  height={14}
                  style={{ flexShrink: 0, opacity: 0.9, height: '0.875rem', width: 'auto' }}
                />
              )}
            </div>
            {sinner_name && (
              <p style={{ color: '#8a7050', fontSize: '0.75rem', fontFamily: 'var(--font-body)', marginBottom: '0.375rem' }}>
                {sinner_name}
              </p>
            )}
            {representativeKeywords.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {representativeKeywords.map(kw => (
                  <span key={kw} className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(120,76,28,0.12)', color: '#907040', border: '1px solid rgba(120,76,28,0.22)', fontSize: '0.6875rem', fontFamily: 'var(--font-heading)' }}>
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 스탯 & 저항 ──────────────────────────────────────── */}
      <div className="px-5 py-3" style={{ borderTop: '1px solid rgba(32,20,8,0.7)', borderBottom: '1px solid rgba(32,20,8,0.7)' }}>
        <div className="flex items-center gap-4 mb-2">
          {identity.hp != null && (
            <span className="flex items-center gap-1" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
              <Image src={STAT_ICON_URL.hp} alt="HP" width={16} height={16} style={{ width: '1rem', height: '1rem', opacity: 0.9 }} />
              <strong style={{ color: '#cc5050' }}>{identity.hp}</strong>
            </span>
          )}
          {identity.speed_min != null && identity.speed_max != null && (
            <span className="flex items-center gap-1" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
              <Image src={STAT_ICON_URL.spd} alt="SPD" width={16} height={16} style={{ width: '1rem', height: '1rem', opacity: 0.9 }} />
              <strong style={{ color: '#88a830' }}>{identity.speed_min}-{identity.speed_max}</strong>
            </span>
          )}
          {identity.def_level != null && (
            <span className="flex items-center gap-1" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
              <Image src={STAT_ICON_URL.def} alt="DEF" width={16} height={16} style={{ width: '1rem', height: '1rem', opacity: 0.9 }} />
              <strong style={{ color: '#4898b0' }}>{identity.def_level}</strong>
            </span>
          )}
        </div>

        {/* 저항 */}
        <div className="flex flex-wrap gap-2">
          {([
            { label: '참격', icon: 'slash', val: identity.slash_res },
            { label: '관통', icon: 'pierce', val: identity.pierce_res },
            { label: '타격', icon: 'blunt', val: identity.blunt_res },
          ] as const).map(({ label, icon, val }) => {
            if (!val) return null
            const st = RES_STYLE[val] ?? { color: '#667788', label: val }
            return (
              <span key={label} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: `${st.color}15`, color: st.color, border: `1px solid ${st.color}30`, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                <Image src={ATK_TYPE_ICON_MAP[icon]} alt={label} width={14} height={14} style={{ width: '0.875rem', height: '0.875rem', opacity: 0.75 }} />
                {label}
                <strong>{val}</strong>
              </span>
            )
          })}
        </div>

        {/* 흐트러짐 구간 */}
        {identity.break_section && identity.break_section.length > 0 && identity.hp != null && (
          <div style={{ marginTop: '0.625rem' }}>
            <p style={{ color: '#888', fontSize: '0.6875rem', marginBottom: '0.375rem', fontFamily: 'var(--font-heading)' }}>흐트러짐 구간</p>
            <div className="relative rounded overflow-hidden" style={{ height: '1.5rem', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(200,60,60,0.25), rgba(200,144,10,0.1))' }} />
              {identity.break_section.map((pct: number, i: number) => (
                <div key={i}>
                  <div className="absolute top-0 bottom-0" style={{ left: `${100 - pct}%`, width: '0.125rem', background: '#e04040', opacity: 0.8 }} />
                  <div className="absolute" style={{ left: `${100 - pct}%`, top: '50%', transform: 'translate(-50%, -50%)' }}>
                    <span style={{ color: '#e04040', fontSize: '0.625rem', fontFamily: 'var(--font-mono)', fontWeight: 700, textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
                      {pct}%
                    </span>
                  </div>
                </div>
              ))}
              <div className="absolute left-1 top-1/2 -translate-y-1/2" style={{ color: '#cc5050', fontSize: '0.5625rem', fontFamily: 'var(--font-mono)', opacity: 0.6 }}>{identity.hp}</div>
              <div className="absolute right-1 top-1/2 -translate-y-1/2" style={{ color: '#888', fontSize: '0.5625rem', fontFamily: 'var(--font-mono)', opacity: 0.5 }}>0</div>
            </div>
          </div>
        )}
      </div>

      {/* ── 탭 바 ────────────────────────────────────────────── */}
      <div className="flex" style={{ borderBottom: '1px solid rgba(32,20,8,0.7)', overflowX: 'auto' }}>
        {MODAL_TABS.map(tab => {
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '0.625rem 1rem',
                fontSize: '0.8125rem',
                fontWeight: active ? 700 : 400,
                color: active ? '#e8dcc8' : '#555',
                background: active ? 'rgba(200,144,10,0.05)' : 'transparent',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                borderBottom: `2px solid ${active ? '#c8900a' : 'transparent'}`,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ── 스킬 탭 ──────────────────────────────────────────── */}
      {activeTab === 'skill' && (
        <div className="px-5 py-3">
          {atkSkills.length === 0 && defSkills.length === 0 ? (
            <p style={{ color: '#5a5070', fontSize: '0.75rem', fontStyle: 'italic' }}>스킬 정보 없음</p>
          ) : (
            <div className="flex flex-col gap-2">
              {atkSkills.map(skill => (
                <SkillCard key={skill.id} skill={skill} skills={sortedSkills} identity={identity} lang={lang} />
              ))}
              {defSkills.map(skill => (
                <SkillCard key={skill.id} skill={skill} skills={sortedSkills} identity={identity} lang={lang} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 패시브 탭 ────────────────────────────────────────── */}
      {activeTab === 'passive' && (
        <div className="px-5 py-3">
          {sortedPassives.length === 0 ? (
            <p style={{ color: '#5a5070', fontSize: '0.75rem', fontStyle: 'italic' }}>패시브 정보 없음</p>
          ) : (
            <>
              {/* 배틀 패시브 */}
              {sortedPassives.filter(p => p.passive_type === 'battle').length > 0 && (
                <>
                  <div className="flex items-center gap-3 my-3">
                    <div className="flex-1" style={{ height: '1px', background: 'linear-gradient(90deg, transparent 0%, rgba(200,144,10,0.3) 100%)' }} />
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.2em', color: '#c8900a', fontFamily: 'var(--font-heading)' }}>패시브</span>
                    <div className="flex-1" style={{ height: '1px', background: 'linear-gradient(90deg, rgba(200,144,10,0.3) 0%, transparent 100%)' }} />
                  </div>
                  <div className="flex flex-col gap-2">
                    {sortedPassives.filter(p => p.passive_type === 'battle').map(passive => (
                      <PassiveCard key={passive.id} passive={passive} />
                    ))}
                  </div>
                </>
              )}
              {/* 서포트 패시브 */}
              {sortedPassives.filter(p => p.passive_type === 'support').length > 0 && (
                <>
                  <div className="flex items-center gap-3 my-3">
                    <div className="flex-1" style={{ height: '1px', background: 'linear-gradient(90deg, transparent 0%, rgba(200,144,10,0.3) 100%)' }} />
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.2em', color: '#c8900a', fontFamily: 'var(--font-heading)' }}>서포트 패시브</span>
                    <div className="flex-1" style={{ height: '1px', background: 'linear-gradient(90deg, rgba(200,144,10,0.3) 0%, transparent 100%)' }} />
                  </div>
                  <div className="flex flex-col gap-2">
                    {sortedPassives.filter(p => p.passive_type === 'support').map(passive => (
                      <PassiveCard key={passive.id} passive={passive} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ── 정신력 탭 ────────────────────────────────────────── */}
      {activeTab === 'sanity' && (
        <div className="px-5 py-3">
          {!panicInfo && sanityConditions.length === 0 ? (
            <p style={{ color: '#5a5070', fontSize: '0.75rem', fontStyle: 'italic' }}>정신력 정보 없음</p>
          ) : (
            <div className="flex flex-col gap-3">
              {/* 패닉 타입 */}
              {panicInfo && (
                <div>
                  <div className="mb-2">
                    <span style={{
                      display: 'inline-block',
                      fontSize: '0.6875rem', fontWeight: 800, letterSpacing: '0.1em',
                      color: '#80c9ff', border: '1px solid rgba(128,201,255,0.5)',
                      padding: '1px 6px', fontFamily: 'var(--font-heading)',
                    }}>
                      패닉 타입
                    </span>
                  </div>
                  <div className="flex items-start gap-3 mb-2">
                    <div className="flex-shrink-0">
                      <Image
                        src={panicInfo.name === '사랑과 증오' ? PANIC_LOVE_HATE_URL : PANIC_IMG_URL}
                        alt="패닉"
                        width={64}
                        height={64}
                        style={{ width: '4rem', height: 'auto', filter: 'drop-shadow(0 0 6px rgba(200,60,60,0.5))' }}
                      />
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <div style={{ fontSize: '0.6875rem', fontWeight: 800, letterSpacing: '0.06em', color: '#d4a050', marginBottom: '0.25rem', fontFamily: 'var(--font-heading)' }}>
                        · 패닉 효과
                      </div>
                      {panicInfo.description && (
                        <p style={{ color: '#cccccc', fontSize: '0.6875rem', lineHeight: 1.75 }}>
                          {panicInfo.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="font-serif font-bold" style={{ color: '#e04040', fontSize: '1.125rem', lineHeight: 1.2, textShadow: '0 0 12px rgba(220,60,60,0.35)' }}>
                    {panicInfo.name}
                  </div>
                </div>
              )}

              {/* 기본 정신력 증가 조건 */}
              {sanityConditions.filter(c => c.condition_type === 'increase').length > 0 && (
                <div className="relative overflow-hidden">
                  <div style={{ position: 'absolute', right: '-4px', bottom: '-4px', opacity: 0.07, pointerEvents: 'none' }}>
                    <Image src={SANITY_INCREASE_BG} alt="" width={80} height={80} style={{ height: '5rem', width: 'auto' }} />
                  </div>
                  <div className="mb-1.5">
                    <span style={{
                      display: 'inline-block',
                      fontSize: '0.6875rem', fontWeight: 800, letterSpacing: '0.08em',
                      color: '#80c9ff', border: '1px solid rgba(128,201,255,0.5)',
                      padding: '1px 6px', fontFamily: 'var(--font-heading)',
                    }}>
                      기본 정신력 증가 조건
                    </span>
                  </div>
                  <div className="relative" style={{ color: '#cccccc', fontSize: '0.6875rem', lineHeight: 1.85, whiteSpace: 'pre-line' }}>
                    {sanityConditions.filter(c => c.condition_type === 'increase').map((c, i) => (
                      <div key={`inc-${i}`}>{renderSanityText(c.text, '#80c9ff')}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* 기본 정신력 감소 조건 */}
              {sanityConditions.filter(c => c.condition_type === 'decrease').length > 0 && (
                <div className="relative overflow-hidden">
                  <div style={{ position: 'absolute', right: '-4px', bottom: '-4px', opacity: 0.07, pointerEvents: 'none' }}>
                    <Image src={SANITY_DECREASE_BG} alt="" width={80} height={80} style={{ height: '5rem', width: 'auto' }} />
                  </div>
                  <div className="mb-1.5">
                    <span style={{
                      display: 'inline-block',
                      fontSize: '0.6875rem', fontWeight: 800, letterSpacing: '0.08em',
                      color: '#fe4b48', border: '1px solid rgba(254,75,72,0.5)',
                      padding: '1px 6px', fontFamily: 'var(--font-heading)',
                    }}>
                      기본 정신력 감소 조건
                    </span>
                  </div>
                  <div className="relative" style={{ color: '#cccccc', fontSize: '0.6875rem', lineHeight: 1.85, whiteSpace: 'pre-line' }}>
                    {sanityConditions.filter(c => c.condition_type === 'decrease').map((c, i) => (
                      <div key={`dec-${i}`}>{renderSanityText(c.text, '#fe4b48')}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── SkillCard ─────────────────────────────────────────────────────────────
function SkillCard({
  skill,
  identity,
  skills,
  lang,
}: {
  skill: SkillData
  identity: IdentityData
  skills: SkillData[]
  lang?: string
}) {
  const flavor = localizedText(lang, skill.flavor, skill.flavor_en, skill.flavor_jp)

  return (
    <div>
      <IdentitySkillFrameCard
        skill={skill}
        skills={skills}
        identity={identity}
        lang={lang}
      />
      {flavor && (
        <div style={{ marginTop: '0.25rem', paddingLeft: '0.625rem' }}>
          <SkillDescription
            description=""
            accentColor={sinColor(skill.sin_affinity)}
            variant="compact"
            flavorText={flavor}
          />
        </div>
      )}
    </div>
  )
}

// ── PassiveCard ───────────────────────────────────────────────────────────
function PassiveCard({ passive }: { passive: PassiveData }) {
  const lang = useLocale()
  const sinNames = passive.sin_affinity ? passive.sin_affinity.split(',').map(s => s.trim()) : []
  // DB에 영문(pride) 또는 한글(오만) 둘 다 올 수 있음
  const ALL_SINS = new Set(['wrath','lust','sloth','gluttony','gloom','pride','envy'])
  const sinTypes = sinNames.map(s => ALL_SINS.has(s) ? s : SIN_KR_TO_EN[s]).filter(Boolean) as SinType[]
  const pc = sinTypes[0] ? (SIN_COLORS[sinTypes[0]] ?? '#cccccc') : '#cccccc'
  const passiveName = localizedText(lang, passive.name, passive.name_en, passive.name_jp) ?? passive.name
  const passiveDescription = localizedText(lang, passive.description, passive.description_en, passive.description_jp)
  const passiveFlavor = localizedText(lang, passive.flavor, passive.flavor_en, passive.flavor_jp)

  return (
    <div className="py-1.5">
      {/* 패시브 이름 — 사선 꼬리 배너 */}
      <div className="overflow-hidden mb-2" style={{ width: 'fit-content', maxWidth: '100%' }}>
        <div style={{
          color: '#e8dcc8',
          backgroundImage: `linear-gradient(255deg, transparent 1.5em, ${pc}30 1.5em)`,
        }}>
          <div style={{
            padding: '0.25em 0 0.25em 0.4em',
            backgroundImage: `linear-gradient(290deg, transparent 2.5em, ${pc}35 2.5em, ${pc}35 2.65em, transparent 2.65em, transparent 2.8em, ${pc}35 2.8em, ${pc}35 2.95em, transparent 2.95em, transparent 3.1em, ${pc}35 3.1em, ${pc}35 3.25em, transparent 3.25em, transparent 3.4em, ${pc}35 3.4em)`,
            textShadow: '1px 1px 3px rgba(0,0,0,0.7)',
          }}>
            <span className="font-bold whitespace-nowrap" style={{
              fontSize: '0.875rem', fontFamily: 'var(--font-heading)', fontWeight: 800,
              paddingRight: '4em',
            }}>
              {passiveName}
            </span>
          </div>
        </div>
      </div>

      {/* 발동 조건: 죄악 아이콘 + x수 + 공명/보유 */}
      {(sinTypes.length > 0 || passive.active_cond) && (
        <div className="flex items-center gap-2 mb-2">
          {sinTypes.map((st, i) => (
            <Image key={i} src={sinIconUrl(st)} alt="" width={22} height={22}
              style={{ width: '1.375rem', height: '1.375rem', filter: `drop-shadow(0 0 4px ${SIN_COLORS[st]}80)` }} />
          ))}
          {sinTypes.length > 0 && passive.sin_count != null && (
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.8125rem', fontWeight: 700, color: '#e8dcc8' }}>
              x{passive.sin_count}
            </span>
          )}
          {passive.active_cond && (
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.8125rem', fontWeight: 700, color: '#e8dcc8' }}>
              {passive.active_cond === 'resonance' ? '공명' : passive.active_cond === 'stock' ? '보유' : passive.active_cond}
            </span>
          )}
        </div>
      )}

      {/* 설명 */}
      {(passiveDescription || passiveFlavor) && (
        <SkillDescription
          description={passiveDescription ?? ''}
          accentColor={pc}
          variant="compact"
          flavorText={passiveFlavor}
        />
      )}
    </div>
  )
}
