'use client'

import { useEffect, useId, useState, type ReactNode } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'

export type DockFacet = {
  key: string
  label: string
  /** Active selections in this facet, shown on its tab. */
  count?: number
  content: ReactNode
}
export type DockApplied = { key: string; label: ReactNode; onRemove: () => void }

/**
 * The deck and plan boards' filter bar: a toolbar row (search, sort, difficulty), a row of facet tabs that open one
 * wide panel at a time, then the applied filters as removable chips. Replaces the old sidebar, so results get the width.
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
    <div className="flex shrink-0 flex-col gap-3 pb-3">
      <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
      <div className="flex gap-1 overflow-x-auto shadow-[inset_0_-1px_0_#2e2417] [scrollbar-width:none]">
        {facets.map(facet => {
          const selected = open === facet.key
          return (
            <button key={facet.key} type="button" aria-expanded={selected} aria-controls={`${id}-panel`}
              onClick={() => setOpen(selected ? null : facet.key)}
              className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-[0.9375rem] transition-colors first:pl-1 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#e8b030] motion-reduce:transition-none ${selected
                ? 'border-[#c8900a] font-semibold text-[#e8dcc8]'
                : facet.count ? 'border-transparent text-[#e8b030] hover:text-[#e8dcc8]' : 'border-transparent text-[#9c8b73] hover:text-[#e8dcc8]'}`}>
              {facet.label}
              {facet.count ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#c8900a] px-1 text-[0.75rem] font-bold leading-none text-[#0d0b08]">{facet.count}</span> : null}
              <ChevronDown size={14} aria-hidden="true" className={`transition-transform motion-reduce:transition-none ${selected ? 'rotate-180' : ''}`} />
            </button>
          )
        })}
      </div>
      {current && (
        <div id={`${id}-panel`} role="region" aria-label={current.label}
          className="max-h-[min(24rem,42dvh)] overflow-y-auto overscroll-contain rounded-lg border border-[#2e2417] bg-[#120e09] p-3 [scrollbar-width:thin]">
          {current.content}
        </div>
      )}
      <div className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-2">
        <div className="text-[0.9375rem] text-[#9c8b73]" role="status" aria-live="polite">{summary}</div>
        {applied.length > 0 && (
          <ul className="flex flex-wrap items-center gap-1.5">
            {applied.map(item => (
              <li key={item.key}>
                <button type="button" onClick={item.onRemove} aria-label={removeLabel(typeof item.label === 'string' ? item.label : item.key)}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[rgba(200,144,10,0.4)] bg-[rgba(200,144,10,0.1)] pl-3 pr-2 text-[0.8125rem] text-[#e8dcc8] transition-colors hover:border-[#c8900a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e8b030]">
                  {item.label}<X size={13} aria-hidden="true" className="text-[#c9b89f]" />
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

/** One selectable option in a facet panel: optional icon, label and how many posts use it. */
export function FacetChip({ active, onClick, icon, label, count, title }: {
  active: boolean
  onClick: () => void
  icon?: ReactNode
  label: ReactNode
  count?: number
  title?: string
}) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} title={title}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-md border px-2.5 text-[0.875rem] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e8b030] ${active
        ? 'border-[#c8900a] bg-[rgba(200,144,10,0.14)] text-[#e8dcc8]'
        : 'border-[#2e2417] bg-[#17120c] text-[#c9b89f] hover:border-[#5a4526] hover:text-[#e8dcc8]'}`}>
      {icon}
      <span className="min-w-0 truncate">{label}</span>
      {count !== undefined && <span className={`text-[0.75rem] tabular-nums ${active ? 'text-[#e8b030]' : 'text-[#7f7364]'}`}>{count}</span>}
    </button>
  )
}

/** Narrows a long facet (gifts, theme packs, affiliations) by name. */
export function FacetSearch({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="relative mb-3 block">
      <Search size={14} aria-hidden="true" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7f7364]" />
      <input type="search" value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder}
        className="min-h-9 w-full rounded-md border border-[#2e2417] bg-[#0d0b08] pl-8 pr-3 text-[0.875rem] text-[#e8dcc8] outline-none placeholder:text-[#6a6058] focus:border-[#5a4526]" />
    </label>
  )
}

