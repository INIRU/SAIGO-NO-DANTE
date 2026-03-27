'use client'

import { RotateCcw } from 'lucide-react'

type Props = {
  activeCount: number
  onReset: () => void
}

export default function ActiveFilterChips({ activeCount, onReset }: Props) {
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
        aria-label="모든 필터 초기화"
      >
        <RotateCcw size={12} />
        필터 초기화 ({activeCount}개 활성)
      </button>
    </div>
  )
}
