'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { AlertTriangle, MessageSquareText, RefreshCw, Search, Star, Users } from 'lucide-react'
import { AdminButton } from '@/components/admin'
import Dropdown, { type DropdownOption } from '@/components/ui/Dropdown'
import { showError } from '@/lib/toast'
import { getIdentityInfoUrl } from '@/lib/utils/images'
import { RARITY_ICON_MAP } from '@/lib/constants/game'
import type { Identity } from '@/lib/types'

const TIERS = ['S+', 'S', 'A', 'B', 'C', 'N/A'] as const
type Tier = typeof TIERS[number]
const CATEGORIES = [
  { key: 'reroll', label: '리세' },
  { key: 'overall', label: '종합' },
  { key: 'mirror_dungeon', label: '거던' },
  { key: 'goodstuff', label: '굿스터프' },
] as const
type TierCategory = typeof CATEGORIES[number]['key']
type Period = '7d' | '30d' | '1y' | 'all'
const PERIOD_OPTIONS: DropdownOption<Period>[] = [
  { value: '7d', label: '최근 7일' },
  { value: '30d', label: '최근 30일' },
  { value: '1y', label: '최근 1년' },
  { value: 'all', label: '전체 기간' },
]

type TierIdentity = Pick<Identity, 'id' | 'name_kr' | 'rarity' | 'sinner_id' | 'game_id' | 'folder_name'>

type RatingComment = {
  id: string
  score: number
  comment: string
  created_at: string
  username?: string | null
  category?: string
}

type RatingAggregate = {
  averageScore: number | null
  ratingCount: number
  derivedTier: string
  distribution: Record<number, number>
}

type RatingSummary = {
  aggregate: RatingAggregate
  comments: RatingComment[]
}

type AdminTierRow = {
  tier: Tier
  identity: TierIdentity
}

type AdminTierPayload = {
  assigned?: { tier: string; identity: TierIdentity | TierIdentity[] | null }[]
}

const EMPTY_AGGREGATE: RatingAggregate = {
  averageScore: null,
  ratingCount: 0,
  derivedTier: 'N/A',
  distribution: {},
}

function normalizeTier(value: string): Tier | null {
  if (value === 'F') return 'N/A'
  return TIERS.includes(value as Tier) ? value as Tier : null
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

function formatAverage(value: number | null) {
  return value === null ? '-' : new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(value)
}

function tierTone(tier: Tier) {
  if (tier === 'S+' || tier === 'S') return '#d49b4a'
  if (tier === 'A') return '#c8a450'
  if (tier === 'B') return '#9aac7d'
  if (tier === 'C') return '#8798b8'
  return '#8a7855'
}

function MiniIdentityImage({ identity }: { identity: TierIdentity }) {
  const [failed, setFailed] = useState(false)
  const imgUrl = getIdentityInfoUrl(identity as Identity)

  if (!imgUrl || failed) {
    return (
      <div className="flex items-center justify-center rounded-sm border" style={{ width: '2.5rem', height: '2.5rem', borderColor: 'rgba(200,144,10,0.12)', background: 'rgba(13,11,8,0.36)' }}>
        <span className="font-serif" style={{ fontSize: '0.875rem', color: '#7a6845' }}>{identity.name_kr[0]}</span>
      </div>
    )
  }

  return (
    <Image
      src={imgUrl}
      alt={identity.name_kr}
      width={40}
      height={40}
      unoptimized
      style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.125rem', objectFit: 'cover' }}
      onError={() => setFailed(true)}
    />
  )
}

function RatingBar({ distribution }: { distribution: Record<number, number> }) {
  const max = Math.max(1, ...Object.values(distribution).map(Number))

  return (
    <div className="grid grid-cols-10 gap-1" aria-label="점수 분포">
      {Array.from({ length: 10 }, (_, index) => {
        const score = index + 1
        const count = Number(distribution[score] ?? 0)
        return (
          <div key={score} className="flex flex-col items-center gap-1">
            <div className="flex h-8 w-full items-end rounded-sm" style={{ background: 'rgba(13,11,8,0.4)' }}>
              <span style={{ width: '100%', height: `${Math.max(0.125, (count / max) * 2)}rem`, background: count > 0 ? 'rgba(200,144,10,0.55)' : 'rgba(122,104,69,0.18)', borderRadius: '0.125rem' }} />
            </div>
            <span className="font-mono" style={{ color: '#665a42', fontSize: '0.5625rem' }}>{score}</span>
          </div>
        )
      })}
    </div>
  )
}

function IdentityReviewRow({
  row,
  summary,
}: {
  row: AdminTierRow
  summary?: RatingSummary
}) {
  const rarityIcon = RARITY_ICON_MAP[row.identity.rarity]
  const aggregate = summary?.aggregate ?? EMPTY_AGGREGATE
  const recentComments = summary?.comments.slice(0, 2) ?? []

  return (
    <article className="grid gap-3 border-t py-3 lg:grid-cols-[minmax(16rem,1fr)_14rem_minmax(18rem,1.2fr)]" style={{ borderColor: 'rgba(200,144,10,0.1)' }}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex shrink-0 items-center justify-center rounded-sm border font-mono" style={{ width: '2.625rem', height: '2.625rem', borderColor: `${tierTone(row.tier)}66`, color: tierTone(row.tier), fontSize: '0.875rem', fontWeight: 700 }}>
          {row.tier}
        </span>
        <MiniIdentityImage identity={row.identity} />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate" style={{ color: '#d6be7a', fontSize: '0.875rem', fontWeight: 700 }}>{row.identity.name_kr}</h2>
            {rarityIcon && (
              <Image src={rarityIcon} alt={`${row.identity.rarity}성`} width={14} height={14} unoptimized style={{ width: '0.875rem', height: '0.875rem', flexShrink: 0 }} />
            )}
          </div>
          <p className="font-mono" style={{ color: '#665a42', fontSize: '0.6875rem', marginTop: '0.1875rem' }}>manual tier reference / user ratings review</p>
        </div>
      </div>

      <div className="grid grid-cols-[0.85fr_0.85fr_1.15fr] gap-2">
        <div>
          <p className="font-mono" style={{ color: '#665a42', fontSize: '0.625rem' }}>AVG</p>
          <p className="font-mono tabular-nums" style={{ color: '#c8a450', fontSize: '1rem' }}>{formatAverage(aggregate.averageScore)}</p>
        </div>
        <div>
          <p className="font-mono" style={{ color: '#665a42', fontSize: '0.625rem' }}>COUNT</p>
          <p className="font-mono tabular-nums" style={{ color: '#c8a450', fontSize: '1rem' }}>{aggregate.ratingCount}</p>
        </div>
        <div>
          <p className="font-mono" style={{ color: '#665a42', fontSize: '0.625rem' }}>MODEL</p>
          <p className="font-mono tabular-nums" style={{ color: tierTone(normalizeTier(aggregate.derivedTier) ?? 'N/A'), fontSize: '1rem' }}>{aggregate.derivedTier}</p>
        </div>
      </div>

      <div className="min-w-0">
        <RatingBar distribution={aggregate.distribution} />
        <div className="mt-2 space-y-1">
          {recentComments.length > 0 ? recentComments.map(comment => (
            <p key={comment.id} className="truncate" style={{ color: '#9a8a6a', fontSize: '0.6875rem' }}>
              <span className="font-mono" style={{ color: '#c8a450' }}>{comment.score}/10</span>
              {' '}
              {comment.comment}
              <span className="font-mono" style={{ color: '#665a42' }}> · {formatDateTime(comment.created_at)}</span>
            </p>
          )) : (
            <p style={{ color: '#665a42', fontSize: '0.6875rem' }}>최근 코멘트 없음</p>
          )}
        </div>
      </div>
    </article>
  )
}

export default function AdminTierListPage() {
  const [rows, setRows] = useState<AdminTierRow[]>([])
  const [summaries, setSummaries] = useState<Record<string, RatingSummary>>({})
  const [category, setCategory] = useState<TierCategory>('reroll')
  const [period, setPeriod] = useState<Period>('30d')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const loadErrorShownRef = useRef(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/tier-list?category=${category}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('tier-list')
      const data = await res.json() as AdminTierPayload
      const nextRows: AdminTierRow[] = []

      for (const row of data.assigned ?? []) {
        const tier = normalizeTier(row.tier)
        const identity = Array.isArray(row.identity) ? row.identity[0] : row.identity
        if (tier && identity) nextRows.push({ tier, identity })
      }

      setRows(nextRows)
      const limitedRows = nextRows.slice(0, 36)
      const ratingPairs = await Promise.all(limitedRows.map(async row => {
        const ratingRes = await fetch(`/api/tier-list/ratings?identityId=${row.identity.id}&category=${category}&period=${period}`, { cache: 'no-store' })
        if (!ratingRes.ok) return [row.identity.id, { aggregate: EMPTY_AGGREGATE, comments: [] }] as const
        const rating = await ratingRes.json() as RatingSummary
        return [row.identity.id, {
          aggregate: rating.aggregate ?? EMPTY_AGGREGATE,
          comments: rating.comments ?? [],
        }] as const
      }))
      setSummaries(Object.fromEntries(ratingPairs))
      loadErrorShownRef.current = false
    } catch {
      if (!loadErrorShownRef.current) {
        loadErrorShownRef.current = true
        showError('티어 평가 데이터를 불러오지 못했습니다.')
      }
      setRows([])
      setSummaries({})
    } finally {
      setLoading(false)
    }
  }, [category, period])

  useEffect(() => { fetchData() }, [fetchData])

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return rows
    return rows.filter(row => row.identity.name_kr.toLowerCase().includes(normalized) || row.tier.toLowerCase().includes(normalized))
  }, [query, rows])

  const stats = useMemo(() => {
    const summariesList = Object.values(summaries)
    return {
      identities: rows.length,
      rated: summariesList.filter(summary => summary.aggregate.ratingCount > 0).length,
      comments: summariesList.reduce((sum, summary) => sum + summary.comments.length, 0),
      reviews: summariesList.reduce((sum, summary) => sum + summary.aggregate.ratingCount, 0),
    }
  }, [rows.length, summaries])

  return (
    <div className="mx-auto w-full max-w-[78rem]">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b" style={{ borderColor: 'rgba(200,144,10,0.14)', paddingBottom: '1rem' }}>
        <div>
          <p className="font-mono" style={{ color: '#8a7a5a', fontSize: '0.6875rem' }}>PARTICIPATORY TIER REVIEW</p>
          <h1 className="mt-1 font-serif text-2xl font-bold" style={{ color: 'var(--gold)' }}>티어 평가 검토</h1>
          <p className="mt-2 max-w-[48rem]" style={{ color: '#8a7a5a', fontSize: '0.75rem', lineHeight: 1.6 }}>
            이 화면은 수동 티어 편집기가 아니라 유저 평가 집계, 댓글, 등급 산출 결과를 검토하는 관리자용 화면입니다.
          </p>
        </div>
        <AdminButton variant="ghost" onClick={fetchData} loading={loading}>
          <RefreshCw size="0.875rem" aria-hidden="true" />
          새로고침
        </AdminButton>
      </header>

      <section className="mb-4 grid gap-3 md:grid-cols-4">
        {[
          { label: '대상 인격', value: stats.identities, icon: Users },
          { label: '평가 있음', value: stats.rated, icon: Star },
          { label: '평가 수', value: stats.reviews, icon: MessageSquareText },
          { label: '댓글 수', value: stats.comments, icon: AlertTriangle },
        ].map(item => {
          const Icon = item.icon
          return (
            <div key={item.label} className="border-l" style={{ borderColor: 'rgba(200,144,10,0.22)', padding: '0.375rem 0.75rem' }}>
              <p className="mb-1 flex items-center gap-1" style={{ color: '#7a6845', fontSize: '0.6875rem' }}><Icon size="0.75rem" aria-hidden="true" />{item.label}</p>
              <p className="font-mono text-lg tabular-nums" style={{ color: 'var(--gold)' }}>{item.value.toLocaleString('ko-KR')}</p>
            </div>
          )
        })}
      </section>

      <section className="mb-4 grid gap-2 lg:grid-cols-[minmax(18rem,1fr)_18rem_12rem]">
        <div className="relative">
          <Search size="0.875rem" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#7a6845' }} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="인격명 또는 티어 검색"
            className="w-full rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
            style={{ padding: '0.5rem 0.75rem 0.5rem 2.25rem', background: 'rgba(0,0,0,0.3)', border: '0.0625rem solid var(--border)', color: '#c8a450', fontSize: '0.8125rem' }}
          />
        </div>
        <div className="flex rounded-sm border" style={{ borderColor: 'rgba(200,144,10,0.18)', padding: '0.25rem', background: '#14100c' }}>
          {CATEGORIES.map(item => {
            const selected = category === item.key
            return (
              <button key={item.key} type="button" onClick={() => setCategory(item.key)} className="flex-1 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]" style={{ minHeight: '2rem', background: selected ? 'rgba(200,144,10,0.14)' : 'transparent', border: '0.0625rem solid transparent', color: selected ? 'var(--gold)' : '#8a7855', fontSize: '0.75rem', fontWeight: selected ? 700 : 500 }}>
                {item.label}
              </button>
            )
          })}
        </div>
        <Dropdown<Period>
          value={period}
          options={PERIOD_OPTIONS}
          onChange={setPeriod}
          className="w-full"
          buttonStyle={{
            width: '100%',
            minHeight: '2.375rem',
            justifyContent: 'space-between',
            padding: '0.5rem 0.75rem',
            background: 'rgba(0,0,0,0.3)',
            borderColor: 'var(--border)',
            borderRadius: '0.125rem',
            color: '#c8a450',
            fontSize: '0.8125rem',
          }}
        />
      </section>

      <section className="rounded-md border" style={{ borderColor: 'rgba(200,144,10,0.14)', background: 'rgba(26,21,16,0.5)', padding: '0 0.875rem' }}>
        {loading ? (
          <div className="space-y-2 py-3">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={`tier-review-skeleton-${index}`} className="rounded-sm border" style={{ height: '4.75rem', borderColor: 'rgba(200,144,10,0.08)', background: 'rgba(13,11,8,0.28)' }} />
            ))}
          </div>
        ) : filteredRows.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: '#888888', fontSize: '0.8125rem' }}>검토할 평가 데이터가 없습니다.</div>
        ) : (
          filteredRows.map(row => (
            <IdentityReviewRow key={`${row.tier}-${row.identity.id}`} row={row} summary={summaries[row.identity.id]} />
          ))
        )}
      </section>
    </div>
  )
}
