'use client'

import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { BarChart3, CalendarDays, Flag, MessageSquare, PackageSearch, Send, Sparkles, Star, X } from 'lucide-react'
import { motion } from 'motion/react'
import BaseModal from '@/components/ui/BaseModal'
import { STORAGE_BASE } from '@/lib/constants/game'
import { getIdentityInfoUrl, RARITY_ICON_MAP, type Identity } from '@/lib/data/sinners'
import { getTierTextColor, TIER_COLORS, type Tier } from '@/lib/tier-list/tierModel'
import type { TierIdentity } from './TierCardInteractive'

export const TIER_CATEGORIES = [
  { key: 'overall', label: '종합', shortLabel: '종합', labels: { ko: '종합', en: 'Overall', ja: '総合' } },
  { key: 'reroll', label: '리세', shortLabel: '리세', labels: { ko: '리세', en: 'Reroll', ja: 'リセマラ' } },
  { key: 'goodstuff', label: '굿스터프', shortLabel: '굿스터프', labels: { ko: '굿스터프', en: 'Goodstuff', ja: 'グッドスタッフ' } },
  { key: 'mirror_dungeon', label: '거던', shortLabel: '거던', labels: { ko: '거던', en: 'Mirror Dungeon', ja: '鏡ダンジョン' } },
] as const

export type TierCategory = typeof TIER_CATEGORIES[number]['key']
export type RatingPeriod = '7d' | '30d' | '1y' | 'all'
type SupportedLocale = 'ko' | 'en' | 'ja'
type SourceCategory = 'reroll' | 'mirror_dungeon' | 'goodstuff'
type SourceAggregate = {
  averageScore: number | null
  ratingCount: number
  derivedTier?: Tier
}
export type TierRatingViewer = {
  authenticated: boolean
  canRate: boolean
  reason: 'login_required' | 'account_too_new' | 'suspended' | 'eligible' | 'overall_readonly'
  accountAgeDays: number | null
}

function normalizeLocale(locale: string): SupportedLocale {
  return locale === 'en' || locale === 'ja' ? locale : 'ko'
}

export function getTierCategoryLabel(category: TierCategory, locale: string) {
  const normalized = normalizeLocale(locale)
  return TIER_CATEGORIES.find(item => item.key === category)?.labels[normalized] ?? TIER_CATEGORIES[0].labels[normalized]
}

const MODAL_COPY = {
  ko: {
    description: '티어 평가 모달',
    autoBasis: '리세마라·굿스터프·거울 던전 기반 자동 산출',
    communityTier: '커뮤니티 평가 기준 티어',
    noRatingData: '아직 평가 데이터가 없습니다.',
    lowConfidenceWarning: '평가 데이터 부족: 표본이 적어 티어가 변동될 수 있습니다.',
    aggregate: '평가 집계',
    basisCount: '개 기준',
    people: '명',
    aggregateCount: (count: number, isOverall: boolean) => `${count}${isOverall ? '개 기준' : '명'}`,
    myRating: '내 평가',
    sourceOverview: '카테고리 평균',
    sourceAverageLabels: {
      reroll: '리세마라 평균',
      mirror_dungeon: '거울 던전 평균',
      goodstuff: '굿스터프 평균',
    },
    scoreUnavailable: '측정 안됨',
    ratingCount: (count: number) => `${count}명`,
    readonlyNotice: '종합은 자동 계산 항목이라 직접 평가를 등록하지 않습니다.',
    readonlyMessage: '종합은 리세마라, 굿스터프, 거울 던전 평가 평균으로 자동 계산됩니다.',
    eligibleMessage: '평가를 저장할 수 있습니다.',
    loginRequired: '로그인 후 평가를 남길 수 있습니다.',
    accountTooNew: (left: number) => `계정 생성 후 14일이 지나야 평가할 수 있습니다. 남은 기간: ${left}일`,
    suspended: '이 계정은 평가 작성이 제한되어 있습니다.',
    lockedTitle: '평가 잠김',
    placeholder: '한줄 평가를 남기세요',
    readonlyPlaceholder: '종합은 자동 계산되어 직접 코멘트를 받지 않습니다',
    saving: '저장 중',
    save: '저장',
    update: '수정',
    delete: '삭제',
    deleting: '삭제 중',
    scoreControlLabel: '평가 점수',
    scoreDecrease: '점수 낮추기',
    scoreIncrease: '점수 높이기',
    auto: '자동 산출',
    comments: '평가 코멘트',
    noComments: '아직 등록된 코멘트가 없습니다.',
    close: '닫기',
    identityInfo: '인격 정보',
    release: '출시',
    acquisition: '획득',
    extraction: '추출',
    fragment: '파편',
    targetExtraction: '대상 추출',
    acquisitionTypes: {
      default: '기본',
      standard: '상시',
      event: '이벤트',
      walpurgis: '발푸르기스',
      attendance: '출석',
    },
    gachaTypes: {
      always: '상시 추출',
      seasonal: '시즌 추출',
      walpurgis: '발푸르기스 밤',
      none: '추출 불가',
    },
    fragmentAlways: (cost: number) => `파편 ${cost}개 · 상시`,
    fragmentWalpurgis: (cost: number) => `파편 ${cost}개 · 발푸르기스밤 한정`,
    fragmentSeasonal: (cost: number, releaseSeason: number, permanentSeason?: number) => (
      permanentSeason
        ? `파편 ${cost}개 · 출시 7일 후 ~ S${releaseSeason}, S${permanentSeason} ~ 상시`
        : `파편 ${cost}개 · 상시`
    ),
    fragmentFromSeason: (cost: number, permanentSeason?: number) => (
      permanentSeason ? `파편 ${cost}개 · S${permanentSeason} ~ 상시` : `파편 ${cost}개 · 상시`
    ),
    walpurgisEdition: (edition: number) => `${edition}회차`,
    adminFallback: '관리자',
    rarityAlt: (rarity: number) => `${rarity}성`,
    fetchError: '평가 데이터를 불러오지 못했습니다.',
    saveError: '평가 저장에 실패했습니다.',
    deleteError: '평가 삭제에 실패했습니다.',
    report: '신고',
    reporting: '신고 중',
    reportSuccess: '신고가 접수되었습니다.',
    reportError: '신고를 접수하지 못했습니다.',
  },
  en: {
    description: 'tier rating modal',
    autoBasis: 'Auto-calculated from Reroll, Goodstuff, and Mirror Dungeon',
    communityTier: 'Community rating tier',
    noRatingData: 'No rating data yet.',
    lowConfidenceWarning: 'Low rating confidence: the sample is small, so this tier may change.',
    aggregate: 'Rating Aggregate',
    basisCount: 'sources',
    people: 'ratings',
    aggregateCount: (count: number, isOverall: boolean) => `${count} ${isOverall ? 'sources' : 'ratings'}`,
    myRating: 'My Rating',
    sourceOverview: 'Source Averages',
    sourceAverageLabels: {
      reroll: 'Reroll Avg',
      mirror_dungeon: 'Mirror Dungeon Avg',
      goodstuff: 'Goodstuff Avg',
    },
    scoreUnavailable: 'N/A',
    ratingCount: (count: number) => `${count} ratings`,
    readonlyNotice: 'Overall is auto-calculated, so direct ratings are not accepted.',
    readonlyMessage: 'Overall is calculated from Reroll, Goodstuff, and Mirror Dungeon rating averages.',
    eligibleMessage: 'You can save a rating.',
    loginRequired: 'Sign in to leave a rating.',
    accountTooNew: (left: number) => `Ratings unlock 14 days after account creation. ${left} day(s) remaining.`,
    suspended: 'This account is restricted from posting ratings.',
    lockedTitle: 'Rating locked',
    placeholder: 'Leave a short comment',
    readonlyPlaceholder: 'Overall is auto-calculated and does not accept comments',
    saving: 'Saving',
    save: 'Save',
    update: 'Update',
    delete: 'Delete',
    deleting: 'Deleting',
    scoreControlLabel: 'Rating score',
    scoreDecrease: 'Decrease score',
    scoreIncrease: 'Increase score',
    auto: 'Auto',
    comments: 'Rating Comments',
    noComments: 'No comments yet.',
    close: 'Close',
    identityInfo: 'Identity Info',
    release: 'Release',
    acquisition: 'Acquisition',
    extraction: 'Extraction',
    fragment: 'Shards',
    targetExtraction: 'target extraction',
    acquisitionTypes: {
      default: 'Default',
      standard: 'Standard',
      event: 'Event',
      walpurgis: 'Walpurgis',
      attendance: 'Login',
    },
    gachaTypes: {
      always: 'Standard extraction',
      seasonal: 'Seasonal extraction',
      walpurgis: 'Walpurgis Night',
      none: 'No extraction',
    },
    fragmentAlways: (cost: number) => `${cost} shards · always`,
    fragmentWalpurgis: (cost: number) => `${cost} shards · Walpurgis Night limited`,
    fragmentSeasonal: (cost: number, releaseSeason: number, permanentSeason?: number) => (
      permanentSeason
        ? `${cost} shards · 7 days after release ~ S${releaseSeason}, S${permanentSeason}+ always`
        : `${cost} shards · always`
    ),
    fragmentFromSeason: (cost: number, permanentSeason?: number) => (
      permanentSeason ? `${cost} shards · S${permanentSeason}+ always` : `${cost} shards · always`
    ),
    walpurgisEdition: (edition: number) => `Edition ${edition}`,
    adminFallback: 'Admin',
    rarityAlt: (rarity: number) => `${rarity}-star`,
    fetchError: 'Failed to load rating data.',
    saveError: 'Failed to save rating.',
    deleteError: 'Failed to delete rating.',
    report: 'Report',
    reporting: 'Reporting',
    reportSuccess: 'Report submitted.',
    reportError: 'Failed to submit report.',
  },
  ja: {
    description: 'ティア評価モーダル',
    autoBasis: 'リセマラ・グッドスタッフ・鏡ダンジョンから自動算出',
    communityTier: 'コミュニティ評価基準ティア',
    noRatingData: '評価データはまだありません。',
    lowConfidenceWarning: '評価データ不足: サンプルが少ないため、ティアが変動する可能性があります。',
    aggregate: '評価集計',
    basisCount: '件基準',
    people: '件',
    aggregateCount: (count: number, isOverall: boolean) => `${count}${isOverall ? '件基準' : '件'}`,
    myRating: '自分の評価',
    sourceOverview: 'カテゴリ平均',
    sourceAverageLabels: {
      reroll: 'リセマラ平均',
      mirror_dungeon: '鏡ダンジョン平均',
      goodstuff: 'グッドスタッフ平均',
    },
    scoreUnavailable: '未測定',
    ratingCount: (count: number) => `${count}件`,
    readonlyNotice: '総合は自動計算のため、直接評価は登録できません。',
    readonlyMessage: '総合はリセマラ、グッドスタッフ、鏡ダンジョンの評価平均から自動計算されます。',
    eligibleMessage: '評価を保存できます。',
    loginRequired: 'ログインすると評価を残せます。',
    accountTooNew: (left: number) => `アカウント作成から14日後に評価できます。残り${left}日`,
    suspended: 'このアカウントは評価投稿が制限されています。',
    lockedTitle: '評価ロック',
    placeholder: '短い評価を入力',
    readonlyPlaceholder: '総合は自動計算のためコメントを受け付けません',
    saving: '保存中',
    save: '保存',
    update: '更新',
    delete: '削除',
    deleting: '削除中',
    scoreControlLabel: '評価スコア',
    scoreDecrease: 'スコアを下げる',
    scoreIncrease: 'スコアを上げる',
    auto: '自動算出',
    comments: '評価コメント',
    noComments: 'コメントはまだありません。',
    close: '閉じる',
    identityInfo: '人格情報',
    release: 'リリース',
    acquisition: '入手',
    extraction: '抽出',
    fragment: '破片',
    targetExtraction: '対象抽出',
    acquisitionTypes: {
      default: '基本',
      standard: '恒常',
      event: 'イベント',
      walpurgis: 'ヴァルプルギス',
      attendance: 'ログイン',
    },
    gachaTypes: {
      always: '恒常抽出',
      seasonal: 'シーズン抽出',
      walpurgis: 'ヴァルプルギスの夜',
      none: '抽出不可',
    },
    fragmentAlways: (cost: number) => `破片${cost}個 · 常設`,
    fragmentWalpurgis: (cost: number) => `破片${cost}個 · ヴァルプルギスの夜限定`,
    fragmentSeasonal: (cost: number, releaseSeason: number, permanentSeason?: number) => (
      permanentSeason
        ? `破片${cost}個 · リリース7日後 ~ S${releaseSeason}, S${permanentSeason}以降 常設`
        : `破片${cost}個 · 常設`
    ),
    fragmentFromSeason: (cost: number, permanentSeason?: number) => (
      permanentSeason ? `破片${cost}個 · S${permanentSeason}以降 常設` : `破片${cost}個 · 常設`
    ),
    walpurgisEdition: (edition: number) => `第${edition}回`,
    adminFallback: '管理者',
    rarityAlt: (rarity: number) => `${rarity}星`,
    fetchError: '評価データを読み込めませんでした。',
    saveError: '評価の保存に失敗しました。',
    deleteError: '評価の削除に失敗しました。',
    report: '通報',
    reporting: '送信中',
    reportSuccess: '通報を受け付けました。',
    reportError: '通報を送信できませんでした。',
  },
} as const

type ReportState = {
  status: 'pending' | 'success' | 'error'
  message: string
}

type TierRatingResponse = {
  aggregate: {
    averageScore: number | null
    ratingCount: number
    derivedTier: Tier
    distribution: Record<number, number>
  }
  comments: Array<{
    id: string
    score: number
    comment: string
    created_at: string
    category?: TierCategory
    username: string | null
    avatar_url: string | null
    role: string | null
  }>
  sourceAggregates?: Partial<Record<SourceCategory, SourceAggregate>> | Array<SourceAggregate & { category: SourceCategory }>
  myRating: null | {
    id: string
    score: number
    comment: string
  }
  viewer: TierRatingViewer
}

const EMPTY_RATING: TierRatingResponse = {
  aggregate: {
    averageScore: null,
    ratingCount: 0,
    derivedTier: 'N/A',
    distribution: {},
  },
  comments: [],
  myRating: null,
  viewer: {
    authenticated: false,
    canRate: false,
    reason: 'login_required',
    accountAgeDays: null,
  },
}

const SCORE_OPTIONS = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
const SOURCE_CATEGORY_ORDER: SourceCategory[] = ['reroll', 'mirror_dungeon', 'goodstuff']
const LOW_CONFIDENCE_RATING_COUNT = 5
const CURRENT_SEASON = 7
const LOCK_ICON_URL = `${STORAGE_BASE}/icons/ui/lock.webp`
const EGO_SHARD_SLUG_BY_SINNER_ID: Record<string, string> = {
  '1': 'yi-sang',
  '2': 'faust',
  '3': 'don-quixote',
  '4': 'ryoshu',
  '5': 'meursault',
  '6': 'hong-lu',
  '7': 'heathcliff',
  '8': 'ishmael',
  '9': 'rodion',
  '10': 'sinclair',
  '11': 'outis',
  '12': 'gregor',
  'yi-sang': 'yi-sang',
  faust: 'faust',
  'don-quixote': 'don-quixote',
  ryoshu: 'ryoshu',
  meursault: 'meursault',
  'hong-lu': 'hong-lu',
  heathcliff: 'heathcliff',
  ishmael: 'ishmael',
  rodion: 'rodion',
  sinclair: 'sinclair',
  outis: 'outis',
  gregor: 'gregor',
}

function getEgoShardIconUrl(sinnerId: string) {
  const slug = EGO_SHARD_SLUG_BY_SINNER_ID[sinnerId]
  return slug ? `${STORAGE_BASE}/icons/ego-shards/${slug}.webp` : null
}

function getViewerMessage(viewer: TierRatingResponse['viewer'], copy: typeof MODAL_COPY[SupportedLocale]) {
  if (viewer.reason === 'eligible') return copy.eligibleMessage
  if (viewer.reason === 'overall_readonly') return copy.readonlyMessage
  if (viewer.reason === 'account_too_new') {
    const left = viewer.accountAgeDays === null ? 14 : Math.max(0, 14 - viewer.accountAgeDays)
    return copy.accountTooNew(left)
  }
  if (viewer.reason === 'suspended') return copy.suspended
  return copy.loginRequired
}

function getAcquisitionType(info: Identity['acquisition_info'], copy: typeof MODAL_COPY[SupportedLocale]) {
  if (!info) return null
  const labels: Record<string, { label: string; color: string; bg: string }> = {
    default: { label: copy.acquisitionTypes.default, color: '#8a8a8a', bg: 'rgba(138,138,138,0.12)' },
    standard: { label: copy.acquisitionTypes.standard, color: '#6bbbff', bg: 'rgba(107,187,255,0.12)' },
    event: { label: copy.acquisitionTypes.event, color: '#ff9f43', bg: 'rgba(255,159,67,0.12)' },
    walpurgis: { label: copy.acquisitionTypes.walpurgis, color: '#7bed9f', bg: 'rgba(123,237,159,0.12)' },
    attendance: { label: copy.acquisitionTypes.attendance, color: '#a29bfe', bg: 'rgba(162,155,254,0.12)' },
  }
  return labels[info.type] ?? labels.standard
}

function getGachaLabel(info: Identity['acquisition_info'], copy: typeof MODAL_COPY[SupportedLocale]) {
  if (!info) return null
  const labels: Record<string, { label: string; color: string }> = {
    always: { label: copy.gachaTypes.always, color: '#6bbbff' },
    seasonal: { label: copy.gachaTypes.seasonal, color: '#ffa502' },
    walpurgis: { label: copy.gachaTypes.walpurgis, color: '#7bed9f' },
    none: { label: copy.gachaTypes.none, color: '#999' },
  }
  return labels[info.gacha] ?? labels.none
}

function getFragmentSummary(identity: TierIdentity, copy: typeof MODAL_COPY[SupportedLocale]) {
  const info = identity.acquisition_info
  if (!info?.fragment_cost) return null
  if (info.gacha === 'walpurgis') {
    return { text: copy.fragmentWalpurgis(info.fragment_cost), color: '#7bed9f' }
  }

  const releaseSeason = Number(info.release_season ?? 0)
  const diff = CURRENT_SEASON - releaseSeason
  const isSeasonalOrEvent = info.gacha === 'seasonal' || (info.type === 'event' && info.gacha === 'none')
  const permanentExchangeSeason = info.exchange_from_season ?? (
    isSeasonalOrEvent && releaseSeason > 0 ? releaseSeason + 2 : undefined
  )
  const daysSinceRelease = identity.release_date
    ? Math.floor((Date.now() - new Date(identity.release_date).getTime()) / (1000 * 60 * 60 * 24))
    : null
  const isNew7dLock = isSeasonalOrEvent && diff === 0 && daysSinceRelease !== null && daysSinceRelease < 7
  const isNextSeasonLock = isSeasonalOrEvent && diff === 1

  if (isNew7dLock) {
    return {
      text: copy.fragmentSeasonal(info.fragment_cost, releaseSeason, permanentExchangeSeason),
      color: '#ff6b6b',
    }
  }
  if (isNextSeasonLock) {
    return {
      text: copy.fragmentFromSeason(info.fragment_cost, permanentExchangeSeason),
      color: '#ff6b6b',
    }
  }
  if (permanentExchangeSeason) {
    return {
      text: copy.fragmentSeasonal(info.fragment_cost, releaseSeason, permanentExchangeSeason),
      color: '#bbb',
    }
  }
  return { text: copy.fragmentAlways(info.fragment_cost), color: '#bbb' }
}

function InfoBadge({
  children,
  color,
  background = 'rgba(200,144,10,0.1)',
}: {
  children: ReactNode
  color: string
  background?: string
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: '1.375rem',
        padding: '0.125rem 0.5rem',
        borderRadius: '0.25rem',
        color,
        background,
        border: `1px solid ${color}30`,
        fontSize: '0.75rem',
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  )
}

function ScoreControl({
  value,
  onChange,
  disabled,
  label,
  decreaseLabel,
  increaseLabel,
}: {
  value: number
  onChange: (value: number) => void
  disabled: boolean
  label: string
  decreaseLabel: string
  increaseLabel: string
}) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const normalizedValue = Math.min(10, Math.max(1, value))
  const fillPercent = ((normalizedValue - 1) / 9) * 100

  const updateFromClientX = useCallback((clientX: number) => {
    const track = trackRef.current
    if (!track || disabled) return
    const rect = track.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    onChange(Math.min(10, Math.max(1, Math.round(ratio * 9) + 1)))
  }, [disabled, onChange])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault()
      onChange(Math.max(1, normalizedValue - 1))
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault()
      onChange(Math.min(10, normalizedValue + 1))
    } else if (event.key === 'Home') {
      event.preventDefault()
      onChange(1)
    } else if (event.key === 'End') {
      event.preventDefault()
      onChange(10)
    }
  }

  return (
    <div style={{ marginBottom: '0.875rem' }}>
      <div className="flex items-center justify-between gap-3" style={{ marginBottom: '0.75rem' }}>
        <button
          type="button"
          onClick={() => onChange(Math.max(1, normalizedValue - 1))}
          disabled={disabled || normalizedValue <= 1}
          aria-label={decreaseLabel}
          style={{
            width: '2rem',
            height: '2rem',
            borderRadius: '0.25rem',
            border: '1px solid var(--border)',
            background: '#14100c',
            color: disabled || normalizedValue <= 1 ? '#4f4536' : '#d8c99b',
            fontSize: '1rem',
            fontWeight: 800,
            cursor: disabled || normalizedValue <= 1 ? 'not-allowed' : 'pointer',
          }}
        >
          -
        </button>
        <div style={{ textAlign: 'center', minWidth: '5.5rem' }}>
          <div style={{ color: 'var(--gold)', fontFamily: 'var(--font-mono)', fontSize: '1.5rem', lineHeight: 1 }}>
            {normalizedValue} / 10
          </div>
          <div style={{ color: '#8a7855', fontSize: '0.6875rem', marginTop: '0.25rem' }}>
            {label}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChange(Math.min(10, normalizedValue + 1))}
          disabled={disabled || normalizedValue >= 10}
          aria-label={increaseLabel}
          style={{
            width: '2rem',
            height: '2rem',
            borderRadius: '0.25rem',
            border: '1px solid var(--border)',
            background: '#14100c',
            color: disabled || normalizedValue >= 10 ? '#4f4536' : '#d8c99b',
            fontSize: '1rem',
            fontWeight: 800,
            cursor: disabled || normalizedValue >= 10 ? 'not-allowed' : 'pointer',
          }}
        >
          +
        </button>
      </div>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={1}
        aria-valuemax={10}
        aria-valuenow={normalizedValue}
        aria-disabled={disabled}
        onKeyDown={handleKeyDown}
        onPointerDown={event => {
          if (disabled) return
          event.currentTarget.setPointerCapture(event.pointerId)
          updateFromClientX(event.clientX)
        }}
        onPointerMove={event => {
          if (disabled || !event.currentTarget.hasPointerCapture(event.pointerId)) return
          updateFromClientX(event.clientX)
        }}
        onPointerUp={event => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
        }}
        style={{
          position: 'relative',
          height: '1.875rem',
          background: '#14100c',
          border: '1px solid #0a0806',
          cursor: disabled ? 'not-allowed' : 'pointer',
          touchAction: 'none',
          outline: 'none',
          opacity: disabled ? 0.75 : 1,
          padding: '0.5rem',
          boxShadow: 'inset 0 0 0 1px #2a2117',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'relative',
            height: '0.5rem',
            background: '#0a0806',
            border: '1px solid #2a2117',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${fillPercent}%`,
              height: '100%',
              background: 'var(--gold)',
            }}
          />
        </div>
      </div>
    </div>
  )
}

function IdentityAcquisitionPanel({
  identity,
  copy,
}: {
  identity: TierIdentity
  copy: typeof MODAL_COPY[SupportedLocale]
}) {
  const info = identity.acquisition_info
  const typeInfo = getAcquisitionType(info, copy)
  const gachaInfo = getGachaLabel(info, copy)
  const fragment = getFragmentSummary(identity, copy)
  const egoShardIconUrl = getEgoShardIconUrl(identity.sinner_id)

  if (!identity.release_date && !info) return null

  return (
    <section
      data-tier-modal-info="identity-acquisition"
      className="tier-rating-modal-info-panel"
      style={{
        margin: '1rem 1rem 0',
        background: '#0d0b08',
        border: '1px solid var(--border)',
        borderRadius: '0.375rem',
        padding: '0.875rem',
      }}
    >
      <div className="flex items-center gap-2" style={{ marginBottom: '0.75rem' }}>
        <PackageSearch size={15} style={{ color: 'var(--gold)' }} />
        <h3 style={{ color: '#ead8a8', fontSize: '0.875rem', fontWeight: 700 }}>{copy.identityInfo}</h3>
      </div>
      <div style={{ display: 'grid', gap: '0.625rem' }}>
        {identity.release_date && (
          <div className="flex items-center gap-2">
            <CalendarDays size={14} style={{ color: '#8a7855', flexShrink: 0 }} />
            <span style={{ color: '#999', fontSize: '0.75rem', minWidth: '3.25rem' }}>{copy.release}</span>
            <span style={{ color: '#bbb', fontSize: '0.75rem' }}>{identity.release_date}</span>
          </div>
        )}

        {info && (
          <div className="flex items-start gap-2">
            <PackageSearch size={14} style={{ color: '#8a7855', flexShrink: 0, marginTop: '0.125rem' }} />
            <span style={{ color: '#999', fontSize: '0.75rem', minWidth: '3.25rem', marginTop: '0.125rem' }}>{copy.acquisition}</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {typeInfo && <InfoBadge color={typeInfo.color} background={typeInfo.bg}>{typeInfo.label}</InfoBadge>}
              {info.release_season > 0 && <InfoBadge color="#c8900a">S{info.release_season}</InfoBadge>}
              {info.walpurgis_edition && <InfoBadge color="#7bed9f" background="rgba(123,237,159,0.08)">{copy.walpurgisEdition(info.walpurgis_edition)}</InfoBadge>}
              {info.event_name && <InfoBadge color="#ff9f43" background="rgba(255,159,67,0.08)">{info.event_name}</InfoBadge>}
            </div>
          </div>
        )}

        {info && info.type !== 'default' && gachaInfo && (
          <div className="flex items-start gap-2">
            <Sparkles size={14} style={{ color: '#8a7855', flexShrink: 0, marginTop: '0.125rem' }} />
            <span style={{ color: '#999', fontSize: '0.75rem', minWidth: '3.25rem', marginTop: '0.125rem' }}>{copy.extraction}</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span style={{ fontSize: '0.75rem', color: gachaInfo.color }}>
                {gachaInfo.label}
                {info.gacha === 'seasonal' && info.gacha_from_season && ` (S${info.gacha_from_season}~)`}
              </span>
              {info.target_sinner && (
                <span style={{ fontSize: '0.75rem', color: '#ffa502' }}>
                  · {info.target_sinner} {copy.targetExtraction}
                </span>
              )}
            </div>
          </div>
        )}

        {fragment && (
          <div className="flex items-start gap-2">
            {egoShardIconUrl && (
              <Image
                src={egoShardIconUrl}
                alt=""
                width={18}
                height={18}
                aria-hidden="true"
                style={{
                  width: '1.125rem',
                  height: '1.125rem',
                  objectFit: 'contain',
                  flexShrink: 0,
                  marginTop: '0.0625rem',
                }}
              />
            )}
            <span style={{ color: '#999', fontSize: '0.75rem', minWidth: '3.25rem', marginTop: '0.125rem' }}>{copy.fragment}</span>
            <span style={{ fontSize: '0.75rem', color: fragment.color, lineHeight: 1.5 }}>
              {fragment.text}
            </span>
          </div>
        )}
      </div>
    </section>
  )
}

function normalizeSourceAggregates(sourceAggregates: TierRatingResponse['sourceAggregates']) {
  const normalized: Partial<Record<SourceCategory, SourceAggregate>> = {}
  if (Array.isArray(sourceAggregates)) {
    for (const item of sourceAggregates) {
      normalized[item.category] = {
        averageScore: item.averageScore,
        ratingCount: item.ratingCount,
        derivedTier: item.derivedTier,
      }
    }
    return normalized
  }
  return sourceAggregates ?? normalized
}

function SourceAverageOverview({
  sourceAggregates,
  copy,
}: {
  sourceAggregates: TierRatingResponse['sourceAggregates']
  copy: typeof MODAL_COPY[SupportedLocale]
}) {
  const normalized = normalizeSourceAggregates(sourceAggregates)
  return (
    <section style={{ background: '#0d0b08', border: '1px solid var(--border)', borderRadius: '0.375rem', padding: '0.875rem' }}>
      <div className="flex items-center gap-2" style={{ marginBottom: '0.75rem' }}>
        <Star size={15} style={{ color: 'var(--gold)' }} />
        <h3 style={{ color: '#ead8a8', fontSize: '0.875rem', fontWeight: 700 }}>{copy.sourceOverview}</h3>
      </div>
      <div
        data-tier-source-overview="overall"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        {SOURCE_CATEGORY_ORDER.map(sourceCategory => {
          const aggregate = normalized[sourceCategory]
          const hasScore = typeof aggregate?.averageScore === 'number'
          return (
            <div
              key={sourceCategory}
              className="tier-rating-modal-source-row"
              style={{
                minHeight: '3.625rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                background: '#14100c',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'rgba(200,144,10,0.18)',
                borderRadius: '0.375rem',
                padding: '0.625rem 0.75rem',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <span style={{ display: 'block', color: '#d8c99b', fontSize: '0.8125rem', fontWeight: 700, lineHeight: 1.3 }}>
                  {copy.sourceAverageLabels[sourceCategory]}
                </span>
                <span style={{ display: 'block', color: '#8a7855', fontSize: '0.6875rem', marginTop: '0.125rem' }}>
                  {hasScore ? copy.ratingCount(aggregate?.ratingCount ?? 0) : copy.scoreUnavailable}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', flexShrink: 0 }}>
                {aggregate?.derivedTier && (
                  <span
                    style={{
                      borderRadius: '0.25rem',
                      background: TIER_COLORS[aggregate.derivedTier],
                      color: getTierTextColor(aggregate.derivedTier),
                      fontSize: '0.6875rem',
                      fontWeight: 800,
                      padding: '0.125rem 0.375rem',
                    }}
                  >
                    {aggregate.derivedTier}
                  </span>
                )}
                <span style={{ color: hasScore ? 'var(--gold)' : '#6f6041', fontFamily: 'var(--font-mono)', fontSize: '1.35rem', lineHeight: 1 }}>
                  {hasScore ? aggregate.averageScore!.toFixed(1) : '--'}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function LockOverlay({
  reason,
}: {
  reason: string
}) {
  return (
    <div
      data-tier-modal-locked="true"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.625rem',
        overflow: 'hidden',
        borderRadius: '0.375rem',
        background: 'rgba(8,7,5,0.72)',
        backdropFilter: 'brightness(0.58) blur(0.125rem)',
        padding: '1rem 1.25rem',
        textAlign: 'center',
        zIndex: 2,
      }}
    >
      <Image
        src={LOCK_ICON_URL}
        alt=""
        width={118}
        height={157}
        style={{
          width: '3.25rem',
          height: 'auto',
          filter: 'brightness(0.88)',
          opacity: 0.94,
        }}
      />
      <p style={{ color: '#d8c99b', fontSize: '0.75rem', lineHeight: 1.55, maxWidth: '22rem' }}>
        {reason}
      </p>
    </div>
  )
}

function getLocalizedIdentityName(identity: TierIdentity, locale: SupportedLocale) {
  if (locale === 'en') return identity.name_en ?? identity.name ?? identity.name_kr ?? identity.name_jp ?? identity.id
  if (locale === 'ja') return identity.name_jp ?? identity.name ?? identity.name_kr ?? identity.name_en ?? identity.id
  return identity.name_kr ?? identity.name ?? identity.name_en ?? identity.name_jp ?? identity.id
}

export function TierRatingModal({
  identity,
  category,
  period,
  initialViewer,
  open,
  onClose,
}: {
  identity: TierIdentity
  category: TierCategory
  period: RatingPeriod
  initialViewer: TierRatingViewer
  open: boolean
  onClose: () => void
}) {
  const locale = normalizeLocale(useLocale())
  const router = useRouter()
  const copy = MODAL_COPY[locale]
  const [ratingData, setRatingData] = useState<TierRatingResponse>(() => ({
    ...EMPTY_RATING,
    viewer: category === 'overall'
      ? { ...initialViewer, canRate: false, reason: 'overall_readonly' }
      : initialViewer,
  }))
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [reportStates, setReportStates] = useState<Record<string, ReportState>>({})
  const [error, setError] = useState<string | null>(null)
  const [score, setScore] = useState(8)
  const [comment, setComment] = useState('')

  const categoryLabel = getTierCategoryLabel(category, locale)
  const isOverall = category === 'overall'
  const modalViewer = useMemo<TierRatingViewer>(() => (
    isOverall
      ? { ...initialViewer, canRate: false, reason: 'overall_readonly' }
      : initialViewer
  ), [initialViewer, isOverall])
  const imgUrl = getIdentityInfoUrl(identity as Identity)
  const rarityIcon = RARITY_ICON_MAP[identity.rarity]
  const displayName = getLocalizedIdentityName(identity, locale)

  const overallRatingData = useMemo<TierRatingResponse>(() => ({
    ...EMPTY_RATING,
    aggregate: {
      averageScore: identity.tier_rating_summary?.averageScore ?? null,
      ratingCount: identity.tier_rating_summary?.ratingCount ?? 0,
      derivedTier: identity.tier_rating_summary?.derivedTier ?? 'N/A',
      distribution: identity.tier_rating_summary?.distribution ?? {},
    },
    viewer: modalViewer,
  }), [identity.tier_rating_summary, modalViewer])

  useEffect(() => {
    if (!open) return
    setRatingData(previous => ({
      ...previous,
      viewer: modalViewer,
    }))
  }, [modalViewer, open])

  const fetchRatings = useCallback(async () => {
    if (!open) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ identityId: identity.id, category, period })
      const res = await fetch(`/api/tier-list/ratings?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(copy.fetchError)
      const data = await res.json() as TierRatingResponse
      setRatingData(isOverall ? {
        ...overallRatingData,
        ...data,
        aggregate: data.aggregate ?? overallRatingData.aggregate,
        sourceAggregates: data.sourceAggregates ?? overallRatingData.sourceAggregates,
        comments: data.comments ?? [],
        viewer: overallRatingData.viewer,
        myRating: null,
      } : {
        ...data,
        viewer: modalViewer,
      })
      if (!isOverall && data.myRating) {
        setScore(data.myRating.score)
        setComment(data.myRating.comment)
      } else {
        setScore(8)
        setComment('')
      }
      setReportStates({})
    } catch (err) {
      setRatingData(isOverall ? overallRatingData : { ...EMPTY_RATING, viewer: modalViewer })
      setError(isOverall ? null : err instanceof Error ? err.message : copy.fetchError)
    } finally {
      setLoading(false)
    }
  }, [category, copy.fetchError, identity.id, isOverall, modalViewer, open, overallRatingData, period])

  useEffect(() => { void fetchRatings() }, [fetchRatings])

  const distributionMax = useMemo(() => {
    const values = Object.values(ratingData.aggregate.distribution ?? {})
    return Math.max(1, ...values)
  }, [ratingData.aggregate.distribution])

  const existingRating = ratingData.myRating
  const hasExistingRating = Boolean(existingRating)
  const ratingFormDirty = existingRating
    ? score !== existingRating.score || comment.trim() !== existingRating.comment.trim()
    : true
  const saveDisabled = submitting || deleting || (hasExistingRating && !ratingFormDirty)

  const handleSubmit = async () => {
    if (isOverall || submitting || deleting || !ratingData.viewer.canRate || (hasExistingRating && !ratingFormDirty)) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/tier-list/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identityId: identity.id,
          category,
          score,
          comment: comment.trim(),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? copy.saveError)
      }
      await fetchRatings()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.saveError)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (isOverall || deleting || !ratingData.myRating || !ratingData.viewer.canRate) return
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch('/api/tier-list/ratings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identityId: identity.id,
          category,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? copy.deleteError)
      }
      setScore(8)
      setComment('')
      await fetchRatings()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.deleteError)
    } finally {
      setDeleting(false)
    }
  }

  const handleReport = async (ratingId: string) => {
    const current = reportStates[ratingId]
    if (current?.status === 'pending' || current?.status === 'success') return
    setReportStates(prev => ({
      ...prev,
      [ratingId]: { status: 'pending', message: copy.reporting },
    }))
    try {
      const res = await fetch('/api/tier-list/ratings/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ratingId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? copy.reportError)
      }
      setReportStates(prev => ({
        ...prev,
        [ratingId]: { status: 'success', message: copy.reportSuccess },
      }))
    } catch (err) {
      setReportStates(prev => ({
        ...prev,
        [ratingId]: { status: 'error', message: err instanceof Error ? err.message : copy.reportError },
      }))
    }
  }

  const canSubmit = !isOverall && ratingData.viewer.canRate
  const hasAggregateScore = ratingData.aggregate.averageScore !== null
  const showLowConfidenceWarning = ratingData.aggregate.ratingCount > 0
    && ratingData.aggregate.ratingCount < LOW_CONFIDENCE_RATING_COUNT
  const viewerMessage = isOverall
    ? copy.readonlyMessage
    : getViewerMessage(ratingData.viewer, copy)

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title={`${displayName} ${copy.description}`}
      description={`${categoryLabel} ${copy.description}`}
      maxWidth="44rem"
      padding="1rem"
    >
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="tier-rating-modal-shell"
        style={{
          width: '100%',
          maxHeight: 'min(42rem, calc(100dvh - 3rem))',
          overflow: 'auto',
          background: '#14100c',
          border: '1px solid rgba(200,144,10,0.28)',
          borderRadius: '0.5rem',
          boxShadow: '0 1rem 3rem rgba(0,0,0,0.65)',
        }}
      >
        <style>{`
          @media (max-width: 47.999rem) {
            .tier-rating-modal-shell {
              width: calc(100vw - 1.75rem) !important;
              max-width: calc(100vw - 1.75rem) !important;
              max-height: calc(100dvh - 4rem) !important;
              border-radius: 0.375rem !important;
            }
            .tier-rating-modal-header {
              min-height: 6.75rem !important;
            }
            .tier-rating-modal-header-inner {
              min-height: 6.75rem !important;
              gap: 0.625rem !important;
              padding: 0.75rem 2.875rem 0.75rem 0.75rem !important;
            }
            .tier-rating-modal-portrait {
              width: 3.25rem !important;
              height: 4.5rem !important;
            }
            .tier-rating-modal-info-panel {
              margin: 0.625rem 0.625rem 0 !important;
              padding: 0.625rem !important;
            }
            .tier-rating-modal-body-grid {
              padding: 0.625rem !important;
              gap: 0.625rem !important;
            }
            .tier-rating-modal-comments {
              padding: 0 0.625rem 0.625rem !important;
            }
            .tier-rating-modal-source-row {
              min-height: 3.25rem !important;
              padding: 0.5rem 0.625rem !important;
            }
          }
        `}</style>
        <div
          data-tier-modal-header="dossier"
          className="tier-rating-modal-header"
          style={{
            position: 'relative',
            minHeight: '8rem',
            overflow: 'hidden',
            borderBottom: '1px solid var(--border)',
            background: '#0d0b08',
          }}
        >
          {imgUrl && (
            <Image
              src={imgUrl}
              alt=""
              fill
              sizes="44rem"
              priority={false}
              style={{
                objectFit: 'cover',
                objectPosition: 'center 20%',
                filter: 'brightness(0.42) saturate(0.9)',
                transform: 'scale(1.08)',
              }}
            />
          )}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(90deg, rgba(13,11,8,0.96) 0%, rgba(13,11,8,0.78) 44%, rgba(13,11,8,0.35) 100%)',
            }}
          />
          <div
            className="tier-rating-modal-header-inner"
            style={{
              position: 'relative',
              minHeight: '8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.875rem',
              padding: '0.875rem 3.25rem 0.875rem 1rem',
            }}
          >
            <div
              className="tier-rating-modal-portrait"
              style={{
                position: 'relative',
                width: '4.25rem',
                height: '5.75rem',
                flexShrink: 0,
                borderRadius: '0.375rem',
                overflow: 'hidden',
                background: '#0d0b08',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'rgba(200,144,10,0.34)',
                boxShadow: '0 0.75rem 1.5rem rgba(0,0,0,0.46)',
              }}
            >
              {imgUrl ? (
                <Image
                  src={imgUrl}
                  alt={displayName}
                  fill
                  sizes="4.25rem"
                  style={{ objectFit: 'cover', objectPosition: 'top center' }}
                />
              ) : (
                <div className="flex h-full items-center justify-center" style={{ color: '#5f4a25', fontSize: '1.25rem' }}>
                  {displayName[0]}
                </div>
              )}
              {rarityIcon && (
                <Image
                  src={rarityIcon}
                  alt={copy.rarityAlt(identity.rarity)}
                  width={24}
                  height={14}
                  unoptimized
                  style={{ position: 'absolute', right: '0.25rem', top: '0.25rem', width: '1.5rem', height: 'auto' }}
                />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: '0.375rem' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    minHeight: '1.5rem',
                    borderRadius: '0.25rem',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: 'rgba(200,144,10,0.34)',
                    background: 'rgba(13,11,8,0.72)',
                    color: 'var(--gold)',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    padding: '0 0.5rem',
                  }}
                >
                  {categoryLabel}
                </span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    minHeight: '1.5rem',
                    minWidth: '2.5rem',
                    justifyContent: 'center',
                    borderRadius: '0.25rem',
                    background: TIER_COLORS[ratingData.aggregate.derivedTier],
                    color: getTierTextColor(ratingData.aggregate.derivedTier),
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    padding: '0 0.5rem',
                  }}
                >
                  {ratingData.aggregate.derivedTier}
                </span>
              </div>
              <h2 className="font-serif truncate" style={{ color: '#ead8a8', fontSize: '1.125rem', fontWeight: 700 }}>
                {displayName}
              </h2>
              <p style={{ color: '#8a7855', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                {isOverall
                  ? copy.autoBasis
                  : hasAggregateScore ? copy.communityTier : copy.noRatingData}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.close}
            className="transition-colors hover:text-[var(--gold)]"
            style={{
              position: 'absolute',
              right: '0.875rem',
              top: '0.875rem',
              zIndex: 2,
              color: '#d8c99b',
              padding: '0.375rem',
              borderRadius: '0.375rem',
              background: 'rgba(0,0,0,0.34)',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: 'rgba(200,144,10,0.18)',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <IdentityAcquisitionPanel identity={identity} copy={copy} />

        <div className="tier-rating-modal-body-grid grid gap-4 md:grid-cols-[0.9fr_1.1fr]" style={{ padding: '1rem' }}>
          <section style={{ background: '#0d0b08', border: '1px solid var(--border)', borderRadius: '0.375rem', padding: '0.875rem' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '0.875rem' }}>
              <div className="flex items-center gap-2">
                <BarChart3 size={15} style={{ color: 'var(--gold)' }} />
                <h3 style={{ color: '#ead8a8', fontSize: '0.875rem', fontWeight: 700 }}>{copy.aggregate}</h3>
              </div>
              <span style={{ color: '#8a7855', fontSize: '0.75rem' }}>
                {loading ? '...' : copy.aggregateCount(ratingData.aggregate.ratingCount, isOverall)}
              </span>
            </div>
            <div className="flex items-end gap-2" style={{ marginBottom: '1rem' }}>
              <span style={{ color: 'var(--gold)', fontFamily: 'var(--font-mono)', fontSize: '2rem', lineHeight: 1 }}>
                {ratingData.aggregate.averageScore === null ? '--' : ratingData.aggregate.averageScore.toFixed(1)}
              </span>
              <span style={{ color: '#8a7855', fontSize: '0.75rem', paddingBottom: '0.25rem' }}>/ 10</span>
            </div>
            {showLowConfidenceWarning && (
              <p
                style={{
                  marginBottom: '0.875rem',
                  padding: '0.5rem 0.625rem',
                  background: 'rgba(200,144,10,0.08)',
                  border: '1px solid rgba(200,144,10,0.18)',
                  borderRadius: '0.25rem',
                  color: '#d7b35b',
                  fontSize: '0.75rem',
                  lineHeight: 1.5,
                }}
              >
                {copy.lowConfidenceWarning}
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {SCORE_OPTIONS.map(value => {
                const count = ratingData.aggregate.distribution?.[value] ?? 0
                return (
                  <div key={value} className="grid items-center gap-2" style={{ gridTemplateColumns: '1.5rem 1fr 1.75rem' }}>
                    <span style={{ color: '#8a7855', fontSize: '0.6875rem', fontFamily: 'var(--font-mono)' }}>{value}</span>
                    <div style={{ height: '0.375rem', borderRadius: '999rem', background: '#1f1811', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${Math.round((count / distributionMax) * 100)}%`,
                          height: '100%',
                          borderRadius: '999rem',
                          background: value >= 8 ? '#c8900a' : value >= 6 ? '#8a7855' : '#6f3a32',
                          transition: 'width 0.2s ease',
                        }}
                      />
                    </div>
                    <span style={{ color: '#5f4a25', fontSize: '0.6875rem', textAlign: 'right' }}>{count}</span>
                  </div>
                )
              })}
            </div>
          </section>

          {isOverall ? (
            <SourceAverageOverview sourceAggregates={ratingData.sourceAggregates} copy={copy} />
          ) : (
          <section style={{ background: '#0d0b08', border: '1px solid var(--border)', borderRadius: '0.375rem', padding: '0.875rem' }}>
            <div className="flex items-center gap-2" style={{ marginBottom: '0.75rem' }}>
              <Star size={15} style={{ color: canSubmit ? 'var(--gold)' : '#8a7855' }} />
              <h3 style={{ color: '#ead8a8', fontSize: '0.875rem', fontWeight: 700 }}>{copy.myRating}</h3>
            </div>
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  opacity: canSubmit ? 1 : 0.32,
                  filter: canSubmit ? 'none' : 'brightness(0.72)',
                  pointerEvents: canSubmit ? 'auto' : 'none',
                }}
              >
                <ScoreControl
                  value={score}
                  onChange={setScore}
                  disabled={!canSubmit || submitting}
                  label={copy.scoreControlLabel}
                  decreaseLabel={copy.scoreDecrease}
                  increaseLabel={copy.scoreIncrease}
                />
                <textarea
                  value={comment}
                  onChange={event => setComment(event.target.value.slice(0, 280))}
                  disabled={!canSubmit || submitting}
                  placeholder={copy.placeholder}
                  style={{
                    width: '100%',
                    minHeight: '5.5rem',
                    resize: 'vertical',
                    background: '#14100c',
                    border: '1px solid var(--border)',
                    borderRadius: '0.375rem',
                    color: '#d8c99b',
                    outline: 'none',
                    padding: '0.625rem',
                    fontSize: '0.8125rem',
                    lineHeight: 1.6,
                  }}
                />
              </div>
              {!canSubmit && <LockOverlay reason={viewerMessage} />}
            </div>
            {canSubmit && (
                <div className="flex items-center justify-between gap-3 flex-wrap" style={{ marginTop: '0.75rem' }}>
                  <p style={{ color: '#8a7855', fontSize: '0.6875rem' }}>
                    {viewerMessage}
                  </p>
                  <div className="flex items-center gap-2">
                    {hasExistingRating && (
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={submitting || deleting}
                        className="inline-flex items-center gap-1.5"
                        style={{
                          minHeight: '2.25rem',
                          padding: '0 0.75rem',
                          borderRadius: '0.25rem',
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          borderColor: 'rgba(255,107,107,0.28)',
                          background: 'rgba(255,107,107,0.08)',
                          color: '#ff8a70',
                          fontSize: '0.8125rem',
                          fontWeight: 700,
                          cursor: deleting ? 'not-allowed' : 'pointer',
                          opacity: deleting ? 0.7 : 1,
                        }}
                      >
                        {deleting ? copy.deleting : copy.delete}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={saveDisabled}
                      className="inline-flex items-center gap-1.5"
                      style={{
                        minHeight: '2.25rem',
                        padding: '0 0.875rem',
                        borderRadius: '0.25rem',
                        background: 'var(--gold)',
                        color: '#0d0b08',
                        fontSize: '0.8125rem',
                        fontWeight: 700,
                        cursor: saveDisabled ? 'not-allowed' : 'pointer',
                        opacity: saveDisabled ? 0.58 : 1,
                      }}
                    >
                      <Send size={14} />
                      {submitting ? copy.saving : hasExistingRating ? copy.update : copy.save}
                    </button>
                  </div>
                </div>
            )}
            {error && (
              <p style={{ color: '#ff8a70', fontSize: '0.75rem', marginTop: '0.75rem' }}>
                {error}
              </p>
            )}
          </section>
          )}
        </div>

        <section className="tier-rating-modal-comments" style={{ padding: '0 1rem 1rem' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: '0.625rem' }}>
            <MessageSquare size={15} style={{ color: 'var(--gold)' }} />
            <h3 style={{ color: '#ead8a8', fontSize: '0.875rem', fontWeight: 700 }}>{copy.comments}</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {ratingData.comments.length === 0 ? (
              <div style={{ border: '1px dashed rgba(200,144,10,0.2)', borderRadius: '0.375rem', padding: '0.875rem', color: '#8a7855', fontSize: '0.8125rem' }}>
                {copy.noComments}
              </div>
            ) : ratingData.comments.map(item => (
              <div key={item.id} style={{ background: '#0d0b08', border: '1px solid var(--border)', borderRadius: '0.375rem', padding: '0.75rem' }}>
                <div className="flex items-center justify-between gap-2" style={{ marginBottom: '0.375rem' }}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    {item.category && (
                      <span
                        style={{
                          flexShrink: 0,
                          borderRadius: '0.25rem',
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          borderColor: 'rgba(200,144,10,0.22)',
                          background: 'rgba(200,144,10,0.08)',
                          color: 'var(--gold)',
                          fontSize: '0.625rem',
                          fontWeight: 800,
                          padding: '0.0625rem 0.375rem',
                        }}
                      >
                        {getTierCategoryLabel(item.category, locale)}
                      </span>
                    )}
                    <span className="truncate" style={{ color: '#c8a450', fontSize: '0.75rem', fontWeight: 700 }}>
                      {item.username ?? copy.adminFallback}
                    </span>
                  </div>
                  <span style={{ color: 'var(--gold)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                    {item.score}/10
                  </span>
                </div>
                {item.comment && (
                  <p style={{ color: '#b8a887', fontSize: '0.8125rem', lineHeight: 1.6 }}>
                    {item.comment}
                  </p>
                )}
                <div className="flex items-center justify-end gap-2" style={{ marginTop: '0.5rem' }}>
                  {reportStates[item.id]?.message && (
                    <span
                      style={{
                        color: reportStates[item.id].status === 'error' ? '#ff8a70' : '#8a7855',
                        fontSize: '0.6875rem',
                      }}
                    >
                      {reportStates[item.id].message}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleReport(item.id)}
                    disabled={reportStates[item.id]?.status === 'pending' || reportStates[item.id]?.status === 'success'}
                    className="inline-flex items-center gap-1"
                    style={{
                      minHeight: '1.75rem',
                      padding: '0 0.5rem',
                      borderRadius: '0.25rem',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: 'rgba(138,120,85,0.22)',
                      background: 'rgba(20,16,12,0.72)',
                      color: '#8a7855',
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      cursor: reportStates[item.id]?.status === 'pending' || reportStates[item.id]?.status === 'success' ? 'not-allowed' : 'pointer',
                      opacity: reportStates[item.id]?.status === 'pending' || reportStates[item.id]?.status === 'success' ? 0.6 : 1,
                    }}
                    aria-label={copy.report}
                  >
                    <Flag size={12} />
                    {reportStates[item.id]?.status === 'pending' ? copy.reporting : copy.report}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </motion.div>
    </BaseModal>
  )
}
