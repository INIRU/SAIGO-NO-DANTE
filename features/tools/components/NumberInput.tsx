'use client'

import { useState } from 'react'
import { parseNumberInput } from '@/features/tools/lib/damage'

/**
 * A number field that keeps what is being typed until it leaves the field. Writing the parsed number straight back
 * would erase a "-" or "." in mid-entry: the browser reports those as empty, which reads as 0. A field that takes
 * negatives keeps the full keyboard: the numeric and decimal pads of phones have no minus key.
 */
export default function NumberInput({ label, value, onChange, min = 0, max, decimal = false, step = decimal ? 0.05 : 1, disabled }: {
  label: string; value: number; onChange: (value: number) => void; min?: number; max: number; decimal?: boolean; step?: number; disabled?: boolean
}) {
  const [draft, setDraft] = useState<string | null>(null)
  return <input type="number" aria-label={label} inputMode={min < 0 ? undefined : decimal ? 'decimal' : 'numeric'} min={min} max={max} step={step} disabled={disabled}
    value={draft ?? value} onBlur={() => setDraft(null)}
    onChange={e => {
      setDraft(e.target.value)
      const next = parseNumberInput(e.target.value, { min, max, decimal })
      if (next !== null) onChange(next)
    }} />
}
