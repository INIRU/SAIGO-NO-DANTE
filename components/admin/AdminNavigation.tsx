'use client'
import { Link, usePathname } from '@/lib/i18n/navigation'
import { useLocale } from 'next-intl'
import { MessageSquare, Megaphone, Users, ArrowUpRight } from 'lucide-react'
import './admin.css'
export default function AdminNavigation() {
  const path = usePathname()
  const lang = useLocale()
  const ko = lang === 'ko',
    ja = lang === 'ja'
  return (
    <aside className="admin-navigation">
      <Link href="/admin" className="admin-wordmark">
        <span>SAIGO NO DANTE</span>
        <strong>{ko ? '운영 데스크' : ja ? '運営デスク' : 'Operations'}</strong>
      </Link>
      <nav>
        {[
          {
            href: '/admin/inquiries',
            label: ko ? '문의함' : ja ? 'お問い合わせ' : 'Inbox',
            icon: MessageSquare,
          },
          {
            href: '/admin/announcements',
            label: ko ? '공지 관리' : ja ? 'お知らせ管理' : 'Announcements',
            icon: Megaphone,
          },
          { href: '/admin/users', label: ko ? '유저 관리' : ja ? 'ユーザー管理' : 'Users', icon: Users },
        ].map((i) => (
          <Link
            key={i.href}
            href={i.href}
            aria-current={path === i.href ? 'page' : undefined}
          >
            <i.icon size={18} />
            {i.label}
          </Link>
        ))}
      </nav>
      <Link href="/" className="admin-return">
        {ko ? '사이트로' : ja ? 'サイトへ' : 'Visit site'}
        <ArrowUpRight size={16} />
      </Link>
    </aside>
  )
}
