'use client'

import { useState, useRef, useEffect, useId, type CSSProperties } from 'react'
import { ChevronDown } from 'lucide-react'

export interface DropdownOption<T extends string = string> {
  value: T
  label: string
}

interface DropdownProps<T extends string = string> {
  value: T
  ariaLabel?: string
  options: DropdownOption<T>[]
  onChange: (value: T) => void
  /** 버튼에 표시할 접두어 (예: "등급:") */
  prefix?: string
  /** 기본값과 다를 때 활성 색상 표시 */
  defaultValue?: T
  /** 최소 드롭다운 너비 */
  minWidth?: number
  /** 기존 호출자는 기본 버튼 스타일을 유지하고, 필요한 화면만 높이/폭을 보정한다. */
  className?: string
  buttonStyle?: CSSProperties
}

export default function Dropdown<T extends string = string>({
  value,
  ariaLabel,
  options,
  onChange,
  prefix,
  defaultValue,
  minWidth = 100,
  className,
  buttonStyle,
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  useEffect(() => {
    if (!open) return
    const buttons = ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
    const selected = Math.max(0, options.findIndex(option => option.value === value))
    buttons?.[selected]?.focus()
    buttons?.[selected]?.scrollIntoView({ block: 'nearest' })
  }, [open, options, value])

  // 외부 클릭 시 닫기
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const isActive = defaultValue !== undefined ? value !== defaultValue : false
  const currentLabel = options.find(o => o.value === value)?.label ?? value

  return (
    <div className={className ? `relative ${className}` : 'relative'} ref={ref} onKeyDown={event => {
      if (event.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); event.stopPropagation(); return }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      if (!open) { setOpen(true); return }
      const buttons = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])
      const current = buttons.findIndex(button => button === document.activeElement)
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
      buttons[next]?.focus()
      buttons[next]?.scrollIntoView({ block: 'nearest' })
    }}>
      <button
        type="button"
        ref={triggerRef}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors"
        style={{
          minWidth: 0,
          cursor: 'pointer',
          background: 'rgba(255,255,255,0.05)',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: isActive ? 'var(--gold-dim)' : 'rgba(255,255,255,0.1)',
          color: isActive ? 'var(--gold)' : 'var(--text-secondary)',
          fontFamily: 'var(--font-heading)',
          ...buttonStyle,
        }}
      >
        <span
          style={{
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {prefix ? `${prefix} ${currentLabel}` : currentLabel}
        </span>
        <ChevronDown
          size={14}
          style={{
            flexShrink: 0,
            opacity: 0.5,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={ariaLabel}
          className="absolute top-full mt-1 left-0 z-30 rounded overflow-y-auto"
          style={{
            background: 'var(--bg-card)',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: 'var(--border)',
            boxShadow: 'var(--shadow-lg)',
            minWidth: `${minWidth}px`,
            maxHeight: '16rem',
          }}
        >
          {options.map(opt => (
            <button
              type="button"
              role="menuitem"
              key={opt.value}
              onMouseDown={event => event.preventDefault()}
              onClick={() => { onChange(opt.value); setOpen(false); triggerRef.current?.focus() }}
              className="block w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white/5"
              style={{
                cursor: 'pointer',
                color: value === opt.value ? 'var(--gold)' : 'var(--text-secondary)',
                fontFamily: 'var(--font-heading)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
