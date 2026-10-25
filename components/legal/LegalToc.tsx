'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'

const id = (i: number) => 'section-' + i

/** Legal table of contents: desktop rail and mobile jump menu inside one nav, following the section in view. */
export default function LegalToc({ headings, label, otherHref, otherLabel }: { headings: string[]; label: string; otherHref: string; otherLabel: string }) {
  const [active, setActive] = useState(0)
  const count = headings.length

  // Current section: the last one whose top passed 30% of the viewport, or the last one at the page bottom.
  useEffect(() => {
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const line = window.innerHeight * 0.3
        let current = 0
        for (let i = 0; i < count; i++) {
          const top = document.getElementById(id(i))?.getBoundingClientRect().top
          if (top != null && top <= line) current = i
        }
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) current = count - 1
        setActive(current)
      })
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [count])

  // Scrolls without a hash so BackLink history stays intact. Rail links also move focus to the heading, as an anchor would.
  const go = (i: number, focus = false) => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.getElementById(id(i))?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    if (focus) document.getElementById(id(i) + '-heading')?.focus({ preventScroll: true })
    setActive(i)
  }

  return <>
    <div className="relative lg:hidden">
      <select
        aria-label={label}
        value={active}
        onChange={event => go(Number(event.target.value))}
        className="h-11 w-full appearance-none truncate rounded-md border border-[var(--border)] bg-[#17120c] pl-3 pr-10 text-base text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-light)]"
      >
        {headings.map((heading, i) => <option key={i} value={i}>{heading}</option>)}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[var(--gold)]" />
    </div>

    <div className="hidden lg:block">
      <ol className="border-l border-[#2e2417]">
        {headings.map((heading, i) => (
          <li key={i}>
            <a
              href={'#' + id(i)}
              aria-current={active === i ? 'location' : undefined}
              onClick={event => { event.preventDefault(); go(i, true) }}
              className="-ml-px block border-l-2 border-transparent py-1.5 pl-4 text-[0.875rem] leading-snug text-[#9c8b73] transition-colors duration-150 hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-light)] motion-reduce:transition-none aria-[current]:border-[var(--gold)] aria-[current]:font-semibold aria-[current]:text-[var(--text-primary)]"
            >
              {heading}
            </a>
          </li>
        ))}
      </ol>
      <Link href={otherHref} className="mt-6 block border-t border-[#241c14] pt-4 text-[0.875rem] text-[var(--gold)] transition-colors duration-150 hover:text-[var(--gold-light)] motion-reduce:transition-none">
        {otherLabel}
      </Link>
    </div>
  </>
}
