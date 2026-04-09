'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Save, ArrowLeft } from 'lucide-react'
import {
  AdminInput, AdminSelect, AdminTextarea,
  AdminButton,
  AdminCard,
  AdminFormSection,
} from '@/components/admin'
import { showSuccess, showError } from '@/lib/toast'
import { createIdentitySchema } from '@/lib/schemas/admin'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SinnerOption {
  id: string
  name_kr: string
}

// All fields kept as strings in the form — Zod coerces numbers on submit
interface IdentityFormValues {
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
  keywords: string        // comma-separated; split to array before sending
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NewIdentityPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [sinners, setSinners] = useState<SinnerOption[]>([])
  const [loadingSinners, setLoadingSinners] = useState(true)

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<IdentityFormValues>({
    resolver: zodResolver(createIdentitySchema) as any,
    defaultValues: {
      sinner_id: searchParams.get('sinner') ?? '',
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
    },
  })

  useEffect(() => {
    fetch('/api/admin/data')
      .then(r => r.json())
      .then(data => setSinners((data.sinners ?? []).map((s: SinnerOption) => ({ id: s.id, name_kr: s.name_kr }))))
      .finally(() => setLoadingSinners(false))
  }, [])

  const strOrNull = (v: string) => v.trim() === '' ? null : v.trim()
  const numOrNull = (v: string) => v.trim() === '' ? null : Number(v)

  const onSubmit = async (values: IdentityFormValues) => {
    try {
      const res = await fetch('/api/admin/identities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sinner_id: values.sinner_id,
          name: values.name.trim(),
          name_kr: strOrNull(values.name_kr),
          rarity: values.rarity,
          tier: numOrNull(values.tier),
          hp: numOrNull(values.hp),
          speed_min: numOrNull(values.speed_min),
          speed_max: numOrNull(values.speed_max),
          def_level: numOrNull(values.def_level),
          sin_affinity: strOrNull(values.sin_affinity),
          keywords: values.keywords.trim()
            ? values.keywords.split(',').map(k => k.trim()).filter(Boolean)
            : null,
          game_id: numOrNull(values.game_id),
          folder_name: strOrNull(values.folder_name),
          affiliation: strOrNull(values.affiliation),
          quote: strOrNull(values.quote),
          slash_res: strOrNull(values.slash_res),
          pierce_res: strOrNull(values.pierce_res),
          blunt_res: strOrNull(values.blunt_res),
          release_date: strOrNull(values.release_date),
          acquisition: strOrNull(values.acquisition),
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        showError(d.error ?? '생성 실패')
      } else {
        const newIdentity = await res.json()
        showSuccess('인격이 생성되었습니다.')
        router.push(`/admin/data/identities/${newIdentity.id}`)
      }
    } catch {
      showError('네트워크 오류')
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
          <AdminButton onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
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
          <div>
            <Controller
              name="sinner_id"
              control={control}
              render={({ field }) => (
                <AdminSelect
                  label="수감자"
                  required
                  value={field.value}
                  onChange={field.onChange}
                  options={sinners.map(s => ({ value: s.id, label: s.name_kr }))}
                  placeholder="선택"
                />
              )}
            />
            {errors.sinner_id && (
              <p style={{ color: '#cc4444', fontSize: '0.6875rem', marginTop: '4px' }}>{errors.sinner_id.message}</p>
            )}
          </div>

          <div>
            <Controller
              name="rarity"
              control={control}
              render={({ field }) => (
                <AdminSelect
                  label="등급"
                  required
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    { value: '1', label: '1성' },
                    { value: '2', label: '2성' },
                    { value: '3', label: '3성' },
                  ]}
                  placeholder="선택"
                />
              )}
            />
            {errors.rarity && (
              <p style={{ color: '#cc4444', fontSize: '0.6875rem', marginTop: '4px' }}>{errors.rarity.message}</p>
            )}
          </div>

          <div>
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <AdminInput
                  label="이름 (영문)"
                  required
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="예: LCB Sinner"
                />
              )}
            />
            {errors.name && (
              <p style={{ color: '#cc4444', fontSize: '0.6875rem', marginTop: '4px' }}>{errors.name.message}</p>
            )}
          </div>

          <div>
            <Controller
              name="name_kr"
              control={control}
              render={({ field }) => (
                <AdminInput
                  label="이름 (한글)"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="예: LCB 수감자"
                />
              )}
            />
          </div>

          <div>
            <Controller
              name="tier"
              control={control}
              render={({ field }) => (
                <AdminInput
                  label="동기화 단계 (1–4)"
                  type="number"
                  min={1}
                  max={4}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </div>

          <div>
            <Controller
              name="hp"
              control={control}
              render={({ field }) => (
                <AdminInput
                  label="HP"
                  type="number"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </div>

          <div>
            <Controller
              name="speed_min"
              control={control}
              render={({ field }) => (
                <AdminInput
                  label="속도 최소"
                  type="number"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </div>

          <div>
            <Controller
              name="speed_max"
              control={control}
              render={({ field }) => (
                <AdminInput
                  label="속도 최대"
                  type="number"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </div>

          <div>
            <Controller
              name="def_level"
              control={control}
              render={({ field }) => (
                <AdminInput
                  label="방어 레벨"
                  type="number"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </div>

          <div>
            <Controller
              name="sin_affinity"
              control={control}
              render={({ field }) => (
                <AdminSelect
                  label="죄악 속성"
                  value={field.value}
                  onChange={field.onChange}
                  options={SIN_OPTIONS.map(s => ({ value: s, label: s }))}
                  placeholder="선택"
                />
              )}
            />
          </div>

          <div>
            <Controller
              name="slash_res"
              control={control}
              render={({ field }) => (
                <AdminSelect
                  label="참격 내성"
                  value={field.value}
                  onChange={field.onChange}
                  options={RES_OPTIONS.map(o => ({ value: o, label: o }))}
                  placeholder="선택"
                />
              )}
            />
          </div>

          <div>
            <Controller
              name="pierce_res"
              control={control}
              render={({ field }) => (
                <AdminSelect
                  label="관통 내성"
                  value={field.value}
                  onChange={field.onChange}
                  options={RES_OPTIONS.map(o => ({ value: o, label: o }))}
                  placeholder="선택"
                />
              )}
            />
          </div>

          <div>
            <Controller
              name="blunt_res"
              control={control}
              render={({ field }) => (
                <AdminSelect
                  label="타격 내성"
                  value={field.value}
                  onChange={field.onChange}
                  options={RES_OPTIONS.map(o => ({ value: o, label: o }))}
                  placeholder="선택"
                />
              )}
            />
          </div>

          <div>
            <Controller
              name="game_id"
              control={control}
              render={({ field }) => (
                <AdminInput
                  label="게임 ID"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </div>

          <div>
            <Controller
              name="folder_name"
              control={control}
              render={({ field }) => (
                <AdminInput
                  label="폴더명"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </div>

          <div>
            <Controller
              name="affiliation"
              control={control}
              render={({ field }) => (
                <AdminInput
                  label="소속"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </div>

          <div>
            <Controller
              name="keywords"
              control={control}
              render={({ field }) => (
                <AdminInput
                  label="키워드 (쉼표 구분)"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="예: 검계, 출혈"
                />
              )}
            />
          </div>

          <div>
            <Controller
              name="release_date"
              control={control}
              render={({ field }) => (
                <AdminInput
                  label="출시일"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="예: 2023-02-27"
                />
              )}
            />
          </div>

          <div>
            <Controller
              name="acquisition"
              control={control}
              render={({ field }) => (
                <AdminInput
                  label="획득 방법"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <Controller
              name="quote"
              control={control}
              render={({ field }) => (
                <AdminTextarea
                  label="대사"
                  value={field.value}
                  onChange={field.onChange}
                  rows={3}
                />
              )}
            />
          </div>
        </AdminFormSection>

        <p style={{ color: '#888888', fontSize: '0.6875rem', marginTop: '12px' }}>
          * 필수 항목. 생성 후 스킬과 패시브를 추가할 수 있습니다.
        </p>
      </AdminCard>

    </div>
  )
}
