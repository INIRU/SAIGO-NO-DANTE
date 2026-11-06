'use client'

import { useState, useRef, useEffect, useId, type CSSProperties } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import styles from './Dropdown.module.css'

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
    const buttons = ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')
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
      const buttons = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])
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
        className={styles.trigger}
        data-active={isActive || undefined}
        style={buttonStyle}
      >
        <span className={styles.label}>{prefix && <span className={styles.prefix}>{prefix}</span>}{currentLabel}</span>
        <ChevronDown size={14} aria-hidden className={styles.chevron} />
      </button>
      {open && (
        <div id={menuId} role="menu" aria-label={ariaLabel} className={styles.menu} style={{ minWidth: `max(100%, ${minWidth}px)` }}>
          {options.map(opt => (
            <button
              type="button"
              role="menuitemradio"
              aria-checked={value === opt.value}
              key={opt.value}
              onMouseDown={event => event.preventDefault()}
              onClick={() => { onChange(opt.value); setOpen(false); triggerRef.current?.focus() }}
              className={styles.item}
            >
              {opt.label}
              <Check size={14} aria-hidden className={styles.check} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
