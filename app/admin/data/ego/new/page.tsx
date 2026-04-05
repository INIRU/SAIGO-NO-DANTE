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
import { createEgoSchema } from '@/lib/schemas/admin'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Sinner {
  id: string
  name_kr: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GRADES = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH']
const SINS = ['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy']
const CORROSION_OPTIONS = [
  { value: '0', label: '낮음' },
  { value: '1', label: '보통' },
  { value: '2', label: '높음' },
  { value: '3', label: '매우 높음' },
]

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NewEGOPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedSinner = searchParams.get('sinner') ?? ''
  const [sinners, setSinners] = useState<Sinner[]>([])
  const [loading, setLoading] = useState(true)

  interface EgoFormValues {
    sinner_id: string
    name: string
    grade: string
    name_kr: string
    sin_affinity: string
    description: string
    corrosion_risk: number | null
    folder_name: string
    image_url: string
  }

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EgoFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createEgoSchema) as any,
    defaultValues: {
      sinner_id: preselectedSinner,
      name: '',
      grade: 'ZAYIN',
      name_kr: '',
      sin_affinity: '',
      description: '',
      corrosion_risk: null,
      folder_name: '',
      image_url: '',
    },
  })

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
      setValue('sinner_id', preselectedSinner)
    }
  }, [preselectedSinner, setValue])

  const onSubmit = handleSubmit(async (data) => {
    try {
      const body = {
        sinner_id: data.sinner_id || null,
        name: data.name,
        name_kr: data.name_kr || null,
        grade: data.grade,
        sin_affinity: data.sin_affinity || null,
        description: data.description || null,
        corrosion_risk: data.corrosion_risk ?? null,
        folder_name: data.folder_name || null,
        image_url: data.image_url || null,
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
    }
  })

  const nameValue = watch('name')

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

      <form onSubmit={onSubmit}>
        <AdminCard
          title="기본 정보"
          headerRight={
            <div style={{ display: 'flex', gap: 8 }}>
              <AdminButton variant="ghost" onClick={() => router.push('/admin/data')}>돌아가기</AdminButton>
              <AdminButton type="submit" loading={isSubmitting} disabled={!nameValue?.trim()}>
                <Save size={14} /> 추가
              </AdminButton>
            </div>
          }
        >
          <AdminFormSection columns={2}>
            <Controller
              name="sinner_id"
              control={control}
              render={({ field }) => (
                <AdminSelect
                  label="수감자"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  options={sinners.map(s => ({ value: s.id, label: s.name_kr }))}
                  placeholder="-- 선택 --"
                />
              )}
            />
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <AdminInput
                  label="이름 (영문)"
                  required
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  placeholder="e.g. Sunshower"
                  error={errors.name?.message}
                />
              )}
            />
            <Controller
              name="name_kr"
              control={control}
              render={({ field }) => (
                <AdminInput
                  label="이름 (한글)"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  placeholder="e.g. 햇빛 소나기"
                />
              )}
            />
            <Controller
              name="grade"
              control={control}
              render={({ field }) => (
                <AdminSelect
                  label="등급"
                  required
                  value={field.value ?? 'ZAYIN'}
                  onChange={field.onChange}
                  options={GRADES.map(g => ({ value: g, label: g }))}
                />
              )}
            />
            <Controller
              name="sin_affinity"
              control={control}
              render={({ field }) => (
                <AdminSelect
                  label="죄악 친화도"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  options={SINS.map(s => ({ value: s, label: s }))}
                  placeholder="-- 없음 --"
                />
              )}
            />
            <Controller
              name="corrosion_risk"
              control={control}
              render={({ field }) => (
                <AdminSelect
                  label="부식 위험도"
                  value={field.value != null ? String(field.value) : ''}
                  onChange={v => field.onChange(v === '' ? null : Number(v))}
                  options={CORROSION_OPTIONS}
                  placeholder="-- 선택 --"
                />
              )}
            />
            <Controller
              name="folder_name"
              control={control}
              render={({ field }) => (
                <AdminInput
                  label="폴더명"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  placeholder="e.g. yi-sang-sunshower"
                />
              )}
            />
            <Controller
              name="image_url"
              control={control}
              render={({ field }) => (
                <AdminInput
                  label="이미지 URL"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  placeholder="https://..."
                  error={errors.image_url?.message}
                />
              )}
            />
            <div style={{ gridColumn: '1 / -1' }}>
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <AdminTextarea
                    label="설명"
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    rows={4}
                    placeholder="E.G.O 설명..."
                  />
                )}
              />
            </div>
          </AdminFormSection>
        </AdminCard>
      </form>

    </div>
  )
}
