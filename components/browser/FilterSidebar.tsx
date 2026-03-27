'use client'

// Design Ref: §5.3 — 반응형 사이드바 (데스크탑 sticky / 모바일 슬라이드업)
import { useState, useEffect, useRef } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'

type Props = {
  children: React.ReactNode
  activeCount: number
}

export default function FilterSidebar({ children, activeCount }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // ESC 키로 닫기 + 열릴 때 포커스 + body scroll lock
  useEffect(() => {
    if (!mobileOpen) return
    panelRef.current?.focus()
    document.body.style.overflow = 'hidden'
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  return (
    <>
      {/* 데스크탑 사이드바 */}
      <aside
        className="hidden lg:block shrink-0 sticky self-start overflow-y-auto"
        style={{
          width: '16rem',
          top: '5rem',
          maxHeight: 'calc(100vh - 6rem)',
          paddingRight: '0.75rem',
        }}
      >
        <div className="flex flex-col gap-4 pb-4">
          {children}
        </div>
      </aside>

      {/* 모바일 플로팅 버튼 */}
      <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex items-center gap-2 rounded-full px-5 py-2.5 shadow-lg transition-transform active:scale-95"
          style={{
            cursor: 'pointer',
            background: 'var(--gold)',
            color: '#0d0b08',
            fontWeight: 600,
            fontSize: '0.8125rem',
          }}
        >
          <SlidersHorizontal size={16} />
          필터{activeCount > 0 ? ` (${activeCount})` : ''}
        </button>
      </div>

      {/* 모바일 슬라이드업 패널 */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-label="필터 패널"
        >
          {/* 백드롭 */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          {/* 패널 */}
          <div
            ref={panelRef}
            tabIndex={-1}
            className="absolute bottom-0 left-0 right-0 rounded-t-2xl overflow-y-auto outline-none"
            style={{
              background: '#1a1510',
              maxHeight: '80vh',
              animation: 'slideUp 0.3s ease-out',
            }}
          >
            {/* 헤더 */}
            <div className="sticky top-0 flex items-center justify-between px-5 py-3" style={{
              background: '#1a1510',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              zIndex: 1,
            }}>
              <span className="font-mono text-xs" style={{ color: 'var(--gold)', letterSpacing: '0.1em' }}>
                FILTERS
              </span>
              <button
                onClick={() => setMobileOpen(false)}
                style={{ cursor: 'pointer', color: '#888' }}
                aria-label="필터 닫기"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex flex-col gap-4 px-5 py-4">
              {children}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
