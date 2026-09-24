'use client'

import { useTranslations } from 'next-intl'
import type { RunState, RunAction } from '@/lib/planner/run-types'

export default function FloorProgress({ state, dispatch }: { state: RunState; dispatch: React.Dispatch<RunAction> }) {
  const t = useTranslations('planner.run')
  return <nav aria-label={t('floorNavigation')} className="flex gap-2 overflow-x-auto border-b border-[var(--border)] pb-3">
    {state.floorLogs.map(log => {
      const selected = log.floor === state.currentFloor
      return <button key={log.floor} type="button" onClick={() => dispatch({ type: 'GO_TO_FLOOR', floor: log.floor })} aria-current={selected ? 'step' : undefined} className={`min-h-11 min-w-20 shrink-0 rounded-md border px-4 text-sm font-bold transition-colors ${selected ? 'border-[var(--gold-light)] bg-[var(--gold)] text-[var(--bg-deep)]' : 'border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:border-[var(--border-gold)]'}`}>{t('floorNumber', { floor: log.floor })}{log.completedAt ? ' ✓' : ''}</button>
    })}
  </nav>
}
