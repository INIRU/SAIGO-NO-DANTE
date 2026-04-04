'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Pin, ChevronDown, XIcon } from 'lucide-react'

function formatDate(d: string) {
  const dateOnly = d.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateOnly) {
    const [, year, month, day] = dateOnly
    return `${year}.${month}.${day}`
  }
  const timestamp = Date.parse(d)
  if (Number.isNaN(timestamp)) return d
  const kst = new Date(timestamp + 9 * 60 * 60 * 1000)
  return `${kst.getUTCFullYear()}.${String(kst.getUTCMonth() + 1).padStart(2, '0')}.${String(kst.getUTCDate()).padStart(2, '0')}`
}

type Announcement = {
  id: string
  title: string
  content: string
  pinned: boolean
  created_at: string
}

export default function AnnouncementBanner({ announcement }: { announcement: Announcement }) {
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(200,144,10,0.1) 0%, rgba(13,11,8,0.98) 100%)',
        borderBottom: '1px solid rgba(200,144,10,0.2)',
      }}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 0',
            cursor: 'pointer',
            userSelect: 'none',
          }}
          onClick={() => setOpen(prev => !prev)}
        >
          <Pin size={13} style={{ color: '#c8900a', flexShrink: 0, transform: 'rotate(45deg)' }} />
          <span
            className="font-serif font-light"
            style={{ color: 'var(--gold-light)', fontSize: '0.875rem', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {announcement.title}
          </span>
          <span className="font-mono" style={{ color: 'var(--text-muted)', fontSize: '0.625rem', flexShrink: 0 }}>
            {formatDate(announcement.created_at)}
          </span>
          <Link
            href="/announcements"
            onClick={e => e.stopPropagation()}
            className="font-mono transition-colors hover:opacity-70"
            style={{ color: '#8a6010', fontSize: '0.625rem', flexShrink: 0, letterSpacing: '0.05em' }}
          >
            전체보기
          </Link>
          <ChevronDown
            size={14}
            style={{
              color: '#8a6010',
              flexShrink: 0,
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.25s ease',
            }}
          />
          <button
            onClick={e => { e.stopPropagation(); setDismissed(true) }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 4,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
            }}
            title="닫기"
          >
            <XIcon size={13} />
          </button>
        </div>

        {open && announcement.content && (
          <div
            style={{
              paddingBottom: 14,
              paddingLeft: 25,
              color: 'var(--text-tertiary)',
              fontSize: '0.8125rem',
              lineHeight: 1.7,
              borderTop: '1px solid rgba(200,144,10,0.1)',
              paddingTop: 12,
              whiteSpace: 'pre-wrap',
            }}
          >
            {announcement.content}
          </div>
        )}
      </div>
    </div>
  )
}
