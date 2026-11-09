'use client'

// Design Ref: §5.3 — 반응형 사이드바 (데스크탑 sticky / 모바일 시트)
import { useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Sheet from '@/components/ui/Sheet'

type Props = {
  children: React.ReactNode
  activeCount: number
}

export default function FilterSidebar({ children, activeCount }: Props) {
  const t = useTranslations('browser')
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* 데스크탑 사이드바 */}
      <aside
        className="sticky-under-nav hidden lg:block shrink-0 self-start overflow-y-auto"
        style={{
          width: '16rem',
          top: 'calc(var(--nav-height) + 1rem)',
          maxHeight: 'calc(100dvh - var(--nav-offset) - 2rem)',
          paddingRight: '0.75rem',
        }}
      >
        <div className="flex flex-col gap-4 pb-6">
          {children}
        </div>
      </aside>

      {/* 모바일 플로팅 버튼 */}
      <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex items-center gap-2 rounded-full px-5 py-2.5 shadow-lg transition-transform active:scale-95"
          style={{
            cursor: 'pointer',
            background: 'var(--gold)',
            color: 'var(--bg-deep)',
            fontWeight: 600,
            fontSize: '0.8125rem',
          }}
        >
          <SlidersHorizontal size={16} />
          {t('filter')}{activeCount > 0 ? ` (${activeCount})` : ''}
        </button>
      </div>

      <Sheet open={mobileOpen} onClose={() => setMobileOpen(false)} title={t('filter')} closeLabel={t('closeFilter')}>
        <div className="flex flex-col gap-4 px-5 py-4">
          {children}
        </div>
      </Sheet>
    </>
  )
}
