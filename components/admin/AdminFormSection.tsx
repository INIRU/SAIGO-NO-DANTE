'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface AdminFormSectionProps {
  title?: string
  columns?: 2 | 3
  children: ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
}

export function AdminFormSection({ title, columns = 2, children, collapsible = false, defaultOpen = true }: AdminFormSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div style={{ marginBottom: '16px' }}>
      {title && (
        <div
          onClick={collapsible ? () => setOpen(v => !v) : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: open ? '12px' : 0,
            cursor: collapsible ? 'pointer' : 'default',
            userSelect: collapsible ? 'none' : 'auto',
          }}
        >
          {collapsible && (
            open
              ? <ChevronDown size={14} style={{ color: '#c8900a' }} />
              : <ChevronRight size={14} style={{ color: '#555566' }} />
          )}
          <h3 style={{ color: '#8a6010', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {title}
          </h3>
        </div>
      )}
      {open && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: '14px',
        }}>
          {children}
        </div>
      )}
    </div>
  )
}
