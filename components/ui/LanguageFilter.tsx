'use client'

import { useState, useRef, useEffect } from 'react'
import { useLanguage } from '@/lib/i18n'
import { SUPPORTED_LANGS, type SupportedLang } from '@/lib/i18n/types'

type LangFilterValue = SupportedLang | 'all'

interface LanguageFilterProps {
  value: LangFilterValue
  onChange: (value: LangFilterValue) => void
}

export default function LanguageFilter({ value, onChange }: LanguageFilterProps) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const options: { value: LangFilterValue; label: string }[] = [
    { value: 'all', label: t('filter.allLangs') },
    ...SUPPORTED_LANGS.map(l => ({ value: l.value, label: l.nativeLabel })),
  ]

  const currentLabel = value === 'all'
    ? t('filter.allLangs')
    : SUPPORTED_LANGS.find(l => l.value === value)?.nativeLabel ?? value

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border transition-colors"
        style={{
          borderColor: 'rgba(200,144,10,0.25)',
          background: 'rgba(200,144,10,0.06)',
          color: '#e8dcc8',
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="text-xs opacity-60">{t('filter.langLabel')}</span>
        <span>{currentLabel}</span>
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full mt-1 w-40 rounded border border-neutral-700 bg-neutral-900 shadow-lg z-50 overflow-hidden"
        >
          {options.map(opt => (
            <button
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-800 transition-colors ${
                opt.value === value ? 'text-amber-400 bg-neutral-800/50' : 'text-neutral-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export type { LangFilterValue }
