'use client'

import { useId } from 'react'
import { DETECTION_KINDS, type DetectionKind, type DetectionSettings } from '@/lib/vision/detection-settings'

interface Props {
  value: DetectionSettings
  onChange: (next: DetectionSettings) => void
  /** Localized group label. */
  label: string
  /** Localized name and one-line effect per switch. */
  options: Record<DetectionKind, { label: string; description: string }>
}

/** Native checkboxes styled like the recognition mode choice, so keyboard and screen readers work unchanged. */
export default function DetectionToggles({ value, onChange, label, options }: Props) {
  const id = useId()
  return <fieldset className="@container min-w-0">
    <legend className="mb-1.5 text-xs font-bold text-[var(--gold-light)]">{label}</legend>
    <div className="grid gap-1.5 @[26rem]:grid-cols-3">
      {DETECTION_KINDS.map(kind => {
        const on = value[kind]
        return <label key={kind} data-detection-kind={kind}
          className={`relative flex min-h-11 cursor-pointer gap-2 rounded-md border px-2.5 py-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--gold-light)] ${on ? 'border-[var(--gold)] bg-[var(--deck-filter-surface-active)]' : 'border-[var(--border)] bg-[var(--bg-panel)] hover:border-[var(--border-hover)]'}`}>
          <input type="checkbox" checked={on} onChange={() => onChange({ ...value, [kind]: !on })} aria-describedby={`${id}-${kind}`} className="sr-only" />
          <span aria-hidden="true" className={`mt-0.5 flex h-4 w-7 shrink-0 items-center rounded-full border p-px transition-colors ${on ? 'justify-end border-[var(--gold)] bg-[var(--gold)]' : 'justify-start border-[var(--border)] bg-[var(--bg-deep)]'}`}>
            <span className={`h-3 w-3 rounded-full ${on ? 'bg-[var(--bg-deep)]' : 'bg-[var(--text-tertiary)]'}`} />
          </span>
          <span className="min-w-0">
            <span className={`block text-sm font-bold leading-5 ${on ? 'text-[var(--gold-light)]' : 'text-[var(--text-primary)]'}`}>{options[kind].label}</span>
            <span id={`${id}-${kind}`} className="block break-keep text-[0.6875rem] leading-4 text-[var(--text-secondary)]">{options[kind].description}</span>
          </span>
        </label>
      })}
    </div>
  </fieldset>
}
