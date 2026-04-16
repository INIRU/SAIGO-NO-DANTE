'use client'

import { useEffect, useState } from 'react'
import { Link } from '@/lib/i18n/navigation'
import { Library, Users, Database, Megaphone, FileText, Loader2, Construction } from 'lucide-react'
import { AdminCard } from '@/components/admin'

interface Stats {
  totalDecks: number
  totalUsers: number
  todayDecks: number
  totalViews: number
}

const quickLinks = [
  { href: '/admin/decks', icon: Library, label: '덱 관리', desc: '전체 덱 조회 및 관리' },
  { href: '/admin/users', icon: Users, label: '유저 관리', desc: '유저 목록 조회' },
  { href: '/admin/data', icon: Database, label: '데이터 관리', desc: '게임 데이터 현황' },
  { href: '/admin/maintenance', icon: Construction, label: '점검 관리', desc: '페이지별 점검 모드' },
  { href: '/admin/announcements', icon: Megaphone, label: '공지', desc: '공지 작성 및 관리' },
  { href: '/admin/legal', icon: FileText, label: '법률문서', desc: '약관/개인정보처리방침' },
]

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then(setStats)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold mb-1" style={{ color: 'var(--gold)' }}>
          대시보드
        </h1>
        <p style={{ color: '#888888', fontSize: '0.8125rem' }}>서비스 현황을 한눈에 확인합니다.</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2" style={{ color: '#888888', fontSize: '0.8125rem' }}>
          <Loader2 size={14} className="animate-spin" /> 로딩 중...
        </div>
      ) : stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { label: '총 덱 수', value: stats.totalDecks },
            { label: '총 유저 수', value: stats.totalUsers },
            { label: '오늘 생성 덱', value: stats.todayDecks },
            { label: '총 조회수', value: stats.totalViews.toLocaleString() },
          ].map(card => (
            <AdminCard key={card.label} title={card.label}>
              <p className="font-mono text-2xl font-bold" style={{ color: 'var(--gold)' }}>{card.value}</p>
            </AdminCard>
          ))}
        </div>
      )}

      <div>
        <h2 className="font-serif text-lg font-bold mb-4" style={{ color: '#c8a450' }}>바로가기</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickLinks.map(link => {
            const Icon = link.icon
            return (
              <Link
                key={link.href}
                href={link.href}
                className="card p-4 flex items-center gap-3 transition-colors hover:bg-white/5"
              >
                <Icon size={20} style={{ color: 'var(--gold-dim)' }} />
                <div>
                  <p style={{ color: '#c8a450', fontSize: '0.8125rem', fontWeight: 600 }}>{link.label}</p>
                  <p style={{ color: '#888888', fontSize: '0.6875rem' }}>{link.desc}</p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
