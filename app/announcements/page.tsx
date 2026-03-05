'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Pin, ChevronDown, ArrowLeft } from 'lucide-react'

interface Announcement {
  id: string
  title: string
  content: string
  pinned: boolean
  created_at: string
}

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/announcements')
      .then(r => r.json())
      .then(res => setItems(res.data ?? []))
      .finally(() => {
        setLoading(false)
        import('gsap').then(({ gsap }) => {
          gsap.fromTo('.announcements-header',
            { opacity: 0, y: -20 },
            { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }
          )
          gsap.fromTo('.announcement-item',
            { opacity: 0, y: 15 },
            { opacity: 1, y: 0, duration: 0.4, stagger: 0.06, ease: 'power2.out', delay: 0.2 }
          )
        })
      })
  }, [])

  return (
    <div style={{ background: 'var(--bg-deep)', minHeight: '100dvh' }}>
      <div className="max-w-3xl mx-auto px-6 pt-28 pb-20">
        {/* 헤더 */}
        <div className="announcements-header mb-8" style={{ opacity: 0 }}>
          <Link
            href="/"
            className="flex items-center gap-1.5 mb-4 transition-colors hover:opacity-70"
            style={{ color: '#555566', fontSize: '0.8125rem' }}
          >
            <ArrowLeft size={14} />
            홈으로
          </Link>
          <h1 className="font-serif text-3xl font-bold" style={{ color: 'var(--gold)' }}>
            공지사항
          </h1>
          <p style={{ color: '#555566', fontSize: '0.8125rem', marginTop: 4 }}>
            사이트 업데이트 및 안내사항을 확인하세요.
          </p>
        </div>

        <div className="divider-gold mb-8" />

        {loading ? (
          <div className="flex items-center gap-2" style={{ color: '#555566', fontSize: '0.8125rem' }}>
            <Loader2 size={14} className="animate-spin" /> 로딩 중...
          </div>
        ) : items.length === 0 ? (
          <div
            className="card"
            style={{ padding: '40px 24px', textAlign: 'center', color: '#555566', fontSize: '0.8125rem' }}
          >
            등록된 공지가 없습니다.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map(item => {
              const isExpanded = expandedId === item.id
              return (
                <div
                  key={item.id}
                  className="announcement-item card"
                  style={{
                    overflow: 'hidden',
                    border: item.pinned ? '1px solid rgba(200,144,10,0.3)' : undefined,
                  }}
                >
                  {/* 헤더 행 */}
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '14px 18px',
                      cursor: 'pointer',
                      userSelect: 'none',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(200,144,10,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {item.pinned && (
                      <Pin size={12} style={{ color: '#c8900a', flexShrink: 0, transform: 'rotate(45deg)' }} />
                    )}
                    <span
                      className="font-serif font-bold"
                      style={{ color: item.pinned ? 'var(--gold-light)' : '#c8a450', fontSize: '0.875rem', flex: 1, minWidth: 0 }}
                    >
                      {item.title}
                    </span>
                    <span className="font-mono" style={{ color: '#4a3820', fontSize: '0.625rem', flexShrink: 0 }}>
                      {new Date(item.created_at).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                      })}
                    </span>
                    <ChevronDown
                      size={14}
                      style={{
                        color: '#8a6010',
                        flexShrink: 0,
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.25s ease',
                      }}
                    />
                  </div>

                  {/* 본문 */}
                  {isExpanded && item.content && (
                    <div
                      style={{
                        padding: '0 18px 16px 18px',
                        marginLeft: item.pinned ? 22 : 0,
                        color: '#7a6845',
                        fontSize: '0.8125rem',
                        lineHeight: 1.8,
                        borderTop: '1px solid rgba(200,144,10,0.08)',
                        paddingTop: 14,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {item.content}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
