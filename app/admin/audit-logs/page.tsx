'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

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

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '100' })
    if (filter) params.set('action', filter)
    fetch(`/api/admin/audit-logs?${params}`)
      .then(r => r.json())
      .then(data => setLogs(Array.isArray(data) ? data : []))
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold mb-1" style={{ color: 'var(--gold)' }}>감사 로그</h1>
        <p style={{ color: '#555566', fontSize: '13px' }}>관리자 및 완장 활동 기록을 조회합니다.</p>
      </div>

      {/* 필터 */}
      <div className="mb-4 flex items-center gap-2">
        <span style={{ color: '#555566', fontSize: '12px' }}>필터:</span>
        <div className="flex gap-1 flex-wrap">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className="px-2.5 py-1 rounded text-xs font-medium transition-all"
              style={{
                background: filter === opt.value ? 'rgba(200,144,10,0.15)' : 'rgba(100,100,120,0.08)',
                color: filter === opt.value ? 'var(--gold)' : '#666677',
                border: `1px solid ${filter === opt.value ? 'var(--gold-dim)' : '#333344'}`,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2" style={{ color: '#555566', fontSize: '13px' }}>
          <Loader2 size={14} className="animate-spin" /> 로딩 중...
        </div>
      ) : logs.length === 0 ? (
        <div className="card p-8 text-center" style={{ color: '#555566' }}>
          <p className="text-sm italic">기록이 없습니다.</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '650px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['시각', '수행자', '활동', '대상', '세부 정보'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#555566', fontSize: '11px', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map(log => {
                const details = formatDetails(log)
                return (
                  <tr key={log.id} style={{ borderBottom: '1px solid rgba(58,42,21,0.3)' }}>
                    <td style={{ padding: '10px 14px', color: '#555566', fontSize: '11px', whiteSpace: 'nowrap' }}>
                      {new Date(log.created_at).toLocaleString('ko-KR', {
                        month: '2-digit', day: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#8a7a5a', fontSize: '12px' }}>
                      {log.actor_name}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '3px', fontSize: '11px', fontWeight: 600,
                        background: `${ACTION_COLORS[log.action] ?? '#888'}20`,
                        color: ACTION_COLORS[log.action] ?? '#888',
                        border: `1px solid ${ACTION_COLORS[log.action] ?? '#888'}40`,
                      }}>
                        {ACTION_LABELS[log.action] ?? log.action}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#7a6845', fontSize: '12px' }}>
                      {log.target_type && (
                        <span style={{ color: '#555', fontSize: '10px', marginRight: 4 }}>{log.target_type}</span>
                      )}
                      {log.target_id ? log.target_id.slice(0, 8) + '...' : '-'}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#666', fontSize: '11px' }}>
                      {details || '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
