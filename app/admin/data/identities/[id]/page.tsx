'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, Save, ArrowLeft, Plus, Trash2, Pencil } from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Skill {
  id: string
  identity_id: string
  name: string
  skill_type: string
  sin_affinity: string
  coins: number | null
  base_power: number | null
  coin_power: number | null
  skill_order: number | null
  offense_level: number | null
  atk_weight: number | null
  description: string | null
}

interface Passive {
  id: string
  identity_id: string
  name: string
  passive_type: string
  sin_affinity: string | null
  sin_count: number | null
  active_cond: string | null
  description: string | null
  passive_order: number | null
}

interface Identity {
  id: string
  sinner_id: string
  name: string
  name_kr: string | null
  rarity: number | null
  tier: number | null
  hp: number | null
  speed_min: number | null
  speed_max: number | null
  def_level: number | null
  sin_affinity: string | null
  keywords: string | null
  game_id: string | null
  folder_name: string | null
  affiliation: string | null
  quote: string | null
  slash_res: string | null
  pierce_res: string | null
  blunt_res: string | null
  release_date: string | null
  acquisition: string | null
  skills: Skill[]
  passives: Passive[]
}

interface SinnerOption {
  id: string
  name_kr: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SIN_OPTIONS = ['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy']
const SKILL_TYPES = ['slash', 'pierce', 'blunt', 'evade', 'defense', 'counter']
const RES_OPTIONS = ['내성', '취약', '보통']
const ACTIVE_COND_OPTIONS = ['공명', '보유', '없음']

// ─── Style helpers ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid var(--border)',
  borderRadius: '4px',
  color: '#c8a450',
  fontSize: '13px',
}

const labelStyle: React.CSSProperties = {
  color: '#555566',
  fontSize: '11px',
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
  fontSize: '13px',
  cursor: 'pointer',
}

const btnSmall: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: '5px 10px',
  background: 'rgba(200,144,10,0.1)',
  border: '1px solid var(--border)',
  borderRadius: '4px',
  color: '#c8a450',
  fontSize: '12px',
  cursor: 'pointer',
}

const btnDanger: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: '5px 10px',
  background: 'rgba(170,68,68,0.1)',
  border: '1px solid rgba(170,68,68,0.4)',
  borderRadius: '4px',
  color: '#ee6666',
  fontSize: '12px',
  cursor: 'pointer',
}

// ─── Blank templates ──────────────────────────────────────────────────────────

function blankSkill(identity_id: string): Omit<Skill, 'id'> {
  return {
    identity_id,
    name: '',
    skill_type: 'slash',
    sin_affinity: 'wrath',
    coins: null,
    base_power: null,
    coin_power: null,
    skill_order: null,
    offense_level: null,
    atk_weight: null,
    description: null,
  }
}

function blankPassive(identity_id: string): Omit<Passive, 'id'> {
  return {
    identity_id,
    name: '',
    passive_type: 'battle',
    sin_affinity: null,
    sin_count: null,
    active_cond: '공명',
    description: null,
    passive_order: null,
  }
}

// ─── Skill form ───────────────────────────────────────────────────────────────

function SkillForm({
  value,
  onChange,
  onSave,
  onCancel,
  saving,
}: {
  value: Partial<Skill>
  onChange: (v: Partial<Skill>) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
}) {
  const set = (k: keyof Skill, v: string | number | null) => onChange({ ...value, [k]: v })
  const num = (v: string) => v === '' ? null : Number(v)

  return (
    <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '16px', marginTop: '8px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '12px' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>이름</label>
          <input style={inputStyle} value={value.name ?? ''} onChange={e => set('name', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>스킬 타입</label>
          <select style={inputStyle} value={value.skill_type ?? 'slash'} onChange={e => set('skill_type', e.target.value)}>
            {SKILL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>죄악 속성</label>
          <select style={inputStyle} value={value.sin_affinity ?? 'wrath'} onChange={e => set('sin_affinity', e.target.value)}>
            {SIN_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>코인 수</label>
          <input style={inputStyle} type="number" value={value.coins ?? ''} onChange={e => set('coins', num(e.target.value))} />
        </div>
        <div>
          <label style={labelStyle}>기본 위력</label>
          <input style={inputStyle} type="number" value={value.base_power ?? ''} onChange={e => set('base_power', num(e.target.value))} />
        </div>
        <div>
          <label style={labelStyle}>코인 위력</label>
          <input style={inputStyle} type="number" value={value.coin_power ?? ''} onChange={e => set('coin_power', num(e.target.value))} />
        </div>
        <div>
          <label style={labelStyle}>스킬 순서</label>
          <input style={inputStyle} type="number" value={value.skill_order ?? ''} onChange={e => set('skill_order', num(e.target.value))} />
        </div>
        <div>
          <label style={labelStyle}>공격 레벨</label>
          <input style={inputStyle} type="number" value={value.offense_level ?? ''} onChange={e => set('offense_level', num(e.target.value))} />
        </div>
        <div>
          <label style={labelStyle}>공격 가중치</label>
          <input style={inputStyle} type="number" value={value.atk_weight ?? ''} onChange={e => set('atk_weight', num(e.target.value))} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>설명</label>
          <textarea style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.6' }} rows={3} value={value.description ?? ''} onChange={e => set('description', e.target.value || null)} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button style={btnGold} onClick={onSave} disabled={saving}>
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} 저장
        </button>
        <button style={{ ...btnSmall, color: '#555566' }} onClick={onCancel}>취소</button>
      </div>
    </div>
  )
}

// ─── Passive form ─────────────────────────────────────────────────────────────

function PassiveForm({
  value,
  onChange,
  onSave,
  onCancel,
  saving,
}: {
  value: Partial<Passive>
  onChange: (v: Partial<Passive>) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
}) {
  const set = (k: keyof Passive, v: string | number | null) => onChange({ ...value, [k]: v })
  const num = (v: string) => v === '' ? null : Number(v)

  return (
    <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '16px', marginTop: '8px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '12px' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>이름</label>
          <input style={inputStyle} value={value.name ?? ''} onChange={e => set('name', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>패시브 타입</label>
          <select style={inputStyle} value={value.passive_type ?? 'battle'} onChange={e => set('passive_type', e.target.value)}>
            <option value="battle">battle</option>
            <option value="support">support</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>죄악 속성</label>
          <input style={inputStyle} value={value.sin_affinity ?? ''} onChange={e => set('sin_affinity', e.target.value || null)} placeholder="예: 분노" />
        </div>
        <div>
          <label style={labelStyle}>죄악 수</label>
          <input style={inputStyle} type="number" value={value.sin_count ?? ''} onChange={e => set('sin_count', num(e.target.value))} />
        </div>
        <div>
          <label style={labelStyle}>발동 조건</label>
          <select style={inputStyle} value={value.active_cond ?? '공명'} onChange={e => set('active_cond', e.target.value)}>
            {ACTIVE_COND_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>순서</label>
          <input style={inputStyle} type="number" value={value.passive_order ?? ''} onChange={e => set('passive_order', num(e.target.value))} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>설명</label>
          <textarea style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.6' }} rows={3} value={value.description ?? ''} onChange={e => set('description', e.target.value || null)} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button style={btnGold} onClick={onSave} disabled={saving}>
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} 저장
        </button>
        <button style={{ ...btnSmall, color: '#555566' }} onClick={onCancel}>취소</button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EditIdentityPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()

  // Identity form state
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [form, setForm] = useState<Partial<Identity>>({})
  const [sinners, setSinners] = useState<SinnerOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  // Skills
  const [skills, setSkills] = useState<Skill[]>([])
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)
  const [editingSkillDraft, setEditingSkillDraft] = useState<Partial<Skill>>({})
  const [newSkill, setNewSkill] = useState(false)
  const [newSkillDraft, setNewSkillDraft] = useState<Partial<Skill>>({})
  const [skillSaving, setSkillSaving] = useState(false)

  // Passives
  const [passives, setPassives] = useState<Passive[]>([])
  const [editingPassive, setEditingPassive] = useState<Passive | null>(null)
  const [editingPassiveDraft, setEditingPassiveDraft] = useState<Partial<Passive>>({})
  const [newPassive, setNewPassive] = useState(false)
  const [newPassiveDraft, setNewPassiveDraft] = useState<Partial<Passive>>({})
  const [passiveSaving, setPassiveSaving] = useState(false)

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'skill' | 'passive'; id: string; name: string } | null>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/identities/${id}`).then(r => r.json()),
      fetch('/api/admin/data').then(r => r.json()),
    ]).then(([identityData, adminData]) => {
      setIdentity(identityData)
      setForm(identityData)
      setSkills(identityData.skills ?? [])
      setPassives(identityData.passives ?? [])
      setSinners((adminData.sinners ?? []).map((s: SinnerOption) => ({ id: s.id, name_kr: s.name_kr })))
    }).finally(() => setLoading(false))
  }, [id])

  // ── Identity save ──

  const handleSave = async () => {
    setSaving(true)
    setSaveMsg('')
    try {
      const { skills: _s, passives: _p, id: _id, ...body } = form as Identity
      const res = await fetch(`/api/admin/identities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json()
        setSaveMsg(d.error ?? '저장 실패')
      } else {
        setSaveMsg('저장됨')
        setTimeout(() => setSaveMsg(''), 2000)
      }
    } catch {
      setSaveMsg('네트워크 오류')
    } finally {
      setSaving(false)
    }
  }

  // ── Skill handlers ──

  const handleStartEditSkill = (skill: Skill) => {
    setNewSkill(false)
    setEditingSkill(skill)
    setEditingSkillDraft({ ...skill })
  }

  const handleSaveSkill = async () => {
    setSkillSaving(true)
    try {
      const res = await fetch(`/api/admin/skills/${editingSkill!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingSkillDraft),
      })
      if (res.ok) {
        const updated = await res.json()
        setSkills(prev => prev.map(s => s.id === updated.id ? updated : s))
        setEditingSkill(null)
      }
    } finally {
      setSkillSaving(false)
    }
  }

  const handleAddSkill = async () => {
    setSkillSaving(true)
    try {
      const res = await fetch('/api/admin/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newSkillDraft, identity_id: id }),
      })
      if (res.ok) {
        const created = await res.json()
        setSkills(prev => [...prev, created])
        setNewSkill(false)
        setNewSkillDraft({})
      }
    } finally {
      setSkillSaving(false)
    }
  }

  const handleDeleteSkill = async () => {
    if (!deleteTarget || deleteTarget.type !== 'skill') return
    await fetch(`/api/admin/skills/${deleteTarget.id}`, { method: 'DELETE' })
    setSkills(prev => prev.filter(s => s.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  // ── Passive handlers ──

  const handleStartEditPassive = (passive: Passive) => {
    setNewPassive(false)
    setEditingPassive(passive)
    setEditingPassiveDraft({ ...passive })
  }

  const handleSavePassive = async () => {
    setPassiveSaving(true)
    try {
      const res = await fetch(`/api/admin/passives/${editingPassive!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingPassiveDraft),
      })
      if (res.ok) {
        const updated = await res.json()
        setPassives(prev => prev.map(p => p.id === updated.id ? updated : p))
        setEditingPassive(null)
      }
    } finally {
      setPassiveSaving(false)
    }
  }

  const handleAddPassive = async () => {
    setPassiveSaving(true)
    try {
      const res = await fetch('/api/admin/passives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newPassiveDraft, identity_id: id }),
      })
      if (res.ok) {
        const created = await res.json()
        setPassives(prev => [...prev, created])
        setNewPassive(false)
        setNewPassiveDraft({})
      }
    } finally {
      setPassiveSaving(false)
    }
  }

  const handleDeletePassive = async () => {
    if (!deleteTarget || deleteTarget.type !== 'passive') return
    await fetch(`/api/admin/passives/${deleteTarget.id}`, { method: 'DELETE' })
    setPassives(prev => prev.filter(p => p.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  // ── Field helpers ──

  const f = (k: keyof Identity) => (form as Record<string, unknown>)[k] as string ?? ''
  const setF = (k: keyof Identity, v: string | number | null) => setForm(prev => ({ ...prev, [k]: v }))
  const numF = (v: string) => v === '' ? null : Number(v)

  // ── Render ──

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#555566', fontSize: '13px' }}>
        <Loader2 size={14} className="animate-spin" /> 로딩 중...
      </div>
    )
  }

  if (!identity) {
    return <div style={{ color: '#ee6666', fontSize: '13px' }}>인격을 찾을 수 없습니다.</div>
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button
          onClick={() => router.back()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', color: '#555566', fontSize: '13px', cursor: 'pointer', padding: 0 }}
        >
          <ArrowLeft size={14} /> 뒤로
        </button>
        <h1 className="font-serif" style={{ color: 'var(--gold)', fontSize: '20px', fontWeight: 'bold' }}>
          인격 편집
        </h1>
        <span style={{ color: '#555566', fontSize: '12px' }}>{identity.name_kr ?? identity.name}</span>
      </div>

      {/* Basic Info Card */}
      <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
        <h2 className="font-serif" style={{ color: '#c8a450', marginBottom: '16px', fontSize: '15px', fontWeight: 'bold' }}>기본 정보</h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', marginBottom: '16px' }}>
          {/* sinner_id */}
          <div>
            <label style={labelStyle}>수감자</label>
            <select style={inputStyle} value={f('sinner_id')} onChange={e => setF('sinner_id', e.target.value)}>
              <option value="">선택</option>
              {sinners.map(s => <option key={s.id} value={s.id}>{s.name_kr}</option>)}
            </select>
          </div>

          {/* rarity */}
          <div>
            <label style={labelStyle}>등급</label>
            <select style={inputStyle} value={f('rarity')} onChange={e => setF('rarity', numF(e.target.value))}>
              <option value="">선택</option>
              <option value="1">1성</option>
              <option value="2">2성</option>
              <option value="3">3성</option>
            </select>
          </div>

          {/* name */}
          <div>
            <label style={labelStyle}>이름 (영문)</label>
            <input style={inputStyle} value={f('name')} onChange={e => setF('name', e.target.value)} />
          </div>

          {/* name_kr */}
          <div>
            <label style={labelStyle}>이름 (한글)</label>
            <input style={inputStyle} value={f('name_kr')} onChange={e => setF('name_kr', e.target.value)} />
          </div>

          {/* tier */}
          <div>
            <label style={labelStyle}>동기화 단계 (1–4)</label>
            <input style={inputStyle} type="number" min={1} max={4} value={f('tier')} onChange={e => setF('tier', numF(e.target.value))} />
          </div>

          {/* hp */}
          <div>
            <label style={labelStyle}>HP</label>
            <input style={inputStyle} type="number" value={f('hp')} onChange={e => setF('hp', numF(e.target.value))} />
          </div>

          {/* speed_min */}
          <div>
            <label style={labelStyle}>속도 최소</label>
            <input style={inputStyle} type="number" value={f('speed_min')} onChange={e => setF('speed_min', numF(e.target.value))} />
          </div>

          {/* speed_max */}
          <div>
            <label style={labelStyle}>속도 최대</label>
            <input style={inputStyle} type="number" value={f('speed_max')} onChange={e => setF('speed_max', numF(e.target.value))} />
          </div>

          {/* def_level */}
          <div>
            <label style={labelStyle}>방어 레벨</label>
            <input style={inputStyle} type="number" value={f('def_level')} onChange={e => setF('def_level', numF(e.target.value))} />
          </div>

          {/* sin_affinity */}
          <div>
            <label style={labelStyle}>죄악 속성</label>
            <select style={inputStyle} value={f('sin_affinity')} onChange={e => setF('sin_affinity', e.target.value || null)}>
              <option value="">선택</option>
              {SIN_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* slash_res */}
          <div>
            <label style={labelStyle}>참격 내성</label>
            <select style={inputStyle} value={f('slash_res')} onChange={e => setF('slash_res', e.target.value || null)}>
              <option value="">선택</option>
              {RES_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {/* pierce_res */}
          <div>
            <label style={labelStyle}>관통 내성</label>
            <select style={inputStyle} value={f('pierce_res')} onChange={e => setF('pierce_res', e.target.value || null)}>
              <option value="">선택</option>
              {RES_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {/* blunt_res */}
          <div>
            <label style={labelStyle}>타격 내성</label>
            <select style={inputStyle} value={f('blunt_res')} onChange={e => setF('blunt_res', e.target.value || null)}>
              <option value="">선택</option>
              {RES_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {/* game_id */}
          <div>
            <label style={labelStyle}>게임 ID</label>
            <input style={inputStyle} value={f('game_id')} onChange={e => setF('game_id', e.target.value || null)} />
          </div>

          {/* folder_name */}
          <div>
            <label style={labelStyle}>폴더명</label>
            <input style={inputStyle} value={f('folder_name')} onChange={e => setF('folder_name', e.target.value || null)} />
          </div>

          {/* affiliation */}
          <div>
            <label style={labelStyle}>소속</label>
            <input style={inputStyle} value={f('affiliation')} onChange={e => setF('affiliation', e.target.value || null)} />
          </div>

          {/* keywords */}
          <div>
            <label style={labelStyle}>키워드 (쉼표 구분)</label>
            <input style={inputStyle} value={f('keywords')} onChange={e => setF('keywords', e.target.value || null)} />
          </div>

          {/* release_date */}
          <div>
            <label style={labelStyle}>출시일</label>
            <input style={inputStyle} value={f('release_date')} onChange={e => setF('release_date', e.target.value || null)} />
          </div>

          {/* acquisition */}
          <div>
            <label style={labelStyle}>획득 방법</label>
            <input style={inputStyle} value={f('acquisition')} onChange={e => setF('acquisition', e.target.value || null)} />
          </div>

          {/* quote */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>대사</label>
            <textarea
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.6' }}
              rows={3}
              value={f('quote')}
              onChange={e => setF('quote', e.target.value || null)}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button style={btnGold} onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} 저장
          </button>
          {saveMsg && (
            <span style={{ fontSize: '12px', color: saveMsg === '저장됨' ? '#44aa66' : '#ee6666' }}>
              {saveMsg === '저장됨' ? '✓ ' : ''}{saveMsg}
            </span>
          )}
        </div>
      </div>

      {/* Skills Card */}
      <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 className="font-serif" style={{ color: '#c8a450', fontSize: '15px', fontWeight: 'bold' }}>스킬</h2>
          <button
            style={btnSmall}
            onClick={() => {
              setEditingSkill(null)
              setNewSkillDraft(blankSkill(id))
              setNewSkill(true)
            }}
          >
            <Plus size={13} /> 추가
          </button>
        </div>

        {skills.length === 0 && !newSkill && (
          <p style={{ color: '#555566', fontSize: '12px' }}>스킬이 없습니다.</p>
        )}

        {skills.map(skill => (
          <div key={skill.id}>
            {editingSkill?.id === skill.id ? (
              <SkillForm
                value={editingSkillDraft}
                onChange={setEditingSkillDraft}
                onSave={handleSaveSkill}
                onCancel={() => setEditingSkill(null)}
                saving={skillSaving}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid rgba(58,42,21,0.3)' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ color: '#c8a450', fontSize: '13px', fontWeight: 600 }}>{skill.name}</span>
                  <span style={{ color: '#555566', fontSize: '11px', marginLeft: '8px' }}>{skill.skill_type} · {skill.sin_affinity}</span>
                  {skill.coins != null && (
                    <span style={{ color: '#555566', fontSize: '11px', marginLeft: '8px' }}>코인:{skill.coins} 위력:{skill.base_power}/{skill.coin_power}</span>
                  )}
                </div>
                <button style={btnSmall} onClick={() => handleStartEditSkill(skill)}>
                  <Pencil size={12} />
                </button>
                <button style={btnDanger} onClick={() => setDeleteTarget({ type: 'skill', id: skill.id, name: skill.name })}>
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </div>
        ))}

        {newSkill && (
          <SkillForm
            value={newSkillDraft}
            onChange={setNewSkillDraft}
            onSave={handleAddSkill}
            onCancel={() => { setNewSkill(false); setNewSkillDraft({}) }}
            saving={skillSaving}
          />
        )}
      </div>

      {/* Passives Card */}
      <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 className="font-serif" style={{ color: '#c8a450', fontSize: '15px', fontWeight: 'bold' }}>패시브</h2>
          <button
            style={btnSmall}
            onClick={() => {
              setEditingPassive(null)
              setNewPassiveDraft(blankPassive(id))
              setNewPassive(true)
            }}
          >
            <Plus size={13} /> 추가
          </button>
        </div>

        {passives.length === 0 && !newPassive && (
          <p style={{ color: '#555566', fontSize: '12px' }}>패시브가 없습니다.</p>
        )}

        {passives.map(passive => (
          <div key={passive.id}>
            {editingPassive?.id === passive.id ? (
              <PassiveForm
                value={editingPassiveDraft}
                onChange={setEditingPassiveDraft}
                onSave={handleSavePassive}
                onCancel={() => setEditingPassive(null)}
                saving={passiveSaving}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid rgba(58,42,21,0.3)' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ color: '#c8a450', fontSize: '13px', fontWeight: 600 }}>{passive.name}</span>
                  <span style={{ color: '#555566', fontSize: '11px', marginLeft: '8px' }}>{passive.passive_type}</span>
                  {passive.sin_affinity && (
                    <span style={{ color: '#555566', fontSize: '11px', marginLeft: '8px' }}>{passive.sin_affinity} {passive.sin_count ?? ''} {passive.active_cond ?? ''}</span>
                  )}
                </div>
                <button style={btnSmall} onClick={() => handleStartEditPassive(passive)}>
                  <Pencil size={12} />
                </button>
                <button style={btnDanger} onClick={() => setDeleteTarget({ type: 'passive', id: passive.id, name: passive.name })}>
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </div>
        ))}

        {newPassive && (
          <PassiveForm
            value={newPassiveDraft}
            onChange={setNewPassiveDraft}
            onSave={handleAddPassive}
            onCancel={() => { setNewPassive(false); setNewPassiveDraft({}) }}
            saving={passiveSaving}
          />
        )}
      </div>

      {/* Delete confirmation modal */}
      <ConfirmModal
        open={deleteTarget !== null}
        title="삭제 확인"
        message={deleteTarget ? `"${deleteTarget.name}"을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.` : ''}
        confirmLabel="삭제"
        variant="danger"
        onConfirm={() => {
          if (deleteTarget?.type === 'skill') handleDeleteSkill()
          else if (deleteTarget?.type === 'passive') handleDeletePassive()
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
