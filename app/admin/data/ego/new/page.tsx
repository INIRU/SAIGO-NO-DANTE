'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Save, ArrowLeft } from 'lucide-react'
import {
  AdminInput, AdminSelect, AdminTextarea,
  AdminButton,
  AdminCard,
  AdminFormSection,
} from '@/components/admin'
import { showSuccess, showError } from '@/lib/toast'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Sinner {
  id: string
  name_kr: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GRADES = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH']
const SINS = ['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy']
const CORROSION_OPTIONS = ['낮음', '보통', '높음', '매우 높음']

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NewEGOPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedSinner = searchParams.get('sinner') ?? ''
  const [form, setForm] = useState({
    sinner_id: preselectedSinner,
    name: '',
    name_kr: '',
    grade: 'ZAYIN',
    sin_affinity: '',
    description: '',
    corrosion_risk: '',
    folder_name: '',
    image_url: '',
  })
  const [sinners, setSinners] = useState<Sinner[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/admin/data')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data.sinners)) {
          setSinners(data.sinners)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  // Sync sinner_id if searchParam arrives after mount
  useEffect(() => {
    if (preselectedSinner) {
      setForm(f => ({ ...f, sinner_id: preselectedSinner }))
    }
  }, [preselectedSinner])

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const body = {
        sinner_id: form.sinner_id || null,
        name: form.name,
        name_kr: form.name_kr || null,
        grade: form.grade,
        sin_affinity: form.sin_affinity || null,
        description: form.description || null,
        corrosion_risk: form.corrosion_risk || null,
        folder_name: form.folder_name || null,
        image_url: form.image_url || null,
      }
      const res = await fetch('/api/admin/ego', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json()
        showError(d.error ?? '생성 실패')
      } else {
        const newEgo = await res.json()
        router.push(`/admin/data/ego/${newEgo.id}`)
      }
    } catch {
      showError('네트워크 오류')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2" style={{ color: '#888888', fontSize: '0.8125rem' }}>
        <Loader2 size={14} className="animate-spin" /> 로딩 중...
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/admin/data')}
          className="transition-opacity hover:opacity-70"
          style={{ color: '#888888', cursor: 'pointer' }}
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="font-serif text-2xl font-bold" style={{ color: 'var(--gold)' }}>E.G.O 추가</h1>
          <p style={{ color: '#888888', fontSize: '0.8125rem' }}>새로운 E.G.O를 등록합니다.</p>
        </div>
      </div>

      <AdminCard
        title="기본 정보"
        headerRight={
          <div style={{ display: 'flex', gap: 8 }}>
            <AdminButton variant="ghost" onClick={() => router.push('/admin/data')}>돌아가기</AdminButton>
            <AdminButton onClick={handleSave} loading={saving} disabled={!form.name.trim()}>
              <Save size={14} /> 추가
            </AdminButton>
          </div>
        }
      >
        <AdminFormSection columns={2}>
          <AdminSelect
            label="수감자"
            value={form.sinner_id}
            onChange={v => setForm(f => ({ ...f, sinner_id: v }))}
            options={sinners.map(s => ({ value: s.id, label: s.name_kr }))}
            placeholder="-- 선택 --"
          />
          <AdminInput
            label="이름 (영문)"
            required
            value={form.name}
            onChange={v => setForm(f => ({ ...f, name: v }))}
            placeholder="e.g. Sunshower"
          />
          <AdminInput
            label="이름 (한글)"
            value={form.name_kr}
            onChange={v => setForm(f => ({ ...f, name_kr: v }))}
            placeholder="e.g. 햇빛 소나기"
          />
          <AdminSelect
            label="등급"
            required
            value={form.grade}
            onChange={v => setForm(f => ({ ...f, grade: v }))}
            options={GRADES.map(g => ({ value: g, label: g }))}
          />
          <AdminSelect
            label="죄악 친화도"
            value={form.sin_affinity}
            onChange={v => setForm(f => ({ ...f, sin_affinity: v }))}
            options={SINS.map(s => ({ value: s, label: s }))}
            placeholder="-- 없음 --"
          />
          <AdminSelect
            label="부식 위험도"
            value={form.corrosion_risk}
            onChange={v => setForm(f => ({ ...f, corrosion_risk: v }))}
            options={CORROSION_OPTIONS.map(o => ({ value: o, label: o }))}
            placeholder="-- 선택 --"
          />
          <AdminInput
            label="폴더명"
            value={form.folder_name}
            onChange={v => setForm(f => ({ ...f, folder_name: v }))}
            placeholder="e.g. yi-sang-sunshower"
          />
          <AdminInput
            label="이미지 URL"
            value={form.image_url}
            onChange={v => setForm(f => ({ ...f, image_url: v }))}
            placeholder="https://..."
          />
          <div style={{ gridColumn: '1 / -1' }}>
            <AdminTextarea
              label="설명"
              value={form.description}
              onChange={v => setForm(f => ({ ...f, description: v }))}
              rows={4}
              placeholder="E.G.O 설명..."
            />
          </div>
        </AdminFormSection>
      </AdminCard>

    </div>
  )
}
