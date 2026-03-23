'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { X } from 'lucide-react'
import { STORAGE_BASE, GRADE_COLORS } from '@/lib/constants/game'
import { SIN_COLORS, SIN_ORDER, SIN_LABELS_KR, getSinIconUrl, normalizeSin } from '@/lib/constants/sin'
import type { SinType } from '@/lib/types'
import SkillDescription from '@/components/skill/SkillDescription'

// ── 타입 ──────────────────────────────────────────────────────────────────
type EgoSkillData = {
  id: string
  name: string
  skill_type: string
  sin_affinity: string
  base_power: number
  coins: number
  coin_power: number
  description: string | null
  category: string
  construe_level: number | null
  offense_level: number | null
  atk_weight: number | null
}

type EgoData = {
  id: string
  sinner_id: string
  name: string
  name_kr: string | null
  grade: string
  sin_affinity: string | null
  folder_name: string | null
  image_url: string | null
  passive_name: string | null
  passive_content: string | null
  resistance: string[] | null
  cost: number[] | null
  resistances: Record<string, string>
  costs: Record<string, number>
  keywords: string[] | null
  description: string | null
  corrosion_risk: string | null
}

type ApiResponse = {
  ego: EgoData
  sinner_name: string | null
  skills: EgoSkillData[]
}

// ── 상수 ──────────────────────────────────────────────────────────────────
const RES_STYLE: Record<string, { color: string; label: string }> = {
  '내성': { color: '#4488dd', label: '내성' },
  '견딤': { color: '#4488dd', label: '견딤' },
  'resist': { color: '#4488dd', label: '내성' },
  '보통': { color: '#667788', label: '보통' },
  'normal': { color: '#667788', label: '보통' },
  '취약': { color: '#e06070', label: '취약' },
  'weak': { color: '#e06070', label: '취약' },
  '치명': { color: '#e04040', label: '치명' },
  'fatal': { color: '#e04040', label: '치명' },
  '무효': { color: '#40c060', label: '무효' },
  '면역': { color: '#40c060', label: '면역' },
  'immune': { color: '#40c060', label: '무효' },
}


// ── 헬퍼 ──────────────────────────────────────────────────────────────────
function sinColor(sin: string): string {
  return SIN_COLORS[sin as SinType] ?? '#cccccc'
}

function sinIconUrl(sin: string): string {
  const normalized = normalizeSin(sin)
  if (normalized) return getSinIconUrl(normalized)
  const cap = sin.charAt(0).toUpperCase() + sin.slice(1)
  return `${STORAGE_BASE}/icons/Sins/transparent/${cap}.webp`
}

function bestConstrue<T extends { construe_level: number | null; name: string }>(items: T[]): T[] {
  const groups = new Map<string, T>()
  for (const item of items) {
    const ex = groups.get(item.name)
    if (!ex || (item.construe_level ?? 3) > (ex.construe_level ?? 3)) {
      groups.set(item.name, item)
    }
  }
  return [...groups.values()]
}

// ── 컴포넌트 ──────────────────────────────────────────────────────────────
interface EgoDetailModalProps {
  egoId: string
  onClose: () => void
}

export default function EgoDetailModal({ egoId, onClose }: EgoDetailModalProps) {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/ego/${egoId}`)
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then((d: ApiResponse) => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setError('데이터를 불러올 수 없습니다') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [egoId])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

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
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />

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
  const { ego, sinner_name, skills } = data

  const gradeColor = GRADE_COLORS[ego.grade] ?? '#667788'
  const sinType = normalizeSin(ego.sin_affinity)
  const egoSinColor = sinType ? SIN_COLORS[sinType] : gradeColor

  // 4해석 우선 스킬
  const awakening = bestConstrue(skills.filter(s => s.category === 'awakening'))
  const corrosion = bestConstrue(skills.filter(s => s.category === 'corrosion'))

  // 내성 배열 (API에서 resistances 객체로 변환됨)
  const resistances = SIN_ORDER.map(sin => ({
    sin,
    value: ego.resistances?.[sin] ?? '보통',
  }))

  // 코스트 배열 (0이 아닌 것만)
  const costs = SIN_ORDER
    .map(sin => ({ sin, amount: ego.costs?.[sin] ?? 0 }))
    .filter(c => c.amount > 0)

  return (
    <div>
      {/* ── 헤더 ──────────────────────────────────────────────── */}
      <div className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${gradeColor}12 0%, transparent 60%)` }}>
        <div className="flex gap-3 p-5 pb-4">
          {ego.image_url && (
            <div className="flex-shrink-0 rounded-lg overflow-hidden" style={{ width: '4.5rem', height: '4.5rem', border: `1px solid ${gradeColor}40` }}>
              <Image
                src={ego.image_url} alt={ego.name_kr ?? ego.name}
                width={72} height={72}
                style={{ width: '4.5rem', height: '4.5rem', objectFit: 'cover', objectPosition: 'center top' }}
              />
            </div>
          )}
          <div className="flex-1 min-w-0 pt-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-serif" style={{ color: '#e8dcc8', fontSize: '1.0625rem', lineHeight: 1.2 }}>
                {ego.name_kr ?? ego.name}
              </span>
            </div>
            {sinner_name && (
              <p style={{ color: '#8a7050', fontSize: '0.75rem', fontFamily: 'var(--font-body)', marginBottom: '0.375rem' }}>
                {sinner_name}
              </p>
            )}
            <div className="flex items-center gap-2">
              {/* 등급 이미지 */}
              {['ZAYIN','TETH','HE','WAW'].includes(ego.grade) ? (
                <Image src={`${STORAGE_BASE}/icons/grade/${ego.grade}.webp`} alt={ego.grade} width={40} height={14} unoptimized
                  style={{ height: '0.875rem', width: 'auto', opacity: 0.9 }} />
              ) : (
                <span className="px-1.5 py-0.5 rounded" style={{ background: `${gradeColor}18`, color: gradeColor, border: `1px solid ${gradeColor}38`, fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 600 }}>
                  {ego.grade}
                </span>
              )}
              {/* 죄악 아이콘 */}
              {sinType && (
                <Image src={getSinIconUrl(sinType)} alt={SIN_LABELS_KR[sinType]} width={16} height={16}
                  style={{ width: '1rem', height: '1rem', opacity: 0.8 }} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 내성 & 코스트 ──────────────────────────────────────── */}
      <div className="px-5 py-3" style={{ borderTop: '1px solid rgba(32,20,8,0.7)', borderBottom: '1px solid rgba(32,20,8,0.7)' }}>
        {/* 죄악 내성 */}
        <p style={{ color: '#888', fontSize: '0.6875rem', marginBottom: '0.375rem', fontFamily: 'var(--font-heading)' }}>죄악 내성</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {resistances.map(({ sin, value }) => {
            const rs = RES_STYLE[value] ?? { color: '#667788', label: value }
            const sc = SIN_COLORS[sin]
            return (
              <span key={sin} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: `${rs.color}15`, color: rs.color, border: `1px solid ${rs.color}30`, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                <Image src={getSinIconUrl(sin)} alt="" width={14} height={14}
                  style={{ width: '0.875rem', height: '0.875rem', filter: `drop-shadow(0 0 2px ${sc}60)` }} />
                <strong>{rs.label}</strong>
              </span>
            )
          })}
        </div>

        {/* 코스트 */}
        {costs.length > 0 && (
          <>
            <p style={{ color: '#888', fontSize: '0.6875rem', marginBottom: '0.375rem', fontFamily: 'var(--font-heading)' }}>코스트</p>
            <div className="flex flex-wrap gap-2">
              {costs.map(({ sin, amount }) => {
                const sc = SIN_COLORS[sin]
                return (
                  <span key={sin} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: `${sc}15`, color: sc, border: `1px solid ${sc}30`, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                    <Image src={getSinIconUrl(sin)} alt="" width={14} height={14}
                      style={{ width: '0.875rem', height: '0.875rem', filter: `drop-shadow(0 0 2px ${sc}60)` }} />
                    <strong>{amount}</strong>
                  </span>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* ── 패시브 섹션 ──────────────────────────────────────── */}
      {ego.passive_name && (
        <Section title="패시브">
          <div className="p-2.5 rounded" style={{ background: `${egoSinColor}08`, border: `1px solid ${egoSinColor}20` }}>
            <div className="flex items-center gap-2 mb-1">
              <span style={{ color: egoSinColor, fontSize: '0.75rem', fontWeight: 600 }}>{ego.passive_name}</span>
            </div>
            {ego.passive_content && (
              <div style={{ marginTop: '0.25rem', borderTop: `1px solid ${egoSinColor}15`, paddingTop: '0.375rem' }}>
                <SkillDescription description={ego.passive_content} accentColor={egoSinColor} variant="compact" />
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ── 각성 스킬 섹션 ────────────────────────────────────── */}
      {awakening.length > 0 && (
        <Section title="각성 스킬">
          <div className="flex flex-col gap-2">
            {awakening.map(skill => (
              <EgoSkillCard key={skill.id} skill={skill} gradeColor={egoSinColor} />
            ))}
          </div>
        </Section>
      )}

      {/* ── 침식 스킬 섹션 ────────────────────────────────────── */}
      {corrosion.length > 0 && (
        <Section title="침식 스킬">
          <div className="flex flex-col gap-2">
            {corrosion.map(skill => (
              <EgoSkillCard key={skill.id} skill={skill} gradeColor="#cc4444" isCorrosion />
            ))}
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

// ── EgoSkillCard ──────────────────────────────────────────────────────────
function EgoSkillCard({ skill, gradeColor, isCorrosion }: { skill: EgoSkillData; gradeColor: string; isCorrosion?: boolean }) {
  const sc = sinColor(skill.sin_affinity)
  const accentColor = isCorrosion ? '#cc4444' : gradeColor
  const coinPowerStr = skill.coin_power >= 0 ? `+${skill.coin_power}` : `${skill.coin_power}`
  const maxPower = skill.coin_power < 0 ? skill.base_power : skill.base_power + skill.coins * skill.coin_power

  return (
    <div className="p-2.5 rounded" style={{ background: `${accentColor}08`, border: `1px solid ${accentColor}25` }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', padding: '0.125rem 0.375rem', borderRadius: '0.1875rem', background: isCorrosion ? 'rgba(180,20,20,0.15)' : `${accentColor}20`, color: isCorrosion ? '#cc4444' : accentColor, border: `1px solid ${isCorrosion ? 'rgba(180,20,20,0.3)' : accentColor + '40'}` }}>
            {isCorrosion ? '침식' : '각성'}
          </span>
          <span className="truncate" style={{ color: accentColor, fontSize: '0.75rem', fontWeight: 600 }}>{skill.name}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Image src={sinIconUrl(skill.sin_affinity)} alt="" width={14} height={14} style={{ width: '0.875rem', height: '0.875rem', opacity: 0.7 }} />
        </div>
      </div>

      {/* 수치 */}
      <div className="flex items-center gap-3 mb-1" style={{ fontSize: '0.6875rem', color: '#999' }}>
        <span>위력 <strong style={{ color: accentColor, fontFamily: 'var(--font-mono)' }}>{skill.base_power}</strong></span>
        <span>코인 <strong style={{ color: '#c8900a', fontFamily: 'var(--font-mono)' }}>{skill.coins}</strong></span>
        <span>코인위력 <strong style={{ color: accentColor, fontFamily: 'var(--font-mono)' }}>{coinPowerStr}</strong></span>
        {skill.atk_weight != null && skill.atk_weight !== 1 && (
          <span>가중치 <strong style={{ color: '#d0a020', fontFamily: 'var(--font-mono)' }}>{skill.atk_weight}</strong></span>
        )}
        <span style={{ marginLeft: 'auto' }}>최대 <strong style={{ color: '#e8dcc8', fontFamily: 'var(--font-mono)' }}>{maxPower}</strong></span>
      </div>

      {/* 스킬 설명 */}
      {skill.description && (
        <div style={{ marginTop: '0.375rem', borderTop: `1px solid ${accentColor}15`, paddingTop: '0.375rem' }}>
          <SkillDescription description={skill.description} accentColor={accentColor} variant="compact" />
        </div>
      )}
    </div>
  )
}
