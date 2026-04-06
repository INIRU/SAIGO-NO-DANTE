'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  AdminSelect, AdminButton, AdminTable,
} from '@/components/admin'
import { showError } from '@/lib/toast'

interface AuditLog {
  id: string
  actor_id: string | null
  actor_name: string
  action: string
  target_type: string | null
  target_id: string | null
  details: Record<string, unknown>
  created_at: string
}

const ACTION_LABELS: Record<string, string> = {
  role_change: '역할 변경',
  guide_create: '운용법 작성',
  guide_update: '운용법 수정',
  guide_delete: '운용법 삭제',
  suspend: '계정 정지',
  unsuspend: '정지 해제',
  deck_delete: '덱 삭제',
}

const ACTION_COLORS: Record<string, string> = {
  role_change: '#c8a450',
  guide_create: '#44aa44',
  guide_update: '#6b9bc0',
  guide_delete: '#aa4444',
  suspend: '#aa4444',
  unsuspend: '#44aa44',
  deck_delete: '#aa4444',
}

const FILTER_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'role_change', label: '역할 변경' },
  { value: 'guide_create', label: '운용법 작성' },
  { value: 'guide_update', label: '운용법 수정' },
  { value: 'guide_delete', label: '운용법 삭제' },
  { value: 'suspend', label: '계정 정지' },
  { value: 'unsuspend', label: '정지 해제' },
  { value: 'deck_delete', label: '덱 삭제' },
]

const PAGE_SIZE = 50

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(0)
  useEffect(() => {
    setLoading(true)
    setPage(0)
    const params = new URLSearchParams({ limit: '200' })
    if (filter) params.set('action', filter)
    fetch(`/api/admin/audit-logs?${params}`)
      .then(r => r.json())
      .then(data => setLogs(Array.isArray(data) ? data : []))
      .catch(() => showError('감사 로그를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [filter])

  const formatDetails = (log: AuditLog) => {
    const d = log.details
    const parts: string[] = []
    if (d.from && d.to) parts.push(`${d.from} → ${d.to}`)
    if (d.username) parts.push(`유저: ${d.username}`)
    if (d.identity_name) parts.push(`인격: ${d.identity_name}`)
    if (d.deck_title) parts.push(`덱: ${d.deck_title}`)
    return parts.join(' · ') || null
  }

  const totalPages = Math.ceil(logs.length / PAGE_SIZE)
  const pageLogs = logs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const columns = [
    {
      key: 'created_at' as const,
      header: '시각',
      render: (log: AuditLog) => (
        <span style={{ color: '#888888', fontSize: '0.6875rem', whiteSpace: 'nowrap' }}>
          {(() => {
            const s = log.created_at
            const mm = s.slice(5, 7)
            const dd = s.slice(8, 10)
            const hh = s.slice(11, 13)
            const mi = s.slice(14, 16)
            return `${mm}.${dd} ${hh}:${mi}`
          })()}
        </span>
      ),
    },
    {
      key: 'actor_name' as const,
      header: '수행자',
      render: (log: AuditLog) => (
        <span style={{ color: '#8a7a5a', fontSize: '0.75rem' }}>{log.actor_name}</span>
      ),
    },
    {
      key: 'action' as const,
      header: '활동',
      render: (log: AuditLog) => (
        <span style={{
          padding: '2px 8px', borderRadius: '3px', fontSize: '0.6875rem', fontWeight: 600,
          background: `${ACTION_COLORS[log.action] ?? '#888'}20`,
          color: ACTION_COLORS[log.action] ?? '#888',
          border: `1px solid ${ACTION_COLORS[log.action] ?? '#888'}40`,
        }}>
          {ACTION_LABELS[log.action] ?? log.action}
        </span>
      ),
    },
    {
      key: 'target' as const,
      header: '대상',
      render: (log: AuditLog) => (
        <span style={{ color: '#7a6845', fontSize: '0.75rem' }}>
          {log.target_type && (
            <span style={{ color: '#555', fontSize: '0.625rem', marginRight: 4 }}>{log.target_type}</span>
          )}
          {log.target_id ? log.target_id.slice(0, 8) + '...' : '-'}
        </span>
      ),
    },
    {
      key: 'details' as const,
      header: '세부 정보',
      render: (log: AuditLog) => (
        <span style={{ color: '#666', fontSize: '0.6875rem' }}>
          {formatDetails(log) || '-'}
        </span>
      ),
    },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold mb-1" style={{ color: 'var(--gold)' }}>감사 로그</h1>
        <p style={{ color: '#888888', fontSize: '0.8125rem' }}>관리자 및 완장 활동 기록을 조회합니다.</p>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <span style={{ color: '#888888', fontSize: '0.75rem' }}>필터:</span>
        <div style={{ width: 160 }}>
          <AdminSelect
            value={filter}
            onChange={setFilter}
            options={FILTER_OPTIONS}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2" style={{ color: '#888888', fontSize: '0.8125rem' }}>
          <Loader2 size={14} className="animate-spin" /> 로딩 중...
        </div>
      ) : (
        <>
          <AdminTable
            columns={columns}
            data={pageLogs}
            keyExtractor={log => log.id}
            emptyMessage="기록이 없습니다."
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span style={{ color: '#888888', fontSize: '0.75rem' }}>
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, logs.length)} / {logs.length}건
              </span>
              <div className="flex gap-2">
                <AdminButton
                  onClick={() => setPage(p => p - 1)}
                  disabled={page === 0}
                  variant="ghost"
                  size="sm"
                >
                  이전
                </AdminButton>
                <AdminButton
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= totalPages - 1}
                  variant="ghost"
                  size="sm"
                >
                  다음
                </AdminButton>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  )
}
