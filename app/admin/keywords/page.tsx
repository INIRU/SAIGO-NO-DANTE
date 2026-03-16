'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { Loader2, Plus, Pencil, Trash2, Search, X, Tags } from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { AdminButton, AdminIconButton, AdminInput } from '@/components/admin'
import { AdminTextarea, AdminSelect } from '@/components/admin/AdminInput'

const ICON_BASE = 'https://lpgqcleszdlldneiwgep.supabase.co/storage/v1/object/public/limbus-assets/icons/keywords'

const SIN_COLORS: Record<string, string> = {
  wrath:    '#c83030',
  lust:     '#d06030',
  sloth:    '#d4b830',
  gluttony: '#88b028',
  gloom:    '#4898b0',
  pride:    '#3870b0',
  envy:     '#8058a8',
}

const SIN_KR: Record<string, string> = {
  wrath:    '분노',
  lust:     '색욕',
  sloth:    '나태',
  gluttony: '탐식',
  gloom:    '우울',
  pride:    '오만',
  envy:     '질투',
}

const SIN_OPTIONS = [
  { value: '',         label: '없음' },
  { value: 'wrath',    label: '분노' },
  { value: 'lust',     label: '색욕' },
  { value: 'sloth',    label: '나태' },
  { value: 'gluttony', label: '탐식' },
  { value: 'gloom',    label: '우울' },
  { value: 'pride',    label: '오만' },
  { value: 'envy',     label: '질투' },
]

interface KeywordRow {
  name: string
  description: string | null
  max_stack: number | null
  icon_slug: string | null
  sin_affinity: string | null
}

function KeywordIcon({ icon_slug, size = 32 }: { icon_slug: string | null; size?: number }) {
  const [errored, setErrored] = useState(false)
  if (!icon_slug || errored) {
    return (
      <span style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        color: '#444455',
        flexShrink: 0,
      }}>
        <Tags size={size * 0.625} />
      </span>
    )
  }
  return (
    <Image
      src={`${ICON_BASE}/${icon_slug}.webp`}
      alt={icon_slug}
      width={size}
      height={size}
      unoptimized
      onError={() => setErrored(true)}
      style={{ objectFit: 'contain', flexShrink: 0 }}
    />
  )
}

function SinDot({ sin }: { sin: string }) {
  const color = SIN_COLORS[sin]
  const label = SIN_KR[sin]
  if (!color) return null
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        boxShadow: `0 0 4px ${color}88`,
      }} />
      <span style={{ color, fontSize: '0.6875rem', fontWeight: 600 }}>{label}</span>
    </span>
  )
}

export default function AdminKeywordsPage() {
  const [rows, setRows] = useState<KeywordRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editRow, setEditRow] = useState<KeywordRow | null>(null)
  const [addMode, setAddMode] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', max_stack: '', icon_slug: '', sin_affinity: '' })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [iconPreviewErr, setIconPreviewErr] = useState(false)

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
    setForm({ name: '', description: '', max_stack: '', icon_slug: '', sin_affinity: '' })
    setIconPreviewErr(false)
    setAddMode(true)
  }

  const openEdit = (row: KeywordRow) => {
    setAddMode(false)
    setEditRow(row)
    setIconPreviewErr(false)
    setForm({
      name: row.name,
      description: row.description ?? '',
      max_stack: row.max_stack?.toString() ?? '',
      icon_slug: row.icon_slug ?? '',
      sin_affinity: row.sin_affinity ?? '',
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
            icon_slug: form.icon_slug.trim() || null,
            sin_affinity: form.sin_affinity.trim() || null,
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
            icon_slug: form.icon_slug.trim() || null,
            sin_affinity: form.sin_affinity.trim() || null,
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

  // Stats
  const countWithIcon = rows.filter(r => r.icon_slug).length
  const countWithSin = rows.filter(r => r.sin_affinity).length

  const iconPreviewSlug = form.icon_slug.trim()

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 className="font-serif" style={{ color: 'var(--gold)', fontSize: '1.125rem' }}>
            키워드 관리
          </h1>
          {/* Stat badges */}
          {!loading && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{
                padding: '2px 8px',
                background: 'rgba(200,144,10,0.1)',
                border: '1px solid rgba(200,144,10,0.25)',
                borderRadius: 999,
                color: '#c8a450',
                fontSize: '0.6875rem',
                fontFamily: 'var(--font-mono)',
              }}>
                총 {rows.length}개
              </span>
              <span style={{
                padding: '2px 8px',
                background: 'rgba(68,136,68,0.1)',
                border: '1px solid rgba(68,136,68,0.25)',
                borderRadius: 999,
                color: '#449944',
                fontSize: '0.6875rem',
                fontFamily: 'var(--font-mono)',
              }}>
                아이콘 {countWithIcon}
              </span>
              <span style={{
                padding: '2px 8px',
                background: 'rgba(136,88,168,0.1)',
                border: '1px solid rgba(136,88,168,0.25)',
                borderRadius: 999,
                color: '#8058a8',
                fontSize: '0.6875rem',
                fontFamily: 'var(--font-mono)',
              }}>
                죄악 {countWithSin}
              </span>
            </div>
          )}
        </div>
        <AdminButton onClick={openAdd} size="sm">
          <Plus size={13} /> 추가
        </AdminButton>
      </div>

      {/* Search */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={13} style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            color: '#888888', pointerEvents: 'none',
          }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="키워드 검색..."
            style={{
              width: '100%',
              padding: '8px 32px 8px 30px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border)',
              borderRadius: 6,
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

      {/* Add/Edit form */}
      {(addMode || editRow) && (
        <div style={{
          background: 'rgba(200,144,10,0.04)',
          border: '1px solid rgba(200,144,10,0.2)',
          borderRadius: 8,
          padding: 16,
          marginBottom: 20,
        }}>
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
            {/* Icon slug with preview */}
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <AdminInput
                    label="아이콘 슬러그 (icon_slug)"
                    value={form.icon_slug}
                    onChange={v => { setForm(f => ({ ...f, icon_slug: v })); setIconPreviewErr(false) }}
                    placeholder="예: bleed, tremor-burst"
                  />
                </div>
                {iconPreviewSlug && (
                  <div style={{
                    width: 40,
                    height: 40,
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginBottom: 0,
                  }}>
                    {iconPreviewErr ? (
                      <Tags size={18} style={{ color: '#444455' }} />
                    ) : (
                      <Image
                        src={`${ICON_BASE}/${iconPreviewSlug}.webp`}
                        alt="preview"
                        width={28}
                        height={28}
                        unoptimized
                        onError={() => setIconPreviewErr(true)}
                        style={{ objectFit: 'contain' }}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
            {/* Sin affinity dropdown */}
            <AdminSelect
              label="죄악 속성 (sin_affinity)"
              value={form.sin_affinity}
              onChange={v => setForm(f => ({ ...f, sin_affinity: v }))}
              options={SIN_OPTIONS}
              placeholder="없음"
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

      {/* Card grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Loader2 size={20} className="animate-spin" style={{ color: 'var(--gold)' }} />
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 10,
        }}>
          {rows.map(row => (
            <KeywordCard
              key={row.name}
              row={row}
              onEdit={() => openEdit(row)}
              onDelete={() => setDeleteTarget(row.name)}
            />
          ))}
        </div>
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

function KeywordCard({
  row,
  onEdit,
  onDelete,
}: {
  row: KeywordRow
  onEdit: () => void
  onDelete: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        background: '#1a1510',
        border: `1px solid ${hovered ? 'var(--gold-dim, #8a6010)' : 'var(--border)'}`,
        borderRadius: 8,
        padding: '12px 14px',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        transition: 'border-color 0.15s ease, filter 0.15s ease',
        filter: hovered ? 'brightness(1.08)' : 'brightness(1)',
        minHeight: 72,
      }}
    >
      {/* Icon */}
      <div style={{
        width: 36,
        height: 36,
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginTop: 1,
      }}>
        <KeywordIcon icon_slug={row.icon_slug} size={24} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          color: '#e8b030',
          fontSize: '0.8125rem',
          fontWeight: 700,
          display: 'block',
          marginBottom: 2,
        }}>
          {row.name}
        </span>
        {row.description && (
          <p style={{
            color: '#7a7a8a',
            fontSize: '0.6875rem',
            lineHeight: 1.55,
            marginBottom: 6,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {row.description}
          </p>
        )}
        {/* Badges */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
          {row.max_stack != null && (
            <span style={{
              padding: '1px 6px',
              background: 'rgba(200,144,10,0.12)',
              border: '1px solid rgba(200,144,10,0.2)',
              borderRadius: 999,
              color: '#a07820',
              fontSize: '0.625rem',
              fontFamily: 'var(--font-mono)',
            }}>
              최대 {row.max_stack}
            </span>
          )}
          {row.sin_affinity && <SinDot sin={row.sin_affinity} />}
        </div>
      </div>

      {/* Action buttons — appear on hover */}
      {hovered && (
        <div style={{
          position: 'absolute',
          top: 8,
          right: 8,
          display: 'flex',
          gap: 4,
        }}>
          <AdminIconButton onClick={onEdit} title="수정">
            <Pencil size={12} />
          </AdminIconButton>
          <AdminIconButton onClick={onDelete} variant="danger" title="삭제">
            <Trash2 size={12} />
          </AdminIconButton>
        </div>
      )}
    </div>
  )
}
