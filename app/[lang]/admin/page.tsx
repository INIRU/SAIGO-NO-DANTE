'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Archive,
  ChevronRight,
  Construction,
  Database,
  FileText,
  Gauge,
  Library,
  Megaphone,
  ScrollText,
  ShieldCheck,
  Tags,
  Users,
} from 'lucide-react'
import { Link } from '@/lib/i18n/navigation'
import { AdminCard } from '@/components/admin'

interface Stats {
  totalDecks?: number
  totalUsers?: number
  todayDecks?: number
  totalViews?: number
}

const primaryActions = [
  { href: '/admin/users', icon: Users, label: '유저 관리', metric: 'moderation' },
  { href: '/admin/audit-logs', icon: ScrollText, label: '감사 로그', metric: 'trace' },
  { href: '/admin/decks', icon: Library, label: '덱 관리', metric: 'content' },
  { href: '/admin/maintenance', icon: Construction, label: '점검 관리', metric: 'switches' },
]

const operations = [
  { href: '/admin/data', icon: Database, label: '게임 데이터', desc: '인격, 스킬, 패시브, E.G.O' },
  { href: '/admin/keywords', icon: Tags, label: '키워드', desc: '검색/표기 메타데이터' },
  { href: '/admin/tier-list', icon: Gauge, label: '티어표', desc: '등급 배치와 노출 관리' },
  { href: '/admin/announcements', icon: Megaphone, label: '공지', desc: '사이트 공지 작성/수정' },
  { href: '/admin/legal', icon: FileText, label: '법률문서', desc: '약관과 개인정보처리방침' },
]

function formatNumber(value: number | undefined) {
  return typeof value === 'number' ? value.toLocaleString('ko-KR') : '-'
}

function getUserTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return undefined
  }
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const timeZone = getUserTimeZone()
    setLoading(true)
    fetch('/api/admin/stats', timeZone ? { headers: { 'x-user-timezone': timeZone } } : undefined)
      .then(async response => {
        if (!response.ok) throw new Error('stats')
        return response.json() as Promise<Stats>
      })
      .then(data => {
        if (active) {
          setStats(data)
          setError(null)
        }
      })
      .catch(() => {
        if (active) setError('통계를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const metrics = useMemo(() => [
    { label: '전체 덱', value: formatNumber(stats?.totalDecks), sub: '공개/비공개 포함', icon: Library },
    { label: '등록 유저', value: formatNumber(stats?.totalUsers), sub: '프로필 기준', icon: Users },
    { label: '오늘 생성', value: formatNumber(stats?.todayDecks), sub: '금일 덱 작성', icon: Activity },
    { label: '누적 조회', value: formatNumber(stats?.totalViews), sub: '덱 조회 합산', icon: Archive },
  ], [stats])

  return (
    <div className="mx-auto w-full max-w-[78rem]">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b" style={{ borderColor: 'rgba(200,144,10,0.16)', paddingBottom: '1rem' }}>
        <div className="flex items-baseline gap-3">
          <h1 className="font-serif font-bold" style={{ color: 'var(--gold)', fontSize: '1.5rem' }}>관리 콘솔</h1>
          <p className="font-mono" style={{ color: '#8a7a5a', fontSize: '0.6875rem' }}>ADMIN OPERATIONS</p>
        </div>
        <div
          className="inline-flex items-center gap-2 font-mono"
          style={{
            color: '#9aac7d',
            fontSize: '0.75rem',
          }}
        >
          <span style={{ width: '0.4375rem', height: '0.4375rem', borderRadius: '999rem', background: '#9aac7d' }} />
          관리자 세션 활성
          <ShieldCheck size="0.875rem" />
        </div>
      </header>

      <section
        className="mb-5 border-y"
        style={{
          borderColor: 'rgba(200,144,10,0.14)',
          padding: '0.875rem 0',
        }}
      >
        <div className="grid grid-cols-2 gap-y-4 md:grid-cols-4">
          {metrics.map((item, index) => {
            const Icon = item.icon
            return (
              <div
                key={item.label}
                className="px-3"
                style={{ borderLeft: index === 0 ? 'none' : '0.0625rem solid rgba(200,144,10,0.12)' }}
              >
                <div className="mb-2 flex items-center gap-2">
                  <Icon size="0.875rem" style={{ color: '#7a6845' }} />
                  <span style={{ color: '#8a7a5a', fontSize: '0.75rem' }}>{item.label}</span>
                </div>
                <p className="font-mono text-2xl font-bold tabular-nums" style={{ color: loading ? '#7a6845' : 'var(--gold)' }}>
                  {loading ? '...' : item.value}
                </p>
                <p style={{ color: '#665a42', fontSize: '0.6875rem', marginTop: '0.25rem' }}>{item.sub}</p>
              </div>
            )
          })}
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2" style={{ color: '#c98272', fontSize: '0.75rem' }}>
            <AlertTriangle size="0.875rem" />
            {error}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <section
          className="rounded-md border"
          style={{
            borderColor: 'rgba(200,144,10,0.18)',
            background: 'rgba(26,21,16,0.64)',
          }}
        >
          <div className="border-b" style={{ borderColor: 'rgba(200,144,10,0.12)', padding: '0.875rem 1rem' }}>
            <h2 style={{ color: '#d6be7a', fontSize: '0.9375rem', fontWeight: 700 }}>작업 우선순위</h2>
          </div>
          <div>
            {primaryActions.map((action, index) => {
              const Icon = action.icon
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group flex items-center justify-between transition-colors hover:bg-white/[0.025]"
                  style={{
                    borderTop: index === 0 ? 'none' : '0.0625rem solid rgba(200,144,10,0.1)',
                    padding: '0.8125rem 1rem',
                  }}
                >
                  <span className="flex items-center gap-3">
                    <span style={{ width: '0.1875rem', height: '1.25rem', background: 'rgba(200,144,10,0.65)' }} />
                    <Icon size="1rem" style={{ color: '#8a7a5a' }} />
                    <span style={{ color: '#d6be7a', fontSize: '0.8125rem', fontWeight: 600 }}>{action.label}</span>
                  </span>
                  <span className="flex items-center gap-1 font-mono" style={{ color: '#7a6845', fontSize: '0.6875rem' }}>
                    {action.metric}
                    <ChevronRight size="0.875rem" className="transition-transform group-hover:translate-x-[0.125rem]" />
                  </span>
                </Link>
              )
            })}
          </div>
        </section>

        <AdminCard
          title="운영 매트릭스"
          style={{ marginBottom: 0, height: '100%' }}
        >
          <div className="grid gap-x-5 gap-y-0 md:grid-cols-2">
            {operations.map((item, index) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-center justify-between gap-3 border-t transition-colors hover:bg-white/[0.025]"
                  style={{ borderColor: 'rgba(200,144,10,0.1)', padding: '0.8125rem 0' }}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Icon size="1rem" style={{ color: index === 0 ? 'var(--gold)' : '#8a7a5a' }} />
                    <span className="min-w-0">
                      <span className="block truncate" style={{ color: '#d6be7a', fontSize: '0.8125rem', fontWeight: 700 }}>{item.label}</span>
                      <span className="block truncate" style={{ color: '#7a6845', fontSize: '0.6875rem', marginTop: '0.125rem' }}>{item.desc}</span>
                    </span>
                  </span>
                  <ChevronRight size="0.875rem" style={{ color: '#665a42' }} className="shrink-0 transition-transform group-hover:translate-x-[0.125rem]" />
                </Link>
              )
            })}
          </div>
        </AdminCard>
      </div>
    </div>
  )
}
