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

// ─── Types ────────────────────────────────────────────────────────────────────

interface Sinner {
  id: string
  name_kr: string
}

interface EGO {
  id: string
  sinner_id: string
  name: string
  name_kr: string | null
  grade: string
  sin_affinity: string | null
  description: string | null
  corrosion_risk: string | null
  folder_name: string | null
  image_url: string | null
  ego_skills?: EgoSkill[]
}

interface EgoSkill {
  id: string
  ego_id: string
  name: string
  skill_type: string
  sin_affinity: string | null
  base_power: number | null
  coin_power: number | null
  coins: number | null
  atk_weight: number | null
  skill_order: number | null
  offense_level: number | null
  description: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GRADES = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH']
const SINS = ['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy']
const SKILL_TYPES = ['slash', 'pierce', 'blunt', 'evade', 'defense', 'counter']
const CORROSION_OPTIONS = ['낮음', '보통', '높음', '매우 높음']

// ─── Blank EGO skill ──────────────────────────────────────────────────────────

function blankEgoSkill(ego_id: string): Omit<EgoSkill, 'id'> {
  return {
    ego_id,
    name: '',
    skill_type: 'slash',
    sin_affinity: null,
    base_power: null,
    coin_power: null,
    coins: null,
    atk_weight: null,
    skill_order: null,
    offense_level: null,
    description: null,
  }
}

// ─── EgoSkill form ────────────────────────────────────────────────────────────

function EgoSkillForm({
  value,
  onChange,
  onSave,
  onCancel,
  saving,
}: {
  value: Partial<EgoSkill>
  onChange: (v: Partial<EgoSkill>) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
}) {
  const set = (k: keyof EgoSkill, v: string | number | null) => onChange({ ...value, [k]: v })
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
          value={value.sin_affinity ?? ''}
          onChange={v => set('sin_affinity', v || null)}
          options={SINS.map(s => ({ value: s, label: s }))}
          placeholder="없음"
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EditEGOPage() {
  const params = useParams()
  const id = params?.id as string
  const router = useRouter()
  const [form, setForm] = useState<Omit<EGO, 'id' | 'ego_skills'>>({
    sinner_id: '',
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

  // EGO skills
  const [egoSkills, setEgoSkills] = useState<EgoSkill[]>([])
  const [editingEgoSkill, setEditingEgoSkill] = useState<EgoSkill | null>(null)
  const [editingEgoSkillDraft, setEditingEgoSkillDraft] = useState<Partial<EgoSkill>>({})
  const [newEgoSkill, setNewEgoSkill] = useState(false)
  const [newEgoSkillDraft, setNewEgoSkillDraft] = useState<Partial<EgoSkill>>({})
  const [egoSkillSaving, setEgoSkillSaving] = useState(false)

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      const [egoRes, dataRes] = await Promise.all([
        fetch(`/api/admin/ego/${id}`),
        fetch('/api/admin/data'),
      ])
      const egoJson = await egoRes.json()
      const dataJson = await dataRes.json()

      if (egoJson.data) {
        const ego: EGO = egoJson.data
        setForm({
          sinner_id: ego.sinner_id ?? '',
          name: ego.name ?? '',
          name_kr: ego.name_kr ?? '',
          grade: ego.grade ?? 'ZAYIN',
          sin_affinity: ego.sin_affinity ?? '',
          description: ego.description ?? '',
          corrosion_risk: ego.corrosion_risk ?? '',
          folder_name: ego.folder_name ?? '',
          image_url: ego.image_url ?? '',
        })
        setEgoSkills(ego.ego_skills ?? [])
      }

      if (Array.isArray(dataJson.sinners)) {
        setSinners(dataJson.sinners)
      }

      setLoading(false)
    }

    fetchData()
  }, [id])

  const handleSave = async () => {
    setSaving(true)
    try {
      const body = {
        ...form,
        sin_affinity: form.sin_affinity || null,
        name_kr: form.name_kr || null,
        description: form.description || null,
        corrosion_risk: form.corrosion_risk || null,
        folder_name: form.folder_name || null,
        image_url: form.image_url || null,
      }
      const res = await fetch(`/api/admin/ego/${id}`, {
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

  // ── EGO skill handlers ──

  const handleStartEditEgoSkill = (skill: EgoSkill) => {
    setNewEgoSkill(false)
    setEditingEgoSkill(skill)
    setEditingEgoSkillDraft({ ...skill })
  }

  const handleSaveEgoSkill = async () => {
    setEgoSkillSaving(true)
    try {
      const res = await fetch(`/api/admin/ego-skills/${editingEgoSkill!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingEgoSkillDraft),
      })
      if (res.ok) {
        const updated = await res.json()
        setEgoSkills(prev => prev.map(s => s.id === updated.id ? updated : s))
        setEditingEgoSkill(null)
        showSuccess('EGO 스킬 저장됨')
      } else {
        const d = await res.json()
        showError(d.error ?? 'EGO 스킬 저장 실패')
      }
    } catch {
      showError('네트워크 오류')
    } finally {
      setEgoSkillSaving(false)
    }
  }

  const handleAddEgoSkill = async () => {
    setEgoSkillSaving(true)
    try {
      const res = await fetch('/api/admin/ego-skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newEgoSkillDraft, ego_id: id }),
      })
      if (res.ok) {
        const created = await res.json()
        setEgoSkills(prev => [...prev, created])
        setNewEgoSkill(false)
        setNewEgoSkillDraft({})
        showSuccess('EGO 스킬 추가됨')
      } else {
        const d = await res.json()
        showError(d.error ?? 'EGO 스킬 추가 실패')
      }
    } catch {
      showError('네트워크 오류')
    } finally {
      setEgoSkillSaving(false)
    }
  }

  const handleDeleteEgoSkill = async () => {
    if (!deleteTarget) return
    try {
      await fetch(`/api/admin/ego-skills/${deleteTarget.id}`, { method: 'DELETE' })
      setEgoSkills(prev => prev.filter(s => s.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch {
      showError('삭제 실패')
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
          <h1 className="font-serif text-2xl font-bold" style={{ color: 'var(--gold)' }}>E.G.O 편집</h1>
          <p style={{ color: '#888888', fontSize: '0.8125rem' }}>{form.name || '이름 없음'}</p>
        </div>
      </div>

      <AdminCard
        title="기본 정보"
        headerRight={
          <div style={{ display: 'flex', gap: 8 }}>
            <AdminButton variant="ghost" onClick={() => router.push('/admin/data')}>돌아가기</AdminButton>
            <AdminButton onClick={handleSave} loading={saving} disabled={!form.name.trim()}>
              <Save size={14} /> 저장
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
            value={form.name_kr ?? ''}
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
            value={form.sin_affinity ?? ''}
            onChange={v => setForm(f => ({ ...f, sin_affinity: v }))}
            options={SINS.map(s => ({ value: s, label: s }))}
            placeholder="-- 없음 --"
          />
          <AdminSelect
            label="부식 위험도"
            value={form.corrosion_risk ?? ''}
            onChange={v => setForm(f => ({ ...f, corrosion_risk: v }))}
            options={CORROSION_OPTIONS.map(o => ({ value: o, label: o }))}
            placeholder="-- 선택 --"
          />
          <AdminInput
            label="폴더명"
            value={form.folder_name ?? ''}
            onChange={v => setForm(f => ({ ...f, folder_name: v }))}
            placeholder="e.g. yi-sang-sunshower"
          />
          <AdminInput
            label="이미지 URL"
            value={form.image_url ?? ''}
            onChange={v => setForm(f => ({ ...f, image_url: v }))}
            placeholder="https://..."
          />
          <div style={{ gridColumn: '1 / -1' }}>
            <AdminTextarea
              label="설명"
              value={form.description ?? ''}
              onChange={v => setForm(f => ({ ...f, description: v }))}
              rows={4}
              placeholder="E.G.O 설명..."
            />
          </div>
        </AdminFormSection>
      </AdminCard>

      {/* EGO Skills Card */}
      <AdminCard
        title="EGO 스킬"
        headerRight={
          <AdminButton
            size="sm"
            onClick={() => {
              setEditingEgoSkill(null)
              setNewEgoSkillDraft(blankEgoSkill(id))
              setNewEgoSkill(true)
            }}
          >
            <Plus size={13} /> 추가
          </AdminButton>
        }
      >
        {egoSkills.length === 0 && !newEgoSkill && (
          <p style={{ color: '#888888', fontSize: '0.75rem' }}>EGO 스킬이 없습니다.</p>
        )}

        {egoSkills.map(skill => (
          <div key={skill.id}>
            {editingEgoSkill?.id === skill.id ? (
              <EgoSkillForm
                value={editingEgoSkillDraft}
                onChange={setEditingEgoSkillDraft}
                onSave={handleSaveEgoSkill}
                onCancel={() => setEditingEgoSkill(null)}
                saving={egoSkillSaving}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid rgba(58,42,21,0.3)' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ color: '#c8a450', fontSize: '0.8125rem', fontWeight: 600 }}>{skill.name}</span>
                  <span style={{ color: '#888888', fontSize: '0.6875rem', marginLeft: '8px' }}>{skill.skill_type}{skill.sin_affinity ? ` · ${skill.sin_affinity}` : ''}</span>
                  {skill.coins != null && (
                    <span style={{ color: '#888888', fontSize: '0.6875rem', marginLeft: '8px' }}>코인:{skill.coins} 위력:{skill.base_power}/{skill.coin_power}</span>
                  )}
                </div>
                <AdminIconButton
                  title="편집"
                  onClick={() => handleStartEditEgoSkill(skill)}
                >
                  <Pencil size={12} />
                </AdminIconButton>
                <AdminIconButton
                  variant="danger"
                  title="삭제"
                  onClick={() => setDeleteTarget({ id: skill.id, name: skill.name })}
                >
                  <Trash2 size={12} />
                </AdminIconButton>
              </div>
            )}
          </div>
        ))}

        {newEgoSkill && (
          <EgoSkillForm
            value={newEgoSkillDraft}
            onChange={setNewEgoSkillDraft}
            onSave={handleAddEgoSkill}
            onCancel={() => { setNewEgoSkill(false); setNewEgoSkillDraft({}) }}
            saving={egoSkillSaving}
          />
        )}
      </AdminCard>

      <ConfirmModal
        open={deleteTarget !== null}
        title="삭제 확인"
        message={deleteTarget ? `"${deleteTarget.name}"을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.` : ''}
        confirmLabel="삭제"
        variant="danger"
        onConfirm={handleDeleteEgoSkill}
        onCancel={() => setDeleteTarget(null)}
      />

    </div>
  )
}
