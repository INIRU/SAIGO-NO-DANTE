'use client'
import { useEffect, useRef, useState } from 'react'
import { Link, usePathname } from '@/lib/i18n/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { MessageSquare, Megaphone, Users, ArrowUpRight, Menu, X, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import './admin.css'
const STORAGE_KEY = 'admin-nav-collapsed'
export default function AdminNavigation() {
  const path = usePathname()
  const lang = useLocale()
  const t = useTranslations('adminShell')
  const ko = lang === 'ko',
    ja = lang === 'ja'
  const [collapsed, setCollapsed] = useState(false)
  const [open, setOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === '1') setCollapsed(true)
  }, [])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      menuButton.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  const visit = ko ? '사이트로' : ja ? 'サイトへ' : 'Visit site'
  const groups = [
    {
      label: t('groupCommunity'),
      items: [
        { href: '/admin/inquiries', label: ko ? '문의함' : ja ? 'お問い合わせ' : 'Inbox', icon: MessageSquare },
        { href: '/admin/announcements', label: ko ? '공지 관리' : ja ? 'お知らせ管理' : 'Announcements', icon: Megaphone },
      ],
    },
    {
      label: t('groupAccounts'),
      items: [{ href: '/admin/users', label: ko ? '유저 관리' : ja ? 'ユーザー管理' : 'Users', icon: Users }],
    },
  ]
  function toggleCollapsed() {
    localStorage.setItem(STORAGE_KEY, collapsed ? '0' : '1')
    setCollapsed(!collapsed)
  }
  return (
    <>
      <button
        ref={menuButton}
        type="button"
        className="admin-menu-button"
        aria-label={t('openMenu')}
        aria-expanded={open}
        aria-controls="admin-navigation"
        onClick={() => {
          setOpen(true)
          requestAnimationFrame(() => closeButton.current?.focus())
        }}
      >
        <Menu size={20} aria-hidden="true" />
      </button>
      {open && <div className="admin-scrim" aria-hidden="true" onClick={() => setOpen(false)} />}
      <aside id="admin-navigation" className="admin-navigation" data-collapsed={collapsed} data-open={open}>
        <div className="admin-brand">
          <Link href="/admin" className="admin-wordmark" title={collapsed ? '최애의 관리자' : undefined} onClick={() => setOpen(false)}>
            <span className="admin-mark" aria-hidden="true" />
            <span className="admin-wordmark-text">
              <small>최애의 관리자</small>
              <strong>{ko ? '운영 데스크' : ja ? '運営デスク' : 'Operations'}</strong>
            </span>
          </Link>
          <button
            ref={closeButton}
            type="button"
            className="admin-icon-button admin-drawer-close"
            aria-label={t('closeMenu')}
            onClick={() => {
              setOpen(false)
              menuButton.current?.focus()
            }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <nav aria-label={t('nav')}>
          {groups.map((g) => (
            <div key={g.label} className="admin-nav-group">
              <p>{g.label}</p>
              {g.items.map((i) => (
                <Link
                  key={i.href}
                  href={i.href}
                  title={collapsed ? i.label : undefined}
                  aria-current={path.startsWith(i.href) ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                >
                  <i.icon size={18} aria-hidden="true" />
                  <span>{i.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="admin-navigation-foot">
          <Link href="/" className="admin-return" title={collapsed ? visit : undefined}>
            <ArrowUpRight size={18} aria-hidden="true" />
            <span>{visit}</span>
          </Link>
          <button
            type="button"
            className="admin-icon-button admin-collapse"
            aria-label={collapsed ? t('expand') : t('collapse')}
            title={collapsed ? t('expand') : t('collapse')}
            aria-pressed={collapsed}
            onClick={toggleCollapsed}
          >
            {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
          </button>
        </div>
      </aside>
    </>
  )
}
