'use client'

import { useEffect, useState } from 'react'
import { Loader2, Pin, ChevronDown } from 'lucide-react'
import { motion } from 'motion/react'
import { useLocale } from 'next-intl'

interface Announcement {
  id: string
  title: string
  content: string
  pinned: boolean
  created_at: string
}

export default function AnnouncementsClient() {
  const locale = useLocale()
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function load() {
    setError(false)
    setLoading(true)
    fetch(`/api/announcements?lang=${encodeURIComponent(locale)}`)
      .then(r => r.json())
      .then(res => setItems(res.data ?? []))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [locale])

  const copy = locale === 'en'
    ? {
        loading: 'Loading...',
        loadError: 'Failed to load announcements.',
        retry: 'Retry',
        empty: 'No announcements yet.',
      }
    : locale === 'ja'
      ? {
          loading: '読み込み中...',
          loadError: 'お知らせの読み込みに失敗しました。',
          retry: '再試行',
          empty: '登録されたお知らせはありません。',
        }
      : {
          loading: '로딩 중...',
          loadError: '공지사항을 불러오는 데 실패했습니다.',
          retry: '다시 시도',
          empty: '등록된 공지가 없습니다.',
        }

  if (loading) {
    return (
      <div className="flex items-center gap-2" style={{ color: '#888888', fontSize: '0.8125rem' }}>
        <Loader2 size={14} className="animate-spin" /> {copy.loading}
      </div>
    )
  }

  if (error) {
    return (
      <div className="card" style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
        <p style={{ color: '#aa6644', fontSize: '0.8125rem', marginBottom: '0.75rem' }}>
          {copy.loadError}
        </p>
        <button
          onClick={load}
          style={{
            padding: '0.4375rem 1rem',
            borderRadius: '0.25rem',
            border: '1px solid var(--gold-dim)',
            background: 'rgba(200,144,10,0.1)',
            color: 'var(--gold)',
            fontSize: '0.8125rem',
            cursor: 'pointer',
          }}
        >
          {copy.retry}
        </button>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div
        className="card"
        style={{ padding: '2.5rem 1.5rem', textAlign: 'center', color: '#888888', fontSize: '0.8125rem' }}
      >
        {copy.empty}
      </div>
    )
  }

  return (
    <motion.div
      style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.06, delayChildren: 0.2 } },
      }}
    >
      {items.map(item => {
        const isExpanded = expandedId === item.id
        return (
          <motion.div
            key={item.id}
            className="card"
            variants={{
              hidden: { opacity: 0, y: 15 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
            }}
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
                gap: '0.625rem',
                padding: '0.875rem 1.125rem',
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
                className="font-serif font-light"
                style={{ color: item.pinned ? 'var(--gold-light)' : '#c8a450', fontSize: '0.875rem', flex: 1, minWidth: 0 }}
              >
                {item.title}
              </span>
              <span className="font-mono" style={{ color: '#7a6845', fontSize: '0.625rem', flexShrink: 0 }}>
                {item.created_at.slice(0, 10).replace(/-/g, '.')}
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
                  padding: '0 1.125rem 1rem 1.125rem',
                  marginLeft: item.pinned ? '1.375rem' : 0,
                  color: '#7a6845',
                  fontSize: '0.8125rem',
                  lineHeight: 1.8,
                  borderTop: '1px solid rgba(200,144,10,0.08)',
                  paddingTop: '0.875rem',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {item.content}
              </div>
            )}
          </motion.div>
        )
      })}
    </motion.div>
  )
}
