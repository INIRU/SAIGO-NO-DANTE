'use client'
import { useEffect, useRef, useState } from 'react'
import { Link, usePathname } from '@/lib/i18n/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Flag, LayoutDashboard, MessageSquare, Megaphone, Users, Construction, ArrowUpRight, Menu, X, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import useSWR from 'swr'
import Button from '@/components/ui/Button'
import DanteLogo from '@/components/brand/DanteLogo'
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
  // Shares the dashboard's request: the two lists that can be waiting show their count.
  const { data: overview } = useSWR<{ queue: Record<string, number> }>('/api/admin/overview', (url: string) => fetch(url).then(r => (r.ok ? r.json() : Promise.reject(Error('overview')))))
  const waiting: Record<string, number | undefined> = { '/admin/inquiries': overview?.queue.inquiries, '/admin/friends': overview?.queue.reports }
  const visit = ko ? '사이트로' : ja ? 'サイトへ' : 'Visit site'
  const groups = [
    {
      label: ko ? '운영' : ja ? '運営' : 'Overview',
      items: [{ href: '/admin', label: ko ? '대시보드' : ja ? 'ダッシュボード' : 'Dashboard', icon: LayoutDashboard }],
    },
    {
      label: t('groupCommunity'),
      items: [
        { href: '/admin/inquiries', label: ko ? '문의함' : ja ? 'お問い合わせ' : 'Inbox', icon: MessageSquare },
        { href: '/admin/announcements', label: ko ? '공지 관리' : ja ? 'お知らせ管理' : 'Announcements', icon: Megaphone },
        { href: '/admin/friends', label: ko ? '친구 코드 신고' : ja ? 'フレンドコード通報' : 'Friend code reports', icon: Flag },
      ],
    },
    {
      label: t('groupAccounts'),
      items: [
        { href: '/admin/users', label: ko ? '유저 관리' : ja ? 'ユーザー管理' : 'Users', icon: Users },
      ],
    },
    {
      label: ko ? '사이트' : ja ? 'サイト' : 'Site',
      items: [{ href: '/admin/maintenance', label: ko ? '점검 관리' : ja ? 'メンテナンス' : 'Maintenance', icon: Construction }],
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
            <DanteLogo size={30} aria-hidden="true" />
            <span className="admin-wordmark-text">
              <small>최애의 관리자</small>
              <strong>{ko ? '운영 데스크' : ja ? '運営デスク' : 'Operations'}</strong>
            </span>
          </Link>
          <Button
            ref={closeButton}
            variant="ghost"
            icon={X}
            className="hidden! max-[48rem]:inline-flex!"
            aria-label={t('closeMenu')}
            onClick={() => {
              setOpen(false)
              menuButton.current?.focus()
            }}
          />
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
                  aria-current={(i.href === '/admin' ? path === '/admin' : path.startsWith(i.href)) ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                >
                  <i.icon size={18} aria-hidden="true" />
                  <span>{i.label}</span>
                  {!!waiting[i.href] && <b className="admin-nav-count">{waiting[i.href]}</b>}
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
          <Button
            variant="ghost"
            size="sm"
            icon={collapsed ? PanelLeftOpen : PanelLeftClose}
            className="max-[48rem]:hidden"
            aria-label={collapsed ? t('expand') : t('collapse')}
            title={collapsed ? t('expand') : t('collapse')}
            aria-pressed={collapsed}
            onClick={toggleCollapsed}
          />
        </div>
      </aside>
    </>
  )
}
