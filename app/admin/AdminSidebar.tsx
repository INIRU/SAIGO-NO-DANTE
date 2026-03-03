'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Library, Users, Database, Megaphone, FileText, ScrollText, Menu, X } from 'lucide-react'

const menuItems = [
  { href: '/admin', icon: LayoutDashboard, label: '대시보드' },
  { href: '/admin/decks', icon: Library, label: '덱 관리' },
  { href: '/admin/users', icon: Users, label: '유저 관리' },
  { href: '/admin/data', icon: Database, label: '데이터 관리' },
  { href: '/admin/announcements', icon: Megaphone, label: '공지' },
  { href: '/admin/legal', icon: FileText, label: '법률문서' },
  { href: '/admin/audit-logs', icon: ScrollText, label: '감사 로그' },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
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
      <div style={{ padding: '12px 20px', marginBottom: '4px' }}>
        <p className="font-serif" style={{ color: 'var(--gold)', fontSize: '0.9375rem', fontWeight: 700 }}>
          관리자
        </p>
        <p style={{ color: '#555566', fontSize: '0.6875rem', marginTop: '2px' }}>
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
                padding: '10px 20px',
                fontSize: '0.8125rem',
                fontFamily: 'var(--font-heading)',
                color: active ? 'var(--gold)' : '#7a6845',
                background: active ? 'rgba(200,144,10,0.08)' : 'transparent',
                borderRight: active ? '2px solid var(--gold)' : '2px solid transparent',
              }}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </>
  )

  return (
    <>
      {/* 모바일 토글 버튼 */}
      <button
        className="md:hidden fixed z-40 flex items-center justify-center"
        onClick={() => setOpen(v => !v)}
        style={{
          top: '76px',
          left: '12px',
          width: 36,
          height: 36,
          borderRadius: '6px',
          background: '#1a1510',
          border: '1px solid var(--border)',
          color: 'var(--gold)',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        }}
        aria-label={open ? '사이드바 닫기' : '사이드바 열기'}
      >
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>

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
        className={`shrink-0 fixed md:static z-30 transition-transform duration-300 md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{
          width: 220,
          background: '#1a1510',
          borderRight: '1px solid var(--border)',
          minHeight: '100vh',
          paddingTop: '72px',
        }}
      >
        {navContent}
      </aside>
    </>
  )
}
