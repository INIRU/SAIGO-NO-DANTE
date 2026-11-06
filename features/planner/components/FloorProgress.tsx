'use client'

import { Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { RunState, RunAction } from '@/features/planner/lib/run-types'

/** The descent so far: one marker per floor on a single line, gold up to the floor being recorded. */
export default function FloorProgress({ state, dispatch }: { state: RunState; dispatch: React.Dispatch<RunAction> }) {
  const t = useTranslations('planner.run')
  return <nav aria-label={t('floorNavigation')} className="overflow-x-auto">
    <ol className="flex min-w-max items-center py-0.5">
      {state.floorLogs.map((log, index) => {
        const selected = log.floor === state.currentFloor
        const reached = log.floor <= state.currentFloor || !!log.completedAt
        return <li key={log.floor} className="flex items-center">
          {index > 0 && <span aria-hidden="true" className={`h-px w-2 sm:w-3.5 ${reached ? 'bg-[var(--gold)]' : 'bg-[var(--border)]'}`} />}
          <button type="button" onClick={() => dispatch({ type: 'GO_TO_FLOOR', floor: log.floor })} aria-current={selected ? 'step' : undefined} aria-label={t('floorNumber', { floor: log.floor })}
            className={`relative grid h-8 w-8 place-items-center rounded border font-[family-name:var(--font-title)] text-base leading-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-light)] ${selected
              ? 'border-[var(--gold-light)] bg-[var(--gold)] text-[var(--bg-deep)]'
              : log.completedAt ? 'border-[var(--border-gold)] bg-[var(--bg-panel)] text-[var(--gold-light)] hover:bg-[var(--bg-elevated)]'
              : 'border-[var(--border)] bg-[var(--bg-panel)] text-[var(--text-muted)] hover:border-[var(--border-gold)] hover:text-[var(--text-primary)]'}`}>
            {log.floor}
            {log.completedAt && <Check aria-hidden="true" size={9} strokeWidth={3} className={`absolute right-px top-px ${selected ? 'text-[var(--bg-deep)]' : 'text-[var(--gold-light)]'}`} />}
          </button>
        </li>
      })}
    </ol>
  </nav>
}
