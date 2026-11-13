'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import { Info } from 'lucide-react'

export default function InfoScoreLabel() {
  const t = useTranslations('decks')
  const tooltipId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return

    const updatePosition = () => {
      const trigger = triggerRef.current
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      const tooltipWidth = 13 * rootFontSize
      const gap = 0.375 * rootFontSize
      const viewportPadding = 0.75 * rootFontSize
      const left = Math.min(
        Math.max(rect.left, viewportPadding),
        Math.max(viewportPadding, window.innerWidth - tooltipWidth - viewportPadding),
      )
      const tooltipHeight = tooltipRef.current?.offsetHeight ?? 0
      const belowTop = rect.bottom + gap
      const top = tooltipHeight > 0 && belowTop + tooltipHeight + viewportPadding > window.innerHeight
        ? Math.max(viewportPadding, rect.top - tooltipHeight - gap)
        : belowTop
      setPosition({ top, left })
    }

    updatePosition()
    const frame = window.requestAnimationFrame(updatePosition)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  return (
    <span className="relative inline-flex min-w-0 items-center gap-1.5">
      <span className="min-w-0 truncate">{t('filters.infoScore')}</span>
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex shrink-0 items-center justify-center rounded-sm transition-colors hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2"
        style={{
          width: '1.5rem',
          height: '1.5rem',
          color: 'var(--deck-filter-text-soft)',
          cursor: 'help',
        }}
        aria-label={t('filters.infoScoreHelpLabel')}
        aria-describedby={open ? tooltipId : undefined}
        onBlur={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <Info size={13} strokeWidth={1.75} aria-hidden="true" />
      </button>
      {mounted && open && createPortal(
        <span
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none fixed z-[100] w-[13rem] rounded border px-2.5 py-2 text-left"
          style={{
            top: position.top,
            left: position.left,
            background: 'var(--bg-card)',
            borderColor: 'rgba(200,144,10,0.28)',
            boxShadow: '0 0.75rem 1.5rem rgba(0,0,0,0.32)',
            color: 'var(--deck-filter-text-muted)',
            fontFamily: 'var(--font-body)',
            fontSize: '0.875rem',
            lineHeight: 1.45,
            whiteSpace: 'normal',
          }}
        >
          {t('filters.infoScoreHelp')}
        </span>,
        document.body,
      )}
    </span>
  )
}
