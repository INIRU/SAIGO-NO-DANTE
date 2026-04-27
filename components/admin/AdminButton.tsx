'use client'

import { type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

type Variant = 'gold' | 'danger' | 'ghost' | 'success'
type Size = 'sm' | 'md'

const variantStyles: Record<Variant, React.CSSProperties> = {
  gold: {
    background: 'rgba(200,144,10,0.15)',
    border: '0.0625rem solid var(--gold)',
    color: 'var(--gold)',
  },
  danger: {
    background: 'transparent',
    border: '0.0625rem solid rgba(170,92,70,0.42)',
    color: '#c98272',
  },
  ghost: {
    background: 'transparent',
    border: '0.0625rem solid var(--border)',
    color: '#888888',
  },
  success: {
    background: 'transparent',
    border: '0.0625rem solid rgba(118,138,96,0.42)',
    color: '#9aac7d',
  },
}

const hoverBg: Record<Variant, string> = {
  gold: 'rgba(200,144,10,0.25)',
  danger: 'rgba(170,92,70,0.08)',
  ghost: 'rgba(255,255,255,0.05)',
  success: 'rgba(118,138,96,0.08)',
}

const sizeStyles: Record<Size, React.CSSProperties> = {
  sm: { padding: '0.3125rem 0.625rem', fontSize: '0.75rem', gap: '0.25rem' },
  md: { padding: '0.5rem 1rem', fontSize: '0.8125rem', gap: '0.375rem' },
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
        borderRadius: '0.25rem',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.5 : 1,
        transition: 'background 160ms ease, border-color 160ms ease, color 160ms ease, transform 160ms ease',
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
      onMouseDown={e => {
        if (!isDisabled) e.currentTarget.style.transform = 'translateY(0.0625rem)'
      }}
      onMouseUp={e => {
        e.currentTarget.style.transform = 'translateY(0)'
      }}
      onBlur={e => {
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {loading ? <Loader2 size={size === 'sm' ? '0.75rem' : '0.8125rem'} className="animate-spin" /> : null}
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
  const color = variant === 'danger' ? '#9b6a5c' : '#7a6845'
  const hoverColor = variant === 'danger' ? '#c98272' : '#c8a450'
  const hoverBorder = variant === 'danger' ? 'rgba(170,92,70,0.56)' : 'rgba(200,144,10,0.6)'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: '1.75rem',
        height: '1.75rem',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '0.0625rem solid rgba(58,42,21,0.4)',
        borderRadius: '0.25rem',
        background: 'transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
        color,
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
        transition: 'border-color 160ms ease, color 160ms ease, background 160ms ease, transform 160ms ease',
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
      onMouseDown={e => {
        if (!disabled) e.currentTarget.style.transform = 'translateY(0.0625rem)'
      }}
      onMouseUp={e => {
        e.currentTarget.style.transform = 'translateY(0)'
      }}
      onBlur={e => {
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {children}
    </button>
  )
}
