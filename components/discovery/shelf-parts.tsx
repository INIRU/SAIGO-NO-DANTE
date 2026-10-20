'use client'

import { useEffect, useState } from 'react'
import { History } from 'lucide-react'
import { useLocale } from 'next-intl'
import { Link } from '@/lib/i18n/navigation'
import { readHistory, type HistoryItem } from '@/lib/discovery/history'

export type Period = 'week' | 'month' | 'all'

const labelOf = (lang: string) => (ko: string, ja: string, en: string) => (lang === 'ko' ? ko : lang === 'ja' ? ja : en)

/** The period tabs of the frequently visited shelf. */
export function PeriodTabs({ days, onChange }: { days: Period; onChange: (days: Period) => void }) {
  const label = labelOf(useLocale())
  return (
    <div role="group" data-period-tabs className="flex gap-1">
      {(['week', 'month', 'all'] as const).map(d => (
        <button key={d} aria-pressed={d === days} onClick={() => onChange(d)}
          className={`min-h-10 rounded-full px-4 text-sm transition-colors ${d === days ? 'bg-[var(--gold)]/10 text-[var(--gold)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
          {d === 'week' ? label('이번 주', '今週', 'This week') : d === 'month' ? label('최근 4주', '直近4週', 'Last 4 weeks') : label('전체 기간', '全期間', 'All time')}
        </button>
      ))}
    </div>
  )
}

/** Recently viewed items and searches of this browser. */
export function RecentHistory({ kind, base }: { kind: 'deck' | 'planner'; base: string }) {
  const label = labelOf(useLocale())
  const [history, setHistory] = useState<{ items: HistoryItem[]; queries: string[]; enabled: boolean }>({ items: [], queries: [], enabled: true })
  useEffect(() => {
    const load = () => setHistory(readHistory())
    load()
    window.addEventListener('limbus-history-changed', load)
    return () => window.removeEventListener('limbus-history-changed', load)
  }, [])
  const items = history.items.filter(item => item.kind === kind || item.kind === 'identity').slice(0, 8)
  if (items.length === 0 && history.queries.length === 0) return null
  return (
    <section className="pt-3">
      <h2 className="mb-3 flex items-center gap-2 text-sm text-[var(--gold)]"><History size={17} />{label('최근 찾아본 기록', '最近の閲覧', 'Recently viewed')}</h2>
      <div className="flex flex-wrap gap-2">
        {items.map(item => (
          <Link key={item.href} href={item.kind === 'identity' ? `${base}?browse=all&ids=${item.id}` : item.href} className="rounded-md bg-white/[0.035] px-3 py-2 text-xs text-[var(--text-muted)] hover:text-[var(--gold)]">{item.title}</Link>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {history.queries.slice(0, 6).map(q => <Link key={q} href={`${base}?browse=all&q=${encodeURIComponent(q)}`} className="text-xs text-[var(--gold-dim)]">#{q}</Link>)}
      </div>
    </section>
  )
}
