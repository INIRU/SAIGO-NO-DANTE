'use client'

import { type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

type Variant = 'gold' | 'danger' | 'ghost' | 'success'
type Size = 'sm' | 'md'

const variantStyles: Record<Variant, React.CSSProperties> = {
  gold: {
    background: 'rgba(200,144,10,0.15)',
    border: '1px solid var(--gold)',
    color: 'var(--gold)',
  },
  danger: {
    background: 'rgba(170,68,68,0.1)',
    border: '1px solid rgba(170,68,68,0.4)',
    color: '#ee6666',
  },
  ghost: {
    background: 'transparent',
    border: '1px solid var(--border)',
    color: '#888888',
  },
  success: {
    background: 'rgba(68,170,102,0.1)',
    border: '1px solid rgba(68,170,102,0.4)',
    color: '#44aa66',
  },
}

const hoverBg: Record<Variant, string> = {
  gold: 'rgba(200,144,10,0.25)',
  danger: 'rgba(170,68,68,0.2)',
  ghost: 'rgba(255,255,255,0.05)',
  success: 'rgba(68,170,102,0.2)',
}

const sizeStyles: Record<Size, React.CSSProperties> = {
  sm: { padding: '5px 10px', fontSize: '0.75rem', gap: '4px' },
  md: { padding: '8px 16px', fontSize: '0.8125rem', gap: '6px' },
}

interface AdminButtonProps {
  children: ReactNode
  onClick?: () => void
  variant?: Variant
  size?: Size
  loading?: boolean
  disabled?: boolean
  type?: 'button' | 'submit'
  title?: string
  style?: React.CSSProperties
}

export function AdminButton({
  children,
  onClick,
  variant = 'gold',
  size = 'md',
  loading = false,
  disabled = false,
  type = 'button',
  title,
  style,
}: AdminButtonProps) {
  const isDisabled = disabled || loading
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      title={title}
      className="transition-colors"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: '4px',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.5 : 1,
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
      onMouseEnter={e => {
        if (!isDisabled) e.currentTarget.style.background = hoverBg[variant]
      }}
      onMouseLeave={e => {
        if (!isDisabled) e.currentTarget.style.background = variantStyles[variant].background as string
      }}
    >
      {loading ? <Loader2 size={size === 'sm' ? 12 : 13} className="animate-spin" /> : null}
      {children}
    </button>
  )
}

// Small icon button (for edit/delete actions in tables)
interface AdminIconButtonProps {
  children: ReactNode
  onClick?: (e: React.MouseEvent) => void
  variant?: 'default' | 'danger'
  title?: string
  disabled?: boolean
}

export function AdminIconButton({ children, onClick, variant = 'default', title, disabled }: AdminIconButtonProps) {
  const color = variant === 'danger' ? '#664444' : '#7a6845'
  const hoverColor = variant === 'danger' ? '#ee6666' : '#c8a450'
  const hoverBorder = variant === 'danger' ? 'rgba(170,68,68,0.6)' : 'rgba(200,144,10,0.6)'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: 28,
        height: 28,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid rgba(58,42,21,0.4)',
        borderRadius: 4,
        background: 'transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
        color,
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={e => {
        if (!disabled) {
          e.currentTarget.style.borderColor = hoverBorder
          e.currentTarget.style.color = hoverColor
        }
      }}
      onMouseLeave={e => {
        if (!disabled) {
          e.currentTarget.style.borderColor = 'rgba(58,42,21,0.4)'
          e.currentTarget.style.color = color
        }
      }}
    >
      {children}
    </button>
  )
}
