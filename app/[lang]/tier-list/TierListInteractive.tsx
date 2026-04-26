'use client'

import Link from 'next/link'
import { useLocale } from 'next-intl'
import { useCallback, useMemo, useState } from 'react'
import { AlertTriangle, Calculator, RotateCcw } from 'lucide-react'
import { TIERS, type Tier } from '@/lib/tier-list/tierModel'
import type { TierIdentity } from './TierCardInteractive'
import { getTierCategoryLabel, TIER_CATEGORIES, type RatingPeriod, type TierCategory, type TierRatingViewer } from './TierRatingModal'
import { motion } from 'framer-motion'
import ScrollReveal from '@/components/ui/ScrollReveal'
import { fadeInUp } from '@/lib/animations'
import TierGrid from './TierGrid'

type TierData = Partial<Record<Tier, TierIdentity[]>>
type SupportedLocale = 'ko' | 'en' | 'ja'
const PERIOD_OPTIONS: RatingPeriod[] = ['7d', '30d', '1y', 'all']

type DiagnosisEntry = {
  id: string
  name: string
  sinnerId: string
  sinnerName: string
  tier: Tier
  score: number
}

type DiagnosisResult = {
  selected: DiagnosisEntry[]
  counted: DiagnosisEntry[]
  ignored: DiagnosisEntry[]
  score: number
  verdict: {
    label: string
    detail: string
    color: string
    background: string
    border: string
  }
}

const PERIOD_LABELS: Record<SupportedLocale, Record<RatingPeriod, string>> = {
  ko: { '7d': '7일', '30d': '30일', '1y': '1년', all: '전체' },
  en: { '7d': '7D', '30d': '30D', '1y': '1Y', all: 'All' },
  ja: { '7d': '7日', '30d': '30日', '1y': '1年', all: '全期間' },
}

const DIAGNOSIS_COPY = {
  ko: {
    eyebrow: '리세 자가진단',
    title: '선택한 인격으로 이륙 판단',
    description: '진단 모드를 켜면 카드 선택으로 이륙 점수를 계산합니다. 끄면 카드가 평가 모달을 엽니다.',
    modeOn: '진단 모드 켜짐',
    modeOff: '진단 모드 꺼짐',
    modeOnAction: '진단 모드 끄기',
    modeOffAction: '진단 모드 켜기',
    modeOnHint: '카드를 눌러 선택',
    modeOffHint: '카드를 눌러 평가 보기',
    empty: '리세에서 뽑은 인격을 선택하세요.',
    selected: '선택',
    counted: '반영',
    duplicate: '중복 제외',
    reset: '초기화',
    score: '진단 점수',
    strong: '강한 이륙권',
    strongDetail: '핵심 수감자가 겹치지 않아 바로 시작해도 좋습니다.',
    launchable: '이륙 가능',
    launchableDetail: '충분히 시작 가능한 계정입니다. 애매하면 질문 후 결정하세요.',
    reroll: '리세 권장',
    rerollDetail: '유효 수감자 수가 부족합니다. 한 번 더 노려보는 편이 좋습니다.',
  },
  en: {
    eyebrow: 'Reroll diagnosis',
    title: 'Launch check from selected identities',
    description: 'Turn diagnosis mode on to select cards for the launch score. Turn it off to open rating modals.',
    modeOn: 'Diagnosis on',
    modeOff: 'Diagnosis off',
    modeOnAction: 'Turn diagnosis off',
    modeOffAction: 'Turn diagnosis on',
    modeOnHint: 'Tap cards to select',
    modeOffHint: 'Tap cards to view ratings',
    empty: 'Select the identities you pulled for reroll.',
    selected: 'Selected',
    counted: 'Counted',
    duplicate: 'Duplicates ignored',
    reset: 'Reset',
    score: 'Score',
    strong: 'Strong launch',
    strongDetail: 'Enough non-overlapping core sinners to start confidently.',
    launchable: 'Launchable',
    launchableDetail: 'Good enough to start. Ask before committing if unsure.',
    reroll: 'Keep rerolling',
    rerollDetail: 'The account is short on valid non-duplicate picks.',
  },
  ja: {
    eyebrow: 'リセマラ診断',
    title: '選択した人格で開始判定',
    description: '診断モードをオンにするとカード選択で開始点を計算します。オフでは評価を開きます。',
    modeOn: '診断モード オン',
    modeOff: '診断モード オフ',
    modeOnAction: '診断モードをオフ',
    modeOffAction: '診断モードをオン',
    modeOnHint: 'カードを押して選択',
    modeOffHint: 'カードを押して評価',
    empty: 'リセマラで引いた人格を選択してください。',
    selected: '選択',
    counted: '反映',
    duplicate: '重複除外',
    reset: 'リセット',
    score: '診断点',
    strong: '強く開始推奨',
    strongDetail: '主要囚人が重複せず、安心して開始できます。',
    launchable: '開始可能',
    launchableDetail: '十分に開始できます。迷う場合は相談して決めてください。',
    reroll: '続行推奨',
    rerollDetail: '有効な非重複人格が不足しています。',
  },
} as const

const DIAGNOSIS_TIER_SCORES: Record<Tier, number> = {
  'S+': 3.0,
  S: 2.8,
  'S-': 2.6,
  'A+': 2.3,
  A: 2.0,
  'A-': 1.8,
  'B+': 1.5,
  B: 1.3,
  'B-': 1.1,
  'C+': 0.8,
  C: 0.6,
  'C-': 0.4,
  F: 0,
  'N/A': 0,
}

function normalizeLocale(locale: string): SupportedLocale {
  return locale === 'en' || locale === 'ja' ? locale : 'ko'
}

function getTierListHref(locale: SupportedLocale, category: TierCategory, period: RatingPeriod) {
  const params = new URLSearchParams()
  if (category !== 'overall') params.set('category', category)
  if (period !== 'all') params.set('period', period)
  const query = params.toString()
  return query ? `/${locale}/tier-list?${query}` : `/${locale}/tier-list`
}

function getLocalizedIdentityName(identity: TierIdentity, locale: SupportedLocale) {
  if (locale === 'en') return identity.name_en ?? identity.name ?? identity.name_kr ?? identity.name_jp ?? ''
  if (locale === 'ja') return identity.name_jp ?? identity.name ?? identity.name_kr ?? identity.name_en ?? ''
  return identity.name_kr ?? identity.name ?? identity.name_en ?? identity.name_jp ?? ''
}

function getLocalizedSinnerName(identity: TierIdentity, locale: SupportedLocale) {
  const sinner = identity.sinner
  if (!sinner) return identity.sinner_id
  if (locale === 'en') return sinner.name_en ?? sinner.name ?? sinner.name_kr ?? sinner.name_jp ?? identity.sinner_id
  if (locale === 'ja') return sinner.name_jp ?? sinner.name ?? sinner.name_kr ?? sinner.name_en ?? identity.sinner_id
  return sinner.name_kr ?? sinner.name ?? sinner.name_en ?? sinner.name_jp ?? identity.sinner_id
}

function getDiagnosisVerdict(score: number, locale: SupportedLocale): DiagnosisResult['verdict'] {
  const copy = DIAGNOSIS_COPY[locale]
  if (score >= 7.0) {
    return {
      label: copy.strong,
      detail: copy.strongDetail,
      color: '#77d36f',
      background: 'rgba(96,200,96,0.1)',
      border: 'rgba(96,200,96,0.28)',
    }
  }
  if (score >= 5.5) {
    return {
      label: copy.launchable,
      detail: copy.launchableDetail,
      color: '#ffd040',
      background: 'rgba(255,208,64,0.1)',
      border: 'rgba(255,208,64,0.28)',
    }
  }
  return {
    label: copy.reroll,
    detail: copy.rerollDetail,
    color: '#ff6f5f',
    background: 'rgba(255,80,80,0.1)',
    border: 'rgba(255,80,80,0.28)',
  }
}

function buildDiagnosisResult(
  tiers: TierData,
  selectedIds: Set<string>,
  locale: SupportedLocale,
): DiagnosisResult {
  const selected: DiagnosisEntry[] = []
  for (const tier of TIERS) {
    for (const identity of tiers[tier] ?? []) {
      if (!selectedIds.has(identity.id)) continue
      selected.push({
        id: identity.id,
        name: getLocalizedIdentityName(identity, locale),
        sinnerId: identity.sinner_id,
        sinnerName: getLocalizedSinnerName(identity, locale),
        tier,
        score: DIAGNOSIS_TIER_SCORES[tier],
      })
    }
  }

  const bestBySinner = new Map<string, DiagnosisEntry>()
  const ignored: DiagnosisEntry[] = []
  for (const entry of selected) {
    const existing = bestBySinner.get(entry.sinnerId)
    if (!existing) {
      bestBySinner.set(entry.sinnerId, entry)
      continue
    }
    if (entry.score > existing.score) {
      ignored.push(existing)
      bestBySinner.set(entry.sinnerId, entry)
    } else {
      ignored.push(entry)
    }
  }

  const counted = Array.from(bestBySinner.values()).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, locale))
  const score = counted.reduce((sum, entry) => sum + entry.score, 0)
  return {
    selected,
    counted,
    ignored: ignored.sort((a, b) => a.sinnerName.localeCompare(b.sinnerName, locale) || a.name.localeCompare(b.name, locale)),
    score,
    verdict: getDiagnosisVerdict(score, locale),
  }
}

function RerollDiagnosisPanel({
  result,
  diagnosisMode,
  onToggleMode,
  onReset,
}: {
  result: DiagnosisResult
  diagnosisMode: boolean
  onToggleMode: () => void
  onReset: () => void
}) {
  const locale = normalizeLocale(useLocale())
  const copy = DIAGNOSIS_COPY[locale]
  const hasSelection = result.selected.length > 0

  return (
    <>
      <section
        aria-labelledby="reroll-diagnosis-title"
        style={{
          margin: '0 0 1rem',
          background: 'linear-gradient(135deg, rgba(26,21,16,0.96), rgba(13,11,8,0.96))',
          border: '1px solid rgba(200,144,10,0.22)',
          borderRadius: '0.5rem',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.03)',
          overflow: 'hidden',
        }}
      >
        <div
          className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(17rem,0.8fr)]"
          style={{ padding: '0.875rem' }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--gold)', fontSize: '0.6875rem', fontWeight: 800 }}>
              <Calculator size={14} aria-hidden="true" />
              <span>{copy.eyebrow}</span>
            </div>
            <h2
              id="reroll-diagnosis-title"
              className="font-serif"
              style={{ color: '#f0dfba', fontSize: '1rem', fontWeight: 500, lineHeight: 1.45, marginTop: '0.375rem' }}
            >
              {copy.title}
            </h2>
            <p style={{ color: '#8a7855', fontSize: '0.8125rem', lineHeight: 1.6, marginTop: '0.25rem' }}>
              {copy.description}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-pressed={diagnosisMode}
                onClick={onToggleMode}
                style={{
                  minHeight: '2.5rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0 0.75rem',
                  borderRadius: '999rem',
                  border: diagnosisMode ? '1px solid rgba(232,176,48,0.68)' : '1px solid rgba(138,120,85,0.32)',
                  background: diagnosisMode ? 'rgba(200,144,10,0.2)' : 'rgba(13,11,8,0.72)',
                  color: diagnosisMode ? '#f0dfba' : '#9d8b66',
                  fontSize: '0.8125rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: '0.625rem',
                    height: '0.625rem',
                    borderRadius: '999rem',
                    background: diagnosisMode ? 'var(--gold)' : '#75685a',
                    boxShadow: diagnosisMode ? '0 0 0 0.1875rem rgba(200,144,10,0.18)' : 'none',
                  }}
                />
                {diagnosisMode ? copy.modeOnAction : copy.modeOffAction}
              </button>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  minHeight: '2rem',
                  color: diagnosisMode ? '#d8c99b' : '#75685a',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                {diagnosisMode ? copy.modeOnHint : copy.modeOffHint}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {hasSelection ? result.selected.map(entry => {
                const ignored = result.ignored.some(item => item.id === entry.id)
                return (
                  <span
                    key={entry.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      minHeight: '1.625rem',
                      maxWidth: '100%',
                      padding: '0 0.5rem',
                      borderRadius: '999rem',
                      background: ignored ? 'rgba(117,104,90,0.16)' : 'rgba(200,144,10,0.12)',
                      border: ignored ? '1px solid rgba(117,104,90,0.26)' : '1px solid rgba(200,144,10,0.24)',
                      color: ignored ? '#8a7855' : '#d8c99b',
                      fontSize: '0.75rem',
                      textDecoration: ignored ? 'line-through' : 'none',
                    }}
                  >
                    <span style={{ fontFamily: 'var(--font-mono)', color: ignored ? '#75685a' : 'var(--gold)' }}>{entry.tier}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</span>
                  </span>
                )
              }) : (
                <span style={{ color: '#75685a', fontSize: '0.8125rem' }}>{copy.empty}</span>
              )}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gap: '0.625rem',
              alignContent: 'start',
            }}
          >
            <div
              style={{
                padding: '0.75rem',
                borderRadius: '0.5rem',
                background: result.verdict.background,
                border: `1px solid ${result.verdict.border}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem' }}>
                <span style={{ color: '#8a7855', fontSize: '0.75rem', fontWeight: 700 }}>{copy.score}</span>
                <strong style={{ color: result.verdict.color, fontFamily: 'var(--font-mono)', fontSize: '1.5rem', lineHeight: 1 }}>
                  {result.score.toFixed(1)}
                </strong>
              </div>
              <p style={{ color: result.verdict.color, fontSize: '0.875rem', fontWeight: 800, marginTop: '0.375rem' }}>
                {result.verdict.label}
              </p>
              <p style={{ color: '#b8a77e', fontSize: '0.75rem', lineHeight: 1.5, marginTop: '0.125rem' }}>
                {result.verdict.detail}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5" style={{ color: '#8a7855', fontSize: '0.6875rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>{copy.selected} <b style={{ color: '#d8c99b', fontFamily: 'var(--font-mono)' }}>{result.selected.length}</b></span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>{copy.counted} <b style={{ color: '#d8c99b', fontFamily: 'var(--font-mono)' }}>{result.counted.length}</b></span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>{copy.duplicate} <b style={{ color: result.ignored.length ? '#ffb86b' : '#d8c99b', fontFamily: 'var(--font-mono)' }}>{result.ignored.length}</b></span>
            </div>
            {result.ignored.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.375rem', color: '#c6924a', fontSize: '0.75rem', lineHeight: 1.45 }}>
                <AlertTriangle size={14} aria-hidden="true" style={{ flex: '0 0 auto', marginTop: '0.0625rem' }} />
                <span>
                  {result.ignored.map(item => `${item.sinnerName}: ${item.name}`).join(' / ')}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={onReset}
              disabled={!hasSelection}
              style={{
                justifySelf: 'start',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                minHeight: '2rem',
                padding: '0 0.625rem',
                borderRadius: '0.375rem',
                border: '1px solid rgba(200,144,10,0.26)',
                background: hasSelection ? 'rgba(200,144,10,0.08)' : 'rgba(117,104,90,0.08)',
                color: hasSelection ? '#d8c99b' : '#75685a',
                cursor: hasSelection ? 'pointer' : 'not-allowed',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              <RotateCcw size={13} aria-hidden="true" />
              {copy.reset}
            </button>
          </div>
        </div>
      </section>

      {hasSelection && (
        <div
          aria-live="polite"
          style={{
            position: 'sticky',
            bottom: '0.75rem',
            zIndex: 20,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
            margin: '0.25rem 0 1rem',
          }}
        >
          <div
            style={{
              pointerEvents: 'auto',
              width: 'min(100%, 34rem)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              padding: '0.625rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'rgba(20,16,12,0.96)',
              border: '1px solid rgba(200,144,10,0.28)',
              boxShadow: '0 0.75rem 2rem rgba(0,0,0,0.45)',
              backdropFilter: 'blur(0.5rem)',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ color: result.verdict.color, fontSize: '0.8125rem', fontWeight: 800 }}>{result.verdict.label}</div>
              <div style={{ color: '#8a7855', fontSize: '0.6875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {copy.counted} {result.counted.length} / {copy.duplicate} {result.ignored.length}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexShrink: 0 }}>
              <strong style={{ color: result.verdict.color, fontFamily: 'var(--font-mono)', fontSize: '1.125rem' }}>{result.score.toFixed(1)}</strong>
              <button
                type="button"
                onClick={onReset}
                aria-label={copy.reset}
                style={{
                  width: '2rem',
                  height: '2rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '0.375rem',
                  border: '1px solid rgba(200,144,10,0.24)',
                  background: 'rgba(13,11,8,0.75)',
                  color: '#d8c99b',
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={13} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function TierListInteractive({
  tiers,
  category,
  period,
  viewer,
}: {
  tiers: TierData
  category: TierCategory
  period: RatingPeriod
  viewer: TierRatingViewer
}) {
  const locale = normalizeLocale(useLocale())
  const [selectedDiagnosisIds, setSelectedDiagnosisIds] = useState<Set<string>>(() => new Set())
  const [diagnosisMode, setDiagnosisMode] = useState(false)
  const hasTiers = TIERS.some(t => (tiers[t]?.length ?? 0) > 0)
  const activeCategoryLabel = getTierCategoryLabel(category, locale)
  const motionKey = useMemo(() => `${category}:${period}`, [category, period])
  const diagnosisEnabled = category === 'reroll'
  const diagnosisResult = useMemo(
    () => diagnosisEnabled ? buildDiagnosisResult(tiers, selectedDiagnosisIds, locale) : null,
    [diagnosisEnabled, locale, selectedDiagnosisIds, tiers],
  )
  const toggleDiagnosisIdentity = useCallback((identityId: string) => {
    setSelectedDiagnosisIds(prev => {
      const next = new Set(prev)
      if (next.has(identityId)) next.delete(identityId)
      else next.add(identityId)
      return next
    })
  }, [])
  const toggleDiagnosisMode = useCallback(() => {
    setDiagnosisMode(value => !value)
  }, [])
  const resetDiagnosis = useCallback(() => {
    setSelectedDiagnosisIds(new Set())
  }, [])

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 pb-16" style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <ScrollReveal variant={fadeInUp} as="div">
          <div className="mb-5">
            <div
              className="mx-auto flex w-full max-w-lg items-center"
              style={{
                padding: '0.25rem',
                background: '#14100c',
                border: '1px solid rgba(200,144,10,0.22)',
                borderRadius: '0.5rem',
              }}
            >
              {TIER_CATEGORIES.map(item => {
                const selected = category === item.key
                return (
                  <Link
                    key={item.key}
                    href={getTierListHref(locale, item.key, period)}
                    aria-current={selected ? 'page' : undefined}
                    data-tier-tab={item.key}
                    scroll={false}
                    prefetch={false}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: '2.25rem',
                      borderRadius: '0.375rem',
                      background: selected ? 'rgba(200,144,10,0.18)' : 'transparent',
                      border: selected ? '1px solid rgba(200,144,10,0.35)' : '1px solid transparent',
                      color: selected ? 'var(--gold)' : '#8a7855',
                      fontSize: '0.875rem',
                      fontWeight: selected ? 700 : 500,
                      cursor: 'pointer',
                      textDecoration: 'none',
                      transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                    }}
                  >
                    {getTierCategoryLabel(item.key, locale)}
                  </Link>
                )
              })}
            </div>
            <div
              className="mx-auto mt-2.5 flex w-full max-w-lg items-center justify-center gap-1.5 overflow-x-auto"
              style={{
                padding: '0.0625rem 0.125rem 0.1875rem',
                background: 'transparent',
                border: 0,
                scrollbarWidth: 'none',
              }}
            >
              {PERIOD_OPTIONS.map(item => {
                const selected = period === item
                return (
                  <Link
                    key={item}
                    href={getTierListHref(locale, category, item)}
                    aria-current={selected ? 'true' : undefined}
                    scroll={false}
                    prefetch={false}
                    style={{
                      flex: '0 0 auto',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: '1.625rem',
                      borderRadius: '999rem',
                      background: selected ? 'rgba(200,144,10,0.12)' : 'rgba(13,11,8,0.24)',
                      border: selected ? '1px solid rgba(200,144,10,0.34)' : '1px solid rgba(138,120,85,0.18)',
                      color: selected ? '#d8b04a' : '#8a7855',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.6875rem',
                      fontWeight: selected ? 800 : 600,
                      padding: '0 0.625rem',
                      textDecoration: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {PERIOD_LABELS[locale][item]}
                  </Link>
                )
              })}
            </div>
          </div>
        </ScrollReveal>

        {!hasTiers ? (
          <div
            className="text-center"
            style={{
              padding: '3rem 1rem',
              background: '#14100c',
              border: '1px dashed rgba(200,144,10,0.24)',
              borderRadius: '0.5rem',
            }}
          >
            <p style={{ color: 'var(--gold)', fontSize: '0.875rem', fontWeight: 700 }}>
              {activeCategoryLabel}
            </p>
            <p style={{ color: '#888888', fontSize: '0.875rem', marginTop: '0.375rem' }}>
              측정 대상 인격을 불러오지 못했습니다.
            </p>
          </div>
        ) : (
          <>
            {diagnosisEnabled && diagnosisResult && (
              <RerollDiagnosisPanel
                result={diagnosisResult}
                diagnosisMode={diagnosisMode}
                onToggleMode={toggleDiagnosisMode}
                onReset={resetDiagnosis}
              />
            )}
            <motion.div
              key={motionKey}
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.1, delayChildren: 0.3 } },
              }}
            >
              <TierGrid
                tiers={tiers}
                category={category}
                period={period}
                viewer={viewer}
                diagnosisMode={diagnosisEnabled && diagnosisMode}
                selectedDiagnosisIds={diagnosisEnabled ? selectedDiagnosisIds : undefined}
                onToggleDiagnosis={diagnosisEnabled ? toggleDiagnosisIdentity : undefined}
              />
            </motion.div>
          </>
        )}
      </div>
    </div>
  )
}
