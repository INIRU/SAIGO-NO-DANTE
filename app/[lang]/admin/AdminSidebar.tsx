'use client'

import { useState, useEffect } from 'react'
import { Link } from '@/lib/i18n/navigation'
import { usePathname } from '@/lib/i18n/navigation'
import { LayoutDashboard, Library, Users, Database, Megaphone, FileText, ScrollText, Trophy, Tags, Menu, X, Construction } from 'lucide-react'

const menuItems = [
  { href: '/admin', icon: LayoutDashboard, label: '대시보드' },
  { href: '/admin/maintenance', icon: Construction, label: '점검 관리' },
  { href: '/admin/tier-list', icon: Trophy, label: '티어표' },
  { href: '/admin/decks', icon: Library, label: '덱 관리' },
  { href: '/admin/users', icon: Users, label: '유저 관리' },
  { href: '/admin/data', icon: Database, label: '데이터 관리' },
  { href: '/admin/keywords', icon: Tags, label: '키워드' },
  { href: '/admin/announcements', icon: Megaphone, label: '공지' },
  { href: '/admin/legal', icon: FileText, label: '법률문서' },
  { href: '/admin/audit-logs', icon: ScrollText, label: '감사 로그' },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const sidebarId = 'admin-mobile-sidebar'

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin'
    return pathname?.startsWith(href) ?? false
  }

  // 경로 변경 시 모바일 드로어 닫기
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // 모바일 드로어 열릴 때 body 스크롤 잠금
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  const navContent = (
    <>
      <div style={{ padding: '0.75rem 1.25rem', marginBottom: '0.25rem' }}>
        <p className="font-serif" style={{ color: 'var(--gold)', fontSize: '0.9375rem', fontWeight: 700 }}>
          관리자
        </p>
        <p style={{ color: '#888888', fontSize: '0.6875rem', marginTop: '0.125rem' }}>
          SAIGO NO DANTE Admin
        </p>
      </div>
      <nav>
        {menuItems.map(item => {
          const active = isActive(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 transition-colors hover:text-yellow-300"
              style={{
                padding: '0.625rem 1.25rem',
                fontSize: '0.8125rem',
                fontFamily: 'var(--font-heading)',
                color: active ? 'var(--gold)' : '#7a6845',
                background: active ? 'rgba(200,144,10,0.08)' : 'transparent',
                borderRight: active ? '0.125rem solid var(--gold)' : '0.125rem solid transparent',
              }}
            >
              <Icon size="1rem" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </>
  )

  return (
    <>
      {/* 모바일 관리자 툴바 */}
      <div
        className="md:hidden fixed left-0 right-0 z-[35] flex items-center"
        style={{
          top: '4rem',
          height: '4rem',
          padding: '0 1rem',
          background: '#1a1510',
          borderBottom: '0.0625rem solid var(--border)',
          boxShadow: '0 0.125rem 0.75rem rgba(0,0,0,0.35)',
        }}
      >
        <button
          type="button"
          className="flex items-center justify-center"
          onClick={() => setOpen(v => !v)}
          style={{
            width: '2.75rem',
            height: '2.75rem',
            borderRadius: '0.375rem',
            background: '#0d0b08',
            border: '0.0625rem solid var(--border)',
            color: 'var(--gold)',
            cursor: 'pointer',
            boxShadow: '0 0.125rem 0.5rem rgba(0,0,0,0.4)',
            touchAction: 'manipulation',
          }}
          aria-label={open ? '사이드바 닫기' : '사이드바 열기'}
          aria-expanded={open}
          aria-controls={sidebarId}
        >
          {open ? <X size="1.125rem" /> : <Menu size="1.125rem" />}
        </button>
      </div>

      {/* 모바일 오버레이 배경 */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-30"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* 사이드바 */}
      {/* 데스크탑: 항상 표시, 모바일: 오버레이 드로어 */}
      <aside
        id={sidebarId}
        className={`shrink-0 fixed md:static z-30 pt-[8.25rem] md:pt-[4.5rem] transition-transform duration-300 md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{
          width: '13.75rem',
          top: 0,
          left: 0,
          background: '#1a1510',
          borderRight: '0.0625rem solid var(--border)',
          minHeight: '100dvh',
          overflowY: 'auto',
        }}
      >
        {navContent}
      </aside>
    </>
  )
}
