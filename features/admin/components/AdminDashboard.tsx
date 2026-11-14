'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useLocale } from 'next-intl'
import { ArrowUpRight, RotateCw } from 'lucide-react'
import { Link } from '@/lib/i18n/navigation'
import Button from '@/components/ui/Button'
import { fetchJson } from '@/lib/utils/http'
import './admin-dashboard.css'

type Overview = {
  queue: { inquiries: number; reports: number; drafts: number; maintenance: number }
  totals: { users: number; seenDay: number; seenWeek: number; decks: number; plans: number }
  days: string[]
  series: { visits: number[]; joined: number[]; posts: number[] }
  inquiries: { id: string; title: string; status: 'open' | 'answered' | 'closed'; category: string; at: string }[]
}
const copy = {
  ko: { title: '대시보드', queue: '처리할 일', inquiries: '답변 대기 문의', reports: '친구 코드 신고', drafts: '공지 초안', maintenance: '진행 중인 점검', days: '최근 14일', visits: '조회', joined: '가입', posts: '새 덱·플랜', today: '오늘', inbox: '문의', all: '전체', empty: '문의가 없습니다.', status: '현황', users: '전체 유저', seenDay: '24시간 접속', seenWeek: '7일 접속', decks: '덱', plans: '플랜', open: '답변 대기', answered: '답변 완료', closed: '종료', error: '불러오지 못했습니다.', retry: '다시 시도' },
  en: { title: 'Dashboard', queue: 'To do', inquiries: 'Inquiries waiting', reports: 'Friend code reports', drafts: 'Draft announcements', maintenance: 'Maintenance running', days: 'Last 14 days', visits: 'Views', joined: 'Sign-ups', posts: 'New decks and plans', today: 'Today', inbox: 'Inquiries', all: 'All', empty: 'No inquiries.', status: 'Totals', users: 'Users', seenDay: 'Seen in 24 hours', seenWeek: 'Seen in 7 days', decks: 'Decks', plans: 'Plans', open: 'Waiting', answered: 'Answered', closed: 'Closed', error: 'Could not load.', retry: 'Retry' },
  ja: { title: 'ダッシュボード', queue: '対応待ち', inquiries: '返信待ちのお問い合わせ', reports: 'フレンドコード通報', drafts: 'お知らせの下書き', maintenance: '実施中のメンテナンス', days: '直近14日', visits: '閲覧', joined: '登録', posts: '新しいデッキ・プラン', today: '今日', inbox: 'お問い合わせ', all: 'すべて', empty: 'お問い合わせはありません。', status: '現況', users: '全ユーザー', seenDay: '24時間以内の接続', seenWeek: '7日以内の接続', decks: 'デッキ', plans: 'プラン', open: '返信待ち', answered: '返信済み', closed: '終了', error: '読み込めませんでした。', retry: '再試行' },
}
const fetcher = (url: string) => fetchJson<Overview>(url)
const QUEUE = [['inquiries', '/admin/inquiries'], ['reports', '/admin/friends'], ['drafts', '/admin/announcements'], ['maintenance', '/admin/maintenance']] as const
const SERIES = ['visits', 'joined', 'posts'] as const
const TOTALS = ['users', 'seenDay', 'seenWeek', 'decks', 'plans'] as const
const EMPTY_DAYS = Array.from({ length: 14 }, () => '')

/** The admin home: what is waiting, how the last 14 days went, and the latest inquiries. Numbers hold their place while loading. */
export default function AdminDashboard() {
  const locale = useLocale()
  const c = copy[locale as keyof typeof copy] ?? copy.ko
  const { data, error, isLoading, mutate } = useSWR('/api/admin/overview', fetcher, { revalidateOnFocus: true })
  const [hover, setHover] = useState<number | null>(null)
  const days = data?.days ?? EMPTY_DAYS
  const at = hover ?? days.length - 1
  const n = (value: number | undefined) => (value === undefined ? '—' : value.toLocaleString(locale))
  const dayLabel = (day: string) => (day ? `${+day.slice(5, 7)}/${+day.slice(8)}` : '')
  return (
    <section className="admin-page admin-dash">
      <header className="admin-topbar">
        <div><h1>{c.title}</h1></div>
        {error && !isLoading && <div className="admin-topbar-actions" role="alert"><span className="admin-dash-error">{c.error}</span><Button variant="outline" size="sm" icon={RotateCw} onClick={() => void mutate()}>{c.retry}</Button></div>}
      </header>
      <div className="admin-body admin-dash-body">
        <h2 className="admin-dash-heading">{c.queue}</h2>
        <div className="admin-dash-queue">
          {QUEUE.map(([key, href]) => (
            <Link key={key} href={href} data-waiting={(data?.queue[key] ?? 0) > 0}>
              <span>{c[key]}</span>
              <strong>{n(data?.queue[key])}</strong>
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          ))}
        </div>
        <div className="admin-dash-columns">
          <div className="admin-dash-activity" onMouseLeave={() => setHover(null)}>
            <h2 className="admin-dash-heading">{c.days}<em>{hover === null ? c.today : dayLabel(days[at])}</em></h2>
            {SERIES.map(key => {
              const values = data?.series[key]
              const max = Math.max(1, ...(values ?? []))
              return (
                <div key={key} className="admin-dash-series" data-series={key}>
                  <dl>
                    <dt>{c[key]}</dt>
                    <dd>{n(values?.[at])}</dd>
                  </dl>
                  <div className="admin-dash-bars" role="img" aria-label={`${c[key]} ${values?.join(', ') ?? ''}`}>
                    {days.map((_day, i) => (
                      <span key={i} data-on={i === at} onMouseEnter={() => setHover(i)}>
                        {values && <i style={{ transform: `scaleY(${Math.max(values[i] / max, values[i] ? 0.03 : 0)})`, transitionDelay: `${i * 18}ms` }} />}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
            <div className="admin-dash-axis" aria-hidden="true">
              <span />
              <div>{days.map((day, i) => <span key={i} data-on={i === at}>{dayLabel(day)}</span>)}</div>
            </div>
          </div>
          <div className="admin-dash-side">
            <h2 className="admin-dash-heading">{c.inbox}<Link href="/admin/inquiries">{c.all}</Link></h2>
            <ul className="admin-dash-inbox">
              {data?.inquiries.map(i => (
                <li key={i.id}>
                  <Link href={`/admin/inquiries?id=${i.id}`}>
                    <span>{i.title}</span>
                    <span className="admin-chip" data-tone={i.status === 'open' ? 'warn' : i.status === 'answered' ? 'ok' : undefined}>{c[i.status]}</span>
                    <time dateTime={i.at}>{new Date(i.at).toLocaleDateString(locale, { month: 'numeric', day: 'numeric' })}</time>
                  </Link>
                </li>
              ))}
              {data && !data.inquiries.length && <li className="admin-dash-empty">{c.empty}</li>}
            </ul>
            <h2 className="admin-dash-heading">{c.status}</h2>
            <dl className="admin-dash-totals">
              {TOTALS.map(key => <div key={key}><dt>{c[key]}</dt><dd>{n(data?.totals[key])}</dd></div>)}
            </dl>
          </div>
        </div>
      </div>
    </section>
  )
}
