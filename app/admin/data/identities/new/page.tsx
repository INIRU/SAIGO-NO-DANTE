'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Save, ArrowLeft } from 'lucide-react'
import {
  AdminInput, AdminSelect, AdminTextarea,
  AdminButton,
  AdminCard,
  AdminFormSection,
  useToast, AdminToastContainer,
} from '@/components/admin'

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
  const { toasts, showToast, dismissToast } = useToast()

  const [sinners, setSinners] = useState<SinnerOption[]>([])
  const [form, setForm] = useState<IdentityForm>({ ...BLANK_FORM, sinner_id: searchParams.get('sinner') ?? '' })
  const [saving, setSaving] = useState(false)
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
      showToast('수감자, 이름, 등급은 필수입니다.', 'error')
      return
    }
    setSaving(true)
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
        showToast(d.error ?? '생성 실패', 'error')
      } else {
        const newIdentity = await res.json()
        router.push(`/admin/data/identities/${newIdentity.id}`)
      }
    } catch {
      showToast('네트워크 오류', 'error')
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
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', color: '#888888', fontSize: '0.8125rem', cursor: 'pointer', padding: 0 }}
        >
          <ArrowLeft size={14} /> 뒤로
        </button>
        <h1 className="font-serif" style={{ color: 'var(--gold)', fontSize: '1.25rem', fontWeight: 'bold' }}>
          인격 추가
        </h1>
      </div>

      <AdminCard
        title="기본 정보"
        headerRight={
          <AdminButton onClick={handleCreate} loading={saving}>
            <Save size={13} /> 인격 생성
          </AdminButton>
        }
      >
        {loadingSinners && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#888888', fontSize: '0.8125rem', marginBottom: '16px' }}>
            <Loader2 size={13} className="animate-spin" /> 수감자 목록 로딩 중...
          </div>
        )}

        <AdminFormSection columns={2}>
          <AdminSelect
            label="수감자"
            required
            value={form.sinner_id}
            onChange={v => setF('sinner_id', v)}
            options={sinners.map(s => ({ value: s.id, label: s.name_kr }))}
            placeholder="선택"
          />
          <AdminSelect
            label="등급"
            required
            value={form.rarity}
            onChange={v => setF('rarity', v)}
            options={[
              { value: '1', label: '1성' },
              { value: '2', label: '2성' },
              { value: '3', label: '3성' },
            ]}
            placeholder="선택"
          />
          <AdminInput
            label="이름 (영문)"
            required
            value={form.name}
            onChange={v => setF('name', v)}
            placeholder="예: LCB Sinner"
          />
          <AdminInput
            label="이름 (한글)"
            value={form.name_kr}
            onChange={v => setF('name_kr', v)}
            placeholder="예: LCB 수감자"
          />
          <AdminInput
            label="동기화 단계 (1–4)"
            type="number"
            min={1}
            max={4}
            value={form.tier}
            onChange={v => setF('tier', v)}
          />
          <AdminInput
            label="HP"
            type="number"
            value={form.hp}
            onChange={v => setF('hp', v)}
          />
          <AdminInput
            label="속도 최소"
            type="number"
            value={form.speed_min}
            onChange={v => setF('speed_min', v)}
          />
          <AdminInput
            label="속도 최대"
            type="number"
            value={form.speed_max}
            onChange={v => setF('speed_max', v)}
          />
          <AdminInput
            label="방어 레벨"
            type="number"
            value={form.def_level}
            onChange={v => setF('def_level', v)}
          />
          <AdminSelect
            label="죄악 속성"
            value={form.sin_affinity}
            onChange={v => setF('sin_affinity', v)}
            options={SIN_OPTIONS.map(s => ({ value: s, label: s }))}
            placeholder="선택"
          />
          <AdminSelect
            label="참격 내성"
            value={form.slash_res}
            onChange={v => setF('slash_res', v)}
            options={RES_OPTIONS.map(o => ({ value: o, label: o }))}
            placeholder="선택"
          />
          <AdminSelect
            label="관통 내성"
            value={form.pierce_res}
            onChange={v => setF('pierce_res', v)}
            options={RES_OPTIONS.map(o => ({ value: o, label: o }))}
            placeholder="선택"
          />
          <AdminSelect
            label="타격 내성"
            value={form.blunt_res}
            onChange={v => setF('blunt_res', v)}
            options={RES_OPTIONS.map(o => ({ value: o, label: o }))}
            placeholder="선택"
          />
          <AdminInput
            label="게임 ID"
            value={form.game_id}
            onChange={v => setF('game_id', v)}
          />
          <AdminInput
            label="폴더명"
            value={form.folder_name}
            onChange={v => setF('folder_name', v)}
          />
          <AdminInput
            label="소속"
            value={form.affiliation}
            onChange={v => setF('affiliation', v)}
          />
          <AdminInput
            label="키워드 (쉼표 구분)"
            value={form.keywords}
            onChange={v => setF('keywords', v)}
            placeholder="예: 검계, 출혈"
          />
          <AdminInput
            label="출시일"
            value={form.release_date}
            onChange={v => setF('release_date', v)}
            placeholder="예: 2023-02-27"
          />
          <AdminInput
            label="획득 방법"
            value={form.acquisition}
            onChange={v => setF('acquisition', v)}
          />
          <div style={{ gridColumn: '1 / -1' }}>
            <AdminTextarea
              label="대사"
              value={form.quote}
              onChange={v => setF('quote', v)}
              rows={3}
            />
          </div>
        </AdminFormSection>

        <p style={{ color: '#888888', fontSize: '0.6875rem', marginTop: '12px' }}>
          * 필수 항목. 생성 후 스킬과 패시브를 추가할 수 있습니다.
        </p>
      </AdminCard>

      <AdminToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
