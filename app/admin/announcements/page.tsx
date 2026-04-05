'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2, Pin, Pencil, X, Loader2 } from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'
import {
  AdminCard, AdminInput, AdminTextarea, AdminCheckbox,
  AdminButton, AdminIconButton,
} from '@/components/admin'
import { showSuccess, showError } from '@/lib/toast'
import { createAnnouncementSchema } from '@/lib/schemas/admin'

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
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null)

  interface AnnouncementFormValues {
    title: string
    content: string
    pinned: boolean
  }

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AnnouncementFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createAnnouncementSchema) as any,
    defaultValues: { title: '', content: '', pinned: false },
  })

  const fetchItems = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/announcements')
    const data = await res.json()
    setItems(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { fetchItems() }, [])

  const onSubmit = handleSubmit(async (data) => {
    if (creating) {
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        showError(`공지 작성 실패: ${err.error ?? res.statusText}`)
        return
      }
      setCreating(false)
      reset({ title: '', content: '', pinned: false })
      showSuccess('공지가 작성되었습니다.')
      fetchItems()
    } else if (editing) {
      const res = await fetch(`/api/admin/announcements/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        showError(`공지 수정 실패: ${err.error ?? res.statusText}`)
        return
      }
      setEditing(null)
      reset({ title: '', content: '', pinned: false })
      showSuccess('공지가 수정되었습니다.')
      fetchItems()
    }
  })

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setDeleteTarget(null)
    await fetch(`/api/admin/announcements/${id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(a => a.id !== id))
    showSuccess('공지가 삭제되었습니다.')
  }, [deleteTarget])

  const startEdit = (a: Announcement) => {
    setEditing(a)
    setCreating(false)
    reset({ title: a.title, content: a.content, pinned: a.pinned })
  }

  const startCreate = () => {
    setCreating(true)
    setEditing(null)
    reset({ title: '', content: '', pinned: false })
  }

  const cancelForm = () => {
    setCreating(false)
    setEditing(null)
    reset({ title: '', content: '', pinned: false })
  }

  const showForm = creating || editing

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-bold mb-1" style={{ color: 'var(--gold)' }}>공지 관리</h1>
          <p style={{ color: '#888888', fontSize: '0.8125rem' }}>공지사항을 작성하고 관리합니다.</p>
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
              <button onClick={cancelForm} style={{ color: '#888888', cursor: 'pointer', background: 'none', border: 'none' }}>
                <X size={16} />
              </button>
            }
          >
            <form onSubmit={onSubmit}>
              <div className="space-y-3">
                <div>
                  <Controller
                    name="title"
                    control={control}
                    render={({ field }) => (
                      <AdminInput
                        label="제목"
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="제목"
                        required
                        error={errors.title?.message}
                      />
                    )}
                  />
                </div>
                <Controller
                  name="content"
                  control={control}
                  render={({ field }) => (
                    <AdminTextarea
                      label="내용"
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      placeholder="내용"
                      rows={5}
                    />
                  )}
                />
                <Controller
                  name="pinned"
                  control={control}
                  render={({ field }) => (
                    <AdminCheckbox
                      label="상단 고정"
                      checked={field.value ?? false}
                      onChange={field.onChange}
                    />
                  )}
                />
                <div className="flex gap-2">
                  <AdminButton
                    type="submit"
                    variant="gold"
                    size="sm"
                    loading={isSubmitting}
                    disabled={isSubmitting}
                  >
                    {creating ? '작성' : '수정'}
                  </AdminButton>
                  <AdminButton onClick={cancelForm} variant="ghost" size="sm">
                    취소
                  </AdminButton>
                </div>
              </div>
            </form>
          </AdminCard>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2" style={{ color: '#888888', fontSize: '0.8125rem' }}>
          <Loader2 size={14} className="animate-spin" /> 로딩 중...
        </div>
      ) : items.length === 0 ? (
        <div className="card p-8 text-center" style={{ color: '#888888', fontSize: '0.8125rem' }}>
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

    </div>
  )
}
