'use client'
// Design Ref: §3,4,6 — 아코디언 UI + 컴포넌트 임베딩 렌더러

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Sparkles, RefreshCw, Loader2, ChevronDown } from 'lucide-react'
import Image from 'next/image'
import { NoteRenderer, type NoteSkillEntry, type NotePassiveEntry, type NoteEgoEntry, type NoteIdentityEntry, type NoteEgoGiftEntry } from '@/components/decks/NoteChips'
import SkillFrameBlock from '@/components/identity/SkillFrameBlock'
import SkillDescription from '@/components/skill/SkillDescription'
import { splitSections, parseRichContent, type AISection } from '@/lib/utils/ai-summary-parser'
import { SIN_COLORS, SKILL_TYPE_LABELS, SIN_KR_TO_EN, getSinIconUrl } from '@/lib/data/sinners'
import { getSkillIconUrl, computeSkillImageIndices } from '@/lib/utils/images'
import { useLanguage } from '@/lib/i18n'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import type { TranslationKey } from '@/lib/i18n/translations'
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

function timeAgo(dateStr: string, t: (key: TranslationKey) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return t('identity.timeAgo.justNow')
  if (mins < 60) return `${mins}${t('identity.timeAgo.minutesAgo')}`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}${t('identity.timeAgo.hoursAgo')}`
  const days = Math.floor(hours / 24)
  return `${days}${t('identity.timeAgo.daysAgo')}`
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
    const el = contentRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setMaxH(el.scrollHeight)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

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

/* ─── 단일 스킬 프레임 렌더 헬퍼 (SkillEmbed와 변형 모두에서 사용) ─── */
function SkillFrameBlockWrapper({
  skill, skills, identity, sinColor, allowedKeywords, variantIndex, lang,
}: {
  skill: Skill
  skills: Skill[]
  identity?: Identity
  sinColor: string
  allowedKeywords?: Set<string>
  variantIndex?: number
  lang?: string
}) {
  const skillImgIdx = computeSkillImageIndices(skills)
  const imgIdx = skillImgIdx[skill.id] ?? 0
  const iconUrl = identity ? getSkillIconUrl(identity, imgIdx) : ''
  const skillSinColor = SIN_COLORS[skill.sin_affinity] || sinColor
  const baseOrder = skill.skill_order
  const isDefense = baseOrder === 4
  const skillLabel = isDefense
    ? (SKILL_TYPE_LABELS[skill.skill_type] || skill.skill_type)
    : variantIndex
      ? `S${baseOrder}-${variantIndex}`
      : `S${baseOrder}`

  const localizedName = lang === 'en'
    ? (skill.name_en || skill.name)
    : lang === 'ja'
      ? (skill.name_jp || skill.name)
      : skill.name

  const localizedDescription = lang === 'en'
    ? (skill.description_en || skill.description)
    : lang === 'ja'
      ? (skill.description_jp || skill.description)
      : skill.description

  const unbreakableCoins = new Set<number>()
  if (skill.description) {
    const ubMatches = skill.description.matchAll(/\[코인\s?(\d+)\]\s*파괴 불가 코인/g)
    for (const m of ubMatches) unbreakableCoins.add(parseInt(m[1]))
  }

  return (
    <SkillFrameBlock
      skillIconUrl={iconUrl}
      sin={skill.sin_affinity || 'neutral'}
      sinColor={skillSinColor}
      skillSlot={baseOrder <= 3 ? baseOrder : 1}
      label={skillLabel}
      size="4.5rem"
      name={localizedName}
      basePower={skill.base_power}
      coinPower={skill.coin_power}
      coins={skill.coins}
      atkType={skill.skill_type}
      offenseLevel={skill.offense_level}
      atkWeight={skill.atk_weight || 1}
      isDefense={isDefense}
      description={localizedDescription}
      unbreakableCoins={unbreakableCoins}
      descVariant="compact"
      allowedKeywords={allowedKeywords}
    />
  )
}

/* ─── 스킬 임베드 (대표 + 변형 토글) ─── */
function SkillEmbed({
  order, variant, skills, identity, sinColor, allowedKeywords, lang,
}: {
  order: number
  variant?: number
  skills: Skill[]
  identity?: Identity
  sinColor: string
  allowedKeywords?: Set<string>
  lang?: string
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

  // variant 지정 시: 해당 변형만 단독 렌더
  if (variant !== undefined) {
    // variant=1 → slotSkills[0] (주 스킬), variant=2 → slotSkills[1] (첫 번째 변형), ...
    const targetSkill = slotSkills[variant - 1] ?? mainSkill
    const skillSinColorSingle = SIN_COLORS[targetSkill.sin_affinity] || sinColor
    return (
      <div
        style={{
          padding: '0.75rem',
          background: `${skillSinColorSingle}08`,
          borderRadius: '0.5rem',
          border: `1px solid ${skillSinColorSingle}30`,
          marginBlock: '0.5rem',
        }}
      >
        <SkillFrameBlockWrapper
          skill={targetSkill}
          skills={skills}
          identity={identity}
          sinColor={sinColor}
          allowedKeywords={allowedKeywords}
          variantIndex={variant > 1 ? variant : undefined}
          lang={lang}
        />
      </div>
    )
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
      <SkillFrameBlockWrapper
        skill={mainSkill}
        skills={skills}
        identity={identity}
        sinColor={sinColor}
        allowedKeywords={allowedKeywords}
        lang={lang}
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
                <SkillFrameBlockWrapper
                  key={v.id}
                  skill={v}
                  skills={skills}
                  identity={identity}
                  sinColor={sinColor}
                  allowedKeywords={allowedKeywords}
                  variantIndex={i + 2}
                  lang={lang}
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
  passiveType, passives, allowedKeywords, t, lang, index,
}: {
  passiveType: 'battle' | 'support'
  passives: Passive[]
  allowedKeywords?: Set<string>
  t: (key: TranslationKey) => string
  lang?: string
  index?: number
}) {
  const typePassives = passives.filter(p => p.passive_type === passiveType)
  if (typePassives.length === 0) {
    return <span style={{ color: '#666', fontSize: '0.75rem' }}>[{passiveType} {t('identity.passives.label')}]</span>
  }
  // index 지정 시 해당 패시브만, 미지정 시 전체 렌더
  const targets = index ? [typePassives[index - 1]].filter(Boolean) : typePassives
  if (targets.length === 0) {
    return <span style={{ color: '#666', fontSize: '0.75rem' }}>[{passiveType} {t('identity.passives.label')}]</span>
  }

  return (
    <>
      {targets.map((passive, ti) => (
        <PassiveEmbedSingle key={ti} passive={passive} allowedKeywords={allowedKeywords} lang={lang} t={t} />
      ))}
    </>
  )
}

function PassiveEmbedSingle({
  passive, allowedKeywords, lang, t,
}: {
  passive: Passive
  allowedKeywords?: Set<string>
  lang?: string
  t: (key: TranslationKey) => string
}) {

  const localizedName = lang === 'en'
    ? ((passive as Record<string, unknown>).name_en as string | undefined || passive.name)
    : lang === 'ja'
    ? ((passive as Record<string, unknown>).name_jp as string | undefined || passive.name)
    : passive.name

  const localizedDesc = lang === 'en'
    ? ((passive as Record<string, unknown>).description_en as string | undefined || passive.description)
    : lang === 'ja'
    ? ((passive as Record<string, unknown>).description_jp as string | undefined || passive.description)
    : passive.description

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
              {localizedName}
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
              {passive.active_cond === 'resonance' ? t('identity.passives.resonance') : passive.active_cond === 'stock' ? t('identity.passives.stock') : passive.active_cond}
            </span>
          )}
        </div>
      )}

      {/* 설명 */}
      {localizedDesc && (
        <SkillDescription
          description={localizedDesc}
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
  lang, t,
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
  lang?: string
  t: (key: TranslationKey) => string
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
                variant={node.variant}
                skills={skills}
                identity={identity}
                sinColor={sinColor}
                allowedKeywords={allowedKeywords}
                lang={lang}
              />
            )
          case 'passive':
            return (
              <PassiveEmbed
                key={i}
                passiveType={node.passiveType}
                passives={passives}
                allowedKeywords={allowedKeywords}
                t={t}
                lang={lang}
                index={node.index}
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
  const { lang, t } = useLanguage()
  const langRef = useRef(lang)
  langRef.current = lang
  const { keywords: keywordData } = useKeywordData()

  const localizedAllowedKeywords = useMemo(() => {
    if (!allowedKeywords || lang === 'ko') return allowedKeywords
    const localized = new Set<string>()
    for (const kwKr of allowedKeywords) {
      // Always keep Korean name for fallback matching
      localized.add(kwKr)
      const info = keywordData[kwKr]
      if (info) {
        if (lang === 'en' && info.nameEn) localized.add(info.nameEn)
        if (lang === 'ja' && info.nameJp) localized.add(info.nameJp)
      }
    }
    return localized
  }, [allowedKeywords, lang, keywordData])
  const [summary, setSummary] = useState<string | null>(null)
  const [createdAt, setCreatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openSections, setOpenSections] = useState<Set<number>>(new Set([0]))

  // 캐시 조회 (lang 변경 시에도 재조회)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const res = await fetch(`/api/identity-ai?identity_id=${identityId}&lang=${lang}`)
        if (!res.ok) throw new Error('fetch failed')
        const data = await res.json()
        if (!cancelled) {
          setSummary(data.summary)
          setCreatedAt(data.created_at)
        }
      } catch {
        if (!cancelled) {
          setSummary(null)
          setCreatedAt(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [identityId, lang])

  // AI 생성 (스트리밍)
  const generate = useCallback(async () => {
    setGenerating(true)
    setError(null)
    setSummary('') // 스트리밍 시작 전 초기화
    try {
      const res = await fetch('/api/identity-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity_id: identityId, lang: langRef.current }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'AI generation failed' }))
        throw new Error(errData.error || 'AI generation failed')
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('Stream not available')

      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setSummary(accumulated)
      }

      // 스트리밍 완료 후 상태 갱신
      setCreatedAt(new Date().toISOString())
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message || 'AI generation error')
    } finally {
      setGenerating(false)
    }
  }, [identityId]) // lang은 langRef로 접근 — deps에서 제외하여 무한 루프 방지

  // 섹션 파싱
  const sections = useMemo<AISection[]>(
    () => summary ? splitSections(summary) : [],
    [summary]
  )

  // 스트리밍 중 새 섹션 자동 펼침
  useEffect(() => {
    if (generating && sections.length > 0) {
      setOpenSections(new Set(sections.map((_, i) => i)))
    }
  }, [generating, sections.length])

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
          <span className="font-serif" style={{ color: 'var(--gold)', fontSize: '1rem' }}>{t('identity.ai')}</span>
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
          <span className="font-serif" style={{ color: 'var(--gold)', fontSize: '1rem' }}>{t('identity.ai')}</span>
        </div>
        {createdAt && (
          <span style={{ color: '#555', fontSize: '0.75rem' }}>
            {timeAgo(createdAt, t)} {t('identity.ai.created')}
          </span>
        )}
      </div>

      {/* 본문: 아코디언 또는 생성 버튼 */}
      {summary ? (
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
                  allowedKeywords={localizedAllowedKeywords}
                  skillLookup={skillLookup}
                  passiveLookup={passiveLookup}
                  egoLookup={egoLookup}
                  identityLookup={identityLookup}
                  egoGiftLookup={egoGiftLookup}
                  lang={lang}
                  t={t}
                />
              </AccordionSection>
            ))}
          </div>

          {/* 푸터 */}
          <div
            className="flex items-center justify-between gap-2 pt-3"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            {generating ? (
              <span className="flex items-center gap-1.5" style={{ color: sinColor, fontSize: '0.75rem' }}>
                <Loader2 className="animate-spin" style={{ width: '0.75rem', height: '0.75rem' }} />
                {t('identity.ai.streaming')}
              </span>
            ) : (
              (() => {
                // 재생성 권한: admin은 항상, 로그인 유저는 14일 경과 후
                const isExpired = createdAt
                  ? Date.now() - new Date(createdAt).getTime() > 14 * 24 * 60 * 60 * 1000
                  : false
                const canRegenerate = isAdmin || (isLoggedIn && isExpired)

                return (
                  <>
                    <span className="min-w-0" style={{ color: '#555', fontSize: '0.6875rem' }}>
                      {t('identity.ai.disclaimer')}
                    </span>
                    {canRegenerate && (
                      <button
                        onClick={generate}
                        className="flex items-center gap-1 shrink-0 transition-colors"
                        style={{
                          color: '#666',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = sinColor }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#666' }}
                      >
                        <RefreshCw style={{ width: '0.75rem', height: '0.75rem' }} />
                        {t('identity.ai.regenerate')}
                      </button>
                    )}
                  </>
                )
              })()
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-6">
          <p style={{ color: '#666', fontSize: '0.8125rem', marginBottom: '1rem' }}>
            {t('identity.ai.description')}
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
                {t('identity.ai.generating')}
              </>
            ) : (
              <>
                <Sparkles style={{ width: '1rem', height: '1rem' }} />
                {t('identity.ai.generate')}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
