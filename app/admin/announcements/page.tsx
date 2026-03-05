'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, Pin, Pencil, X, Loader2 } from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'
import {
  AdminCard, AdminInput, AdminTextarea, AdminCheckbox,
  AdminButton, AdminIconButton,
  useToast, AdminToastContainer,
} from '@/components/admin'

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
  const { toasts, showToast, dismissToast } = useToast()

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
        showToast(`공지 작성 실패: ${err.error ?? res.statusText}`, 'error')
        return
      }
      setCreating(false)
      setForm({ title: '', content: '', pinned: false })
      showToast('공지가 작성되었습니다.', 'success')
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
        showToast(`공지 수정 실패: ${err.error ?? res.statusText}`, 'error')
        return
      }
      setEditing(null)
      setForm({ title: '', content: '', pinned: false })
      showToast('공지가 수정되었습니다.', 'success')
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
    showToast('공지가 삭제되었습니다.', 'success')
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
          <p style={{ color: '#555566', fontSize: '0.8125rem' }}>공지사항을 작성하고 관리합니다.</p>
        </div>
        {!showForm && (
          <AdminButton onClick={startCreate} variant="gold" size="sm">
            <Plus size={14} /> 새 공지
          </AdminButton>
        )}
      </div>

      {showForm && (
        <div className="mb-6">
          <AdminCard
            title={creating ? '새 공지 작성' : '공지 수정'}
            headerRight={
              <button onClick={cancelForm} style={{ color: '#555566', cursor: 'pointer', background: 'none', border: 'none' }}>
                <X size={16} />
              </button>
            }
          >
            <div className="space-y-3">
              <AdminInput
                label="제목"
                value={form.title}
                onChange={title => setForm(f => ({ ...f, title }))}
                placeholder="제목"
                required
              />
              <AdminTextarea
                label="내용"
                value={form.content}
                onChange={content => setForm(f => ({ ...f, content }))}
                placeholder="내용"
                rows={5}
              />
              <AdminCheckbox
                label="상단 고정"
                checked={form.pinned}
                onChange={pinned => setForm(f => ({ ...f, pinned }))}
              />
              <div className="flex gap-2">
                <AdminButton
                  onClick={creating ? handleCreate : handleUpdate}
                  variant="gold"
                  size="sm"
                  loading={saving}
                  disabled={saving || !form.title.trim()}
                >
                  {creating ? '작성' : '수정'}
                </AdminButton>
                <AdminButton onClick={cancelForm} variant="ghost" size="sm">
                  취소
                </AdminButton>
              </div>
            </div>
          </AdminCard>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2" style={{ color: '#555566', fontSize: '0.8125rem' }}>
          <Loader2 size={14} className="animate-spin" /> 로딩 중...
        </div>
      ) : items.length === 0 ? (
        <div className="card p-8 text-center" style={{ color: '#555566', fontSize: '0.8125rem' }}>
          공지가 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(a => (
            <div key={a.id} className="card p-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {a.pinned && <Pin size={12} style={{ color: 'var(--gold)' }} />}
                  <p style={{ color: '#c8a450', fontSize: '0.875rem', fontWeight: 600 }}>{a.title}</p>
                </div>
                {a.content && (
                  <p style={{ color: '#7a6845', fontSize: '0.75rem', marginTop: '4px', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {a.content.length > 200 ? a.content.slice(0, 200) + '...' : a.content}
                  </p>
                )}
                <p style={{ color: '#6a6a80', fontSize: '0.6875rem', marginTop: '6px' }}>
                  {new Date(a.created_at).toLocaleDateString('ko-KR')}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <AdminIconButton onClick={() => startEdit(a)} title="수정">
                  <Pencil size={14} />
                </AdminIconButton>
                <AdminIconButton onClick={() => setDeleteTarget(a)} variant="danger" title="삭제">
                  <Trash2 size={14} />
                </AdminIconButton>
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

      <AdminToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
