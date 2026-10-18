'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface SectionBlockProps {
  title: string
  subtitle?: string
  badge?: number | string
  defaultOpen?: boolean
  children: React.ReactNode
  className?: string
}

export default function SectionBlock({
  title,
  subtitle,
  badge,
  defaultOpen = true,
  children,
  className = '',
}: SectionBlockProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={className} style={{ marginBottom: '1.5rem' }}>
      {/* 헤더 */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between w-full text-left"
        style={{
          paddingBottom: '0.625rem',
          borderBottom: '1px solid var(--border)',
          cursor: 'pointer',
        }}
      >
        <div className="flex items-center gap-2">
          <span
            style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-heading)',
            }}
          >
            {title}
          </span>
          {badge !== undefined && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                color: 'var(--gold)',
              }}
            >
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {subtitle && (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              {subtitle}
            </span>
          )}
          <ChevronDown
            style={{
              width: '0.875rem',
              height: '0.875rem',
              color: 'var(--text-muted)',
              transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform 0.2s ease',
            }}
          />
        </div>
      </button>

      {/* 콘텐츠 */}
      <div
        style={{
          display: 'grid',
          gridTemplateRows: open ? '1fr' : '0fr',
          opacity: open ? 1 : 0,
          transition: 'grid-template-rows 0.3s ease, opacity 0.2s ease',
        }}
      >
        <div style={{ minHeight: 0, overflow: 'hidden' }}>
          <div style={{ paddingTop: '1rem' }}>{children}</div>
        </div>
      </div>
    </div>
  )
}
