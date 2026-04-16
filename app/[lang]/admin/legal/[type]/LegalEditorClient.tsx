'use client'

import { useState } from 'react'
import { useRouter } from '@/lib/i18n/navigation'
import type { LegalDoc, LegalSection } from '@/lib/data/legal'
import { adminInputStyle, AdminButton } from '@/components/admin'
import { showSuccess, showError } from '@/lib/toast'

function SectionEditor({
  section, index, total,
  onChange, onDelete, onMove,
}: {
  section: LegalSection
  index: number
  total: number
  onChange: (s: LegalSection) => void
  onDelete: () => void
  onMove: (dir: -1 | 1) => void
}) {
  const addItem = () => onChange({ ...section, items: [...(section.items ?? []), ''] })
  const removeItem = (i: number) => {
    const items = (section.items ?? []).filter((_, j) => j !== i)
    onChange({ ...section, items })
  }
  const updateItem = (i: number, val: string) => {
    const items = (section.items ?? []).map((it, j) => j === i ? val : it)
    onChange({ ...section, items })
  }

  const inputStyle = adminInputStyle

  return (
    <div style={{ background: '#1a1510', border: '1px solid #2a2520', borderRadius: '6px', padding: '16px' }}>
      {/* 섹션 헤더 */}
      <div className="flex items-center gap-2 mb-3">
        <span style={{ color: '#666', fontSize: '0.6875rem', fontFamily: 'monospace', flexShrink: 0 }}>
          #{index + 1}
        </span>
        <input
          value={section.heading}
          onChange={e => onChange({ ...section, heading: e.target.value })}
          placeholder="제목"
          style={inputStyle}
        />
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={() => onMove(-1)} disabled={index === 0}
            style={{ padding: '4px 8px', fontSize: '0.75rem', background: '#252015', border: '1px solid #3a3020', borderRadius: '3px', color: index === 0 ? '#333' : '#888', cursor: index === 0 ? 'default' : 'pointer' }}>
            ↑
          </button>
          <button onClick={() => onMove(1)} disabled={index === total - 1}
            style={{ padding: '4px 8px', fontSize: '0.75rem', background: '#252015', border: '1px solid #3a3020', borderRadius: '3px', color: index === total - 1 ? '#333' : '#888', cursor: index === total - 1 ? 'default' : 'pointer' }}>
            ↓
          </button>
          <button onClick={onDelete}
            style={{ padding: '4px 8px', fontSize: '0.75rem', background: 'rgba(160,40,40,0.15)', border: '1px solid rgba(160,40,40,0.4)', borderRadius: '3px', color: '#cc5555', cursor: 'pointer' }}>
            ✕
          </button>
        </div>
      </div>

      {/* 본문 */}
      <textarea
        value={section.body ?? ''}
        onChange={e => onChange({ ...section, body: e.target.value || undefined })}
        placeholder="본문 (선택)"
        rows={3}
        style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.6' }}
      />

      {/* 목록 항목 */}
      <div className="mt-3 space-y-2">
        {(section.items ?? []).map((item, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={item}
              onChange={e => updateItem(i, e.target.value)}
              placeholder={`항목 ${i + 1}`}
              style={inputStyle}
            />
            <button onClick={() => removeItem(i)}
              style={{ flexShrink: 0, padding: '4px 10px', fontSize: '0.75rem', background: 'rgba(160,40,40,0.1)', border: '1px solid rgba(160,40,40,0.3)', borderRadius: '3px', color: '#cc5555', cursor: 'pointer' }}>
              −
            </button>
          </div>
        ))}
        <div className="flex items-center gap-3">
          <button onClick={addItem}
            style={{ fontSize: '0.75rem', color: '#888', border: '1px dashed #333', borderRadius: '3px', padding: '4px 12px', cursor: 'pointer', background: 'transparent' }}>
            + 항목 추가
          </button>
          {(section.items ?? []).length > 0 && (
            <label className="flex items-center gap-1.5" style={{ fontSize: '0.6875rem', color: '#666', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={section.itemAccent === 'red'}
                onChange={e => onChange({ ...section, itemAccent: e.target.checked ? 'red' : 'gold' })}
              />
              빨간 불릿
            </label>
          )}
        </div>
      </div>
    </div>
  )
}

export default function LegalEditorClient({ initial }: { initial: LegalDoc }) {
  const router = useRouter()
  const [doc, setDoc] = useState<LegalDoc>(initial)
  const [saving, setSaving] = useState(false)

  const updateSection = (i: number, s: LegalSection) => {
    const sections = doc.sections.map((sec, j) => j === i ? s : sec)
    setDoc({ ...doc, sections })
  }

  const deleteSection = (i: number) => {
    const sections = doc.sections.filter((_, j) => j !== i)
    setDoc({ ...doc, sections })
  }

  const moveSection = (i: number, dir: -1 | 1) => {
    const sections = [...doc.sections]
    const j = i + dir
    if (j < 0 || j >= sections.length) return
    ;[sections[i], sections[j]] = [sections[j], sections[i]]
    setDoc({ ...doc, sections })
  }

  const addSection = () => {
    setDoc({ ...doc, sections: [...doc.sections, { heading: '', body: '', items: [] }] })
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/legal', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc),
      })
      if (!res.ok) {
        const data = await res.json()
        showError(data.error ?? '저장 실패')
      } else {
        showSuccess('저장되었습니다.')
        router.refresh()
      }
    } catch {
      showError('네트워크 오류')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {/* 상단 메타 + 저장 */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <input
            value={doc.title}
            onChange={e => setDoc({ ...doc, title: e.target.value })}
            placeholder="문서 제목"
            style={{
              background: '#0d0b08', border: '1px solid #2a2520', borderRadius: '4px',
              padding: '6px 12px', color: '#c8a450', fontSize: '1rem', fontWeight: 'bold',
              outline: 'none', minWidth: '200px',
            }}
          />
          <input
            value={doc.last_updated}
            onChange={e => setDoc({ ...doc, last_updated: e.target.value })}
            placeholder="최종 수정일 (예: 2025년 1월 1일)"
            style={{
              background: '#0d0b08', border: '1px solid #2a2520', borderRadius: '4px',
              padding: '6px 12px', color: '#666677', fontSize: '0.75rem',
              outline: 'none', minWidth: '180px',
            }}
          />
        </div>
        <AdminButton onClick={save} variant="gold" size="sm" loading={saving} disabled={saving}>
          {saving ? '저장 중...' : '저장'}
        </AdminButton>
      </div>

      {/* 섹션 목록 */}
      <div className="space-y-3">
        {doc.sections.map((section, i) => (
          <SectionEditor
            key={i}
            section={section}
            index={i}
            total={doc.sections.length}
            onChange={s => updateSection(i, s)}
            onDelete={() => deleteSection(i)}
            onMove={dir => moveSection(i, dir)}
          />
        ))}
      </div>

      {/* 섹션 추가 */}
      <button
        onClick={addSection}
        className="w-full mt-4 py-3 transition-colors"
        style={{
          border: '1px dashed #2a2520', borderRadius: '6px',
          color: '#888888', fontSize: '0.8125rem', cursor: 'pointer',
          background: 'transparent',
        }}
      >
        + 섹션 추가
      </button>

    </div>
  )
}
