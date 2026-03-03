'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Save, ArrowLeft } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SinnerOption {
  id: string
  name_kr: string
}

interface IdentityForm {
  sinner_id: string
  name: string
  name_kr: string
  rarity: string
  tier: string
  hp: string
  speed_min: string
  speed_max: string
  def_level: string
  sin_affinity: string
  keywords: string
  game_id: string
  folder_name: string
  affiliation: string
  quote: string
  slash_res: string
  pierce_res: string
  blunt_res: string
  release_date: string
  acquisition: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SIN_OPTIONS = ['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy']
const RES_OPTIONS = ['내성', '취약', '보통']

// ─── Style helpers ────────────────────────────────────────────────────────────

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

const btnGold: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 16px',
  background: 'rgba(200,144,10,0.15)',
  border: '1px solid var(--gold)',
  borderRadius: '4px',
  color: 'var(--gold)',
  fontSize: '0.8125rem',
  cursor: 'pointer',
}

// ─── Blank form ───────────────────────────────────────────────────────────────

const BLANK_FORM: IdentityForm = {
  sinner_id: '',
  name: '',
  name_kr: '',
  rarity: '',
  tier: '',
  hp: '',
  speed_min: '',
  speed_max: '',
  def_level: '',
  sin_affinity: '',
  keywords: '',
  game_id: '',
  folder_name: '',
  affiliation: '',
  quote: '',
  slash_res: '',
  pierce_res: '',
  blunt_res: '',
  release_date: '',
  acquisition: '',
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NewIdentityPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [sinners, setSinners] = useState<SinnerOption[]>([])
  const [form, setForm] = useState<IdentityForm>({ ...BLANK_FORM, sinner_id: searchParams.get('sinner') ?? '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loadingSinners, setLoadingSinners] = useState(true)

  useEffect(() => {
    fetch('/api/admin/data')
      .then(r => r.json())
      .then(data => setSinners((data.sinners ?? []).map((s: SinnerOption) => ({ id: s.id, name_kr: s.name_kr }))))
      .finally(() => setLoadingSinners(false))
  }, [])

  const setF = (k: keyof IdentityForm, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const numOrNull = (v: string) => v.trim() === '' ? null : Number(v)
  const strOrNull = (v: string) => v.trim() === '' ? null : v.trim()

  const handleCreate = async () => {
    if (!form.sinner_id || !form.name || !form.rarity) {
      setError('수감자, 이름, 등급은 필수입니다.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/identities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sinner_id: form.sinner_id,
          name: form.name.trim(),
          name_kr: strOrNull(form.name_kr),
          rarity: Number(form.rarity),
          tier: numOrNull(form.tier),
          hp: numOrNull(form.hp),
          speed_min: numOrNull(form.speed_min),
          speed_max: numOrNull(form.speed_max),
          def_level: numOrNull(form.def_level),
          sin_affinity: strOrNull(form.sin_affinity),
          keywords: strOrNull(form.keywords),
          game_id: strOrNull(form.game_id),
          folder_name: strOrNull(form.folder_name),
          affiliation: strOrNull(form.affiliation),
          quote: strOrNull(form.quote),
          slash_res: strOrNull(form.slash_res),
          pierce_res: strOrNull(form.pierce_res),
          blunt_res: strOrNull(form.blunt_res),
          release_date: strOrNull(form.release_date),
          acquisition: strOrNull(form.acquisition),
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? '생성 실패')
      } else {
        const newIdentity = await res.json()
        router.push(`/admin/data/identities/${newIdentity.id}`)
      }
    } catch {
      setError('네트워크 오류')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button
          onClick={() => router.back()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', color: '#555566', fontSize: '0.8125rem', cursor: 'pointer', padding: 0 }}
        >
          <ArrowLeft size={14} /> 뒤로
        </button>
        <h1 className="font-serif" style={{ color: 'var(--gold)', fontSize: '1.25rem', fontWeight: 'bold' }}>
          인격 추가
        </h1>
      </div>

      {/* Form Card */}
      <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
        <h2 className="font-serif" style={{ color: '#c8a450', marginBottom: '16px', fontSize: '0.9375rem', fontWeight: 'bold' }}>기본 정보</h2>

        {loadingSinners ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#555566', fontSize: '0.8125rem', marginBottom: '16px' }}>
            <Loader2 size={13} className="animate-spin" /> 수감자 목록 로딩 중...
          </div>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', marginBottom: '16px' }}>
          {/* sinner_id */}
          <div>
            <label style={labelStyle}>수감자 *</label>
            <select style={inputStyle} value={form.sinner_id} onChange={e => setF('sinner_id', e.target.value)}>
              <option value="">선택</option>
              {sinners.map(s => <option key={s.id} value={s.id}>{s.name_kr}</option>)}
            </select>
          </div>

          {/* rarity */}
          <div>
            <label style={labelStyle}>등급 *</label>
            <select style={inputStyle} value={form.rarity} onChange={e => setF('rarity', e.target.value)}>
              <option value="">선택</option>
              <option value="1">1성</option>
              <option value="2">2성</option>
              <option value="3">3성</option>
            </select>
          </div>

          {/* name */}
          <div>
            <label style={labelStyle}>이름 (영문) *</label>
            <input style={inputStyle} value={form.name} onChange={e => setF('name', e.target.value)} placeholder="예: LCB Sinner" />
          </div>

          {/* name_kr */}
          <div>
            <label style={labelStyle}>이름 (한글)</label>
            <input style={inputStyle} value={form.name_kr} onChange={e => setF('name_kr', e.target.value)} placeholder="예: LCB 수감자" />
          </div>

          {/* tier */}
          <div>
            <label style={labelStyle}>동기화 단계 (1–4)</label>
            <input style={inputStyle} type="number" min={1} max={4} value={form.tier} onChange={e => setF('tier', e.target.value)} />
          </div>

          {/* hp */}
          <div>
            <label style={labelStyle}>HP</label>
            <input style={inputStyle} type="number" value={form.hp} onChange={e => setF('hp', e.target.value)} />
          </div>

          {/* speed_min */}
          <div>
            <label style={labelStyle}>속도 최소</label>
            <input style={inputStyle} type="number" value={form.speed_min} onChange={e => setF('speed_min', e.target.value)} />
          </div>

          {/* speed_max */}
          <div>
            <label style={labelStyle}>속도 최대</label>
            <input style={inputStyle} type="number" value={form.speed_max} onChange={e => setF('speed_max', e.target.value)} />
          </div>

          {/* def_level */}
          <div>
            <label style={labelStyle}>방어 레벨</label>
            <input style={inputStyle} type="number" value={form.def_level} onChange={e => setF('def_level', e.target.value)} />
          </div>

          {/* sin_affinity */}
          <div>
            <label style={labelStyle}>죄악 속성</label>
            <select style={inputStyle} value={form.sin_affinity} onChange={e => setF('sin_affinity', e.target.value)}>
              <option value="">선택</option>
              {SIN_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* slash_res */}
          <div>
            <label style={labelStyle}>참격 내성</label>
            <select style={inputStyle} value={form.slash_res} onChange={e => setF('slash_res', e.target.value)}>
              <option value="">선택</option>
              {RES_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {/* pierce_res */}
          <div>
            <label style={labelStyle}>관통 내성</label>
            <select style={inputStyle} value={form.pierce_res} onChange={e => setF('pierce_res', e.target.value)}>
              <option value="">선택</option>
              {RES_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {/* blunt_res */}
          <div>
            <label style={labelStyle}>타격 내성</label>
            <select style={inputStyle} value={form.blunt_res} onChange={e => setF('blunt_res', e.target.value)}>
              <option value="">선택</option>
              {RES_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {/* game_id */}
          <div>
            <label style={labelStyle}>게임 ID</label>
            <input style={inputStyle} value={form.game_id} onChange={e => setF('game_id', e.target.value)} />
          </div>

          {/* folder_name */}
          <div>
            <label style={labelStyle}>폴더명</label>
            <input style={inputStyle} value={form.folder_name} onChange={e => setF('folder_name', e.target.value)} />
          </div>

          {/* affiliation */}
          <div>
            <label style={labelStyle}>소속</label>
            <input style={inputStyle} value={form.affiliation} onChange={e => setF('affiliation', e.target.value)} />
          </div>

          {/* keywords */}
          <div>
            <label style={labelStyle}>키워드 (쉼표 구분)</label>
            <input style={inputStyle} value={form.keywords} onChange={e => setF('keywords', e.target.value)} placeholder="예: 검계, 출혈" />
          </div>

          {/* release_date */}
          <div>
            <label style={labelStyle}>출시일</label>
            <input style={inputStyle} value={form.release_date} onChange={e => setF('release_date', e.target.value)} placeholder="예: 2023-02-27" />
          </div>

          {/* acquisition */}
          <div>
            <label style={labelStyle}>획득 방법</label>
            <input style={inputStyle} value={form.acquisition} onChange={e => setF('acquisition', e.target.value)} />
          </div>

          {/* quote */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>대사</label>
            <textarea
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.6' }}
              rows={3}
              value={form.quote}
              onChange={e => setF('quote', e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button style={btnGold} onClick={handleCreate} disabled={saving}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} 인격 생성
          </button>
          {error && <span style={{ color: '#ee6666', fontSize: '0.75rem' }}>{error}</span>}
        </div>

        <p style={{ color: '#555566', fontSize: '0.6875rem', marginTop: '12px' }}>
          * 필수 항목. 생성 후 스킬과 패시브를 추가할 수 있습니다.
        </p>
      </div>
    </div>
  )
}
