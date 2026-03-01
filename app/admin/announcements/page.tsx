'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, Pin, Pencil, X, Loader2 } from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'

interface Announcement {
  id: string
  title: string
  content: string
  pinned: boolean
  created_at: string
  updated_at: string
}

export default function AdminAnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: '', content: '', pinned: false })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchItems = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/announcements')
    const data = await res.json()
    setItems(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { fetchItems() }, [])

  const handleCreate = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError(`공지 작성 실패: ${err.error ?? res.statusText}`)
        return
      }
      setCreating(false)
      setForm({ title: '', content: '', pinned: false })
      fetchItems()
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!editing) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/announcements/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError(`공지 수정 실패: ${err.error ?? res.statusText}`)
        return
      }
      setEditing(null)
      setForm({ title: '', content: '', pinned: false })
      fetchItems()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setDeleteTarget(null)
    await fetch(`/api/admin/announcements/${id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(a => a.id !== id))
  }, [deleteTarget])

  const startEdit = (a: Announcement) => {
    setEditing(a)
    setCreating(false)
    setForm({ title: a.title, content: a.content, pinned: a.pinned })
  }

  const startCreate = () => {
    setCreating(true)
    setEditing(null)
    setForm({ title: '', content: '', pinned: false })
  }

  const cancelForm = () => {
    setCreating(false)
    setEditing(null)
    setForm({ title: '', content: '', pinned: false })
  }

  const showForm = creating || editing

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-bold mb-1" style={{ color: 'var(--gold)' }}>공지 관리</h1>
          <p style={{ color: '#555566', fontSize: '13px' }}>공지사항을 작성하고 관리합니다.</p>
        </div>
        {!showForm && (
          <button
            onClick={startCreate}
            className="flex items-center gap-2 transition-colors hover:opacity-80"
            style={{
              padding: '8px 16px', background: 'rgba(200,144,10,0.15)', border: '1px solid var(--border)',
              borderRadius: '4px', color: 'var(--gold)', fontSize: '13px', cursor: 'pointer',
            }}
          >
            <Plus size={14} /> 새 공지
          </button>
        )}
      </div>

      {error && (
        <div
          style={{
            padding: '10px 14px',
            marginBottom: 16,
            background: 'rgba(170,68,68,0.1)',
            border: '1px solid rgba(170,68,68,0.3)',
            borderRadius: 4,
            color: '#ee6666',
            fontSize: '13px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ color: '#ee6666', cursor: 'pointer', background: 'none', border: 'none' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {showForm && (
        <div className="card p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif font-bold" style={{ color: '#c8a450', fontSize: '15px' }}>
              {creating ? '새 공지 작성' : '공지 수정'}
            </h3>
            <button onClick={cancelForm} style={{ color: '#555566', cursor: 'pointer' }}><X size={16} /></button>
          </div>
          <div className="space-y-3">
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="제목"
              style={{
                width: '100%', padding: '8px 12px', background: '#0d0b08', border: '1px solid var(--border)',
                borderRadius: '4px', color: '#c8a450', fontSize: '13px', outline: 'none',
              }}
            />
            <textarea
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="내용"
              rows={5}
              style={{
                width: '100%', padding: '8px 12px', background: '#0d0b08', border: '1px solid var(--border)',
                borderRadius: '4px', color: '#c8a450', fontSize: '13px', outline: 'none', resize: 'vertical',
              }}
            />
            <label className="flex items-center gap-2" style={{ color: '#7a6845', fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={e => setForm(f => ({ ...f, pinned: e.target.checked }))}
              />
              상단 고정
            </label>
            <div className="flex gap-2">
              <button
                onClick={creating ? handleCreate : handleUpdate}
                disabled={saving || !form.title.trim()}
                style={{
                  padding: '8px 20px', background: 'rgba(200,144,10,0.2)', border: '1px solid var(--gold-dim)',
                  borderRadius: '4px', color: 'var(--gold)', fontSize: '13px', cursor: 'pointer',
                  opacity: saving || !form.title.trim() ? 0.5 : 1,
                }}
              >
                {saving ? '저장 중...' : (creating ? '작성' : '수정')}
              </button>
              <button onClick={cancelForm} style={{
                padding: '8px 16px', border: '1px solid var(--border)', borderRadius: '4px',
                color: '#555566', fontSize: '13px', cursor: 'pointer',
              }}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2" style={{ color: '#555566', fontSize: '13px' }}>
          <Loader2 size={14} className="animate-spin" /> 로딩 중...
        </div>
      ) : items.length === 0 ? (
        <div className="card p-8 text-center" style={{ color: '#555566', fontSize: '13px' }}>
          공지가 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(a => (
            <div key={a.id} className="card p-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {a.pinned && <Pin size={12} style={{ color: 'var(--gold)' }} />}
                  <p style={{ color: '#c8a450', fontSize: '14px', fontWeight: 600 }}>{a.title}</p>
                </div>
                {a.content && (
                  <p style={{ color: '#7a6845', fontSize: '12px', marginTop: '4px', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {a.content.length > 200 ? a.content.slice(0, 200) + '...' : a.content}
                  </p>
                )}
                <p style={{ color: '#444455', fontSize: '11px', marginTop: '6px' }}>
                  {new Date(a.created_at).toLocaleDateString('ko-KR')}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => startEdit(a)} className="transition-opacity hover:opacity-70" style={{ color: '#7a6845', cursor: 'pointer' }}>
                  <Pencil size={14} />
                </button>
                <button onClick={() => setDeleteTarget(a)} className="transition-opacity hover:opacity-70" style={{ color: '#aa4444', cursor: 'pointer' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="공지 삭제"
        message={`"${deleteTarget?.title}" 공지를 삭제하시겠습니까?`}
        confirmLabel="삭제"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
