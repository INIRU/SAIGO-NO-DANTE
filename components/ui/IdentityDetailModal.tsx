'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { X } from 'lucide-react'
import { STORAGE_BASE, ATK_TYPE_ICON_MAP, RARITY_ICON_MAP } from '@/lib/constants/game'
import { SIN_COLORS, SIN_KR_TO_EN } from '@/lib/constants/sin'
import type { SinType } from '@/lib/types'
import { computeSkillImageIndices } from '@/lib/utils/images'
import SkillDescription from '@/components/skill/SkillDescription'

// ── 타입 ──────────────────────────────────────────────────────────────────
type SkillData = {
  id: string
  name: string
  skill_type: string
  sin_affinity: string
  coins: number
  base_power: number
  coin_power: number
  description: string | null
  skill_order: number
  atk_weight: number | null
  offense_level: number | null
  uptie_level: number | null
  variant_order: number | null
}

type PassiveData = {
  id: string
  name: string
  passive_type: string
  sin_affinity: string | null
  sin_count: number | null
  active_cond: string | null
  description: string
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
  slash_res: string | null
  pierce_res: string | null
  blunt_res: string | null
  panic_type: string | number | null
  sanity_increase: string | null
  sanity_decrease: string | null
  break_section: number[] | null
  game_id: string | null
  folder_name: string | null
}

type ApiResponse = {
  identity: IdentityData
  sinner_name: string | null
  skills: SkillData[]
  passives: PassiveData[]
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

const PANIC_LABELS: Record<string, string> = {
  panic: '패닉', '1': '패닉',
  reverb_base: '역공진', '2': '역공진',
}

const SIN_LABELS: Record<string, string> = {
  wrath: '분노', lust: '색욕', sloth: '나태', gluttony: '탐식',
  gloom: '우울', pride: '오만', envy: '질투',
}

// ── 헬퍼 ──────────────────────────────────────────────────────────────────
function sinColor(sin: string): string {
  return SIN_COLORS[sin as SinType] ?? '#cccccc'
}

function sinIconUrl(sin: string): string {
  const cap = sin.charAt(0).toUpperCase() + sin.slice(1)
  return `${STORAGE_BASE}/icons/Sins/transparent/${cap}.webp`
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

  // ESC 키로 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // 스크롤 방지
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleBackdrop = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdrop}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />

      <div
        className="relative w-full overflow-y-auto rounded-xl"
        style={{
          maxWidth: '32rem',
          maxHeight: '85vh',
          background: '#131110',
          border: '1px solid rgba(200,144,10,0.15)',
          boxShadow: '0 0 3rem rgba(200,144,10,0.05), 0 1.5rem 4rem rgba(0,0,0,0.6)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
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
    </div>
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

// ── 모달 본문 ─────────────────────────────────────────────────────────────
function ModalContent({ data }: { data: ApiResponse }) {
  const { identity, sinner_name, skills, passives } = data

  // 4동기화 우선 스킬
  const sortedSkills = bestUptie(skills, s => `${s.skill_order}:${s.variant_order ?? 0}`)
    .sort((a, b) => a.skill_order - b.skill_order || (a.variant_order ?? 0) - (b.variant_order ?? 0))

  // 4동기화 우선 패시브
  const sortedPassives = bestUptie(passives, p => `${p.passive_type}:${p.passive_order}`)
    .sort((a, b) => a.passive_order - b.passive_order)

  const atkSkills = sortedSkills.filter(s => !['evade', 'defense', 'counter'].includes(s.skill_type))
  const defSkills = sortedSkills.filter(s => ['evade', 'defense', 'counter'].includes(s.skill_type))
  const skillImageIdx = computeSkillImageIndices(sortedSkills)

  const rarityColor = identity.rarity === 3 ? '#c8900a' : identity.rarity === 2 ? '#4898b0' : '#667788'

  const portraitUrl = identity.game_id && identity.folder_name
    ? `${STORAGE_BASE}/sinners/${identity.sinner_id}/identities/${encodeURIComponent(identity.folder_name)}/${identity.game_id}_normal_info.webp`
    : null

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
            {identity.keywords && identity.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {identity.keywords.map(kw => (
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

      {/* ── 스킬 섹션 ────────────────────────────────────────── */}
      <Section title="스킬">
        {atkSkills.length === 0 && defSkills.length === 0 ? (
          <p style={{ color: '#5a5070', fontSize: '0.75rem', fontStyle: 'italic' }}>스킬 정보 없음</p>
        ) : (
          <div className="flex flex-col gap-2">
            {atkSkills.map(skill => (
              <SkillCard key={skill.id} skill={skill} identity={identity} skillImageIdx={skillImageIdx} atkSkills={atkSkills} />
            ))}
            {defSkills.map(skill => (
              <SkillCard key={skill.id} skill={skill} identity={identity} skillImageIdx={skillImageIdx} isDefense />
            ))}
          </div>
        )}
      </Section>

      {/* ── 패시브 섹션 ──────────────────────────────────────── */}
      <Section title="패시브">
        {sortedPassives.length === 0 ? (
          <p style={{ color: '#5a5070', fontSize: '0.75rem', fontStyle: 'italic' }}>패시브 정보 없음</p>
        ) : (
          <div className="flex flex-col gap-2">
            {sortedPassives.map(passive => (
              <PassiveCard key={passive.id} passive={passive} />
            ))}
          </div>
        )}
      </Section>

      {/* ── 정신력 / 패닉 ─────────────────────────────────────── */}
      {(identity.panic_type || identity.sanity_increase || identity.sanity_decrease) && (
        <Section title="정신력">
          <div className="flex flex-col gap-2">
            {identity.panic_type && (
              <div className="flex items-center gap-2 p-2 rounded" style={{ background: 'rgba(200,64,80,0.08)', border: '1px solid rgba(200,64,80,0.2)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', padding: '0.125rem 0.375rem', borderRadius: '0.1875rem', fontWeight: 600, background: 'rgba(200,64,80,0.15)', color: '#c84050', border: '1px solid rgba(200,64,80,0.3)' }}>
                  패닉
                </span>
                <span style={{ color: '#c84050', fontSize: '0.75rem', fontWeight: 600 }}>
                  {PANIC_LABELS[String(identity.panic_type)] ?? identity.panic_type}
                </span>
              </div>
            )}
            {identity.sanity_increase && (
              <div className="p-2 rounded" style={{ background: 'rgba(136,168,48,0.08)', border: '1px solid rgba(136,168,48,0.2)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', padding: '0.125rem 0.375rem', borderRadius: '0.1875rem', fontWeight: 600, background: 'rgba(136,168,48,0.15)', color: '#88a830', border: '1px solid rgba(136,168,48,0.3)' }}>
                    회복
                  </span>
                </div>
                <div style={{ fontSize: '0.6875rem', lineHeight: 1.7, color: '#88a830', whiteSpace: 'pre-wrap' }}>
                  {identity.sanity_increase}
                </div>
              </div>
            )}
            {identity.sanity_decrease && (
              <div className="p-2 rounded" style={{ background: 'rgba(224,96,112,0.08)', border: '1px solid rgba(224,96,112,0.2)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', padding: '0.125rem 0.375rem', borderRadius: '0.1875rem', fontWeight: 600, background: 'rgba(224,96,112,0.15)', color: '#e06070', border: '1px solid rgba(224,96,112,0.3)' }}>
                    감소
                  </span>
                </div>
                <div style={{ fontSize: '0.6875rem', lineHeight: 1.7, color: '#e06070', whiteSpace: 'pre-wrap' }}>
                  {identity.sanity_decrease}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}
    </div>
  )
}

// ── Section 래퍼 ──────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(32,20,8,0.5)' }}>
      <h3 className="font-serif mb-2" style={{ color: '#c8900a', fontSize: '0.8125rem', letterSpacing: '0.05em' }}>
        {title}
      </h3>
      {children}
    </div>
  )
}

// ── SkillCard ─────────────────────────────────────────────────────────────
function SkillCard({
  skill,
  identity,
  skillImageIdx,
  atkSkills,
  isDefense,
}: {
  skill: SkillData
  identity: IdentityData
  skillImageIdx: Record<string, number>
  atkSkills?: SkillData[]
  isDefense?: boolean
}) {
  const sc = sinColor(skill.sin_affinity)
  const coinPowerStr = skill.coin_power >= 0 ? `+${skill.coin_power}` : `${skill.coin_power}`
  const maxPower = skill.coin_power < 0 ? skill.base_power : skill.base_power + skill.coins * skill.coin_power

  // 스킬 라벨 계산
  let skillLabel: string
  if (isDefense) {
    const typeLabels: Record<string, string> = { evade: '회피', defense: '수비', counter: '반격' }
    skillLabel = typeLabels[skill.skill_type] ?? '수비'
  } else {
    const orderCount: Record<number, number> = {}
    if (atkSkills) {
      for (const s of atkSkills) orderCount[s.skill_order] = (orderCount[s.skill_order] ?? 0) + 1
    }
    const hasVariants = (orderCount[skill.skill_order] ?? 1) > 1
    if (hasVariants) {
      const idx = atkSkills?.filter(s => s.skill_order === skill.skill_order).indexOf(skill) ?? 0
      skillLabel = `S${skill.skill_order}-${idx + 1}`
    } else {
      skillLabel = `S${skill.skill_order}`
    }
  }

  const imgIdx = skillImageIdx[skill.id] ?? skill.skill_order
  const iconUrl = identity.game_id
    ? `${STORAGE_BASE}/icons/skills/${identity.sinner_id}/${identity.game_id}${String(imgIdx).padStart(2, '0')}.webp`
    : null

  return (
    <div className="p-2.5 rounded" style={{ background: `${sc}08`, border: `1px solid ${sc}25` }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {iconUrl && (
            <Image src={iconUrl} alt="" width={20} height={20}
              style={{ width: '1.25rem', height: '1.25rem', borderRadius: '0.1875rem', border: `1px solid ${sc}40`, flexShrink: 0 }} />
          )}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', padding: '0.125rem 0.375rem', borderRadius: '0.1875rem', background: `${sc}20`, color: sc, border: `1px solid ${sc}40` }}>
            {skillLabel}
          </span>
          <span className="truncate" style={{ color: sc, fontSize: '0.75rem', fontWeight: 600 }}>{skill.name}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Image src={sinIconUrl(skill.sin_affinity)} alt="" width={14} height={14} style={{ width: '0.875rem', height: '0.875rem', opacity: 0.7 }} />
          {ATK_TYPE_ICON_MAP[skill.skill_type] && (
            <Image src={ATK_TYPE_ICON_MAP[skill.skill_type]} alt="" width={14} height={14} style={{ width: '0.875rem', height: '0.875rem', opacity: 0.6 }} />
          )}
        </div>
      </div>

      {/* 수치 */}
      <div className="flex items-center gap-3 mb-1" style={{ fontSize: '0.6875rem', color: '#999' }}>
        <span>위력 <strong style={{ color: sc, fontFamily: 'var(--font-mono)' }}>{skill.base_power}</strong></span>
        <span>코인 <strong style={{ color: '#c8900a', fontFamily: 'var(--font-mono)' }}>{skill.coins}</strong></span>
        <span>코인위력 <strong style={{ color: sc, fontFamily: 'var(--font-mono)' }}>{coinPowerStr}</strong></span>
        {skill.atk_weight != null && skill.atk_weight !== 1 && (
          <span>가중치 <strong style={{ color: '#d0a020', fontFamily: 'var(--font-mono)' }}>{skill.atk_weight}</strong></span>
        )}
        <span style={{ marginLeft: 'auto' }}>최대 <strong style={{ color: '#e8dcc8', fontFamily: 'var(--font-mono)' }}>{maxPower}</strong></span>
      </div>

      {/* 스킬 설명 */}
      {skill.description && (
        <div style={{ marginTop: '0.375rem', borderTop: `1px solid ${sc}15`, paddingTop: '0.375rem' }}>
          <SkillDescription description={skill.description} accentColor={sc} variant="compact" />
        </div>
      )}
    </div>
  )
}

// ── PassiveCard ───────────────────────────────────────────────────────────
function PassiveCard({ passive }: { passive: PassiveData }) {
  const isBattle = passive.passive_type === 'battle'
  const sinNames = passive.sin_affinity ? passive.sin_affinity.split(',').map(s => s.trim()) : []
  const sinTypes = sinNames.map(s => SIN_KR_TO_EN[s]).filter(Boolean) as SinType[]
  const pc = sinTypes[0] ? (SIN_COLORS[sinTypes[0]] ?? '#cccccc') : '#cccccc'

  return (
    <div className="p-2.5 rounded" style={{ background: `${pc}08`, border: `1px solid ${pc}20` }}>
      <div className="flex items-center gap-2 mb-1">
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', padding: '0.125rem 0.375rem',
          borderRadius: '0.1875rem', fontWeight: 600,
          background: isBattle ? 'rgba(200,64,80,0.15)' : 'rgba(72,120,160,0.15)',
          color: isBattle ? '#c84050' : '#4898b0',
          border: `1px solid ${isBattle ? 'rgba(200,64,80,0.3)' : 'rgba(72,120,160,0.3)'}`,
        }}>
          {isBattle ? '배틀' : '서포트'}
        </span>
        <span style={{ color: pc, fontSize: '0.75rem', fontWeight: 600 }}>{passive.name}</span>
      </div>

      {/* 죄악 조건 */}
      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
        {sinTypes.map((st, i) => (
          <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: `${SIN_COLORS[st]}15`, border: `1px solid ${SIN_COLORS[st]}30` }}>
            <Image src={sinIconUrl(st)} alt="" width={14} height={14}
              style={{ width: '0.875rem', height: '0.875rem', filter: `drop-shadow(0 0 2px ${SIN_COLORS[st] ?? pc}60)` }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: SIN_COLORS[st] }}>
              {SIN_LABELS[st] ?? st}
            </span>
          </span>
        ))}
        {sinTypes.length > 0 && passive.sin_count != null && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, color: pc }}>x{passive.sin_count}</span>
        )}
        {passive.active_cond && (
          <span style={{ fontSize: '0.6875rem', padding: '0.125rem 0.5rem', borderRadius: '0.1875rem', background: `${pc}18`, color: pc, border: `1px solid ${pc}35`, fontWeight: 600 }}>
            {passive.active_cond === 'resonance' ? '공명' : passive.active_cond === 'stock' ? '보유' : passive.active_cond}
          </span>
        )}
      </div>

      {passive.description && (
        <div style={{ marginTop: '0.25rem', borderTop: `1px solid ${pc}15`, paddingTop: '0.375rem' }}>
          <SkillDescription description={passive.description} accentColor={pc} variant="compact" />
        </div>
      )}
    </div>
  )
}
