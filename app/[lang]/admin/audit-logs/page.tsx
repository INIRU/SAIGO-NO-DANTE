'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  Filter,
  Globe2,
  Search,
  ShieldAlert,
  UserRound,
} from 'lucide-react'
import {
  AdminButton,
  AdminInput,
  AdminSelect,
} from '@/components/admin'
import { showError } from '@/lib/toast'

interface AuditLog {
  id: string
  actor_id: string | null
  actor_name?: string | null
  action: string
  target_type: string | null
  target_id: string | null
  target_label?: string | null
  details?: Record<string, unknown> | null
  severity?: string | null
  ip?: string | null
  country?: string | null
  created_at: string
}

const PAGE_SIZE = 30

const ACTION_LABELS: Record<string, string> = {
  role_change: '역할 변경',
  guide_create: '운용법 작성',
  guide_update: '운용법 수정',
  guide_delete: '운용법 삭제',
  suspend: '계정 정지',
  unsuspend: '정지 해제',
  deck_delete: '덱 삭제',
  user_suspend: '계정 정지',
  user_unsuspend: '정지 해제',
  user_role_update: '역할 변경',
}

const FILTER_OPTIONS = [
  { value: '', label: '전체 활동' },
  { value: 'role_change', label: '역할 변경' },
  { value: 'suspend', label: '계정 정지' },
  { value: 'unsuspend', label: '정지 해제' },
  { value: 'deck_delete', label: '덱 삭제' },
  { value: 'guide_create', label: '운용법 작성' },
  { value: 'guide_update', label: '운용법 수정' },
  { value: 'guide_delete', label: '운용법 삭제' },
]

const SEVERITY_OPTIONS = [
  { value: 'all', label: '전체 등급' },
  { value: 'critical', label: 'critical' },
  { value: 'warning', label: 'warning' },
  { value: 'info', label: 'info' },
  { value: 'success', label: 'success' },
]

function inferSeverity(log: AuditLog) {
  const severity = log.severity?.toLowerCase()
  if (severity) return severity
  if (['suspend', 'deck_delete', 'guide_delete', 'user_suspend'].includes(log.action)) return 'warning'
  if (['unsuspend', 'guide_create', 'user_unsuspend'].includes(log.action)) return 'success'
  return 'info'
}

function getSeverityTone(severity: string) {
  if (severity === 'critical') return { color: '#c98272', border: 'rgba(170,92,70,0.42)', icon: AlertTriangle }
  if (severity === 'warning') return { color: '#d49b4a', border: 'rgba(200,144,10,0.34)', icon: ShieldAlert }
  if (severity === 'success') return { color: '#9aac7d', border: 'rgba(118,138,96,0.36)', icon: CheckCircle2 }
  return { color: '#9a8a6a', border: 'rgba(122,104,69,0.3)', icon: CircleDot }
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'medium' }).format(date)
}

function asText(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  return null
}

function compactValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'string') return value.length > 80 ? `${value.slice(0, 80)}...` : value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return '-'
  }
}

function detailEntries(details?: Record<string, unknown> | null) {
  if (!details) return []
  const preferred = ['username', 'email', 'from', 'to', 'reason', 'suspendedUntil', 'suspended_until', 'deck_title', 'identity_name']
  const seen = new Set<string>()
  const entries: [string, unknown][] = []
  for (const key of preferred) {
    if (key in details) {
      entries.push([key, details[key]])
      seen.add(key)
    }
  }
  for (const entry of Object.entries(details)) {
    if (!seen.has(entry[0])) entries.push(entry)
    if (entries.length >= 6) break
  }
  return entries.slice(0, 6)
}

function auditSummary(log: AuditLog) {
  const details = log.details ?? {}
  const from = asText(details.from)
  const to = asText(details.to)
  const reason = asText(details.reason)
  const until = asText(details.suspendedUntil) ?? asText(details.suspended_until)

  if (from && to) return `${from} -> ${to}`
  if (reason && until) return `${reason} / ${until}`
  if (reason) return reason
  if (log.target_type) return `${log.target_type} record`
  return '상세 context 없음'
}

function rawDetails(details?: Record<string, unknown> | null) {
  if (!details || Object.keys(details).length === 0) return null
  try {
    return JSON.stringify(details, null, 2)
  } catch {
    return null
  }
}

function targetLabel(log: AuditLog) {
  return log.target_label ?? asText(log.details?.username) ?? asText(log.details?.deck_title) ?? asText(log.details?.identity_name) ?? log.target_id ?? '대상 없음'
}

function matchesQuery(log: AuditLog, query: string) {
  if (!query) return true
  const haystack = [
    log.actor_name,
    log.action,
    ACTION_LABELS[log.action],
    log.target_type,
    log.target_id,
    log.target_label,
    log.ip,
    log.country,
    JSON.stringify(log.details ?? {}),
  ].filter(Boolean).join(' ').toLowerCase()
  return haystack.includes(query)
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const loadErrorShownRef = useRef(false)

  useEffect(() => {
    setLoading(true)
    setPage(0)
    const params = new URLSearchParams({ limit: '200' })
    if (actionFilter) params.set('action', actionFilter)
    fetch(`/api/admin/audit-logs?${params}`)
      .then(async response => {
        if (!response.ok) throw new Error('audit')
        return response.json() as Promise<AuditLog[]>
      })
      .then(data => {
        loadErrorShownRef.current = false
        setLogs(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (!loadErrorShownRef.current) {
          loadErrorShownRef.current = true
          showError('감사 로그를 불러오지 못했습니다.')
        }
      })
      .finally(() => setLoading(false))
  }, [actionFilter])

  const query = search.trim().toLowerCase()
  const filteredLogs = useMemo(() => logs.filter(log => {
    const severity = inferSeverity(log)
    const severityMatch = severityFilter === 'all' || severity === severityFilter
    return severityMatch && matchesQuery(log, query)
  }), [logs, query, severityFilter])

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE))
  const pageLogs = filteredLogs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  useEffect(() => {
    setPage(0)
  }, [query, severityFilter])

  return (
    <div className="mx-auto w-full max-w-[78rem]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono" style={{ color: '#8a7a5a', fontSize: '0.6875rem' }}>AUDIT TRAIL</p>
          <h1 className="mt-1 font-serif text-2xl font-bold" style={{ color: 'var(--gold)' }}>감사 로그</h1>
        </div>
        <div className="rounded-sm border font-mono" style={{ borderColor: 'rgba(200,144,10,0.18)', padding: '0.625rem 0.75rem', color: '#c8a450', background: 'rgba(26,21,16,0.62)', fontSize: '0.75rem' }}>
          {filteredLogs.length.toLocaleString('ko-KR')} / {logs.length.toLocaleString('ko-KR')} rows
        </div>
      </div>

      <section className="mb-4 grid gap-2 xl:grid-cols-[1fr_11rem_11rem]">
        <div className="relative">
          <Search size="0.875rem" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#7a6845' }} />
          <AdminInput
            value={search}
            onChange={setSearch}
            placeholder="수행자, 대상, IP, 세부 정보 검색"
            style={{ paddingLeft: '2.25rem' }}
          />
        </div>
        <AdminSelect value={actionFilter} onChange={setActionFilter} options={FILTER_OPTIONS} />
        <AdminSelect value={severityFilter} onChange={setSeverityFilter} options={SEVERITY_OPTIONS} />
      </section>

      {loading ? (
        <div className="rounded-md border" style={{ borderColor: 'rgba(200,144,10,0.14)', padding: '1.25rem', color: '#888888', fontSize: '0.8125rem' }}>
          감사 로그 로딩 중
        </div>
      ) : pageLogs.length === 0 ? (
        <div className="rounded-md border" style={{ borderColor: 'rgba(200,144,10,0.14)', padding: '1.5rem', color: '#888888', fontSize: '0.8125rem', textAlign: 'center' }}>
          조건에 맞는 기록이 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {pageLogs.map(log => {
            const severity = inferSeverity(log)
            const tone = getSeverityTone(severity)
            const Icon = tone.icon
            const entries = detailEntries(log.details)
            const raw = rawDetails(log.details)
            return (
              <article
                key={log.id}
                className="rounded-md border"
                style={{
                  borderColor: tone.border,
                  background: 'rgba(26,21,16,0.64)',
                  borderLeft: `0.1875rem solid ${tone.color}`,
                  }}
              >
                <div className="grid gap-3 p-4 lg:grid-cols-[12rem_1fr_13rem]">
                  <div className="space-y-2">
                    <span
                      className="inline-flex items-center gap-1 rounded-sm border font-mono"
                      style={{ color: tone.color, background: 'transparent', borderColor: tone.border, padding: '0.1875rem 0.5rem', fontSize: '0.6875rem' }}
                    >
                      <span style={{ width: '0.3125rem', height: '0.3125rem', borderRadius: '999rem', background: tone.color }} />
                      <Icon size="0.75rem" />
                      {severity}
                    </span>
                    <p className="flex items-center gap-1" style={{ color: '#8a7a5a', fontSize: '0.75rem' }}>
                      <Clock3 size="0.75rem" />
                      {formatDateTime(log.created_at)}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 style={{ color: '#d6be7a', fontSize: '0.9375rem', fontWeight: 700 }}>
                        {ACTION_LABELS[log.action] ?? log.action}
                      </h2>
                      <span className="font-mono" style={{ color: '#665a42', fontSize: '0.6875rem' }}>{log.action}</span>
                    </div>
                    <p className="mt-1 break-words font-sans" style={{ color: '#9a8a6a', fontSize: '0.75rem', lineHeight: 1.55 }}>
                      {auditSummary(log)}
                    </p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <div className="rounded-sm border" style={{ borderColor: 'rgba(200,144,10,0.1)', padding: '0.625rem 0.75rem' }}>
                        <p className="mb-1 flex items-center gap-1" style={{ color: '#7a6845', fontSize: '0.6875rem' }}><UserRound size="0.75rem" />수행자</p>
                        <p className="truncate" style={{ color: '#c8a450', fontSize: '0.8125rem' }}>{log.actor_name ?? '시스템'}</p>
                      </div>
                      <div className="rounded-sm border" style={{ borderColor: 'rgba(200,144,10,0.1)', padding: '0.625rem 0.75rem' }}>
                        <p className="mb-1" style={{ color: '#7a6845', fontSize: '0.6875rem' }}>{log.target_type ?? 'target'}</p>
                        <p className="truncate" style={{ color: '#c8a450', fontSize: '0.8125rem' }}>{targetLabel(log)}</p>
                      </div>
                    </div>

                    {entries.length > 0 && (
                      <dl className="mt-3 grid gap-2 md:grid-cols-2">
                        {entries.map(([key, value]) => (
                          <div key={key} className="min-w-0 rounded-sm border" style={{ borderColor: 'rgba(200,144,10,0.08)', background: 'rgba(13,11,8,0.34)', padding: '0.5rem 0.625rem' }}>
                            <dt className="font-mono" style={{ color: '#665a42', fontSize: '0.625rem' }}>{key}</dt>
                            <dd className="truncate font-sans" style={{ color: '#b49b62', fontSize: '0.75rem', marginTop: '0.125rem' }}>{compactValue(value)}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {raw && (
                      <details className="mt-3 rounded-sm border" style={{ borderColor: 'rgba(200,144,10,0.1)', background: 'rgba(13,11,8,0.28)' }}>
                        <summary className="cursor-pointer select-none font-sans" style={{ color: '#8a7a5a', fontSize: '0.75rem', padding: '0.625rem 0.75rem' }}>
                          원본 details 보기
                        </summary>
                        <pre className="overflow-x-auto border-t font-mono" style={{ borderColor: 'rgba(200,144,10,0.08)', color: '#8f8269', fontSize: '0.6875rem', lineHeight: 1.6, margin: 0, padding: '0.75rem', whiteSpace: 'pre-wrap' }}>
                          {raw}
                        </pre>
                      </details>
                    )}
                  </div>

                  <aside className="flex flex-col justify-between gap-3">
                    <div className="rounded-sm border" style={{ borderColor: 'rgba(200,144,10,0.1)', padding: '0.625rem 0.75rem' }}>
                      <p className="mb-1 flex items-center gap-1" style={{ color: '#7a6845', fontSize: '0.6875rem' }}><Globe2 size="0.75rem" />요청</p>
                      <p className="font-mono" style={{ color: '#c8a450', fontSize: '0.75rem' }}>{log.country ?? '국가 없음'}</p>
                      <p className="truncate font-mono" style={{ color: '#7a6845', fontSize: '0.6875rem', marginTop: '0.25rem' }}>{log.ip ?? 'IP 없음'}</p>
                    </div>
                    <div className="flex items-center gap-1 font-mono" style={{ color: '#665a42', fontSize: '0.625rem' }}>
                      <Filter size="0.75rem" aria-hidden="true" />
                      {log.id.slice(0, 8)}
                    </div>
                  </aside>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {!loading && filteredLogs.length > PAGE_SIZE && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="font-mono" style={{ color: '#888888', fontSize: '0.75rem' }}>
            {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filteredLogs.length)} / {filteredLogs.length}
          </span>
          <div className="flex gap-2">
            <AdminButton onClick={() => setPage(prev => Math.max(0, prev - 1))} disabled={page === 0} variant="ghost" size="sm">
              <ChevronLeft size="0.875rem" /> 이전
            </AdminButton>
            <AdminButton onClick={() => setPage(prev => Math.min(totalPages - 1, prev + 1))} disabled={page >= totalPages - 1} variant="ghost" size="sm">
              다음 <ChevronRight size="0.875rem" />
            </AdminButton>
          </div>
        </div>
      )}
    </div>
  )
}
