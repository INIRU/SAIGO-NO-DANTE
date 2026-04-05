'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useQueryState, parseAsString } from 'nuqs'
import type { Sinner } from '@/lib/data/sinners'
import type { MetaData, EGOStat } from '@/lib/db/meta'
import IdentityTab from '@/components/meta/IdentityTab'
import KeywordTab from '@/components/meta/KeywordTab'
import SynergyTab from '@/components/meta/SynergyTab'
import EGOTab from '@/components/meta/EGOTab'

type Tab = 'identity' | 'keyword' | 'synergy' | 'ego'
type IdentitySubTab = 'battle' | 'support'

const TAB_LIST: { key: Tab; label: string }[] = [
  { key: 'identity', label: '인격 채용률' },
  { key: 'keyword', label: '키워드' },
  { key: 'synergy', label: '시너지' },
  { key: 'ego', label: 'EGO' },
]

interface Props {
  sinners: Sinner[]
  initialData: MetaData | null
}

export default function MetaClient({ sinners, initialData }: Props) {
  const [tab, setTab] = useQueryState('tab', parseAsString.withDefault('identity'))
  const [identitySubTab, setIdentitySubTab] = useQueryState('sub', parseAsString.withDefault('battle'))
  const [data] = useState<MetaData | null>(initialData)
  const [sinnerFilter, setSinnerFilter] = useQueryState('sinner', parseAsString.withDefault(''))

  const sinnerMap = useMemo(() => {
    const m = new Map<string, Sinner>()
    sinners.forEach(s => m.set(s.id, s))
    return m
  }, [sinners])

  // ── Scroll animations (Web Animations API + IntersectionObserver) ───────
  const animObserversRef = useRef<IntersectionObserver[]>([])

  const runAnimations = useCallback(() => {
    // Disconnect any previous observers before re-running (tab/filter change)
    animObserversRef.current.forEach(io => io.disconnect())
    animObserversRef.current = []

    // Usage bars — scaleX from 0 to 1, staggered, triggered when .usage-chart enters viewport
    const chart = document.querySelector('.usage-chart')
    if (chart) {
      const barIo = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return
        barIo.disconnect()
        const bars = Array.from(document.querySelectorAll<HTMLElement>('.usage-bar'))
        bars.forEach((bar, i) => {
          bar.style.transformOrigin = 'left'
          bar.animate(
            [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
            { duration: 800, delay: i * 40, easing: 'ease-out', fill: 'forwards' },
          )
        })
      }, { threshold: 0.05 })
      barIo.observe(chart)
      animObserversRef.current.push(barIo)
    }

    // Count-up numbers
    document.querySelectorAll<HTMLElement>('.count-up').forEach(el => {
      const target = parseInt(el.getAttribute('data-target') || '0', 10)
      if (!target) return
      const countIo = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return
        countIo.disconnect()
        const start = performance.now()
        const duration = 1200
        const tick = (now: number) => {
          const progress = Math.min((now - start) / duration, 1)
          // ease-out quad
          const eased = 1 - (1 - progress) * (1 - progress)
          el.textContent = Math.round(eased * target).toString()
          if (progress < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }, { threshold: 0.1 })
      countIo.observe(el)
      animObserversRef.current.push(countIo)
    })
  }, [])

  useEffect(() => {
    if (!data) return
    const timer = setTimeout(runAnimations, 60)
    return () => {
      clearTimeout(timer)
      animObserversRef.current.forEach(io => io.disconnect())
    }
  }, [data, tab, sinnerFilter, runAnimations])

  // ── Derived ───────────────────────────────────────────────────
  const filteredBattleStats = useMemo(() => {
    if (!data) return []
    const stats = sinnerFilter
      ? data.battleIdentityStats.filter(s => s.sinner_id === sinnerFilter)
      : data.battleIdentityStats
    return stats.slice(0, 20)
  }, [data, sinnerFilter])

  const filteredSupportStats = useMemo(() => {
    if (!data) return []
    const stats = sinnerFilter
      ? data.supportIdentityStats.filter(s => s.sinner_id === sinnerFilter)
      : data.supportIdentityStats
    return stats.slice(0, 20)
  }, [data, sinnerFilter])

  const egoByGrade = useMemo(() => {
    if (!data) return {} as Record<string, EGOStat[]>
    const groups: Record<string, EGOStat[]> = {}
    for (const ego of data.egoStats) {
      if (!groups[ego.grade]) groups[ego.grade] = []
      groups[ego.grade].push(ego)
    }
    return groups
  }, [data])

  if (!data) {
    return (
      <div className="space-y-3 mt-6">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="h-16 rounded-lg animate-pulse"
            style={{ background: 'var(--bg-elevated)', opacity: 1 - i * 0.08 }}
          />
        ))}
      </div>
    )
  }

  const totalDecks = data.totalDecks || 1

  return (
    <div>
      {/* 탭 */}
      <div className="flex gap-0 mb-6 md:mb-8 rounded overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        {TAB_LIST.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSinnerFilter(null) }}
            className="flex-1 py-2.5 md:py-3 text-xs md:text-sm font-medium transition-all duration-200"
            style={{
              background: tab === t.key ? 'var(--gold)' : 'transparent',
              color: tab === t.key ? 'var(--bg-deep)' : '#666688',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'identity' && (
        <IdentityTab
          data={data}
          totalDecks={totalDecks}
          sinners={sinners}
          sinnerMap={sinnerMap}
          sinnerFilter={sinnerFilter}
          setSinnerFilter={setSinnerFilter}
          filteredStats={identitySubTab === 'battle' ? filteredBattleStats : filteredSupportStats}
          label={identitySubTab === 'battle' ? '배틀 채용률' : '서포트 채용률'}
          subTab={identitySubTab as IdentitySubTab}
          setSubTab={(v: IdentitySubTab) => setIdentitySubTab(v === 'battle' ? null : v)}
        />
      )}
      {tab === 'keyword' && <KeywordTab data={data} />}
      {tab === 'synergy' && <SynergyTab data={data} sinnerMap={sinnerMap} />}
      {tab === 'ego' && <EGOTab data={data} sinnerMap={sinnerMap} egoByGrade={egoByGrade} />}
    </div>
  )
}
