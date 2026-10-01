'use client'

import { type LucideIcon } from 'lucide-react'

const VARIANTS = {
  gold:    { bg: 'rgba(200,144,10,0.1)',  color: 'var(--gold-light)', border: 'rgba(200,144,10,0.3)' },
  muted:   { bg: 'var(--bg-card)',         color: 'var(--text-muted)', border: 'var(--border)' },
  success: { bg: 'rgba(34,197,94,0.12)',   color: '#4ade80',           border: 'rgba(34,197,94,0.35)' },
  danger:  { bg: 'rgba(200,48,32,0.1)',    color: '#cc4444',           border: 'rgba(200,48,32,0.3)' },
  primary: { bg: 'var(--gold)',            color: 'var(--bg-deep)',    border: 'var(--gold)' },
} as const

const SIZES = {
  sm: { padding: '0.375rem 0.625rem', fontSize: 'var(--text-xs)', iconSize: '0.75rem' },
  md: { padding: '0.5rem 0.875rem',   fontSize: 'var(--text-sm)', iconSize: '0.875rem' },
} as const

interface CompactButtonProps {
  icon?: LucideIcon
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: keyof typeof VARIANTS
  size?: keyof typeof SIZES
  title?: string
  className?: string
}

export default function CompactButton({
  icon: Icon,
  children,
  onClick,
  disabled = false,
  variant = 'gold',
  size = 'sm',
  title,
  className = '',
}: CompactButtonProps) {
  const v = VARIANTS[variant]
  const s = SIZES[size]

  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center gap-1 font-semibold transition ${className}`}
      style={{
        padding: s.padding,
        fontSize: s.fontSize,
        background: v.bg,
        color: v.color,
        border: `1px solid ${v.border}`,
        borderRadius: 'var(--radius-md)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {Icon && <Icon style={{ width: s.iconSize, height: s.iconSize }} />}
      {children}
    </button>
  )
}
