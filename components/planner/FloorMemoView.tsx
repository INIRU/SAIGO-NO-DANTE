'use client'

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * A floor memo on the plan page, shown in full. Only a memo taller than the clamp gets a fade and a toggle,
 * so short memos read without any extra click.
 */
export default function FloorMemoView({ children, moreLabel, lessLabel }: { children: ReactNode; moreLabel: string; lessLabel: string }) {
  const body = useRef<HTMLDivElement>(null)
  const [long, setLong] = useState(false)
  const [open, setOpen] = useState(false)
  useLayoutEffect(() => {
    const el = body.current
    if (!el) return
    const measure = () => setLong(el.scrollHeight > el.clientHeight + 4 || (open && el.scrollHeight > 9.5 * parseFloat(getComputedStyle(el).fontSize)))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [open])
  return (
    <div className="min-w-0 border-l-2 border-[#5a4526] pl-3">
      <div ref={body} className={`relative whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-[#cfc2ad] ${open ? '' : 'max-h-[9.5em] overflow-hidden'}`}>
        {children}
        {long && !open && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#17120c] to-transparent" />}
      </div>
      {long && (
        <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open}
          className="mt-1 inline-flex min-h-8 items-center gap-1 text-[0.875rem] font-semibold text-[#c8900a] hover:text-[#e8b030] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c8900a]">
          {open ? lessLabel : moreLabel}
          <ChevronDown size={14} aria-hidden="true" className={open ? 'rotate-180' : ''} />
        </button>
      )}
    </div>
  )
}
