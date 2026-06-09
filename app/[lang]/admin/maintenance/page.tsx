'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarClock,
  Clock,
  Construction,
  Edit3,
  Loader2,
  PauseCircle,
  PlayCircle,
  Plus,
  RotateCw,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import { AdminCard } from '@/components/admin'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { showError, showSuccess } from '@/lib/toast'

interface MaintenanceEntry {
  id: number
  path: string
  label: string
  message: string
  reason: string
  ends_at: string | null
  is_active: boolean
  updated_at: string
}

interface MaintenanceDraft {
  path: string
  label: string
  message: string
  reason: string
  ends_at: string
  noEndTime: boolean
  is_active: boolean
}

const emptyDraft: MaintenanceDraft = {
  path: '/sinners',
  label: '수감자 페이지',
  message: '현재 점검 중입니다.',
  reason: '데이터 정리',
  ends_at: '',
  noEndTime: true,
  is_active: true,
}

const routePresets = [
  {
    path: '/sinners',
    label: '수감자 페이지',
    message: '수감자 데이터 정리 중입니다.',
    reason: '인격/E.G.O 데이터 갱신',
  },
  {
    path: '/decks',
    label: '덱 아카이브',
    message: '덱 기능 점검 중입니다.',
    reason: '공유 덱/댓글 안정화',
  },
  {
    path: '/planner',
    label: '거울 던전 플래너',
    message: '플래너 점검 중입니다.',
    reason: '편성 계산 로직 점검',
  },
  {
    path: '/',
    label: '전체 사이트',
    message: '사이트 전체 점검 중입니다.',
    reason: '배포 점검',
  },
] as const

function normalizePath(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

function toApiEndsAt(draft: Pick<MaintenanceDraft, 'ends_at' | 'noEndTime'>) {
  if (draft.noEndTime || !draft.ends_at) return null
  return new Date(draft.ends_at).toISOString()
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const m = d.getMonth() + 1
  const day = d.getDate()
  const h = d.getHours().toString().padStart(2, '0')
  const min = d.getMinutes().toString().padStart(2, '0')
  return `${m}월 ${day}일 ${h}:${min}`
}

function toLocalDatetimeValue(iso: string) {
  const d = new Date(iso)
  const offset = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - offset).toISOString().slice(0, 16)
}

function endingLabel(entry: MaintenanceEntry, now: number) {
  if (!entry.ends_at) return '종료 미정'
  const endTime = new Date(entry.ends_at).getTime()
  if (Number.isNaN(endTime)) return '종료 시간 오류'
  if (endTime < now) return `만료됨 · ${formatDate(entry.ends_at)}`
  return `종료 예정 · ${formatDate(entry.ends_at)}`
}

export default function MaintenancePage() {
  const [entries, setEntries] = useState<MaintenanceEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<MaintenanceDraft>(emptyDraft)
  const [newDraft, setNewDraft] = useState<MaintenanceDraft>(emptyDraft)
  const [deleteTarget, setDeleteTarget] = useState<MaintenanceEntry | null>(null)

  const fetchEntries = useCallback(async (options?: { quiet?: boolean }) => {
    if (!options?.quiet) setLoading(true)
    setLoadError('')

    try {
      const res = await fetch('/api/admin/maintenance')
      if (!res.ok) throw new Error('maintenance-list')
      setEntries(await res.json())
    } catch {
      setLoadError('점검 항목을 불러오지 못했습니다.')
      showError('점검 항목을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const now = Date.now()
  const summary = useMemo(() => {
    const active = entries.filter(entry => entry.is_active)
    const endingSoon = active.filter(entry => {
      if (!entry.ends_at) return false
      const endsAt = new Date(entry.ends_at).getTime()
      return !Number.isNaN(endsAt) && endsAt >= now
    }).length
    const expired = active.filter(entry => {
      if (!entry.ends_at) return false
      const endsAt = new Date(entry.ends_at).getTime()
      return !Number.isNaN(endsAt) && endsAt < now
    }).length

    return {
      total: entries.length,
      active: active.length,
      endingSoon,
      noEnd: active.filter(entry => !entry.ends_at).length,
      expired,
    }
  }, [entries, now])

  const activeEntries = useMemo(
    () => entries.filter(entry => entry.is_active).sort((a, b) => a.path.localeCompare(b.path)),
    [entries],
  )

  const idleEntries = useMemo(
    () => entries.filter(entry => !entry.is_active).sort((a, b) => a.path.localeCompare(b.path)),
    [entries],
  )

  const applyPreset = (preset: (typeof routePresets)[number]) => {
    setNewDraft(draft => ({
      ...draft,
      path: preset.path,
      label: preset.label,
      message: preset.message,
      reason: preset.reason,
    }))
  }

  const toggleActive = async (entry: MaintenanceEntry) => {
    const nextActive = !entry.is_active
    setBusyKey(`toggle-${entry.id}`)

    try {
      const res = await fetch('/api/admin/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entry.id, is_active: nextActive }),
      })
      if (!res.ok) throw new Error('toggle')
      showSuccess(nextActive ? '점검을 시작했습니다.' : '점검을 해제했습니다.')
      await fetchEntries({ quiet: true })
    } catch {
      showError(nextActive ? '점검 시작에 실패했습니다.' : '점검 해제에 실패했습니다.')
    } finally {
      setBusyKey(null)
    }
  }

  const startEditing = (entry: MaintenanceEntry) => {
    setEditingId(entry.id)
    setEditDraft({
      path: normalizePath(entry.path),
      label: entry.label,
      message: entry.message,
      reason: entry.reason || '',
      ends_at: entry.ends_at ? toLocalDatetimeValue(entry.ends_at) : '',
      noEndTime: !entry.ends_at,
      is_active: entry.is_active,
    })
  }

  const saveEdit = async (entry: MaintenanceEntry) => {
    const path = normalizePath(editDraft.path)
    if (!path || !editDraft.label.trim()) {
      showError('경로와 라벨을 입력하세요.')
      return
    }

    setBusyKey(`save-${entry.id}`)

    try {
      const res = await fetch('/api/admin/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: entry.id,
          path,
          label: editDraft.label.trim(),
          message: editDraft.message.trim(),
          reason: editDraft.reason.trim(),
          ends_at: toApiEndsAt(editDraft),
          is_active: editDraft.is_active,
        }),
      })
      if (!res.ok) throw new Error('save')
      showSuccess('점검 항목을 저장했습니다.')
      setEditingId(null)
      await fetchEntries({ quiet: true })
    } catch {
      showError('점검 항목 저장에 실패했습니다.')
    } finally {
      setBusyKey(null)
    }
  }

  const addEntry = async () => {
    const path = normalizePath(newDraft.path)
    if (!path || !newDraft.label.trim()) {
      showError('경로와 라벨을 입력하세요.')
      return
    }

    setBusyKey('create')

    try {
      const res = await fetch('/api/admin/maintenance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path,
          label: newDraft.label.trim(),
          message: newDraft.message.trim(),
          reason: newDraft.reason.trim(),
          ends_at: toApiEndsAt(newDraft),
          is_active: newDraft.is_active,
        }),
      })
      if (!res.ok) throw new Error('create')
      showSuccess(newDraft.is_active ? '점검 항목을 만들고 즉시 활성화했습니다.' : '점검 항목을 만들었습니다.')
      setNewDraft(emptyDraft)
      await fetchEntries({ quiet: true })
    } catch {
      showError('점검 항목 생성에 실패했습니다.')
    } finally {
      setBusyKey(null)
    }
  }

  const deleteEntry = async () => {
    if (!deleteTarget) return
    setBusyKey(`delete-${deleteTarget.id}`)

    try {
      const res = await fetch(`/api/admin/maintenance?id=${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete')
      showSuccess('점검 항목을 삭제했습니다.')
      setDeleteTarget(null)
      await fetchEntries({ quiet: true })
    } catch {
      showError('점검 항목 삭제에 실패했습니다.')
    } finally {
      setBusyKey(null)
    }
  }

  const inputClass = 'min-h-11 w-full rounded-sm border bg-[#0d0b08] px-3 py-2 text-[0.9375rem] text-[#d0b885] outline-none transition-colors placeholder:text-[#5d513f] focus:border-[#c8900a]/60 focus:bg-[#120f0b] focus-visible:ring-2 focus-visible:ring-[#c8900a]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0b08]'
  const labelClass = 'mb-1.5 block text-[0.875rem] font-medium text-[#8a7855]'
  const secondaryButtonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-[#c8900a]/15 px-3 text-[0.9375rem] font-medium text-[#a89070] transition-colors hover:border-[#c8900a]/35 hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8900a]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0b08] disabled:cursor-not-allowed disabled:opacity-45'
  const primaryButtonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-[#c8900a]/40 bg-[#c8900a]/15 px-4 text-[0.9375rem] font-semibold text-[#e8b030] transition-colors hover:bg-[#c8900a]/22 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8900a]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0b08] disabled:cursor-not-allowed disabled:opacity-45'

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 border-b pb-5 md:flex-row md:items-end md:justify-between" style={{ borderColor: 'rgba(200,144,10,0.12)' }}>
        <div>
          <p className="font-mono text-[0.875rem]" style={{ color: '#8a7a5a' }}>MAINTENANCE OPS</p>
          <h1 className="font-serif text-2xl font-bold" style={{ color: 'var(--gold)' }}>
            점검 관리
          </h1>
          <p className="mt-1 max-w-3xl text-[0.9375rem] leading-6" style={{ color: '#9a8a70' }}>
            경로별 점검을 만들고, 즉시 활성화하고, 종료 시간을 기준으로 운영 상태를 점검합니다. 저장된 경로의 하위 경로도 함께 차단됩니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => fetchEntries()}
          disabled={loading}
          className={secondaryButtonClass}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RotateCw size={16} />}
          새로고침
        </button>
      </header>

      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5" aria-label="점검 상태 요약">
        {[
          { label: '전체 항목', value: summary.total, detail: '등록된 경로', tone: '#c8a450' },
          { label: '활성 점검', value: summary.active, detail: '현재 차단 중', tone: summary.active > 0 ? '#d46a5a' : '#8a7855' },
          { label: '종료 예정', value: summary.endingSoon, detail: '종료 시간이 있음', tone: '#c8900a' },
          { label: '종료 미정', value: summary.noEnd, detail: '수동 해제 필요', tone: '#9a8a70' },
          { label: '만료 활성', value: summary.expired, detail: '해제 검토 필요', tone: summary.expired > 0 ? '#d46a5a' : '#665a42' },
        ].map(item => (
          <div
            key={item.label}
            className="rounded-sm border px-3 py-3"
            style={{ borderColor: 'rgba(200,144,10,0.14)', background: 'rgba(26,21,16,0.54)' }}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[0.875rem] font-medium" style={{ color: '#8a7855' }}>{item.label}</p>
              <span className="h-2 w-2 rounded-full" style={{ background: item.tone }} aria-hidden="true" />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums" style={{ color: item.tone }}>{item.value}</p>
            <p className="mt-1 text-[0.875rem]" style={{ color: '#6f6048' }}>{item.detail}</p>
          </div>
        ))}
      </section>

      {summary.active > 0 && (
        <section className="rounded-sm border px-4 py-3" style={{ borderColor: 'rgba(212,106,90,0.26)', background: 'rgba(26,21,16,0.64)' }}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <Construction className="mt-1 shrink-0" size={18} style={{ color: '#d46a5a' }} />
              <div>
                <p className="text-[1rem] font-semibold" style={{ color: '#d8c09a' }}>
                  현재 {summary.active}개 경로가 점검 중입니다.
                </p>
                <p className="mt-1 text-[0.875rem]" style={{ color: '#8f8269' }}>
                  {activeEntries.slice(0, 3).map(entry => entry.path).join(', ')}
                  {activeEntries.length > 3 ? ` 외 ${activeEntries.length - 3}개` : ''}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {summary.expired > 0 && (
                <span className="inline-flex min-h-8 items-center gap-1 rounded-sm border px-2 text-[0.875rem]" style={{ borderColor: 'rgba(212,106,90,0.28)', color: '#d46a5a' }}>
                  <AlertTriangle size={14} /> 만료 활성 {summary.expired}
                </span>
              )}
              {summary.noEnd > 0 && (
                <span className="inline-flex min-h-8 items-center gap-1 rounded-sm border px-2 text-[0.875rem]" style={{ borderColor: 'rgba(200,144,10,0.18)', color: '#c8a450' }}>
                  <Clock size={14} /> 종료 미정 {summary.noEnd}
                </span>
              )}
            </div>
          </div>
        </section>
      )}

      <AdminCard
        title="빠른 점검 생성"
        style={{ marginBottom: 0, padding: '1rem', background: 'rgba(26,21,16,0.58)' }}
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-[0.875rem] font-medium" style={{ color: '#8a7855' }}>경로 프리셋</p>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {routePresets.map(preset => (
                  <button
                    key={preset.path}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="min-h-11 rounded-sm border px-3 py-2 text-left transition-colors hover:border-[#c8900a]/40 hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8900a]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0b08]"
                    style={{ borderColor: newDraft.path === preset.path ? 'rgba(200,144,10,0.42)' : 'rgba(200,144,10,0.14)' }}
                  >
                    <span className="block text-[0.9375rem] font-semibold" style={{ color: '#d0b885' }}>{preset.label}</span>
                    <span className="mt-1 block truncate font-mono text-[0.875rem]" style={{ color: '#7a6845' }}>{preset.path}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="maintenance-new-path">경로</label>
                <input
                  id="maintenance-new-path"
                  value={newDraft.path}
                  onChange={e => setNewDraft(draft => ({ ...draft, path: normalizePath(e.target.value) }))}
                  placeholder="/sinners/yi-sang"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="maintenance-new-label">라벨</label>
                <input
                  id="maintenance-new-label"
                  value={newDraft.label}
                  onChange={e => setNewDraft(draft => ({ ...draft, label: e.target.value }))}
                  placeholder="이상 수감자 페이지"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <div>
                <label className={labelClass} htmlFor="maintenance-new-message">메시지</label>
                <textarea
                  id="maintenance-new-message"
                  value={newDraft.message}
                  onChange={e => setNewDraft(draft => ({ ...draft, message: e.target.value }))}
                  placeholder="현재 점검 중입니다."
                  rows={3}
                  className={`${inputClass} resize-y leading-6`}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="maintenance-new-reason">사유</label>
                <textarea
                  id="maintenance-new-reason"
                  value={newDraft.reason}
                  onChange={e => setNewDraft(draft => ({ ...draft, reason: e.target.value }))}
                  placeholder="데이터 업데이트, 버그 수정 등"
                  rows={3}
                  className={`${inputClass} resize-y leading-6`}
                />
              </div>
            </div>
          </div>

          <aside className="rounded-sm border p-3" style={{ borderColor: 'rgba(200,144,10,0.12)', background: 'rgba(13,11,8,0.35)' }}>
            <div className="space-y-3">
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-sm border px-3" style={{ borderColor: 'rgba(200,144,10,0.14)', color: '#d0b885' }}>
                <input
                  type="checkbox"
                  checked={newDraft.is_active}
                  onChange={e => setNewDraft(draft => ({ ...draft, is_active: e.target.checked }))}
                  className="h-4 w-4"
                  style={{ accentColor: '#c8900a' }}
                />
                <span className="text-[0.9375rem] font-medium">생성 즉시 활성화</span>
              </label>

              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-sm border px-3" style={{ borderColor: 'rgba(200,144,10,0.14)', color: '#d0b885' }}>
                <input
                  type="checkbox"
                  checked={newDraft.noEndTime}
                  onChange={e => setNewDraft(draft => ({ ...draft, noEndTime: e.target.checked, ends_at: e.target.checked ? '' : draft.ends_at }))}
                  className="h-4 w-4"
                  style={{ accentColor: '#c8900a' }}
                />
                <span className="text-[0.9375rem] font-medium">종료 시간 미정</span>
              </label>

              {!newDraft.noEndTime && (
                <div>
                  <label className={labelClass} htmlFor="maintenance-new-ends-at">종료 시간</label>
                  <input
                    id="maintenance-new-ends-at"
                    type="datetime-local"
                    value={newDraft.ends_at}
                    onChange={e => setNewDraft(draft => ({ ...draft, ends_at: e.target.value }))}
                    className={inputClass}
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
              )}

              <button
                type="button"
                onClick={addEntry}
                disabled={busyKey === 'create'}
                className={`${primaryButtonClass} w-full`}
              >
                {busyKey === 'create' ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                점검 항목 만들기
              </button>
            </div>
          </aside>
        </div>
      </AdminCard>

      <section className="space-y-3" aria-label="점검 항목 목록">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[1.125rem] font-semibold" style={{ color: '#d8c09a' }}>운영 항목</h2>
            <p className="text-[0.875rem]" style={{ color: '#7a6845' }}>활성 항목을 먼저 표시합니다. 각 행에서 수정, 토글, 삭제를 바로 처리할 수 있습니다.</p>
          </div>
          <span className="font-mono text-[0.875rem] tabular-nums" style={{ color: '#7a6845' }}>
            ACTIVE {summary.active} / TOTAL {summary.total}
          </span>
        </div>

        {loading ? (
          <div className="rounded-sm border p-4" style={{ borderColor: 'rgba(200,144,10,0.12)', background: 'rgba(26,21,16,0.48)' }}>
            <div className="flex items-center gap-2 text-[0.9375rem]" style={{ color: '#8f8269' }}>
              <Loader2 size={16} className="animate-spin" /> 점검 항목을 불러오는 중입니다.
            </div>
          </div>
        ) : loadError ? (
          <div className="rounded-sm border p-4" style={{ borderColor: 'rgba(212,106,90,0.24)', background: 'rgba(26,21,16,0.48)' }}>
            <p className="flex items-center gap-2 text-[0.9375rem]" style={{ color: '#d46a5a' }}>
              <AlertTriangle size={16} /> {loadError}
            </p>
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-sm border p-5" style={{ borderColor: 'rgba(200,144,10,0.12)', background: 'rgba(26,21,16,0.48)' }}>
            <p className="text-[1rem] font-semibold" style={{ color: '#d8c09a' }}>등록된 점검 항목이 없습니다.</p>
            <p className="mt-1 text-[0.9375rem]" style={{ color: '#8f8269' }}>위 빠른 생성 폼에서 경로를 만들면 운영 목록에 표시됩니다.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-sm border" style={{ borderColor: 'rgba(200,144,10,0.14)', background: 'rgba(26,21,16,0.42)' }}>
            <div className="hidden grid-cols-[minmax(16rem,1.1fr)_minmax(18rem,1.4fr)_12rem_12rem] gap-3 border-b px-3 py-2 font-mono text-[0.875rem] lg:grid" style={{ borderColor: 'rgba(200,144,10,0.12)', color: '#7a6845' }}>
              <span>ROUTE</span>
              <span>MESSAGE</span>
              <span>ENDS</span>
              <span className="text-right">ACTIONS</span>
            </div>
            {[...activeEntries, ...idleEntries].map(entry => {
              const isEditing = editingId === entry.id
              const rowBusy = busyKey?.endsWith(`-${entry.id}`) ?? false

              return (
                <article
                  key={entry.id}
                  className="border-b px-3 py-3 last:border-b-0"
                  style={{ borderColor: 'rgba(200,144,10,0.08)' }}
                >
                  {!isEditing ? (
                    <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1.1fr)_minmax(18rem,1.4fr)_12rem_12rem] lg:items-start">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="inline-flex min-h-8 items-center gap-1 rounded-sm border px-2 text-[0.875rem] font-medium"
                            style={{
                              borderColor: entry.is_active ? 'rgba(212,106,90,0.28)' : 'rgba(200,144,10,0.12)',
                              color: entry.is_active ? '#d46a5a' : '#8a7855',
                              background: entry.is_active ? 'rgba(212,106,90,0.06)' : 'transparent',
                            }}
                          >
                            <span className="h-2 w-2 rounded-full" style={{ background: entry.is_active ? '#d46a5a' : '#4a4034' }} aria-hidden="true" />
                            {entry.is_active ? '활성' : '대기'}
                          </span>
                          <p className="min-w-0 truncate text-[1rem] font-semibold" style={{ color: '#d8c09a' }}>{entry.label}</p>
                        </div>
                        <code className="mt-2 block truncate font-mono text-[0.9375rem]" style={{ color: '#c8a450' }}>{entry.path}</code>
                      </div>

                      <div className="min-w-0 space-y-2">
                        <p className="line-clamp-2 text-[0.9375rem] leading-6" style={{ color: '#b5a184' }}>{entry.message || '메시지 없음'}</p>
                        <p className="flex items-start gap-2 text-[0.875rem] leading-5" style={{ color: '#8f8269' }}>
                          <AlertTriangle className="mt-0.5 shrink-0" size={14} />
                          <span className="min-w-0 break-words">{entry.reason || '사유 없음'}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 text-[0.875rem] leading-5 lg:block" style={{ color: entry.ends_at ? '#9a8a70' : '#7a6845' }}>
                        <CalendarClock size={15} className="shrink-0 lg:mb-2" />
                        <span>{endingLabel(entry, now)}</span>
                      </div>

                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <button
                          type="button"
                          onClick={() => startEditing(entry)}
                          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-sm border px-2 text-[0.9375rem] transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8900a]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0b08] sm:flex-none"
                          style={{ borderColor: 'rgba(200,144,10,0.14)', color: '#c8a450' }}
                          aria-label={`${entry.label} 수정`}
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(entry)}
                          disabled={rowBusy}
                          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-sm border px-2 text-[0.9375rem] transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8900a]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0b08] disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none"
                          style={{ borderColor: entry.is_active ? 'rgba(212,106,90,0.24)' : 'rgba(90,150,92,0.22)', color: entry.is_active ? '#d46a5a' : '#73a56f' }}
                          aria-label={entry.is_active ? `${entry.label} 점검 해제` : `${entry.label} 점검 시작`}
                        >
                          {busyKey === `toggle-${entry.id}` ? <Loader2 size={16} className="animate-spin" /> : entry.is_active ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(entry)}
                          disabled={rowBusy}
                          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-sm border px-2 text-[0.9375rem] transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8900a]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0b08] disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none"
                          style={{ borderColor: 'rgba(212,106,90,0.18)', color: '#b86a62' }}
                          aria-label={`${entry.label} 삭제`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 rounded-sm border p-3" style={{ borderColor: 'rgba(200,144,10,0.16)', background: 'rgba(13,11,8,0.34)' }}>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <label className={labelClass} htmlFor={`maintenance-edit-path-${entry.id}`}>경로</label>
                          <input
                            id={`maintenance-edit-path-${entry.id}`}
                            value={editDraft.path}
                            onChange={e => setEditDraft(draft => ({ ...draft, path: normalizePath(e.target.value) }))}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass} htmlFor={`maintenance-edit-label-${entry.id}`}>라벨</label>
                          <input
                            id={`maintenance-edit-label-${entry.id}`}
                            value={editDraft.label}
                            onChange={e => setEditDraft(draft => ({ ...draft, label: e.target.value }))}
                            className={inputClass}
                          />
                        </div>
                      </div>

                      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                        <div>
                          <label className={labelClass} htmlFor={`maintenance-edit-message-${entry.id}`}>메시지</label>
                          <textarea
                            id={`maintenance-edit-message-${entry.id}`}
                            value={editDraft.message}
                            onChange={e => setEditDraft(draft => ({ ...draft, message: e.target.value }))}
                            rows={3}
                            className={`${inputClass} resize-y leading-6`}
                          />
                        </div>
                        <div>
                          <label className={labelClass} htmlFor={`maintenance-edit-reason-${entry.id}`}>사유</label>
                          <textarea
                            id={`maintenance-edit-reason-${entry.id}`}
                            value={editDraft.reason}
                            onChange={e => setEditDraft(draft => ({ ...draft, reason: e.target.value }))}
                            rows={3}
                            className={`${inputClass} resize-y leading-6`}
                          />
                        </div>
                      </div>

                      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-sm border px-3" style={{ borderColor: 'rgba(200,144,10,0.14)', color: '#d0b885' }}>
                            <input
                              type="checkbox"
                              checked={editDraft.is_active}
                              onChange={e => setEditDraft(draft => ({ ...draft, is_active: e.target.checked }))}
                              className="h-4 w-4"
                              style={{ accentColor: '#c8900a' }}
                            />
                            <span className="text-[0.9375rem] font-medium">활성 상태</span>
                          </label>
                          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-sm border px-3" style={{ borderColor: 'rgba(200,144,10,0.14)', color: '#d0b885' }}>
                            <input
                              type="checkbox"
                              checked={editDraft.noEndTime}
                              onChange={e => setEditDraft(draft => ({ ...draft, noEndTime: e.target.checked, ends_at: e.target.checked ? '' : draft.ends_at }))}
                              className="h-4 w-4"
                              style={{ accentColor: '#c8900a' }}
                            />
                            <span className="text-[0.9375rem] font-medium">종료 시간 미정</span>
                          </label>
                          {!editDraft.noEndTime && (
                            <div className="sm:col-span-2">
                              <label className={labelClass} htmlFor={`maintenance-edit-ends-at-${entry.id}`}>종료 시간</label>
                              <input
                                id={`maintenance-edit-ends-at-${entry.id}`}
                                type="datetime-local"
                                value={editDraft.ends_at}
                                onChange={e => setEditDraft(draft => ({ ...draft, ends_at: e.target.value }))}
                                className={inputClass}
                                style={{ colorScheme: 'dark' }}
                              />
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:flex">
                          <button
                            type="button"
                            onClick={() => saveEdit(entry)}
                            disabled={busyKey === `save-${entry.id}`}
                            className={primaryButtonClass}
                          >
                            {busyKey === `save-${entry.id}` ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            저장
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            disabled={busyKey === `save-${entry.id}`}
                            className={secondaryButtonClass}
                          >
                            <X size={16} />
                            취소
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>

      <ConfirmModal
        open={!!deleteTarget}
        title="점검 항목 삭제"
        message={`"${deleteTarget?.label}" (${deleteTarget?.path}) 항목을 삭제하시겠습니까?`}
        variant="danger"
        confirmLabel={busyKey === `delete-${deleteTarget?.id}` ? '삭제 중' : '삭제'}
        onConfirm={deleteEntry}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
