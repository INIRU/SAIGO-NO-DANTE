'use client'

// Shared styles
export const adminInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid var(--border)',
  borderRadius: '4px',
  color: '#c8a450',
  fontSize: '0.8125rem',
}

export const adminLabelStyle: React.CSSProperties = {
  color: '#555566',
  fontSize: '0.6875rem',
  marginBottom: '4px',
  display: 'block',
}

interface AdminInputProps {
  label?: string
  value: string | number
  onChange: (value: string) => void
  type?: 'text' | 'number' | 'date'
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
      {error && <span style={{ color: '#ee6666', fontSize: '0.625rem', marginTop: '2px', display: 'block' }}>{error}</span>}
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
  return (
    <div>
      {label && <label style={adminLabelStyle}>{label}{required && ' *'}</label>}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        style={{
          ...adminInputStyle,
          ...(disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
          ...style,
        }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
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
    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
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
