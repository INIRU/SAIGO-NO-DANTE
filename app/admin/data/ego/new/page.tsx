'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Save, ArrowLeft } from 'lucide-react'

interface Sinner {
  id: string
  name_kr: string
}

const GRADES = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH']
const SINS = ['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy']

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid var(--border)',
  borderRadius: '4px',
  color: '#c8a450',
  fontSize: '0.8125rem',
}

const labelStyle: React.CSSProperties = {
  color: '#555566',
  fontSize: '0.6875rem',
  marginBottom: '4px',
  display: 'block',
}

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
    await fetch('/api/admin/ego', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    router.push('/admin/data')
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2" style={{ color: '#555566', fontSize: '0.8125rem' }}>
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
          style={{ color: '#555566', cursor: 'pointer' }}
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="font-serif text-2xl font-bold" style={{ color: 'var(--gold)' }}>E.G.O 추가</h1>
          <p style={{ color: '#555566', fontSize: '0.8125rem' }}>새로운 E.G.O를 등록합니다.</p>
        </div>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <h2 className="font-serif font-bold" style={{ color: '#c8a450', fontSize: '0.9375rem', marginBottom: 16 }}>
          기본 정보
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>수감자</label>
            <select
              value={form.sinner_id}
              onChange={e => setForm(f => ({ ...f, sinner_id: e.target.value }))}
              style={inputStyle}
            >
              <option value="">-- 선택 --</option>
              {sinners.map(s => (
                <option key={s.id} value={s.id}>{s.name_kr}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>이름 (영문) *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              style={inputStyle}
              placeholder="e.g. Sunshower"
            />
          </div>

          <div>
            <label style={labelStyle}>이름 (한글)</label>
            <input
              type="text"
              value={form.name_kr}
              onChange={e => setForm(f => ({ ...f, name_kr: e.target.value }))}
              style={inputStyle}
              placeholder="e.g. 햇빛 소나기"
            />
          </div>

          <div>
            <label style={labelStyle}>등급 *</label>
            <select
              value={form.grade}
              onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}
              style={inputStyle}
            >
              {GRADES.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>죄악 친화도</label>
            <select
              value={form.sin_affinity}
              onChange={e => setForm(f => ({ ...f, sin_affinity: e.target.value }))}
              style={inputStyle}
            >
              <option value="">-- 없음 --</option>
              {SINS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>부식 위험도</label>
            <input
              type="text"
              value={form.corrosion_risk}
              onChange={e => setForm(f => ({ ...f, corrosion_risk: e.target.value }))}
              style={inputStyle}
              placeholder="e.g. Low"
            />
          </div>

          <div>
            <label style={labelStyle}>폴더명</label>
            <input
              type="text"
              value={form.folder_name}
              onChange={e => setForm(f => ({ ...f, folder_name: e.target.value }))}
              style={inputStyle}
              placeholder="e.g. yi-sang-sunshower"
            />
          </div>

          <div>
            <label style={labelStyle}>이미지 URL</label>
            <input
              type="text"
              value={form.image_url}
              onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
              style={inputStyle}
              placeholder="https://..."
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>설명</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={4}
              style={{ ...inputStyle, resize: 'vertical' }}
              placeholder="E.G.O 설명..."
            />
          </div>
        </div>

        <div style={{ marginTop: 24, display: 'flex', gap: 8 }}>
          <button
            onClick={() => router.push('/admin/data')}
            style={{
              padding: '8px 16px',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              color: '#555566',
              fontSize: '0.8125rem',
              cursor: 'pointer',
              background: 'transparent',
            }}
            className="transition-colors hover:bg-white/5"
          >
            돌아가기
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            className="flex items-center gap-2 transition-colors hover:opacity-80"
            style={{
              padding: '8px 20px',
              background: 'rgba(200,144,10,0.2)',
              border: '1px solid var(--gold-dim)',
              borderRadius: '4px',
              color: 'var(--gold)',
              fontSize: '0.8125rem',
              cursor: saving || !form.name.trim() ? 'not-allowed' : 'pointer',
              opacity: saving || !form.name.trim() ? 0.5 : 1,
            }}
          >
            <Save size={14} />
            {saving ? '저장 중...' : '추가'}
          </button>
        </div>
      </div>
    </div>
  )
}
