'use client'

import { useId } from 'react'

export const RECOGNITION_MODES = ['fastest', 'performance', 'balanced', 'quality'] as const
export type RecognitionMode = typeof RECOGNITION_MODES[number]
export const DEFAULT_RECOGNITION_MODE: RecognitionMode = 'balanced'

export function isRecognitionMode(value: unknown): value is RecognitionMode {
  return typeof value === 'string' && (RECOGNITION_MODES as readonly string[]).includes(value)
}

interface Props {
  value: RecognitionMode
  onChange: (mode: RecognitionMode) => void
  disabled?: boolean
  /** Localized group label. */
  label: string
  /** Localized name and one-line user benefit per mode. */
  options: Record<RecognitionMode, { label: string; description: string }>
  /** Optional localized line under the options, e.g. when a change applies on the next start. */
  note?: string
}

/** Controlled choice built on native radios, so arrow keys and screen readers work without extra wiring. */
export default function RecognitionModeControl({ value, onChange, disabled = false, label, options, note }: Props) {
  const id = useId()
  return <fieldset disabled={disabled} aria-describedby={note ? `${id}-note` : undefined} className="group @container min-w-0">
    <legend className="mb-1.5 text-xs font-bold text-[var(--gold-light)] group-disabled:opacity-50">{label}</legend>
    <div className="grid gap-1.5 group-disabled:opacity-50 @[22rem]:grid-cols-2 @[40rem]:grid-cols-4">
      {RECOGNITION_MODES.map((mode, index) => {
        const selected = value === mode
        return <label key={mode} data-recognition-mode={mode}
          className={`relative flex min-h-11 cursor-pointer gap-2 rounded-md border px-2.5 py-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--gold-light)] has-[:disabled]:cursor-not-allowed ${selected ? 'border-[var(--gold)] bg-[var(--deck-filter-surface-active)]' : 'border-[var(--border)] bg-[var(--bg-panel)] hover:border-[var(--border-hover)]'}`}>
          <input type="radio" name={id} value={mode} checked={selected} onChange={() => onChange(mode)} aria-describedby={`${id}-${mode}`} className="sr-only" />
          {/* Ordinal ticks: how thoroughly each mode reads the screen, lightest to most. */}
          <span aria-hidden="true" className="mt-0.5 flex h-3.5 shrink-0 items-end gap-[0.1875rem]">
            {RECOGNITION_MODES.map((_, tick) => <span key={tick} className={`w-[0.1875rem] rounded-[1px] ${tick <= index ? (selected ? 'bg-[var(--gold-light)]' : 'bg-[var(--text-tertiary)]') : 'bg-[var(--border)]'}`} style={{ height: `${0.375 + tick * 0.1875}rem` }} />)}
          </span>
          <span className="min-w-0">
            <span className={`block text-sm font-bold leading-5 ${selected ? 'text-[var(--gold-light)]' : 'text-[var(--text-primary)]'}`}>{options[mode].label}</span>
            <span id={`${id}-${mode}`} className="block break-keep text-[0.6875rem] leading-4 text-[var(--text-secondary)]">{options[mode].description}</span>
          </span>
        </label>
      })}
    </div>
    {note && <p id={`${id}-note`} className="mt-1.5 break-keep text-[0.6875rem] leading-4 text-[var(--text-secondary)]">{note}</p>}
  </fieldset>
}
