'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { AdminButton, AdminIconButton, AdminInput } from '@/components/admin'

interface SinnerData {
  id: string
  name_kr: string
  identity_count: number
  ego_count: number
}

interface DataStats {
  sinners: SinnerData[]
  totalIdentities: number
  totalSkills: number
  totalEgo: number
  totalPassives: number
}

interface Identity {
  id: string
  name: string
  name_kr: string
  rarity: number
  tier: number
}

interface EGO {
  id: string
  name: string
  name_kr: string
  grade: string
}

interface DeleteTarget {
  type: 'identity' | 'ego'
  id: string
  name: string
  sinnerId: string
}

export default function AdminDataPage() {
  const router = useRouter()
  const [data, setData] = useState<DataStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedSinner, setExpandedSinner] = useState<string | null>(null)
  const [sinnerIdentities, setSinnerIdentities] = useState<Record<string, Identity[]>>({})
  const [sinnerEgo, setSinnerEgo] = useState<Record<string, EGO[]>>({})
  const [loadingSinner, setLoadingSinner] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [identitySearch, setIdentitySearch] = useState('')

  const fetchStats = useCallback(() => {
    return fetch('/api/admin/data')
      .then(r => r.json())
      .then(setData)
  }, [])

  useEffect(() => {
    fetchStats().finally(() => setLoading(false))
  }, [fetchStats])

  const fetchSinnerDetails = useCallback(async (sinnerId: string) => {
    if (sinnerIdentities[sinnerId] !== undefined && sinnerEgo[sinnerId] !== undefined) return
    setLoadingSinner(sinnerId)
    try {
      const [identitiesRes, egoRes] = await Promise.all([
        fetch(`/api/admin/identities?sinner_id=${sinnerId}`),
        fetch(`/api/admin/ego?sinner_id=${sinnerId}`),
      ])
      const [identities, egos] = await Promise.all([
        identitiesRes.json(),
        egoRes.json(),
      ])
      setSinnerIdentities(prev => ({ ...prev, [sinnerId]: identities.data ?? [] }))
      setSinnerEgo(prev => ({ ...prev, [sinnerId]: egos.data ?? [] }))
    } catch {
      setSinnerIdentities(prev => ({ ...prev, [sinnerId]: [] }))
      setSinnerEgo(prev => ({ ...prev, [sinnerId]: [] }))
    } finally {
      setLoadingSinner(null)
    }
  }, [sinnerIdentities, sinnerEgo])

  const handleToggle = (sinnerId: string) => {
    if (expandedSinner === sinnerId) {
      setExpandedSinner(null)
    } else {
      setExpandedSinner(sinnerId)
      fetchSinnerDetails(sinnerId)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const endpoint =
        deleteTarget.type === 'identity'
          ? `/api/admin/identities/${deleteTarget.id}`
          : `/api/admin/ego/${deleteTarget.id}`
      const res = await fetch(endpoint, { method: 'DELETE' })
      if (res.ok) {
        const { sinnerId, type, id } = deleteTarget
        if (type === 'identity') {
          setSinnerIdentities(prev => ({
            ...prev,
            [sinnerId]: (prev[sinnerId] ?? []).filter(x => x.id !== id),
          }))
        } else {
          setSinnerEgo(prev => ({
            ...prev,
            [sinnerId]: (prev[sinnerId] ?? []).filter(x => x.id !== id),
          }))
        }
        await fetchStats()
      }
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const rarityLabel = (rarity: number) => `${rarity}성`

  const gradeLabel = (grade: string) => {
    const map: Record<string, string> = { ZAYIN: 'ZAYIN', TETH: 'TETH', HE: 'HE', WAW: 'WAW', ALEPH: 'ALEPH' }
    return map[grade] ?? grade
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold mb-1" style={{ color: 'var(--gold)' }}>데이터 관리</h1>
        <p style={{ color: '#555566', fontSize: '0.8125rem' }}>게임 데이터 현황을 확인하고 관리합니다.</p>
      </div>

      {/* Identity search */}
      <div style={{ marginBottom: '16px', maxWidth: 320 }}>
        <AdminInput
          value={identitySearch}
          onChange={setIdentitySearch}
          placeholder="인격 이름 검색..."
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2" style={{ color: '#555566', fontSize: '0.8125rem' }}>
          <Loader2 size={14} className="animate-spin" /> 로딩 중...
        </div>
      ) : data && (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: '총 인격', value: data.totalIdentities },
              { label: '총 스킬', value: data.totalSkills },
              { label: '총 E.G.O', value: data.totalEgo },
              { label: '총 패시브', value: data.totalPassives },
            ].map(card => (
              <div key={card.label} className="card p-5">
                <p style={{ color: '#555566', fontSize: '0.6875rem', marginBottom: '4px' }}>{card.label}</p>
                <p className="font-mono text-2xl font-bold" style={{ color: 'var(--gold)' }}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* Accordion */}
          <h2 className="font-serif text-lg font-bold mb-4" style={{ color: '#c8a450' }}>수감자별 데이터</h2>
          <div className="card overflow-hidden">
            {data.sinners.map((sinner, idx) => {
              const isExpanded = expandedSinner === sinner.id
              const isLast = idx === data.sinners.length - 1
              const allIdentities = sinnerIdentities[sinner.id] ?? []
              const egos = sinnerEgo[sinner.id] ?? []
              const searchLower = identitySearch.toLowerCase()
              const identities = identitySearch
                ? allIdentities.filter(i => (i.name_kr || i.name).toLowerCase().includes(searchLower))
                : allIdentities

              return (
                <div key={sinner.id}>
                  {/* Accordion row */}
                  <div
                    onClick={() => handleToggle(sinner.id)}
                    className="hover:bg-[rgba(200,144,10,0.05)]"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderBottom: isExpanded || !isLast ? '1px solid var(--border)' : 'none',
                      cursor: 'pointer',
                      background: isExpanded ? 'rgba(200,144,10,0.04)' : 'transparent',
                      transition: 'background 0.15s',
                      userSelect: 'none',
                    }}
                    onMouseEnter={e => {
                      if (!isExpanded) (e.currentTarget as HTMLDivElement).style.background = 'rgba(200,144,10,0.05)'
                    }}
                    onMouseLeave={e => {
                      if (!isExpanded) (e.currentTarget as HTMLDivElement).style.background = 'transparent'
                    }}
                  >
                    {/* Left: chevron + name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {isExpanded
                        ? <ChevronDown size={14} style={{ color: '#c8900a', flexShrink: 0 }} />
                        : <ChevronRight size={14} style={{ color: '#555566', flexShrink: 0 }} />
                      }
                      <span
                        className="font-serif"
                        style={{ color: isExpanded ? '#c8a450' : '#7a6845', fontSize: '0.875rem', fontWeight: 600 }}
                      >
                        {sinner.name_kr}
                      </span>
                    </div>

                    {/* Right: counts + add buttons */}
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                      onClick={e => e.stopPropagation()}
                    >
                      <span style={{ color: '#555566', fontSize: '0.75rem' }}>
                        인격 <span className="font-mono" style={{ color: '#7a6845' }}>{sinner.identity_count}</span>
                        {'  |  '}
                        EGO <span className="font-mono" style={{ color: '#7a6845' }}>{sinner.ego_count}</span>
                      </span>
                      <AdminButton
                        size="sm"
                        variant="gold"
                        onClick={() => router.push(`/admin/data/identities/new?sinner=${sinner.id}`)}
                      >
                        <Plus size={10} />
                        인격 추가
                      </AdminButton>
                      <AdminButton
                        size="sm"
                        variant="gold"
                        onClick={() => router.push(`/admin/data/ego/new?sinner=${sinner.id}`)}
                      >
                        <Plus size={10} />
                        EGO 추가
                      </AdminButton>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div
                      style={{
                        background: 'rgba(0,0,0,0.15)',
                        padding: '12px 16px',
                        borderBottom: isLast ? 'none' : '1px solid var(--border)',
                      }}
                    >
                      {loadingSinner === sinner.id ? (
                        <div className="flex items-center gap-2" style={{ color: '#555566', fontSize: '0.75rem', padding: '8px 0' }}>
                          <Loader2 size={12} className="animate-spin" /> 불러오는 중...
                        </div>
                      ) : (
                        <>
                          {/* 인격 목록 */}
                          <h4
                            className="font-serif"
                            style={{ color: '#8a6010', fontSize: '0.6875rem', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                          >
                            인격
                          </h4>
                          {identities.length === 0 ? (
                            <p style={{ color: '#555566', fontSize: '0.75rem', padding: '4px 0 10px' }}>
                              {identitySearch ? '검색 결과가 없습니다.' : '등록된 인격이 없습니다.'}
                            </p>
                          ) : (
                            <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
                              {identities.map(identity => (
                                <div
                                  key={identity.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '6px 8px',
                                    borderRadius: 4,
                                    background: 'rgba(255,255,255,0.02)',
                                  }}
                                >
                                  <span style={{ color: '#c8a450', fontSize: '0.8125rem', flex: 1, minWidth: 0 }}>
                                    {identity.name_kr || identity.name}
                                  </span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                    <span
                                      style={{
                                        fontSize: '0.625rem',
                                        padding: '2px 6px',
                                        border: '1px solid rgba(200,144,10,0.3)',
                                        borderRadius: 3,
                                        color: '#8a6010',
                                      }}
                                    >
                                      {rarityLabel(identity.rarity)}
                                    </span>
                                    <AdminIconButton
                                      title="편집"
                                      onClick={e => {
                                        e.stopPropagation()
                                        router.push(`/admin/data/identities/${identity.id}`)
                                      }}
                                    >
                                      <Pencil size={12} />
                                    </AdminIconButton>
                                    <AdminIconButton
                                      variant="danger"
                                      title="삭제"
                                      onClick={e => {
                                        e.stopPropagation()
                                        setDeleteTarget({ type: 'identity', id: identity.id, name: identity.name_kr || identity.name, sinnerId: sinner.id })
                                      }}
                                    >
                                      <Trash2 size={12} />
                                    </AdminIconButton>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* EGO 목록 */}
                          <h4
                            className="font-serif"
                            style={{ color: '#8a6010', fontSize: '0.6875rem', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                          >
                            E.G.O
                          </h4>
                          {egos.length === 0 ? (
                            <p style={{ color: '#555566', fontSize: '0.75rem', padding: '4px 0' }}>등록된 E.G.O가 없습니다.</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              {egos.map(ego => (
                                <div
                                  key={ego.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '6px 8px',
                                    borderRadius: 4,
                                    background: 'rgba(255,255,255,0.02)',
                                  }}
                                >
                                  <span style={{ color: '#c8a450', fontSize: '0.8125rem', flex: 1, minWidth: 0 }}>
                                    {ego.name_kr || ego.name}
                                  </span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                    <span
                                      style={{
                                        fontSize: '0.625rem',
                                        padding: '2px 6px',
                                        border: '1px solid rgba(200,144,10,0.3)',
                                        borderRadius: 3,
                                        color: '#8a6010',
                                      }}
                                    >
                                      {gradeLabel(ego.grade)}
                                    </span>
                                    <AdminIconButton
                                      title="편집"
                                      onClick={e => {
                                        e.stopPropagation()
                                        router.push(`/admin/data/ego/${ego.id}`)
                                      }}
                                    >
                                      <Pencil size={12} />
                                    </AdminIconButton>
                                    <AdminIconButton
                                      variant="danger"
                                      title="삭제"
                                      onClick={e => {
                                        e.stopPropagation()
                                        setDeleteTarget({ type: 'ego', id: ego.id, name: ego.name_kr || ego.name, sinnerId: sinner.id })
                                      }}
                                    >
                                      <Trash2 size={12} />
                                    </AdminIconButton>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Delete confirmation modal */}
      <ConfirmModal
        open={deleteTarget !== null}
        title="삭제 확인"
        message={`"${deleteTarget?.name}"을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel={deleting ? '삭제 중...' : '삭제'}
        cancelLabel="취소"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => { if (!deleting) setDeleteTarget(null) }}
      />
    </div>
  )
}
