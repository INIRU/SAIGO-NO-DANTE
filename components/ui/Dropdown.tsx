'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

export interface DropdownOption<T extends string = string> {
  value: T
  label: string
}

interface DropdownProps<T extends string = string> {
  value: T
  options: DropdownOption<T>[]
  onChange: (value: T) => void
  /** 버튼에 표시할 접두어 (예: "등급:") */
  prefix?: string
  /** 기본값과 다를 때 활성 색상 표시 */
  defaultValue?: T
  /** 최소 드롭다운 너비 */
  minWidth?: number
}

export default function Dropdown<T extends string = string>({
  value,
  options,
  onChange,
  prefix,
  defaultValue,
  minWidth = 100,
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors"
        style={{
          cursor: 'pointer',
          background: 'rgba(255,255,255,0.05)',
          border: `1px solid ${isActive ? 'var(--gold-dim)' : 'rgba(255,255,255,0.1)'}`,
          color: isActive ? 'var(--gold)' : '#777',
          fontFamily: 'var(--font-heading)',
        }}
      >
        {prefix ? `${prefix} ${currentLabel}` : currentLabel}
        <ChevronDown
          size={14}
          style={{
            opacity: 0.5,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        />
      </button>
      {open && (
        <div
          className="absolute top-full mt-1 left-0 z-30 rounded overflow-hidden"
          style={{
            background: '#1a1510',
            border: '1px solid var(--border)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            minWidth: `${minWidth}px`,
          }}
        >
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className="block w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white/5"
              style={{
                cursor: 'pointer',
                color: value === opt.value ? 'var(--gold)' : '#777',
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
