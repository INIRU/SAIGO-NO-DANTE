'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, Plus, Pencil, Trash2, Search, X } from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { AdminButton, AdminIconButton, AdminInput } from '@/components/admin'
import { AdminTextarea } from '@/components/admin/AdminInput'

interface KeywordRow {
  name: string
  description: string | null
  max_stack: number | null
}

export default function AdminKeywordsPage() {
  const [rows, setRows] = useState<KeywordRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editRow, setEditRow] = useState<KeywordRow | null>(null)
  const [addMode, setAddMode] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', max_stack: '' })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const fetchRows = useCallback(async (q?: string) => {
    const url = q ? `/api/admin/keywords?q=${encodeURIComponent(q)}` : '/api/admin/keywords'
    const res = await fetch(url)
    if (res.ok) setRows(await res.json())
  }, [])

  useEffect(() => {
    fetchRows().finally(() => setLoading(false))
  }, [fetchRows])

  const handleSearch = () => {
    setLoading(true)
    fetchRows(search).finally(() => setLoading(false))
  }

  const openAdd = () => {
    setEditRow(null)
    setForm({ name: '', description: '', max_stack: '' })
    setAddMode(true)
  }

  const openEdit = (row: KeywordRow) => {
    setAddMode(false)
    setEditRow(row)
    setForm({
      name: row.name,
      description: row.description ?? '',
      max_stack: row.max_stack?.toString() ?? '',
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (addMode) {
        const res = await fetch('/api/admin/keywords', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name.trim(),
            description: form.description || null,
            max_stack: form.max_stack ? parseInt(form.max_stack) : null,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          alert(err.error || '추가 실패')
          return
        }
      } else if (editRow) {
        const res = await fetch(`/api/admin/keywords/${encodeURIComponent(editRow.name)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: form.description || null,
            max_stack: form.max_stack ? parseInt(form.max_stack) : null,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          alert(err.error || '수정 실패')
          return
        }
      }
      setAddMode(false)
      setEditRow(null)
      await fetchRows(search)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await fetch(`/api/admin/keywords/${encodeURIComponent(deleteTarget)}`, { method: 'DELETE' })
    setDeleteTarget(null)
    await fetchRows(search)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 className="font-serif" style={{ color: 'var(--gold)', fontSize: '1.125rem' }}>
          키워드 관리
        </h1>
        <AdminButton onClick={openAdd} size="sm">
          <Plus size={13} /> 추가
        </AdminButton>
      </div>

      {/* 검색 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="키워드 검색..."
            style={{
              width: '100%',
              padding: '7px 32px 7px 12px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              color: '#c8a450',
              fontSize: '0.8125rem',
            }}
          />
          {search && (
            <button
              onClick={() => { setSearch(''); fetchRows() }}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}
            >
              <X size={14} />
            </button>
          )}
        </div>
        <AdminButton onClick={handleSearch} variant="ghost" size="sm">
          <Search size={13} />
        </AdminButton>
      </div>

      {/* 추가/수정 폼 */}
      {(addMode || editRow) && (
        <div style={{ background: 'rgba(200,144,10,0.05)', border: '1px solid var(--border)', borderRadius: 6, padding: 16, marginBottom: 16 }}>
          <p style={{ color: 'var(--gold)', fontSize: '0.8125rem', fontWeight: 700, marginBottom: 12 }}>
            {addMode ? '키워드 추가' : `"${editRow?.name}" 수정`}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {addMode && (
              <AdminInput
                label="키워드명"
                value={form.name}
                onChange={v => setForm(f => ({ ...f, name: v }))}
                placeholder="예: 출혈"
                required
              />
            )}
            <AdminTextarea
              label="설명"
              value={form.description}
              onChange={v => setForm(f => ({ ...f, description: v }))}
              rows={3}
              placeholder="키워드 설명"
            />
            <AdminInput
              label="최대 스택"
              type="number"
              value={form.max_stack}
              onChange={v => setForm(f => ({ ...f, max_stack: v }))}
              placeholder="없으면 비워두기"
              min={0}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <AdminButton onClick={handleSave} loading={saving} size="sm">
                저장
              </AdminButton>
              <AdminButton onClick={() => { setAddMode(false); setEditRow(null) }} variant="ghost" size="sm">
                취소
              </AdminButton>
            </div>
          </div>
        </div>
      )}

      {/* 목록 */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Loader2 size={20} className="animate-spin" style={{ color: 'var(--gold)' }} />
        </div>
      ) : (
        <>
          <p style={{ color: '#555566', fontSize: '0.6875rem', marginBottom: 8 }}>
            총 {rows.length}개
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {rows.map(row => (
              <div
                key={row.name}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '8px 12px',
                  background: 'rgba(0,0,0,0.15)',
                  borderRadius: 4,
                  border: '1px solid transparent',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#c8a450', fontSize: '0.8125rem', fontWeight: 600 }}>
                      {row.name}
                    </span>
                    {row.max_stack != null && (
                      <span style={{ color: '#555566', fontSize: '0.6875rem', fontFamily: 'var(--font-mono)' }}>
                        max {row.max_stack}
                      </span>
                    )}
                  </div>
                  {row.description && (
                    <p style={{ color: '#666677', fontSize: '0.75rem', marginTop: 2, lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                      {row.description}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <AdminIconButton onClick={() => openEdit(row)} title="수정">
                    <Pencil size={13} />
                  </AdminIconButton>
                  <AdminIconButton onClick={() => setDeleteTarget(row.name)} variant="danger" title="삭제">
                    <Trash2 size={13} />
                  </AdminIconButton>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="키워드 삭제"
        message={`"${deleteTarget}" 키워드를 삭제하시겠습니까?`}
        variant="danger"
        confirmLabel="삭제"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
