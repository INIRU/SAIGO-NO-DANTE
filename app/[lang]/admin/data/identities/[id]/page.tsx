'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, Save, ArrowLeft, Plus, Trash2, Pencil } from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'
import {
  AdminInput, AdminSelect, AdminTextarea,
  AdminButton, AdminIconButton,
  AdminCard,
  AdminFormSection,
} from '@/components/admin'
import { showSuccess, showError } from '@/lib/toast'

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
const KR_SIN_OPTIONS = [
  { value: '분노', label: '분노' },
  { value: '색욕', label: '색욕' },
  { value: '나태', label: '나태' },
  { value: '탐식', label: '탐식' },
  { value: '우울', label: '우울' },
  { value: '오만', label: '오만' },
  { value: '질투', label: '질투' },
]

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
      <AdminFormSection columns={3}>
        <div style={{ gridColumn: '1 / -1' }}>
          <AdminInput
            label="이름"
            value={value.name ?? ''}
            onChange={v => set('name', v)}
          />
        </div>
        <AdminSelect
          label="스킬 타입"
          value={value.skill_type ?? 'slash'}
          onChange={v => set('skill_type', v)}
          options={SKILL_TYPES.map(t => ({ value: t, label: t }))}
        />
        <AdminSelect
          label="죄악 속성"
          value={value.sin_affinity ?? 'wrath'}
          onChange={v => set('sin_affinity', v)}
          options={SIN_OPTIONS.map(s => ({ value: s, label: s }))}
        />
        <AdminInput
          label="코인 수"
          type="number"
          value={value.coins ?? ''}
          onChange={v => set('coins', num(v))}
        />
        <AdminInput
          label="기본 위력"
          type="number"
          value={value.base_power ?? ''}
          onChange={v => set('base_power', num(v))}
        />
        <AdminInput
          label="코인 위력"
          type="number"
          value={value.coin_power ?? ''}
          onChange={v => set('coin_power', num(v))}
        />
        <AdminInput
          label="스킬 순서"
          type="number"
          value={value.skill_order ?? ''}
          onChange={v => set('skill_order', num(v))}
        />
        <AdminInput
          label="공격 레벨"
          type="number"
          value={value.offense_level ?? ''}
          onChange={v => set('offense_level', num(v))}
        />
        <AdminInput
          label="공격 가중치"
          type="number"
          value={value.atk_weight ?? ''}
          onChange={v => set('atk_weight', num(v))}
        />
        <div style={{ gridColumn: '1 / -1' }}>
          <AdminTextarea
            label="설명"
            value={value.description ?? ''}
            onChange={v => set('description', v || null)}
            rows={3}
          />
        </div>
      </AdminFormSection>
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <AdminButton onClick={onSave} loading={saving}>
          <Save size={13} /> 저장
        </AdminButton>
        <AdminButton variant="ghost" onClick={onCancel}>취소</AdminButton>
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
      <AdminFormSection columns={3}>
        <div style={{ gridColumn: '1 / -1' }}>
          <AdminInput
            label="이름"
            value={value.name ?? ''}
            onChange={v => set('name', v)}
          />
        </div>
        <AdminSelect
          label="패시브 타입"
          value={value.passive_type ?? 'battle'}
          onChange={v => set('passive_type', v)}
          options={[
            { value: 'battle', label: 'battle' },
            { value: 'support', label: 'support' },
          ]}
        />
        <AdminSelect
          label="죄악 속성"
          value={value.sin_affinity ?? ''}
          onChange={v => set('sin_affinity', v || null)}
          options={KR_SIN_OPTIONS}
          placeholder="없음"
        />
        <AdminInput
          label="죄악 수"
          type="number"
          value={value.sin_count ?? ''}
          onChange={v => set('sin_count', num(v))}
        />
        <AdminSelect
          label="발동 조건"
          value={value.active_cond ?? '공명'}
          onChange={v => set('active_cond', v)}
          options={ACTIVE_COND_OPTIONS.map(o => ({ value: o, label: o }))}
        />
        <AdminInput
          label="순서"
          type="number"
          value={value.passive_order ?? ''}
          onChange={v => set('passive_order', num(v))}
        />
        <div style={{ gridColumn: '1 / -1' }}>
          <AdminTextarea
            label="설명"
            value={value.description ?? ''}
            onChange={v => set('description', v || null)}
            rows={3}
          />
        </div>
      </AdminFormSection>
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <AdminButton onClick={onSave} loading={saving}>
          <Save size={13} /> 저장
        </AdminButton>
        <AdminButton variant="ghost" onClick={onCancel}>취소</AdminButton>
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
    try {
      const { skills: _s, passives: _p, id: _id, ...body } = form as Identity
      const res = await fetch(`/api/admin/identities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json()
        showError(d.error ?? '저장 실패')
      } else {
        showSuccess('저장됨')
      }
    } catch {
      showError('네트워크 오류')
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
        showSuccess('스킬 저장됨')
      } else {
        const d = await res.json()
        showError(d.error ?? '스킬 저장 실패')
      }
    } catch {
      showError('네트워크 오류')
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
        showSuccess('스킬 추가됨')
      } else {
        const d = await res.json()
        showError(d.error ?? '스킬 추가 실패')
      }
    } catch {
      showError('네트워크 오류')
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
        showSuccess('패시브 저장됨')
      } else {
        const d = await res.json()
        showError(d.error ?? '패시브 저장 실패')
      }
    } catch {
      showError('네트워크 오류')
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
        showSuccess('패시브 추가됨')
      } else {
        const d = await res.json()
        showError(d.error ?? '패시브 추가 실패')
      }
    } catch {
      showError('네트워크 오류')
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#888888', fontSize: '0.8125rem' }}>
        <Loader2 size={14} className="animate-spin" /> 로딩 중...
      </div>
    )
  }

  if (!identity) {
    return <div style={{ color: '#ee6666', fontSize: '0.8125rem' }}>인격을 찾을 수 없습니다.</div>
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button
          onClick={() => router.back()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', color: '#888888', fontSize: '0.8125rem', cursor: 'pointer', padding: 0 }}
        >
          <ArrowLeft size={14} /> 뒤로
        </button>
        <h1 className="font-serif" style={{ color: 'var(--gold)', fontSize: '1.25rem', fontWeight: 'bold' }}>
          인격 편집
        </h1>
        <span style={{ color: '#888888', fontSize: '0.75rem' }}>{identity.name_kr ?? identity.name}</span>
      </div>

      {/* Basic Info Card */}
      <AdminCard
        title="기본 정보"
        headerRight={
          <AdminButton onClick={handleSave} loading={saving}>
            <Save size={13} /> 저장
          </AdminButton>
        }
      >
        <AdminFormSection columns={2}>
          <AdminSelect
            label="수감자"
            value={f('sinner_id')}
            onChange={v => setF('sinner_id', v)}
            options={sinners.map(s => ({ value: s.id, label: s.name_kr }))}
            placeholder="선택"
          />
          <AdminSelect
            label="등급"
            value={f('rarity')}
            onChange={v => setF('rarity', numF(v))}
            options={[
              { value: '1', label: '1성' },
              { value: '2', label: '2성' },
              { value: '3', label: '3성' },
            ]}
            placeholder="선택"
          />
          <AdminInput
            label="이름 (영문)"
            value={f('name')}
            onChange={v => setF('name', v)}
          />
          <AdminInput
            label="이름 (한글)"
            value={f('name_kr')}
            onChange={v => setF('name_kr', v)}
          />
          <AdminInput
            label="동기화 단계 (1–4)"
            type="number"
            min={1}
            max={4}
            value={f('tier')}
            onChange={v => setF('tier', numF(v))}
          />
          <AdminInput
            label="HP"
            type="number"
            value={f('hp')}
            onChange={v => setF('hp', numF(v))}
          />
          <AdminInput
            label="속도 최소"
            type="number"
            value={f('speed_min')}
            onChange={v => setF('speed_min', numF(v))}
          />
          <AdminInput
            label="속도 최대"
            type="number"
            value={f('speed_max')}
            onChange={v => setF('speed_max', numF(v))}
          />
          <AdminInput
            label="방어 레벨"
            type="number"
            value={f('def_level')}
            onChange={v => setF('def_level', numF(v))}
          />
          <AdminSelect
            label="죄악 속성"
            value={f('sin_affinity')}
            onChange={v => setF('sin_affinity', v || null)}
            options={SIN_OPTIONS.map(s => ({ value: s, label: s }))}
            placeholder="선택"
          />
          <AdminSelect
            label="참격 내성"
            value={f('slash_res')}
            onChange={v => setF('slash_res', v || null)}
            options={RES_OPTIONS.map(o => ({ value: o, label: o }))}
            placeholder="선택"
          />
          <AdminSelect
            label="관통 내성"
            value={f('pierce_res')}
            onChange={v => setF('pierce_res', v || null)}
            options={RES_OPTIONS.map(o => ({ value: o, label: o }))}
            placeholder="선택"
          />
          <AdminSelect
            label="타격 내성"
            value={f('blunt_res')}
            onChange={v => setF('blunt_res', v || null)}
            options={RES_OPTIONS.map(o => ({ value: o, label: o }))}
            placeholder="선택"
          />
          <AdminInput
            label="게임 ID"
            value={f('game_id')}
            onChange={v => setF('game_id', v || null)}
          />
          <AdminInput
            label="폴더명"
            value={f('folder_name')}
            onChange={v => setF('folder_name', v || null)}
          />
          <AdminInput
            label="소속"
            value={f('affiliation')}
            onChange={v => setF('affiliation', v || null)}
          />
          <AdminInput
            label="키워드 (쉼표 구분)"
            value={f('keywords')}
            onChange={v => setF('keywords', v || null)}
          />
          <AdminInput
            label="출시일"
            value={f('release_date')}
            onChange={v => setF('release_date', v || null)}
          />
          <AdminInput
            label="획득 방법"
            value={f('acquisition')}
            onChange={v => setF('acquisition', v || null)}
          />
          <div style={{ gridColumn: '1 / -1' }}>
            <AdminTextarea
              label="대사"
              value={f('quote')}
              onChange={v => setF('quote', v || null)}
              rows={3}
            />
          </div>
        </AdminFormSection>
      </AdminCard>

      {/* Skills Card */}
      <AdminCard
        title="스킬"
        headerRight={
          <AdminButton
            size="sm"
            onClick={() => {
              setEditingSkill(null)
              setNewSkillDraft(blankSkill(id))
              setNewSkill(true)
            }}
          >
            <Plus size={13} /> 추가
          </AdminButton>
        }
      >
        {skills.length === 0 && !newSkill && (
          <p style={{ color: '#888888', fontSize: '0.75rem' }}>스킬이 없습니다.</p>
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
                  <span style={{ color: '#c8a450', fontSize: '0.8125rem', fontWeight: 600 }}>{skill.name}</span>
                  <span style={{ color: '#888888', fontSize: '0.6875rem', marginLeft: '8px' }}>{skill.skill_type} · {skill.sin_affinity}</span>
                  {skill.coins != null && (
                    <span style={{ color: '#888888', fontSize: '0.6875rem', marginLeft: '8px' }}>코인:{skill.coins} 위력:{skill.base_power}/{skill.coin_power}</span>
                  )}
                </div>
                <AdminButton size="sm" variant="ghost" onClick={() => handleStartEditSkill(skill)}>
                  <Pencil size={12} />
                </AdminButton>
                <AdminButton size="sm" variant="danger" onClick={() => setDeleteTarget({ type: 'skill', id: skill.id, name: skill.name })}>
                  <Trash2 size={12} />
                </AdminButton>
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
      </AdminCard>

      {/* Passives Card */}
      <AdminCard
        title="패시브"
        headerRight={
          <AdminButton
            size="sm"
            onClick={() => {
              setEditingPassive(null)
              setNewPassiveDraft(blankPassive(id))
              setNewPassive(true)
            }}
          >
            <Plus size={13} /> 추가
          </AdminButton>
        }
      >
        {passives.length === 0 && !newPassive && (
          <p style={{ color: '#888888', fontSize: '0.75rem' }}>패시브가 없습니다.</p>
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
                  <span style={{ color: '#c8a450', fontSize: '0.8125rem', fontWeight: 600 }}>{passive.name}</span>
                  <span style={{ color: '#888888', fontSize: '0.6875rem', marginLeft: '8px' }}>{passive.passive_type}</span>
                  {passive.sin_affinity && (
                    <span style={{ color: '#888888', fontSize: '0.6875rem', marginLeft: '8px' }}>{passive.sin_affinity} {passive.sin_count ?? ''} {passive.active_cond ?? ''}</span>
                  )}
                </div>
                <AdminButton size="sm" variant="ghost" onClick={() => handleStartEditPassive(passive)}>
                  <Pencil size={12} />
                </AdminButton>
                <AdminButton size="sm" variant="danger" onClick={() => setDeleteTarget({ type: 'passive', id: passive.id, name: passive.name })}>
                  <Trash2 size={12} />
                </AdminButton>
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
      </AdminCard>

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
