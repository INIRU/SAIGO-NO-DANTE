'use client'

import { useEffect, useId, useState, type ReactNode } from 'react'
import { Check, Search, X } from 'lucide-react'

export type DockFacet = {
  key: string
  label: string
  /** Active selections in this facet, shown on its tab. */
  count?: number
  content: ReactNode
}
export type DockApplied = { key: string; label: ReactNode; onRemove: () => void }

/**
 * The deck and plan boards' filters, placed inside the results' scroller (one scroll area): a toolbar row, underline tabs
 * that open one panel below them (no inner scroll), then the result count with the applied filters as removable chips.
 */
export default function FilterDock({ toolbar, facets, applied, summary, onClearAll, clearLabel, removeLabel }: {
  toolbar: ReactNode
  facets: DockFacet[]
  applied: DockApplied[]
  summary: ReactNode
  onClearAll: () => void
  clearLabel: string
  removeLabel: (label: string) => string
}) {
  const id = useId()
  const [open, setOpen] = useState<string | null>(null)
  const current = facets.find(facet => facet.key === open)
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  return (
    <div className="mb-5 flex flex-col">
      <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
      <div className="mt-3 flex overflow-x-auto shadow-[inset_0_-1px_0_#2e2417] [scrollbar-width:none]">
        {facets.map(facet => {
          const selected = open === facet.key
          return (
            <button key={facet.key} type="button" aria-expanded={selected} aria-controls={`${id}-panel`}
              onClick={() => setOpen(selected ? null : facet.key)}
              className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 text-[0.9375rem] transition-colors first:pl-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#e8b030] motion-reduce:transition-none ${selected
                ? 'border-[#c8900a] font-semibold text-[#e8dcc8]'
                : 'border-transparent text-[#9c8b73] hover:text-[#e8dcc8]'}`}>
              {facet.label}
              {facet.count ? <span className="font-[family-name:var(--font-title)] text-[1rem] leading-none text-[#e8b030]">{facet.count}</span> : null}
            </button>
          )
        })}
      </div>
      {current && (
        <div id={`${id}-panel`} role="region" aria-label={current.label} className="border-b border-[#2e2417] bg-[#120e09] px-3 py-4 sm:px-4">
          {current.content}
        </div>
      )}
      <div className="mt-3 flex min-h-8 flex-wrap items-center gap-x-3 gap-y-2">
        <div className="text-[0.9375rem] text-[#9c8b73]" role="status" aria-live="polite">{summary}</div>
        {applied.length > 0 && (
          <ul className="flex flex-wrap items-center gap-1.5">
            {applied.map(item => (
              <li key={item.key}>
                <button type="button" onClick={item.onRemove} aria-label={removeLabel(typeof item.label === 'string' ? item.label : item.key)}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded border border-[#3a2a15] bg-[#17120c] pl-2.5 pr-1.5 text-[0.8125rem] text-[#e8dcc8] transition-colors hover:border-[#5a4526] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e8b030]">
                  {item.label}<X size={13} aria-hidden="true" className="text-[#9c8b73]" />
                </button>
              </li>
            ))}
            <li>
              <button type="button" onClick={onClearAll}
                className="min-h-8 rounded px-2 text-[0.8125rem] text-[#9c8b73] underline-offset-4 hover:text-[#e8dcc8] hover:underline">
                {clearLabel}
              </button>
            </li>
          </ul>
        )}
      </div>
    </div>
  )
}

/** A marked corner for selected options: the state is never shown by border colour alone. */
function Mark() {
  return <span aria-hidden="true" className="grid h-4 w-4 shrink-0 place-items-center rounded-sm bg-[#c8900a] text-[#0d0b08]"><Check size={11} strokeWidth={3.5} /></span>
}

/** A text option (affiliation, language, owned). */
export function FacetChip({ active, onClick, label, count, title }: {
  active: boolean
  onClick: () => void
  label: ReactNode
  count?: number
  title?: string
}) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} title={title}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded border px-2.5 text-[0.875rem] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e8b030] ${active
        ? 'border-[#5a4526] bg-[#241c12] text-[#e8dcc8]'
        : 'border-[#241c14] bg-[#17120c] text-[#b0a890] hover:border-[#3a2a15] hover:text-[#e8dcc8]'}`}>
      {active && <Mark />}
      <span className="min-w-0 truncate">{label}</span>
      {count !== undefined && <span className="font-[family-name:var(--font-title)] text-[0.9375rem] leading-none text-[#7f7364]">{count}</span>}
    </button>
  )
}

/** An option led by its game icon (keywords): icon above the name. */
export function FacetTile({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: ReactNode }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick}
      className={`relative flex min-h-[4.25rem] min-w-0 flex-col items-center justify-center gap-1 rounded border px-1 text-[0.8125rem] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e8b030] ${active
        ? 'border-[#5a4526] bg-[#241c12] text-[#e8dcc8]'
        : 'border-[#241c14] bg-[#17120c] text-[#9c8b73] hover:border-[#3a2a15] hover:text-[#e8dcc8]'}`}>
      {active && <span className="absolute right-1 top-1"><Mark /></span>}
      <span className={`grid h-7 w-7 place-items-center transition-opacity ${active ? '' : 'opacity-70'}`}>{icon}</span>
      <span className="max-w-full truncate">{label}</span>
    </button>
  )
}

/** Narrows a long facet by name. */
export function FacetSearch({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="relative mb-3 block max-w-[24rem]">
      <Search size={14} aria-hidden="true" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7f7364]" />
      <input type="search" value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder}
        className="min-h-9 w-full rounded border border-[#2e2417] bg-[#0d0b08] pl-8 pr-3 text-[0.875rem] text-[#e8dcc8] outline-none placeholder:text-[#6a6058] focus:border-[#5a4526]" />
    </label>
  )
}

