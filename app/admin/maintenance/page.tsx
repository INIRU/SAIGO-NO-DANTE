'use client'

import { useEffect, useState, useCallback } from 'react'
import { Construction, Plus, Trash2, Loader2, Clock, AlertTriangle } from 'lucide-react'
import { AdminCard } from '@/components/admin'
import ConfirmModal from '@/components/ui/ConfirmModal'

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

export default function MaintenancePage() {
  const [entries, setEntries] = useState<MaintenanceEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState({ message: '', reason: '', ends_at: '', noEndTime: true })
  const [showAdd, setShowAdd] = useState(false)
  const [newPath, setNewPath] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<MaintenanceEntry | null>(null)

  const fetchEntries = useCallback(async () => {
    const res = await fetch('/api/admin/maintenance')
    if (res.ok) setEntries(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  const toggleActive = async (entry: MaintenanceEntry) => {
    setToggling(entry.id)
    await fetch('/api/admin/maintenance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: entry.id, is_active: !entry.is_active }),
    })
    await fetchEntries()
    setToggling(null)
  }

  const startEditing = (entry: MaintenanceEntry) => {
    setEditingId(entry.id)
    setEditDraft({
      message: entry.message,
      reason: entry.reason || '',
      ends_at: entry.ends_at ? toLocalDatetimeValue(entry.ends_at) : '',
      noEndTime: !entry.ends_at,
    })
  }

  const saveEdit = async (entry: MaintenanceEntry) => {
    await fetch('/api/admin/maintenance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: entry.id,
        message: editDraft.message,
        reason: editDraft.reason,
        ends_at: editDraft.noEndTime ? null : (editDraft.ends_at ? new Date(editDraft.ends_at).toISOString() : null),
      }),
    })
    setEditingId(null)
    await fetchEntries()
  }

  const addEntry = async () => {
    if (!newPath || !newLabel) return
    await fetch('/api/admin/maintenance', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: newPath.startsWith('/') ? newPath : `/${newPath}`,
        label: newLabel,
      }),
    })
    setShowAdd(false)
    setNewPath('')
    setNewLabel('')
    await fetchEntries()
  }

  const deleteEntry = async () => {
    if (!deleteTarget) return
    await fetch(`/api/admin/maintenance?id=${deleteTarget.id}`, { method: 'DELETE' })
    setDeleteTarget(null)
    await fetchEntries()
  }

  const activeCount = entries.filter(e => e.is_active).length

  const inputStyle = {
    background: '#0d0b08',
    border: '1px solid var(--border)',
    color: '#a89070',
    fontSize: '0.8125rem' as const,
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold mb-1" style={{ color: 'var(--gold)' }}>
            점검 관리
          </h1>
          <p style={{ color: '#555566', fontSize: '0.8125rem' }}>
            특정 페이지의 접근을 차단합니다. 하위 경로도 함께 차단됩니다. 관리자는 점검 중에도 접근 가능합니다.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors hover:bg-white/10"
          style={{
            background: 'rgba(200,144,10,0.15)',
            color: '#c8900a',
            border: '1px solid rgba(200,144,10,0.3)',
            fontSize: '0.8125rem',
          }}
        >
          <Plus size={14} /> 추가
        </button>
      </div>

      {activeCount > 0 && (
        <div
          className="mb-6 px-4 py-3 rounded flex items-center gap-2"
          style={{
            background: 'rgba(220,50,50,0.1)',
            border: '1px solid rgba(220,50,50,0.3)',
            color: '#e05555',
            fontSize: '0.8125rem',
          }}
        >
          <Construction size={16} />
          현재 {activeCount}개 페이지가 점검 중입니다.
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2" style={{ color: '#555566', fontSize: '0.8125rem' }}>
          <Loader2 size={14} className="animate-spin" /> 로딩 중...
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(entry => (
            <AdminCard key={entry.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* 헤더: 상태, 라벨, 경로 */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="inline-block w-2 h-2 rounded-full shrink-0"
                      style={{ background: entry.is_active ? '#e05555' : '#3a3530' }}
                    />
                    <span style={{ color: '#c8a450', fontSize: '0.875rem', fontWeight: 600 }}>
                      {entry.label}
                    </span>
                    <code style={{ color: '#7a6845', fontSize: '0.75rem' }}>{entry.path}</code>
                  </div>

                  {/* 점검 정보 표시 */}
                  {editingId !== entry.id && (
                    <div
                      className="space-y-1 cursor-pointer rounded px-2 py-1.5 -mx-2 transition-colors hover:bg-white/[0.03]"
                      onClick={() => startEditing(entry)}
                      title="클릭하여 수정"
                    >
                      <p className="truncate" style={{ color: '#555566', fontSize: '0.75rem' }}>
                        {entry.message}
                      </p>
                      {entry.reason && (
                        <p className="flex items-center gap-1" style={{ color: '#555566', fontSize: '0.7rem' }}>
                          <AlertTriangle size={10} /> {entry.reason}
                        </p>
                      )}
                      <p className="flex items-center gap-1" style={{ color: '#444', fontSize: '0.7rem' }}>
                        <Clock size={10} />
                        {entry.ends_at ? formatDate(entry.ends_at) : '미정'}
                      </p>
                    </div>
                  )}

                  {/* 편집 모드 */}
                  {editingId === entry.id && (
                    <div className="mt-2 space-y-2.5 p-3 rounded" style={{ background: 'rgba(0,0,0,0.2)' }}>
                      <div>
                        <label className="block mb-1" style={{ color: '#7a6845', fontSize: '0.7rem' }}>점검 메시지</label>
                        <input
                          value={editDraft.message}
                          onChange={e => setEditDraft(d => ({ ...d, message: e.target.value }))}
                          className="w-full px-2 py-1.5 rounded"
                          style={inputStyle}
                          placeholder="현재 점검 중입니다."
                        />
                      </div>
                      <div>
                        <label className="block mb-1" style={{ color: '#7a6845', fontSize: '0.7rem' }}>사유</label>
                        <input
                          value={editDraft.reason}
                          onChange={e => setEditDraft(d => ({ ...d, reason: e.target.value }))}
                          className="w-full px-2 py-1.5 rounded"
                          style={inputStyle}
                          placeholder="데이터 업데이트, 버그 수정 등"
                        />
                      </div>
                      <div>
                        <label className="block mb-1" style={{ color: '#7a6845', fontSize: '0.7rem' }}>종료 시간</label>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 cursor-pointer" style={{ color: '#7a6845', fontSize: '0.75rem' }}>
                            <input
                              type="checkbox"
                              checked={editDraft.noEndTime}
                              onChange={e => setEditDraft(d => ({ ...d, noEndTime: e.target.checked, ends_at: '' }))}
                              style={{ accentColor: '#c8900a' }}
                            />
                            미정
                          </label>
                          {!editDraft.noEndTime && (
                            <input
                              type="datetime-local"
                              value={editDraft.ends_at}
                              onChange={e => setEditDraft(d => ({ ...d, ends_at: e.target.value }))}
                              className="px-2 py-1 rounded"
                              style={{ ...inputStyle, colorScheme: 'dark' }}
                            />
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => saveEdit(entry)}
                          className="px-3 py-1 rounded"
                          style={{ background: 'rgba(200,144,10,0.15)', color: '#c8900a', fontSize: '0.75rem' }}
                        >
                          저장
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1 rounded"
                          style={{ color: '#555566', fontSize: '0.75rem' }}
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 액션 버튼 */}
                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                  <button
                    onClick={() => toggleActive(entry)}
                    disabled={toggling === entry.id}
                    className="px-3 py-1.5 rounded transition-colors text-sm"
                    style={{
                      background: entry.is_active ? 'rgba(220,50,50,0.15)' : 'rgba(50,180,50,0.1)',
                      color: entry.is_active ? '#e05555' : '#50b050',
                      border: `1px solid ${entry.is_active ? 'rgba(220,50,50,0.3)' : 'rgba(50,180,50,0.2)'}`,
                      fontSize: '0.75rem',
                      minWidth: 72,
                    }}
                  >
                    {toggling === entry.id ? (
                      <Loader2 size={12} className="animate-spin mx-auto" />
                    ) : entry.is_active ? '점검 해제' : '점검 시작'}
                  </button>
                  <button
                    onClick={() => setDeleteTarget(entry)}
                    className="p-1.5 rounded transition-colors hover:bg-white/5"
                    style={{ color: '#555566' }}
                    title="삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </AdminCard>
          ))}
        </div>
      )}

      {/* 추가 모달 */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-md rounded-lg p-6" style={{ background: '#1a1510', border: '1px solid var(--border)' }}>
            <h3 className="font-serif text-lg font-bold mb-4" style={{ color: '#c8a450' }}>
              점검 항목 추가
            </h3>
            <p className="mb-4" style={{ color: '#555566', fontSize: '0.75rem' }}>
              하위 경로도 함께 차단됩니다. 예: /sinners 입력 시 /sinners/yi-sang 등도 차단
            </p>
            <div className="space-y-3">
              <div>
                <label className="block mb-1" style={{ color: '#7a6845', fontSize: '0.75rem' }}>경로</label>
                <input
                  value={newPath}
                  onChange={e => setNewPath(e.target.value)}
                  placeholder="/sinners/yi-sang"
                  className="w-full px-3 py-2 rounded"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block mb-1" style={{ color: '#7a6845', fontSize: '0.75rem' }}>라벨</label>
                <input
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  placeholder="이상 수감자 페이지"
                  className="w-full px-3 py-2 rounded"
                  style={inputStyle}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => { setShowAdd(false); setNewPath(''); setNewLabel('') }}
                className="px-4 py-2 rounded"
                style={{ color: '#555566', fontSize: '0.8125rem' }}
              >
                취소
              </button>
              <button
                onClick={addEntry}
                disabled={!newPath || !newLabel}
                className="px-4 py-2 rounded transition-colors"
                style={{
                  background: 'rgba(200,144,10,0.2)',
                  color: '#c8900a',
                  border: '1px solid rgba(200,144,10,0.3)',
                  fontSize: '0.8125rem',
                  opacity: !newPath || !newLabel ? 0.4 : 1,
                }}
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="점검 항목 삭제"
        message={`"${deleteTarget?.label}" (${deleteTarget?.path}) 항목을 삭제하시겠습니까?`}
        variant="danger"
        confirmLabel="삭제"
        onConfirm={deleteEntry}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
