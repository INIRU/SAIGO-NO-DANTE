'use client'
// Design Ref: §3,4,6 — 아코디언 UI + 컴포넌트 임베딩 렌더러

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Sparkles, RefreshCw, Loader2, ChevronDown } from 'lucide-react'
import Image from 'next/image'
import { NoteRenderer, type NoteSkillEntry, type NotePassiveEntry, type NoteEgoEntry, type NoteIdentityEntry, type NoteEgoGiftEntry } from '@/components/decks/NoteChips'
import SkillFrame from '@/components/identity/SkillFrame'
import SkillDescription from '@/components/skill/SkillDescription'
import { splitSections, parseRichContent, type AISection } from '@/lib/utils/ai-summary-parser'
import { SIN_COLORS, SKILL_TYPE_LABELS, SIN_KR_TO_EN, getSinIconUrl } from '@/lib/data/sinners'
import { getSkillIconUrl, computeSkillImageIndices } from '@/lib/utils/images'
import { STORAGE_BASE } from '@/lib/constants/game'
import type { Skill, Passive, Identity } from '@/lib/types'

interface IdentityAISectionProps {
  identityId: string
  sinColor: string
  isAdmin?: boolean
  allowedKeywords?: Set<string>
  skillLookup: Record<string, NoteSkillEntry>
  passiveLookup: Record<string, NotePassiveEntry>
  egoLookup: Record<string, NoteEgoEntry>
  identityLookup: Record<string, NoteIdentityEntry>
  egoGiftLookup: Record<string, NoteEgoGiftEntry>
  // 컴포넌트 임베딩용
  skills?: Skill[]
  passives?: Passive[]
  identity?: Identity
  // 재생성 권한
  isLoggedIn?: boolean
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '방금 전'
  if (mins < 60) return `${mins}분 전`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  return `${days}일 전`
}

/* ─── 아코디언 섹션 ─── */
function AccordionSection({
  title, isOpen, onToggle, sinColor, children,
}: {
  title: string
  isOpen: boolean
  onToggle: () => void
  sinColor: string
  children: React.ReactNode
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [maxH, setMaxH] = useState<number>(0)

  useEffect(() => {
    if (contentRef.current) {
      setMaxH(contentRef.current.scrollHeight)
    }
  }, [children, isOpen])

  return (
    <div style={{ marginBottom: '0.375rem' }}>
      {/* 헤더 */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 text-left transition-colors"
        style={{
          padding: '0.5rem 0.75rem',
          background: isOpen ? `${sinColor}18` : `${sinColor}0c`,
          borderLeft: `3px solid ${isOpen ? sinColor : `${sinColor}40`}`,
          borderRadius: '0 0.375rem 0.375rem 0',
          cursor: 'pointer',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = `${sinColor}20` }}
        onMouseLeave={e => { e.currentTarget.style.background = isOpen ? `${sinColor}18` : `${sinColor}0c` }}
      >
        <ChevronDown
          style={{
            width: '0.875rem',
            height: '0.875rem',
            color: sinColor,
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e8dcc8' }}>
          {title}
        </span>
      </button>

      {/* 콘텐츠 */}
      <div
        ref={contentRef}
        style={{
          maxHeight: isOpen ? `${maxH + 32}px` : '0px',
          opacity: isOpen ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.3s ease, opacity 0.2s ease',
        }}
      >
        <div style={{ padding: '0.75rem 0.75rem 0.5rem 1.25rem' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

const SIN_FRAME_MAP: Record<string, string> = {
  wrath: 'crimson', lust: 'scarlet', sloth: 'amber', gluttony: 'shamrock',
  gloom: 'azure', pride: 'indigo', envy: 'violet',
}

/* ─── 단일 스킬 프레임 렌더 (SkillEmbed와 변형 모두에서 사용) ─── */
function SkillFrameBlock({
  skill, skills, identity, sinColor, allowedKeywords, variantIndex,
}: {
  skill: Skill
  skills: Skill[]
  identity?: Identity
  sinColor: string
  allowedKeywords?: Set<string>
  variantIndex?: number
}) {
  const skillImgIdx = computeSkillImageIndices(skills)
  const imgIdx = skillImgIdx[skill.id] ?? 0
  const iconUrl = identity ? getSkillIconUrl(identity, imgIdx) : ''
  const skillSinColor = SIN_COLORS[skill.sin_affinity] || sinColor
  const baseOrder = skill.skill_order
  const isDefense = baseOrder === 4
  const isAttackSkill = !isDefense
  const skillLabel = isDefense
    ? (SKILL_TYPE_LABELS[skill.skill_type] || skill.skill_type)
    : variantIndex
      ? `S${baseOrder}-${variantIndex}`
      : `S${baseOrder}`
  const frameSin = SIN_FRAME_MAP[skill.sin_affinity] || 'crimson'

  const unbreakableCoins = new Set<number>()
  if (skill.description) {
    const ubMatches = skill.description.matchAll(/\[코인\s?(\d+)\]\s*파괴 불가 코인/g)
    for (const m of ubMatches) unbreakableCoins.add(parseInt(m[1]))
  }

  const frameSize = '4.5rem'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.25rem', marginBottom: '0.5rem' }}>
        <div className="relative shrink-0 ml-2" style={{ width: frameSize, height: frameSize }}>
          {/* 죄악 색 삼각형 */}
          <div className="absolute flex items-center justify-center pointer-events-none" style={{
            top: '1.5%', left: '50%', transform: 'translateX(-56%)',
            width: '1rem', height: '1rem', zIndex: 0,
          }}>
            <div className="absolute" style={{
              width: '1.5rem', height: '1rem',
              backgroundColor: skillSinColor,
              clipPath: 'polygon(5% 20%, 85% 0%, 100% 100%, 10% 100%)',
            }} />
          </div>
          <SkillFrame
            skillIconUrl={iconUrl}
            sin={skill.sin_affinity || 'neutral'}
            skillSlot={baseOrder <= 3 ? baseOrder : 1}
            sinColor={skillSinColor}
            label={skillLabel}
            size={frameSize}
          />
          {isAttackSkill && skill.skill_type && ['slash', 'pierce', 'blunt'].includes(skill.skill_type) && (
            <div className="absolute z-20 pointer-events-none"
              style={{ bottom: 0, left: '50%', marginLeft: '-0.625rem', transform: 'translateY(-30%)', width: '1.25rem', height: '1.25rem' }}>
              <Image src={`${STORAGE_BASE}/icons/skill-frames/extras/${frameSin}_icon_bg.webp`}
                alt="" width={20} height={20} className="absolute inset-0" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              <Image src={`${STORAGE_BASE}/icons/skill-frames/extras/${frameSin}_icon_overlay.webp`}
                alt="" width={20} height={20} className="absolute inset-0" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              <Image src={`${STORAGE_BASE}/icons/stats/${skill.skill_type}.webp`}
                alt="" width={16} height={16} className="absolute inset-0 m-auto z-10" style={{ width: '0.625rem', height: '0.625rem' }} />
            </div>
          )}
          {/* 기본 위력 */}
          <div className="absolute z-20" style={{ left: 0, top: '50%', transform: 'translateX(-40%) translateY(-75%)' }}>
            <span style={{ fontFamily: 'var(--font-excelsior), sans-serif', fontSize: '1.5rem', lineHeight: 1, color: 'oklch(81.35% .0894 69.33)' }}>
              {skill.base_power}
            </span>
          </div>
          {/* 코인 위력 */}
          <div className="absolute z-20" style={{ top: 0, left: '50%', transform: 'translateX(-56%) translateY(-12.5%)' }}>
            <span style={{
              fontFamily: 'var(--font-excelsior), sans-serif', fontSize: '0.8125rem', fontWeight: 700, lineHeight: 1,
              color: skill.coin_power >= 0 ? 'oklch(81.35% .0894 69.33)' : '#ff8866',
              textShadow: '1px 1px 1px black',
              WebkitTextStroke: '0.01px black',
            }}>
              {skill.coin_power >= 0 ? `+${skill.coin_power}` : <>
                <span style={{ fontSize: '1rem' }}>-</span>{Math.abs(skill.coin_power)}
              </>}
            </span>
          </div>
        </div>

        {/* 스킬 정보 */}
        <div className="flex-1 min-w-0 overflow-hidden pt-0.5">
          {/* 코인 */}
          <div className="flex items-center gap-0.5 mb-0.5">
            {Array.from({ length: skill.coins }).map((_, ci) => {
              const isUb = unbreakableCoins.has(ci + 1)
              return (
                <Image key={ci}
                  src={`${STORAGE_BASE}/icons/stats/${isUb ? 'unbreakable_coin' : 'coin'}.webp`}
                  alt={isUb ? '파괴 불가 코인' : '코인'} width={16} height={16}
                  style={{ width: '0.875rem', height: '0.875rem' }}
                />
              )
            })}
          </div>
          <div className="overflow-hidden mb-1" style={{ width: 'fit-content', maxWidth: '100%' }}>
            <div style={{
              color: '#e8dcc8',
              backgroundImage: `linear-gradient(255deg, transparent 1.2em, ${skillSinColor}30 1.2em)`,
            }}>
              <div style={{
                padding: '0.1em 0 0.1em 0.3em',
                backgroundImage: `linear-gradient(290deg, transparent 2em, ${skillSinColor}40 2em, ${skillSinColor}40 2.12em, transparent 2.12em, transparent 2.24em, ${skillSinColor}40 2.24em, ${skillSinColor}40 2.36em, transparent 2.36em, transparent 2.48em, ${skillSinColor}40 2.48em, ${skillSinColor}40 2.6em, transparent 2.6em, transparent 2.72em, ${skillSinColor}40 2.72em)`,
                textShadow: '1px 1px 2px rgba(0,0,0,0.6)',
              }}>
                <span className="font-bold whitespace-nowrap" style={{
                  fontSize: '0.75rem', fontFamily: 'var(--font-heading)', fontWeight: 800,
                  paddingRight: '3.5em',
                }}>
                  {skill.name}
                </span>
              </div>
            </div>
          </div>
          {/* 공격 레벨 + 가중치 */}
          <div className="flex items-center gap-3">
            {skill.offense_level != null && (
              <div className="flex items-center gap-0.5">
                <Image src={`${STORAGE_BASE}/icons/ui/${isDefense ? 'icon-defense' : 'icon-sword'}.webp`} alt="" width={22} height={22} style={{ width: '1rem', height: '1rem' }} />
                <span style={{ fontFamily: 'var(--font-excelsior), sans-serif', color: '#e8dcc8', fontSize: '1rem', textDecoration: 'underline', textUnderlineOffset: '2px', textDecorationColor: '#e8dcc8' }}>
                  {skill.offense_level}
                </span>
              </div>
            )}
            {isAttackSkill && (
              <div className="flex items-center gap-1">
                <span style={{ fontFamily: 'var(--font-heading)', color: '#c8900a', fontSize: '0.625rem', fontWeight: 700 }}>공격 가중치</span>
                <div className="flex gap-0.5">
                  {Array.from({ length: skill.atk_weight || 1 }).map((_, i) => (
                    <div key={i} style={{ width: '0.5625rem', height: '0.5625rem', background: '#c8900a', borderRadius: '0.1rem' }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <SkillDescription
        description={skill.description}
        accentColor={skillSinColor}
        variant="compact"
        allowedKeywords={allowedKeywords}
      />
    </div>
  )
}

/* ─── 스킬 임베드 (대표 + 변형 토글) ─── */
function SkillEmbed({
  order, skills, identity, sinColor, allowedKeywords,
}: {
  order: number
  skills: Skill[]
  identity?: Identity
  sinColor: string
  allowedKeywords?: Set<string>
}) {
  const [showVariants, setShowVariants] = useState(false)

  // 같은 skill_order인 스킬들을 variant_order 순으로 정렬
  const slotSkills = skills
    .filter(s => s.skill_order === order)
    .sort((a, b) => (a.variant_order ?? 0) - (b.variant_order ?? 0))

  const mainSkill = slotSkills[0]
  if (!mainSkill) {
    return <span style={{ color: '#666', fontSize: '0.75rem' }}>[스킬 {order}]</span>
  }

  // 변형 스킬 = 같은 slot의 나머지
  const variants = slotSkills.slice(1)

  const skillSinColor = SIN_COLORS[mainSkill.sin_affinity] || sinColor

  return (
    <div
      style={{
        padding: '0.75rem',
        background: `${skillSinColor}08`,
        borderRadius: '0.5rem',
        border: `1px solid ${skillSinColor}30`,
        marginBlock: '0.5rem',
      }}
    >
      {/* 대표 스킬 */}
      <SkillFrameBlock
        skill={mainSkill}
        skills={skills}
        identity={identity}
        sinColor={sinColor}
        allowedKeywords={allowedKeywords}
      />

      {/* 변형 토글 */}
      {variants.length > 0 && (
        <div style={{ marginTop: '0.5rem' }}>
          <button
            onClick={() => setShowVariants(v => !v)}
            className="flex items-center gap-1.5 transition-colors"
            style={{
              color: '#888',
              fontSize: '0.75rem',
              cursor: 'pointer',
              padding: '0.25rem 0',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = skillSinColor }}
            onMouseLeave={e => { e.currentTarget.style.color = '#888' }}
          >
            <ChevronDown style={{
              width: '0.75rem', height: '0.75rem',
              transition: 'transform 0.2s ease',
              transform: showVariants ? 'rotate(0deg)' : 'rotate(-90deg)',
            }} />
            변형 {variants.length}개 보기
          </button>

          {showVariants && (
            <div style={{
              marginTop: '0.375rem',
              paddingTop: '0.5rem',
              borderTop: `1px solid ${skillSinColor}20`,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}>
              {variants.map((v, i) => (
                <SkillFrameBlock
                  key={v.id}
                  skill={v}
                  skills={skills}
                  identity={identity}
                  sinColor={sinColor}
                  allowedKeywords={allowedKeywords}
                  variantIndex={i + 2}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── 패시브 임베드 (원본 IdentityPassivesTab 구조 재사용) ─── */
function PassiveEmbed({
  passiveType, passives, allowedKeywords,
}: {
  passiveType: 'battle' | 'support'
  passives: Passive[]
  allowedKeywords?: Set<string>
}) {
  const passive = passives.find(p => p.passive_type === passiveType)
  if (!passive) {
    return <span style={{ color: '#666', fontSize: '0.75rem' }}>[{passiveType} 패시브]</span>
  }

  // sin 파싱 (원본과 동일: ", " 구분)
  const sinNames = passive.sin_affinity ? passive.sin_affinity.split(', ').map(s => s.trim()) : []
  const sinTypes = sinNames
    .map(s => SIN_KR_TO_EN[s] ?? (SIN_COLORS[s as keyof typeof SIN_COLORS] ? s : null))
    .filter(Boolean) as Array<keyof typeof SIN_COLORS>
  const primaryColor = sinTypes[0] ? SIN_COLORS[sinTypes[0]] : '#cccccc'

  return (
    <div
      style={{
        padding: '0.75rem',
        background: `${primaryColor}08`,
        borderRadius: '0.5rem',
        border: `1px solid ${primaryColor}30`,
        marginBlock: '0.5rem',
      }}
    >
      {/* 패시브 이름 배너 (원본 사선 꼬리) */}
      <div className="overflow-hidden mb-2" style={{ width: 'fit-content', maxWidth: '100%' }}>
        <div style={{
          color: '#e8dcc8',
          backgroundImage: `linear-gradient(255deg, transparent 1.5em, ${primaryColor}30 1.5em)`,
        }}>
          <div style={{
            padding: '0.2em 0 0.2em 0.4em',
            backgroundImage: `linear-gradient(290deg, transparent 2.2em, ${primaryColor}35 2.2em, ${primaryColor}35 2.35em, transparent 2.35em, transparent 2.5em, ${primaryColor}35 2.5em, ${primaryColor}35 2.65em, transparent 2.65em, transparent 2.8em, ${primaryColor}35 2.8em, ${primaryColor}35 2.95em, transparent 2.95em, transparent 3.1em, ${primaryColor}35 3.1em)`,
            textShadow: '1px 1px 3px rgba(0,0,0,0.7)',
          }}>
            <span className="font-bold whitespace-nowrap" style={{
              fontSize: '0.875rem', fontFamily: 'var(--font-heading)', fontWeight: 800,
              paddingRight: '4em',
            }}>
              {passive.name}
            </span>
          </div>
        </div>
      </div>

      {/* 발동 조건 (원본과 동일: getSinIconUrl 사용) */}
      {(sinTypes.length > 0 || passive.active_cond) && (
        <div className="flex items-center gap-2 mb-2">
          {sinTypes.map((st, i) => (
            <Image
              key={i}
              src={getSinIconUrl(st)}
              alt=""
              width={22}
              height={22}
            />
          ))}
          {passive.sin_count != null && passive.sin_count > 0 && (
            <span className="font-bold" style={{ color: '#e8dcc8', fontSize: '0.8125rem', fontFamily: 'var(--font-heading)' }}>
              x{passive.sin_count}
            </span>
          )}
          {passive.active_cond && (
            <span className="font-bold" style={{ color: '#e8dcc8', fontSize: '0.8125rem', fontFamily: 'var(--font-heading)' }}>
              {passive.active_cond === 'resonance' ? '공명' : passive.active_cond === 'stock' ? '보유' : passive.active_cond}
            </span>
          )}
        </div>
      )}

      {/* 설명 */}
      {passive.description && (
        <SkillDescription
          description={passive.description}
          accentColor={primaryColor}
          variant="compact"
          showCoinBadges={false}
          allowedKeywords={allowedKeywords}
        />
      )}
    </div>
  )
}

/* ─── 리치 콘텐츠 렌더러 ─── */
function RichContentRenderer({
  content, skills, passives, identity, sinColor, allowedKeywords,
  skillLookup, passiveLookup, egoLookup, identityLookup, egoGiftLookup,
}: {
  content: string
  skills: Skill[]
  passives: Passive[]
  identity?: Identity
  sinColor: string
  allowedKeywords?: Set<string>
  skillLookup: Record<string, NoteSkillEntry>
  passiveLookup: Record<string, NotePassiveEntry>
  egoLookup: Record<string, NoteEgoEntry>
  identityLookup: Record<string, NoteIdentityEntry>
  egoGiftLookup: Record<string, NoteEgoGiftEntry>
}) {
  const nodes = useMemo(() => parseRichContent(content), [content])

  return (
    <>
      {nodes.map((node, i) => {
        switch (node.type) {
          case 'text':
            return (
              <NoteRenderer
                key={i}
                text={node.value}
                skillLookup={skillLookup}
                passiveLookup={passiveLookup}
                egoLookup={egoLookup}
                identityLookup={identityLookup}
                egoGiftLookup={egoGiftLookup}
                allowedKeywords={allowedKeywords}
              />
            )
          case 'skill':
            return (
              <SkillEmbed
                key={i}
                order={node.order}
                skills={skills}
                identity={identity}
                sinColor={sinColor}
                allowedKeywords={allowedKeywords}
              />
            )
          case 'passive':
            return (
              <PassiveEmbed
                key={i}
                passiveType={node.passiveType}
                passives={passives}
                allowedKeywords={allowedKeywords}
              />
            )
        }
      })}
    </>
  )
}

/* ─── 메인 컴포넌트 ─── */
export default function IdentityAISection({
  identityId,
  sinColor,
  isAdmin,
  allowedKeywords,
  skillLookup,
  passiveLookup,
  egoLookup,
  identityLookup,
  egoGiftLookup,
  skills = [],
  passives = [],
  identity,
  isLoggedIn,
}: IdentityAISectionProps) {
  const [summary, setSummary] = useState<string | null>(null)
  const [createdAt, setCreatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openSections, setOpenSections] = useState<Set<number>>(new Set([0]))

  // 캐시 조회
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/identity-ai?identity_id=${identityId}`)
        if (!res.ok) throw new Error('fetch failed')
        const data = await res.json()
        if (!cancelled) {
          setSummary(data.summary)
          setCreatedAt(data.created_at)
        }
      } catch {
        // 캐시 없으면 무시
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [identityId])

  // AI 생성
  const generate = useCallback(async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/identity-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity_id: identityId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'AI 생성 실패')
      setSummary(data.summary)
      setCreatedAt(data.created_at)
      setOpenSections(new Set([0])) // 새 생성 시 첫 섹션만 열기
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message || 'AI 생성 중 오류가 발생했습니다.')
    } finally {
      setGenerating(false)
    }
  }, [identityId])

  // 섹션 파싱
  const sections = useMemo<AISection[]>(
    () => summary ? splitSections(summary) : [],
    [summary]
  )

  const toggleSection = useCallback((idx: number) => {
    setOpenSections(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }, [])

  if (loading) {
    return (
      <div className="card p-6" style={{ border: `1px solid ${sinColor}15` }}>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles style={{ width: '1rem', height: '1rem', color: sinColor }} />
          <span className="font-serif" style={{ color: 'var(--gold)', fontSize: '1rem' }}>AI 분석</span>
        </div>
        <div className="flex items-center justify-center py-6" style={{ color: '#555' }}>
          <Loader2 className="animate-spin" style={{ width: '1.25rem', height: '1.25rem' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="card p-6" style={{ border: `1px solid ${sinColor}15` }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles style={{ width: '1rem', height: '1rem', color: sinColor }} />
          <span className="font-serif" style={{ color: 'var(--gold)', fontSize: '1rem' }}>AI 분석</span>
        </div>
        {createdAt && (
          <span style={{ color: '#555', fontSize: '0.75rem' }}>
            {timeAgo(createdAt)} 생성
          </span>
        )}
      </div>

      {/* 본문: 아코디언 또는 생성 버튼 */}
      {summary && sections.length > 0 ? (
        <>
          <div style={{ marginBottom: '0.75rem' }}>
            {sections.map((section, idx) => (
              <AccordionSection
                key={idx}
                title={section.title}
                isOpen={openSections.has(idx)}
                onToggle={() => toggleSection(idx)}
                sinColor={sinColor}
              >
                <RichContentRenderer
                  content={section.content}
                  skills={skills}
                  passives={passives}
                  identity={identity}
                  sinColor={sinColor}
                  allowedKeywords={allowedKeywords}
                  skillLookup={skillLookup}
                  passiveLookup={passiveLookup}
                  egoLookup={egoLookup}
                  identityLookup={identityLookup}
                  egoGiftLookup={egoGiftLookup}
                />
              </AccordionSection>
            ))}
          </div>

          {/* 푸터 */}
          <div
            className="flex items-center justify-between gap-2 pt-3"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            {(() => {
              // 재생성 권한: admin은 항상, 로그인 유저는 14일 경과 후
              const isExpired = createdAt
                ? Date.now() - new Date(createdAt).getTime() > 14 * 24 * 60 * 60 * 1000
                : false
              const canRegenerate = isAdmin || (isLoggedIn && isExpired)

              return (
                <>
                  <span className="min-w-0" style={{ color: '#555', fontSize: '0.6875rem' }}>
                    AI가 생성한 요약입니다. 실제 게임과 다를 수 있습니다.
                  </span>
                  {canRegenerate && (
                    <button
                      onClick={generate}
                      disabled={generating}
                      className="flex items-center gap-1 shrink-0 transition-colors"
                      style={{
                        color: generating ? '#444' : '#666',
                        fontSize: '0.75rem',
                        cursor: generating ? 'not-allowed' : 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                      onMouseEnter={e => { if (!generating) (e.currentTarget.style.color = sinColor) }}
                      onMouseLeave={e => { if (!generating) (e.currentTarget.style.color = '#666') }}
                    >
                      {generating ? (
                        <Loader2 className="animate-spin" style={{ width: '0.75rem', height: '0.75rem' }} />
                      ) : (
                        <RefreshCw style={{ width: '0.75rem', height: '0.75rem' }} />
                      )}
                      재생성
                    </button>
                  )}
                </>
              )
            })()}
          </div>
        </>
      ) : (
        <div className="text-center py-6">
          <p style={{ color: '#666', fontSize: '0.8125rem', marginBottom: '1rem' }}>
            AI가 이 인격의 스킬, 운영법, 추천 편성을 분석하여 요약합니다.
          </p>

          {error && (
            <p style={{ color: '#e04040', fontSize: '0.75rem', marginBottom: '0.75rem' }}>
              {error}
            </p>
          )}

          <button
            onClick={generate}
            disabled={generating}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-all"
            style={{
              background: generating ? `${sinColor}20` : `${sinColor}30`,
              color: generating ? '#666' : '#e8dcc8',
              border: `1px solid ${sinColor}50`,
              fontSize: '0.8125rem',
              cursor: generating ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={e => { if (!generating) { e.currentTarget.style.background = `${sinColor}50`; e.currentTarget.style.borderColor = sinColor } }}
            onMouseLeave={e => { if (!generating) { e.currentTarget.style.background = `${sinColor}30`; e.currentTarget.style.borderColor = `${sinColor}50` } }}
          >
            {generating ? (
              <>
                <Loader2 className="animate-spin" style={{ width: '1rem', height: '1rem' }} />
                AI 분석 중...
              </>
            ) : (
              <>
                <Sparkles style={{ width: '1rem', height: '1rem' }} />
                AI 분석 생성하기
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
