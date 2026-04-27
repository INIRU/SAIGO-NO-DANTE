'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

// Shared styles
export const adminInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  background: 'rgba(13,11,8,0.48)',
  border: '0.0625rem solid var(--border)',
  borderRadius: '0.25rem',
  color: '#c8a450',
  fontSize: '0.8125rem',
}

export const adminLabelStyle: React.CSSProperties = {
  color: '#888888',
  fontSize: '0.6875rem',
  marginBottom: '0.25rem',
  display: 'block',
}

interface AdminInputProps {
  label?: string
  value: string | number
  onChange: (value: string) => void
  type?: 'text' | 'number' | 'date' | 'datetime-local'
  placeholder?: string
  error?: string
  required?: boolean
  min?: number
  max?: number
  disabled?: boolean
  style?: React.CSSProperties
}

export function AdminInput({ label, value, onChange, type = 'text', placeholder, error, required, min, max, disabled, style }: AdminInputProps) {
  return (
    <div>
      {label && <label style={adminLabelStyle}>{label}{required && ' *'}</label>}
      <input
        type={type}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        min={min}
        max={max}
        disabled={disabled}
        style={{
          ...adminInputStyle,
          ...(error ? { borderColor: 'rgba(238,102,102,0.5)' } : {}),
          ...(disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
          ...style,
        }}
      />
      {error && <span style={{ color: '#ee6666', fontSize: '0.625rem', marginTop: '0.125rem', display: 'block' }}>{error}</span>}
    </div>
  )
}

interface AdminSelectProps {
  label?: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  required?: boolean
  disabled?: boolean
  style?: React.CSSProperties
}

export function AdminSelect({ label, value, onChange, options, placeholder, required, disabled, style }: AdminSelectProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const selectedLabel = options.find(o => o.value === value)?.label

  return (
    <div>
      {label && <label style={adminLabelStyle}>{label}{required && ' *'}</label>}
      <div ref={containerRef} style={{ position: 'relative', ...style }}>
        <button
          type="button"
          aria-label={label ?? placeholder ?? '선택'}
          onClick={() => !disabled && setOpen(prev => !prev)}
          style={{
            ...adminInputStyle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            color: selectedLabel ? '#c8a450' : '#888',
            textAlign: 'left',
          }}
        >
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedLabel ?? placeholder ?? '선택'}
          </span>
          <ChevronDown
            size="0.875rem"
            style={{
              flexShrink: 0,
              transition: 'transform 0.2s ease',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              color: '#888',
            }}
          />
        </button>
        {open && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 0.125rem)',
            left: 0,
            right: 0,
            background: '#1a1510',
            border: '0.0625rem solid var(--border)',
            borderRadius: '0.25rem',
            zIndex: 50,
            maxHeight: '15rem',
            overflowY: 'auto',
          }}>
            {placeholder && (
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false) }}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  textAlign: 'left',
                  fontSize: '0.8125rem',
                  color: '#888',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {placeholder}
              </button>
            )}
            {options.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false) }}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  textAlign: 'left',
                  fontSize: '0.8125rem',
                  color: o.value === value ? '#e8b030' : '#c8a450',
                  background: o.value === value ? 'rgba(200,144,10,0.12)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: o.value === value ? 600 : 400,
                }}
                onMouseEnter={e => { if (o.value !== value) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                onMouseLeave={e => { if (o.value !== value) e.currentTarget.style.background = 'transparent' }}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface AdminTextareaProps {
  label?: string
  value: string
  onChange: (value: string) => void
  rows?: number
  placeholder?: string
  required?: boolean
  disabled?: boolean
  style?: React.CSSProperties
}

export function AdminTextarea({ label, value, onChange, rows = 3, placeholder, required, disabled, style }: AdminTextareaProps) {
  return (
    <div>
      {label && <label style={adminLabelStyle}>{label}{required && ' *'}</label>}
      <textarea
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        disabled={disabled}
        style={{
          ...adminInputStyle,
          resize: 'vertical' as const,
          fontFamily: 'inherit',
          lineHeight: '1.6',
          ...(disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
          ...style,
        }}
      />
    </div>
  )
}

interface AdminCheckboxProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

export function AdminCheckbox({ label, checked, onChange, disabled }: AdminCheckboxProps) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        disabled={disabled}
        style={{ accentColor: '#c8900a' }}
      />
      <span style={{ color: '#888899', fontSize: '0.8125rem' }}>{label}</span>
    </label>
  )
}
