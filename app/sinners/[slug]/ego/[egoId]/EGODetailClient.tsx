'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Sinner, EGO, EGOSkill, STORAGE_BASE,
  SIN_COLORS, SinType,
  GRADE_COLORS, SIN_KR_TO_EN, ATK_TYPE_ICON_MAP,
  getSinIconUrl,
} from '@/lib/data/sinners'
import { KeywordWithTooltip, formatSkillDesc } from '@/components/sinners/KeywordTooltip'

// ─── 상수 ────────────────────────────────────────────────────────────
const SIN_ORDER: SinType[] = ['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy']

const RESISTANCE_STYLE: Record<string, { color: string; bg: string }> = {
  '내성': { color: '#4488dd', bg: 'rgba(44,88,180,0.15)' },
  '견딤': { color: '#9966cc', bg: 'rgba(120,80,180,0.15)' },
  '보통': { color: '#556677', bg: 'rgba(60,70,80,0.12)' },
  '취약': { color: '#cc4444', bg: 'rgba(160,40,40,0.15)' },
}

// ─── Grade 이미지 ─────────────────────────────────────────────────────
function GradeImg({ grade, height = 16 }: { grade: string; height?: number }) {
  if (grade === 'ALEPH') return <span style={{ fontFamily: 'monospace', fontSize: `${height - 2}px`, color: '#c83040', letterSpacing: '0.1em' }}>ALEPH</span>
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`${STORAGE_BASE}/icons/grade/${grade}.webp`} alt={grade} style={{ height, width: 'auto' }} />
}

// ─── EGO 스킬 패널 ────────────────────────────────────────────────────
function SkillPanel({ skill, gradeColor, isCor }: { skill: EGOSkill; gradeColor: string; isCor: boolean }) {
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
            <Image src={ATK_TYPE_ICON_MAP[skill.atkType]} alt="" width={16} height={16} unoptimized />
          )}
          <span className="font-semibold" style={{ color: accentColor, fontSize: '14px' }}>
            {skill.name}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* 가중치 */}
          <div className="flex items-center gap-1">
            <span style={{ color: '#666', fontSize: '10px' }}>가중치</span>
            <div className="flex items-center gap-0.5">
              {Array.from({ length: skill.atkWeight }).map((_, i) => (
                <div key={i} className="w-2 h-2 rounded-sm" style={{ background: `${accentColor}50`, border: `1.5px solid ${accentColor}` }} />
              ))}
            </div>
          </div>
          {/* 정신력 소모 */}
          {skill.mentalConsume !== 0 && (
            <span className="font-mono" style={{ color: '#666', fontSize: '10px' }}>
              정신력 -{skill.mentalConsume}
            </span>
          )}
        </div>
      </div>

      {/* 위력 + 자원 */}
      <div className="flex items-center gap-4 mb-2 flex-wrap">
        <div className="flex items-center gap-1">
          <span style={{ color: '#888', fontSize: '11px' }}>위력</span>
          <span className="font-mono font-bold" style={{ color: accentColor, fontSize: '13px' }}>{skill.skillPower}</span>
        </div>
        <div className="flex items-center gap-1">
          <span style={{ color: '#888', fontSize: '11px' }}>코인</span>
          <span className="font-mono font-bold" style={{ color: 'var(--gold)', fontSize: '13px' }}>{skill.coinNum}</span>
        </div>
        {skill.coinPower !== 0 && (
          <div className="flex items-center gap-1">
            <span style={{ color: '#888', fontSize: '11px' }}>코인 위력</span>
            <span className="font-mono font-bold" style={{ color: accentColor, fontSize: '13px' }}>
              {skill.coinPower > 0 ? `+${skill.coinPower}` : skill.coinPower}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1 ml-auto">
          <span style={{ color: '#888', fontSize: '11px' }}>최대</span>
          <span className="font-mono font-bold" style={{ color: '#e8dcc8', fontSize: '13px' }}>{skill.power.replace(/\(\d+\)/g, '')}</span>
        </div>
        {/* 죄악 자원 */}
        {resourceSin && (
          <Image src={getSinIconUrl(resourceSin)} alt={skill.resource} width={16} height={16} unoptimized style={{ filter: `drop-shadow(0 0 3px ${resourceColor}70)` }} />
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
            unoptimized
            style={{ filter: `drop-shadow(0 0 2px ${accentColor}60)` }}
          />
        ))}
      </div>

      {/* 일반 효과 */}
      {skill.normalEffect && (
        <div style={{ color: '#888', fontSize: '11px', lineHeight: 1.8, whiteSpace: 'pre-line', marginBottom: '8px' }}>
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
                  color: accentColor, fontFamily: 'monospace', fontSize: '9px', fontWeight: 'bold',
                }}>
                  {i + 1}
                </div>
                <div style={{ color: '#888', fontSize: '11px', lineHeight: 1.8, flex: 1 }}>
                  {isUnbreakable && (
                    <span style={{ color: '#aaa', fontSize: '10px', fontWeight: 600 }}>파괴 불가 코인</span>
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

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────
interface Props {
  sinner: Sinner
  ego: EGO
}

export default function EGODetailClient({ sinner, ego }: Props) {
  const [skillLevel, setSkillLevel] = useState<3 | 4>(4)
  const [corSkillLevel, setCorSkillLevel] = useState<3 | 4>(4)

  const gradeColor = GRADE_COLORS[ego.grade] ?? '#667788'
  const sinColor = SIN_COLORS[ego.sin_affinity as SinType] ?? gradeColor

  const normalSkillList = ego.ego_skills ?? []
  const corSkillList = ego.ego_cor_skills ?? []
  const hasCor = corSkillList.length > 0

  // 이름별 그룹화 후 선택된 동기화 레벨 스킬 추출 (다중 스킬 EGO 대응)
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

  return (
    <div className="min-h-screen pb-16" style={{ background: '#0d0b08' }}>

      {/* ─── 히어로 배너 ─── */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 5', overflow: 'hidden', background: '#080604' }}>
        {ego.image_url && (
          <Image src={ego.image_url} alt="" fill unoptimized
            style={{ objectFit: 'cover', objectPosition: '50% 10%', filter: 'blur(20px) brightness(0.45)', transform: 'scale(1.1)' }}
          />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,6,4,0.65)' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '65%', background: 'linear-gradient(to bottom, transparent, #0d0b08)' }} />
        <div style={{ position: 'absolute', bottom: '28px', left: '40px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
          <GradeImg grade={ego.grade} height={20} />
          <h1 className="font-serif" style={{ fontSize: '32px', fontWeight: 'bold', color: '#e8b030', lineHeight: 1.1, textShadow: `0 0 40px ${sinColor}60` }}>
            {ego.name_kr || ego.name}
          </h1>
          {ego.name_kr && (
            <p className="font-mono" style={{ fontSize: '13px', color: '#8a6010', letterSpacing: '0.08em' }}>{ego.name}</p>
          )}
        </div>
      </div>

      {/* ─── 메인 ─── */}
      <div className="max-w-6xl mx-auto px-6 pt-8">

        {/* 브레드크럼 */}
        <div className="mb-8 flex items-center gap-2 text-sm" style={{ color: '#555566' }}>
          <Link href="/sinners" className="hover:text-yellow-300 transition-colors">수감자 목록</Link>
          <span>›</span>
          <Link href={`/sinners/${sinner.id}`} className="hover:text-yellow-300 transition-colors">{sinner.name_kr}</Link>
          <span>›</span>
          <span style={{ color: 'var(--gold)' }}>{ego.name_kr || ego.name}</span>
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
                  <Image src={ego.image_url} alt={ego.name_kr || ego.name} fill unoptimized className="object-cover" style={{ objectPosition: '50% 10%' }} />
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
                  <Image src={getSinIconUrl(ego.sin_affinity as SinType)} alt="" width={16} height={16} unoptimized
                    style={{ opacity: 0.75, marginLeft: '6px' }} />
                )}
              </div>
            </div>

            {/* 기본 정보 카드 */}
            <div className="card p-4 space-y-4">
              {/* 죄악 내성 */}
              {ego.resistance && ego.resistance.length === 7 && (
                <div>
                  <p style={{ color: '#666', fontSize: '10px', marginBottom: '8px', letterSpacing: '0.1em' }}>죄악 내성</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {SIN_ORDER.map((sin, i) => {
                      const res = ego.resistance![i] ?? '보통'
                      const rs = RESISTANCE_STYLE[res] ?? RESISTANCE_STYLE['보통']
                      const sc = SIN_COLORS[sin]
                      return (
                        <div key={sin} className="flex items-center gap-1.5">
                          <Image src={getSinIconUrl(sin)} alt="" width={14} height={14} unoptimized
                            style={{ filter: `drop-shadow(0 0 2px ${sc}60)`, flexShrink: 0 }} />
                          <span className="font-mono" style={{ fontSize: '10px', color: rs.color, fontWeight: 600 }}>
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
                  <p style={{ color: '#666', fontSize: '10px', marginBottom: '8px', letterSpacing: '0.1em' }}>코스트</p>
                  <div className="flex flex-wrap gap-2">
                    {SIN_ORDER.map((sin, i) => {
                      const amount = ego.cost![i]
                      if (!amount) return null
                      const sc = SIN_COLORS[sin]
                      return (
                        <div key={sin} className="flex items-center gap-1.5"
                          style={{ padding: '4px 10px', background: `${sc}12`, border: `1px solid ${sc}40`, borderRadius: '4px' }}>
                          <Image src={getSinIconUrl(sin)} alt="" width={14} height={14} unoptimized
                            style={{ filter: `drop-shadow(0 0 3px ${sc}60)` }} />
                          <span className="font-mono font-bold" style={{ fontSize: '12px', color: sc }}>{amount}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 입수 방법 */}
              {ego.obtaining_method && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                  <p style={{ color: '#666', fontSize: '10px', marginBottom: '6px', letterSpacing: '0.1em' }}>입수 방법</p>
                  <p style={{ fontSize: '11px', color: '#7a6a5a', lineHeight: '1.6' }}>{ego.obtaining_method}</p>
                </div>
              )}
            </div>

            {/* 뒤로가기 */}
            <Link
              href={`/sinners/${sinner.id}`}
              className="block text-center py-3 rounded font-medium text-sm transition-all hover:opacity-80"
              style={{ background: 'rgba(200,144,10,0.08)', border: '1px solid var(--border)', color: 'var(--gold-dim)' }}
            >
              ← {sinner.name_kr}의 EGO 목록으로
            </Link>
          </div>

          {/* ─── 우측 메인 ─── */}
          <div className="lg:col-span-2 space-y-6">

            {/* 패시브 */}
            {ego.passive_name && (
              <div className="card p-6">
                <h2 className="font-serif font-bold mb-4" style={{ color: 'var(--gold)', fontSize: '16px' }}>패시브</h2>
                <div className="p-4 rounded" style={{ background: `${sinColor}08`, border: `1px solid ${sinColor}30` }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold" style={{ color: sinColor, fontSize: '14px' }}>{ego.passive_name}</span>
                  </div>
                  {ego.passive_content && (
                    <div style={{ color: '#888', fontSize: '11px', lineHeight: 1.8, whiteSpace: 'pre-line' }}>
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
                  <h2 className="font-serif font-bold" style={{ color: 'var(--gold)', fontSize: '16px' }}>EGO 스킬</h2>
                  {/* 3동기화 / 4동기화 */}
                  <div className="flex rounded overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                    {([3, 4] as const).map(lv => (
                      <button
                        key={lv}
                        onClick={() => setSkillLevel(lv)}
                        className="px-3 py-1.5 text-xs font-mono transition-all"
                        style={{
                          background: skillLevel === lv ? `${sinColor}20` : 'transparent',
                          color: skillLevel === lv ? sinColor : '#444',
                          borderRight: lv === 3 ? '1px solid var(--border)' : undefined,
                        }}
                      >
                        {lv}동기화
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
                  <p style={{ color: '#444', fontSize: '13px', fontStyle: 'italic' }}>스킬 데이터 없음</p>
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
                      fontSize: '11px',
                      color: '#cc2222',
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      textShadow: '0 0 12px rgba(200,20,20,0.6)',
                    }}
                  >
                    ▌ 침식
                  </span>
                  {/* 3동기화 / 4동기화 */}
                  <div className="flex rounded overflow-hidden" style={{ border: '1px solid rgba(180,20,20,0.4)' }}>
                    {([3, 4] as const).map(lv => (
                      <button
                        key={lv}
                        onClick={() => setCorSkillLevel(lv)}
                        className="px-3 py-1.5 text-xs font-mono transition-all"
                        style={{
                          background: corSkillLevel === lv ? 'rgba(180,20,20,0.3)' : 'transparent',
                          color: corSkillLevel === lv ? '#dd4444' : 'rgba(180,60,60,0.4)',
                          borderRight: lv === 3 ? '1px solid rgba(180,20,20,0.4)' : undefined,
                        }}
                      >
                        {lv}동기화
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
                    <p style={{ color: '#442222', fontSize: '13px', fontStyle: 'italic' }}>침식 스킬 데이터 없음</p>
                  )}
                </div>
              </div>
            )}

            {/* 키워드 */}
            {ego.keywords && ego.keywords.length > 0 && (
              <div className="card p-6">
                <h2 className="font-serif font-bold mb-4" style={{ color: 'var(--gold)', fontSize: '16px' }}>키워드</h2>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {ego.keywords.map((kw, i) => (
                    <KeywordWithTooltip key={i} keyword={kw}>
                      <span className="font-semibold" style={{ fontSize: '12px', color: '#668877' }}>{kw}</span>
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
