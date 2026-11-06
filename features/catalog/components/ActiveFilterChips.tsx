'use client'

import { RotateCcw } from 'lucide-react'
import { useTranslations } from 'next-intl'

type Props = {
  activeCount: number
  onReset: () => void
}

export default function ActiveFilterChips({ activeCount, onReset }: Props) {
  const t = useTranslations('browser')
  if (activeCount === 0) return null

  return (
    <div className="pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <button
        onClick={onReset}
        className="flex items-center gap-1.5 w-full rounded px-3 py-2 text-xs transition-colors hover:bg-white/5"
        style={{
          cursor: 'pointer',
          color: '#999',
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'transparent',
        }}
        aria-label={t('resetAll')}
      >
        <RotateCcw size={12} />
        {t('reset', { count: activeCount })}
      </button>
    </div>
  )
}
