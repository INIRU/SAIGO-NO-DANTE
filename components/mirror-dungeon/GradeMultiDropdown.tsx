'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { useLocale } from 'next-intl'
import { translations } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'
import { GRADES, GRADE_LABELS } from './types'

export default function GradeMultiDropdown({ grades, toggleGrade }: { grades: Set<string>; toggleGrade: (g: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const locale = useLocale()
  const lang = locale as SupportedLang
  const t = (key: string) => {
    const entry = translations[key as keyof typeof translations]
    if (!entry) return key
    return entry[lang] ?? entry['ko'] ?? key
  }

  const isActive = grades.size > 0
  const label = !isActive
    ? t('mirrorDungeon.filter.all')
    : `${grades.size}${t('mirrorDungeon.filter.selected')}`

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
          fontWeight: 700,
          minWidth: 100,
        }}
      >
        {t('mirrorDungeon.filter.grade')}: {label}
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
            minWidth: 120,
          }}
        >
          {GRADES.map(g => {
            const isAll = g === '전체'
            const checked = isAll ? grades.size === 0 : grades.has(g)
            return (
              <button
                key={g}
                onClick={() => toggleGrade(g)}
                className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white/5"
                style={{
                  cursor: 'pointer',
                  color: checked ? 'var(--gold)' : '#777',
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 700,
                }}
              >
                <span
                  className="inline-block w-3 h-3 rounded-sm border shrink-0"
                  style={{
                    borderColor: checked ? 'var(--gold)' : '#555',
                    background: checked ? 'var(--gold)' : 'transparent',
                  }}
                >
                  {checked && (
                    <svg viewBox="0 0 12 12" fill="none" style={{ width: '100%', height: '100%' }}>
                      <path d="M3 6l2 2 4-4" stroke="#0d0b08" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                {isAll ? t('mirrorDungeon.filter.all') : GRADE_LABELS[g] ?? g}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
