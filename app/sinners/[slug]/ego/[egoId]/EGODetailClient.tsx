'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Sinner, EGO, EGOSkill, STORAGE_BASE,
  SIN_COLORS, SinType,
  GRADE_COLORS, SIN_KR_TO_EN, ATK_TYPE_ICON_MAP,
  getSinIconUrl,
  SIN_ORDER,
} from '@/lib/data/sinners'
import { KeywordWithTooltip, useFormatSkillDesc } from '@/components/sinners/KeywordTooltip'

// ─── 상수 ────────────────────────────────────────────────────────────
const RESISTANCE_STYLE: Record<string, { color: string; bg: string }> = {
  '내성': { color: '#4488dd', bg: 'rgba(44,88,180,0.15)' },
  '견딤': { color: '#9966cc', bg: 'rgba(120,80,180,0.15)' },
  '보통': { color: '#556677', bg: 'rgba(60,70,80,0.12)' },
  '취약': { color: '#cc4444', bg: 'rgba(160,40,40,0.15)' },
}

// ─── Grade 이미지 ─────────────────────────────────────────────────────
function GradeImg({ grade, height = 16 }: { grade: string; height?: number }) {
  if (grade === 'ALEPH') return <span style={{ fontFamily: 'monospace', fontSize: `${height - 2}px`, color: '#c83040', letterSpacing: '0.1em' }}>ALEPH</span>
  return <Image src={`${STORAGE_BASE}/icons/grade/${grade}.webp`} alt={grade} width={40} height={height} unoptimized style={{ width: 'auto', height }} />
}

// ─── EGO 스킬 패널 ────────────────────────────────────────────────────
function SkillPanel({ skill, gradeColor, isCor }: { skill: EGOSkill; gradeColor: string; isCor: boolean }) {
  const formatSkillDesc = useFormatSkillDesc()
  const accentColor = isCor ? '#cc4444' : gradeColor
  const resourceSin = SIN_KR_TO_EN[skill.resource]
  const resourceColor = resourceSin ? SIN_COLORS[resourceSin] : '#888'

  // 코인 효과 배열 (coinNum개만)
  const coinEffects = [skill.coin1Effect, skill.coin2Effect, skill.coin3Effect, skill.coin4Effect, skill.coin5Effect]
    .slice(0, skill.coinNum)

  // 파괴 불가 코인 감지 (coinXEffect 첫 줄이 "파괴 불가 코인"이면)
  const unbreakableCoins = new Set<number>()
  coinEffects.forEach((effect, i) => {
    if (effect && effect.startsWith('파괴 불가 코인')) unbreakableCoins.add(i)
  })

  return (
    <div
      className="p-4 rounded"
      style={{
        background: `${accentColor}06`,
        border: `1px solid ${accentColor}30`,
      }}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {/* 공격 타입 아이콘 */}
          {ATK_TYPE_ICON_MAP[skill.atkType] && (
            <Image src={ATK_TYPE_ICON_MAP[skill.atkType]} alt="" width={16} height={16} />
          )}
          <span className="font-semibold" style={{ color: accentColor, fontSize: '0.875rem' }}>
            {skill.name}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* 가중치 */}
          <div className="flex items-center gap-1">
            <span style={{ color: '#666', fontSize: '0.625rem' }}>가중치</span>
            <div className="flex items-center gap-0.5">
              {Array.from({ length: skill.atkWeight }).map((_, i) => (
                <div key={i} className="w-2 h-2 rounded-sm" style={{ background: `${accentColor}50`, border: `1.5px solid ${accentColor}` }} />
              ))}
            </div>
          </div>
          {/* 정신력 소모 */}
          {skill.mentalConsume !== 0 && (
            <span className="font-mono" style={{ color: '#666', fontSize: '0.625rem' }}>
              정신력 -{skill.mentalConsume}
            </span>
          )}
        </div>
      </div>

      {/* 위력 + 자원 */}
      <div className="flex items-center gap-4 mb-2 flex-wrap">
        <div className="flex items-center gap-1">
          <span style={{ color: '#888', fontSize: '0.6875rem' }}>위력</span>
          <span className="font-mono font-bold" style={{ color: accentColor, fontSize: '0.8125rem' }}>{skill.skillPower}</span>
        </div>
        <div className="flex items-center gap-1">
          <span style={{ color: '#888', fontSize: '0.6875rem' }}>코인</span>
          <span className="font-mono font-bold" style={{ color: 'var(--gold)', fontSize: '0.8125rem' }}>{skill.coinNum}</span>
        </div>
        {skill.coinPower !== 0 && (
          <div className="flex items-center gap-1">
            <span style={{ color: '#888', fontSize: '0.6875rem' }}>코인 위력</span>
            <span className="font-mono font-bold" style={{ color: accentColor, fontSize: '0.8125rem' }}>
              {skill.coinPower > 0 ? `+${skill.coinPower}` : skill.coinPower}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1 ml-auto">
          <span style={{ color: '#888', fontSize: '0.6875rem' }}>최대</span>
          <span className="font-mono font-bold" style={{ color: '#e8dcc8', fontSize: '0.8125rem' }}>{skill.power.replace(/\(\d+\)/g, '')}</span>
        </div>
        {/* 죄악 자원 */}
        {resourceSin && (
          <Image src={getSinIconUrl(resourceSin)} alt={skill.resource} width={20} height={20} style={{ filter: `drop-shadow(0 0 3px ${resourceColor}70)` }} />
        )}
      </div>

      {/* 코인 시각화 */}
      <div className="flex items-center gap-1 mb-2">
        {Array.from({ length: skill.coinNum }).map((_, i) => (
          <Image
            key={i}
            src={`${STORAGE_BASE}/icons/stats/${unbreakableCoins.has(i) ? 'unbreakable_coin' : 'coin'}.webp`}
            alt={unbreakableCoins.has(i) ? '파괴 불가 코인' : '코인'}
            width={18}
            height={18}
           
            style={{ filter: `drop-shadow(0 0 2px ${accentColor}60)` }}
          />
        ))}
      </div>

      {/* 일반 효과 */}
      {skill.normalEffect && (
        <div style={{ color: '#888', fontSize: '0.6875rem', lineHeight: 1.8, whiteSpace: 'pre-line', marginBottom: '8px' }}>
          {skill.normalEffect.split('\n').map((line, li) => (
            <div key={li}>{formatSkillDesc(line, accentColor)}</div>
          ))}
        </div>
      )}

      {/* 코인별 효과 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        {coinEffects.map((effect, i) => {
          if (!effect) return null
          const lines = effect.split('\n')
          const isUnbreakable = unbreakableCoins.has(i)
          // "파괴 불가 코인" 첫 줄 제외하고 나머지 렌더
          const displayLines = isUnbreakable ? lines.slice(1) : lines

          return (
            <div key={i}>
              <div style={{ borderTop: `1px solid ${accentColor}18`, margin: '6px 0' }} />
              <div className="flex items-start gap-2">
                {/* 코인 번호 */}
                <div style={{
                  flexShrink: 0, width: '20px', height: '20px', borderRadius: '50%',
                  background: isUnbreakable ? `${accentColor}30` : `${accentColor}18`,
                  border: `1px solid ${accentColor}${isUnbreakable ? '70' : '40'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: accentColor, fontFamily: 'monospace', fontSize: '0.5625rem', fontWeight: 'bold',
                }}>
                  {i + 1}
                </div>
                <div style={{ color: '#888', fontSize: '0.6875rem', lineHeight: 1.8, flex: 1 }}>
                  {isUnbreakable && (
                    <span style={{ color: '#aaa', fontSize: '0.625rem', fontWeight: 600 }}>파괴 불가 코인</span>
                  )}
                  {displayLines.map((line, li) => (
                    <div key={li}>{formatSkillDesc(line, accentColor)}</div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── 입수 방법 배지 ───────────────────────────────────────────────────
function EgoAcquisitionBadges({ text }: { text: string }) {
  const parts = text.split(/\s*\/\s*/)

  const badges: { label: string; color: string; bg: string }[] = []
  let fragmentInfo: string | null = null

  for (const part of parts) {
    const p = part.trim()

    if (p === '기본') {
      badges.push({ label: '기본', color: '#8a8a8a', bg: 'rgba(138,138,138,0.12)' })
    } else if (/^추출\s*\(상시\)$/.test(p)) {
      badges.push({ label: '추출(상시)', color: '#6bbbff', bg: 'rgba(107,187,255,0.12)' })
    } else if (/^추출\s*\(시즌\s*(\d+)\s*이후\)$/.test(p)) {
      const m = p.match(/시즌\s*(\d+)/)
      badges.push({ label: `추출(시즌 ${m?.[1]}~)`, color: '#6bbbff', bg: 'rgba(107,187,255,0.12)' })
    } else if (/이벤트\s*추출/.test(p)) {
      const m = p.match(/시즌\s*(\d+)/)
      badges.push({ label: m ? `이벤트 추출(S${m[1]})` : '이벤트 추출', color: '#ff9f43', bg: 'rgba(255,159,67,0.12)' })
    } else if (/발푸르기스의\s*밤/.test(p)) {
      if (/추출/.test(p)) {
        badges.push({ label: '발푸르기스 추출', color: '#7bed9f', bg: 'rgba(123,237,159,0.12)' })
      } else {
        const m = p.match(/[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+/)
        badges.push({ label: m ? `발푸르기스 ${m[0]}` : '발푸르기스', color: '#7bed9f', bg: 'rgba(123,237,159,0.12)' })
      }
    } else if (/특정\s*추출/.test(p)) {
      const m = p.match(/(.+?)\s*특정\s*추출/)
      badges.push({ label: m ? `${m[1].trim()} 특정 추출` : '특정 추출', color: '#ffa502', bg: 'rgba(255,165,2,0.12)' })
    } else if (/배틀\s*패스/.test(p)) {
      const season = p.match(/시즌\s*(\d+)/)
      const level = p.match(/(\d+)\s*레벨/)
      const paid = /유료/.test(p)
      const label = `${paid ? '유료' : '무료'} 패스${season ? ` S${season[1]}` : ''}${level ? ` Lv.${level[1]}` : ''}`
      badges.push({ label, color: '#a29bfe', bg: 'rgba(162,155,254,0.12)' })
    } else if (/선의의\s*순례/.test(p)) {
      if (/추출/.test(p)) {
        badges.push({ label: '선의의 순례 추출', color: '#ff9f43', bg: 'rgba(255,159,67,0.12)' })
      } else {
        badges.push({ label: '선의의 순례 보상', color: '#ff9f43', bg: 'rgba(255,159,67,0.12)' })
      }
    } else if (/이벤트.*보상|이벤트.*교환/.test(p) || /\d+개\s*(보상|획득)/.test(p)) {
      badges.push({ label: p.replace(/\s*\/.*$/, '').trim(), color: '#ff9f43', bg: 'rgba(255,159,67,0.12)' })
    } else if (/자아\s*파편/.test(p)) {
      // 파편 교환 — 별도 줄로 표시
      const cost = p.match(/(\d+)\s*(개\s*)?교환/)
      const allSeasons = [...p.matchAll(/시즌\s*(\d+)/g)].map(m => m[1])
      if (cost) {
        let detail = `자아 파편 ${cost[1]}`
        if (allSeasons.length > 0) {
          detail += ` (S${allSeasons.join(', S')}~)`
        } else if (/상시/.test(p)) {
          detail += ' (상시)'
        }
        fragmentInfo = detail
      }
    } else {
      // 기타 — 그대로 표시
      badges.push({ label: p, color: '#7a6a5a', bg: 'rgba(122,106,90,0.12)' })
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        {badges.map((b, i) => (
          <span
            key={i}
            style={{
              fontSize: '0.625rem', fontWeight: 600,
              padding: '2px 8px', borderRadius: '3px',
              color: b.color,
              background: b.bg,
              border: `1px solid ${b.color}30`,
            }}
          >
            {b.label}
          </span>
        ))}
      </div>
      {fragmentInfo && (
        <div className="flex items-center gap-2">
          <span style={{ color: '#666', fontSize: '0.625rem', minWidth: '48px' }}>파편 교환</span>
          <span style={{ fontSize: '0.625rem', color: '#aaa' }}>{fragmentInfo}</span>
        </div>
      )}
    </div>
  )
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────
interface Props {
  sinner: Sinner
  ego: EGO
}

export default function EGODetailClient({ sinner, ego }: Props) {
  const formatSkillDesc = useFormatSkillDesc()
  const [skillLevel, setSkillLevel] = useState<3 | 4>(4)
  const [corSkillLevel, setCorSkillLevel] = useState<3 | 4>(4)

  const gradeColor = GRADE_COLORS[ego.grade] ?? '#667788'
  const sinColor = SIN_COLORS[ego.sin_affinity as SinType] ?? gradeColor

  // ego_skills가 단일 객체(JSONB)인 경우 배열로 정규화
  const normalSkillList = Array.isArray(ego.ego_skills) ? ego.ego_skills : ego.ego_skills ? [ego.ego_skills] : []
  const corSkillList = Array.isArray(ego.ego_cor_skills) ? ego.ego_cor_skills : ego.ego_cor_skills ? [ego.ego_cor_skills] : []
  const hasCor = corSkillList.length > 0

  // 이름별 그룹화 후 선택된 해석 레벨 스킬 추출 (다중 스킬 EGO 대응)
  function pickByLevel(list: EGOSkill[], level: 3 | 4): EGOSkill[] {
    const groups: Record<string, EGOSkill[]> = {}
    for (const s of list) {
      if (!groups[s.name]) groups[s.name] = []
      groups[s.name].push(s)
    }
    return Object.values(groups).map(
      group => group.find(s => s.construeLevel === level) ?? group[0]
    )
  }

  const currentSkills = pickByLevel(normalSkillList, skillLevel)
  const currentCorSkills = pickByLevel(corSkillList, corSkillLevel)

  const animRef = useRef(false)
  useEffect(() => {
    if (animRef.current) return
    animRef.current = true
    import('gsap').then(({ gsap }) => {
      gsap.fromTo('.ego-detail-header',
        { opacity: 0, y: -20 },
        { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }
      )
      gsap.fromTo('.ego-detail-content',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.5, delay: 0.2, ease: 'power2.out' }
      )
    })
  }, [])

  return (
    <div className="min-h-screen pb-16" style={{ background: '#0d0b08' }}>

      {/* ─── 히어로 배너 ─── */}
      <div className="ego-detail-header" style={{ position: 'relative', width: '100%', aspectRatio: '16 / 5', overflow: 'hidden', background: '#080604', opacity: 0 }}>
        {ego.image_url && (
          <Image src={ego.image_url} alt="" fill
            style={{ objectFit: 'cover', objectPosition: '50% 10%', filter: 'blur(20px) brightness(0.45)', transform: 'scale(1.1)' }}
            sizes="(max-width: 768px) 90vw, 200px"
          />
        )}
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, rgba(8,6,4,0.75) 0%, ${sinColor}08 50%, rgba(8,6,4,0.7) 100%)` }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '70%', background: 'linear-gradient(to bottom, transparent, #0d0b08)' }} />
        {/* 상단 장식 라인 */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '0.0625rem', background: `linear-gradient(90deg, transparent, ${sinColor}40, transparent)` }} />
        <div style={{ position: 'absolute', bottom: '1.75rem', left: '2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.375rem' }}>
          <GradeImg grade={ego.grade} height={20} />
          <h1 className="font-serif" style={{ fontSize: '2rem', fontWeight: 'bold', color: '#e8b030', lineHeight: 1.1, textShadow: `0 0 2.5rem ${sinColor}60` }}>
            {ego.name_kr || ego.name}
          </h1>
          {ego.name_kr && (
            <p className="font-mono" style={{ fontSize: '0.8125rem', color: '#8a6010', letterSpacing: '0.08em' }}>{ego.name}</p>
          )}
        </div>
      </div>

      {/* ─── 메인 ─── */}
      <div className="ego-detail-content max-w-6xl mx-auto px-6 pt-8" style={{ opacity: 0 }}>

        {/* 브레드크럼 */}
        <div className="mb-8 flex items-center gap-2 text-sm" style={{ color: '#888888' }}>
          <Link href="/sinners" className="hover:text-yellow-300 transition-colors">수감자 목록</Link>
          <span style={{ color: '#333344' }}>&rsaquo;</span>
          <Link href={`/sinners/${sinner.id}`} className="hover:text-yellow-300 transition-colors">{sinner.name_kr}</Link>
          <span style={{ color: '#333344' }}>&rsaquo;</span>
          <span style={{ color: sinColor }}>{ego.name_kr || ego.name}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ─── 좌측 사이드바 (sticky) ─── */}
          <div className="lg:sticky lg:top-24 lg:self-start space-y-5">

            {/* 원형 이미지 */}
            <div className="flex flex-col items-center gap-4">
              <div style={{
                position: 'relative', width: '160px', height: '160px', borderRadius: '50%', overflow: 'hidden',
                border: `3px solid ${sinColor}`, background: '#0d0a06',
                boxShadow: `0 0 0 1px ${sinColor}28, 0 0 40px ${sinColor}40, 0 0 80px ${sinColor}18`,
              }}>
                {ego.image_url ? (
                  <Image src={ego.image_url} alt={ego.name_kr || ego.name} fill className="object-cover" style={{ objectPosition: '50% 10%' }} sizes="(max-width: 768px) 90vw, 200px" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="font-mono text-3xl" style={{ color: gradeColor }}>{ego.grade?.[0]}</span>
                  </div>
                )}
              </div>

              {/* Grade + Sin 배지 */}
              <div className="flex items-center gap-2" style={{ padding: '5px 14px', background: `${gradeColor}12`, border: `1px solid ${gradeColor}35`, borderRadius: '4px' }}>
                <GradeImg grade={ego.grade} height={20} />
                {ego.sin_affinity && (
                  <Image src={getSinIconUrl(ego.sin_affinity as SinType)} alt="" width={20} height={20}
                    style={{ opacity: 0.75, marginLeft: '6px' }} />
                )}
              </div>
            </div>

            {/* 기본 정보 카드 */}
            <div className="card p-4 space-y-4" style={{
              background: 'linear-gradient(180deg, #14120e 0%, #0f0d0a 100%)',
              border: `0.0625rem solid ${sinColor}18`,
              borderRadius: '0.5rem',
              boxShadow: `0 0.75rem 2.5rem rgba(0,0,0,0.35), 0 0 1.5rem ${sinColor}08`,
            }}>
              {/* 죄악 내성 */}
              {ego.resistance && ego.resistance.length === 7 && (
                <div>
                  <p style={{ color: '#666', fontSize: '0.625rem', marginBottom: '8px', letterSpacing: '0.1em' }}>죄악 내성</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {SIN_ORDER.map((sin, i) => {
                      const res = ego.resistance![i] ?? '보통'
                      const rs = RESISTANCE_STYLE[res] ?? RESISTANCE_STYLE['보통']
                      const sc = SIN_COLORS[sin]
                      return (
                        <div key={sin} className="flex items-center gap-1.5">
                          <Image src={getSinIconUrl(sin)} alt="" width={18} height={18}
                            style={{ filter: `drop-shadow(0 0 2px ${sc}60)`, flexShrink: 0 }} />
                          <span className="font-mono" style={{ fontSize: '0.625rem', color: rs.color, fontWeight: 600 }}>
                            {res}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 코스트 */}
              {ego.cost && ego.cost.some(c => c > 0) && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                  <p style={{ color: '#666', fontSize: '0.625rem', marginBottom: '8px', letterSpacing: '0.1em' }}>코스트</p>
                  <div className="flex flex-wrap gap-2">
                    {SIN_ORDER.map((sin, i) => {
                      const amount = ego.cost![i]
                      if (!amount) return null
                      const sc = SIN_COLORS[sin]
                      return (
                        <div key={sin} className="flex items-center gap-1.5"
                          style={{ padding: '4px 10px', background: `${sc}12`, border: `1px solid ${sc}40`, borderRadius: '4px' }}>
                          <Image src={getSinIconUrl(sin)} alt="" width={18} height={18}
                            style={{ filter: `drop-shadow(0 0 3px ${sc}60)` }} />
                          <span className="font-mono font-bold" style={{ fontSize: '0.75rem', color: sc }}>{amount}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 입수 방법 */}
              {ego.obtaining_method && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                  <p style={{ color: '#666', fontSize: '0.625rem', marginBottom: '6px', letterSpacing: '0.1em' }}>입수 방법</p>
                  <EgoAcquisitionBadges text={ego.obtaining_method} />
                </div>
              )}
            </div>

            {/* 뒤로가기 */}
            <Link
              href={`/sinners/${sinner.id}#ego`}
              className="block text-center py-3 font-medium text-sm transition-all duration-300"
              style={{
                background: `linear-gradient(135deg, ${sinColor}08 0%, ${sinColor}03 100%)`,
                border: `0.0625rem solid ${sinColor}20`,
                borderRadius: '0.375rem',
                color: 'var(--gold-dim)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = `${sinColor}45`
                e.currentTarget.style.background = `linear-gradient(135deg, ${sinColor}12 0%, ${sinColor}06 100%)`
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = `${sinColor}20`
                e.currentTarget.style.background = `linear-gradient(135deg, ${sinColor}08 0%, ${sinColor}03 100%)`
              }}
            >
              &larr; {sinner.name_kr}의 EGO 목록으로
            </Link>
          </div>

          {/* ─── 우측 메인 ─── */}
          <div className="lg:col-span-2 space-y-6">

            {/* 패시브 */}
            {ego.passive_name && (
              <div className="card p-6">
                <h2 className="font-serif font-bold mb-4" style={{ color: 'var(--gold)', fontSize: '1rem' }}>패시브</h2>
                <div className="p-4 rounded" style={{ background: `${sinColor}08`, border: `1px solid ${sinColor}30` }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold" style={{ color: sinColor, fontSize: '0.875rem' }}>{ego.passive_name}</span>
                  </div>
                  {ego.passive_content && (
                    <div style={{ color: '#888', fontSize: '0.6875rem', lineHeight: 1.8, whiteSpace: 'pre-line' }}>
                      {ego.passive_content.split('\n').map((line, li) => (
                        <div key={li}>{formatSkillDesc(line, sinColor)}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* EGO 스킬 (일반) */}
            {normalSkillList.length > 0 && (
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h2 className="font-serif font-bold" style={{ color: 'var(--gold)', fontSize: '1rem' }}>EGO 스킬</h2>
                  {/* 3해석 / 4해석 */}
                  <div className="flex rounded overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                    {([3, 4] as const).map(lv => (
                      <button
                        key={lv}
                        onClick={() => setSkillLevel(lv)}
                        className="px-3 py-1.5 text-xs font-semibold transition-all"
                        style={{
                          background: skillLevel === lv ? `${sinColor}20` : 'transparent',
                          color: skillLevel === lv ? sinColor : '#444',
                          borderRight: lv === 3 ? '1px solid var(--border)' : undefined,
                        }}
                      >
                        {lv}해석
                      </button>
                    ))}
                  </div>
                </div>
                {currentSkills.length > 0 ? (
                  <div className="space-y-4">
                    {currentSkills.map((skill, i) => (
                      <SkillPanel key={i} skill={skill} gradeColor={sinColor} isCor={false} />
                    ))}
                  </div>
                ) : (
                  <p style={{ color: '#444', fontSize: '0.8125rem', fontStyle: 'italic' }}>스킬 데이터 없음</p>
                )}
              </div>
            )}

            {/* EGO 침식 스킬 */}
            {hasCor && (
              <div
                className="rounded-lg overflow-hidden"
                style={{
                  border: '1px solid rgba(180,20,20,0.5)',
                  boxShadow: '0 0 40px rgba(160,10,10,0.18), inset 0 0 60px rgba(120,0,0,0.08)',
                  background: 'rgba(20,4,4,0.85)',
                }}
              >
                {/* 침식 헤더 */}
                <div
                  style={{
                    padding: '14px 24px',
                    borderBottom: '1px solid rgba(180,20,20,0.35)',
                    background: 'linear-gradient(90deg, rgba(120,0,0,0.4) 0%, rgba(20,4,4,0.0) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <span
                    className="font-mono font-bold"
                    style={{
                      fontSize: '0.6875rem',
                      color: '#cc2222',
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      textShadow: '0 0 12px rgba(200,20,20,0.6)',
                    }}
                  >
                    ▌ 침식
                  </span>
                  {/* 3해석 / 4해석 */}
                  <div className="flex rounded overflow-hidden" style={{ border: '1px solid rgba(180,20,20,0.4)' }}>
                    {([3, 4] as const).map(lv => (
                      <button
                        key={lv}
                        onClick={() => setCorSkillLevel(lv)}
                        className="px-3 py-1.5 text-xs font-semibold transition-all"
                        style={{
                          background: corSkillLevel === lv ? 'rgba(180,20,20,0.3)' : 'transparent',
                          color: corSkillLevel === lv ? '#dd4444' : 'rgba(180,60,60,0.4)',
                          borderRight: lv === 3 ? '1px solid rgba(180,20,20,0.4)' : undefined,
                        }}
                      >
                        {lv}해석
                      </button>
                    ))}
                  </div>
                </div>

                {/* 침식 스킬 패널 */}
                <div className="p-6">
                  {currentCorSkills.length > 0 ? (
                    <div className="space-y-4">
                      {currentCorSkills.map((skill, i) => (
                        <SkillPanel key={i} skill={skill} gradeColor={sinColor} isCor={true} />
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: '#442222', fontSize: '0.8125rem', fontStyle: 'italic' }}>침식 스킬 데이터 없음</p>
                  )}
                </div>
              </div>
            )}

            {/* 키워드 */}
            {ego.keywords && ego.keywords.length > 0 && (
              <div className="card p-6">
                <h2 className="font-serif font-bold mb-4" style={{ color: 'var(--gold)', fontSize: '1rem' }}>키워드</h2>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {ego.keywords.map((kw, i) => (
                    <KeywordWithTooltip key={i} keyword={kw}>
                      <span className="font-semibold" style={{ fontSize: '0.75rem', color: '#668877' }}>{kw}</span>
                    </KeywordWithTooltip>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
