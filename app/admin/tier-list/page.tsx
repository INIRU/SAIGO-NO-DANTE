'use client'

import { useEffect, useState, useCallback, useRef, DragEvent } from 'react'
import Image from 'next/image'
import { Save, GripVertical, Search, X } from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { getIdentityInfoUrl, RARITY_ICON_MAP, type Identity } from '@/lib/data/sinners'

const TIERS = ['S+', 'S', 'A', 'B', 'C', 'F'] as const
type Tier = typeof TIERS[number]

const TIER_COLORS: Record<Tier, string> = {
  'S+': '#ff5050',
  'S': '#ffa030',
  'A': '#ffd040',
  'B': '#60c860',
  'C': '#60a0ff',
  'F': '#909090',
}

type TierIdentity = Pick<Identity, 'id' | 'name_kr' | 'rarity' | 'sinner_id' | 'game_id' | 'folder_name'>

export default function AdminTierListPage() {
  const [tiers, setTiers] = useState<Record<Tier, TierIdentity[]>>({
    'S+': [], 'S': [], 'A': [], 'B': [], 'C': [], 'F': [],
  })
  const [unassigned, setUnassigned] = useState<TierIdentity[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // drag state
  const dragItem = useRef<{ id: string; source: Tier | 'unassigned' } | null>(null)
  const [dragOverTarget, setDragOverTarget] = useState<Tier | 'unassigned' | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/tier-list')
      const data = await res.json()

      const newTiers: Record<Tier, TierIdentity[]> = {
        'S+': [], 'S': [], 'A': [], 'B': [], 'C': [], 'F': [],
      }

      for (const row of data.assigned ?? []) {
        const tier = row.tier as Tier
        if (newTiers[tier] && row.identity) {
          newTiers[tier].push(row.identity)
        }
      }

      setTiers(newTiers)
      setUnassigned(data.unassigned ?? [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSave = async () => {
    setConfirmOpen(false)
    setSaving(true)
    try {
      const tiersPayload: Record<string, string[]> = {}
      for (const tier of TIERS) {
        tiersPayload[tier] = tiers[tier].map(i => i.id)
      }
      const res = await fetch('/api/admin/tier-list', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiers: tiersPayload }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '저장 실패')
      }
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  // --- Drag handlers ---
  const onDragStart = (e: DragEvent, id: string, source: Tier | 'unassigned') => {
    dragItem.current = { id, source }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  const onDragOver = (e: DragEvent, target: Tier | 'unassigned') => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverTarget(target)
  }

  const onDragLeave = () => {
    setDragOverTarget(null)
  }

  const onDrop = (e: DragEvent, target: Tier | 'unassigned') => {
    e.preventDefault()
    setDragOverTarget(null)

    const drag = dragItem.current
    if (!drag) return
    if (drag.source === target) return

    // Find and remove from source
    let item: TierIdentity | undefined

    if (drag.source === 'unassigned') {
      const idx = unassigned.findIndex(i => i.id === drag.id)
      if (idx === -1) return
      item = unassigned[idx]
      setUnassigned(prev => prev.filter((_, i) => i !== idx))
    } else {
      const tier = drag.source as Tier
      const idx = tiers[tier].findIndex(i => i.id === drag.id)
      if (idx === -1) return
      item = tiers[tier][idx]
      setTiers(prev => ({ ...prev, [tier]: prev[tier].filter((_, i) => i !== idx) }))
    }

    if (!item) return

    // Add to target
    if (target === 'unassigned') {
      setUnassigned(prev => [...prev, item])
    } else {
      setTiers(prev => ({ ...prev, [target]: [...prev[target], item] }))
    }

    dragItem.current = null
  }

  const filteredUnassigned = searchQuery
    ? unassigned.filter(i => i.name_kr.toLowerCase().includes(searchQuery.toLowerCase()))
    : unassigned

  const totalAssigned = TIERS.reduce((sum, t) => sum + tiers[t].length, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p style={{ color: '#555566', fontSize: '0.875rem' }}>로딩 중...</p>
      </div>
    )
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif" style={{ color: 'var(--gold)', fontSize: '1.25rem', fontWeight: 700 }}>
            리세마라 티어표
          </h1>
          <p style={{ color: '#555566', fontSize: '0.75rem', marginTop: '4px' }}>
            인격을 드래그하여 티어에 배치하세요 ({totalAssigned}개 배정)
          </p>
        </div>
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={saving}
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
          style={{
            padding: '8px 20px',
            background: 'rgba(200,144,10,0.15)',
            border: '1px solid var(--gold-dim)',
            borderRadius: '6px',
            color: 'var(--gold)',
            fontSize: '0.8125rem',
            fontFamily: 'var(--font-heading)',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.5 : 1,
          }}
        >
          <Save size={14} />
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      {/* 티어 영역 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {TIERS.map(tier => (
          <div
            key={tier}
            onDragOver={e => onDragOver(e, tier)}
            onDragLeave={onDragLeave}
            onDrop={e => onDrop(e, tier)}
            style={{
              display: 'flex',
              minHeight: '72px',
              background: dragOverTarget === tier ? 'rgba(200,144,10,0.08)' : '#141210',
              border: dragOverTarget === tier ? '1px dashed rgba(200,144,10,0.3)' : '1px solid transparent',
              borderRadius: '4px',
              transition: 'background 0.15s, border-color 0.15s',
            }}
          >
            {/* 티어 라벨 */}
            <div
              style={{
                width: '64px',
                minWidth: '64px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: TIER_COLORS[tier],
                borderRadius: '4px 0 0 4px',
                fontFamily: 'var(--font-heading)',
                fontSize: '1.125rem',
                fontWeight: 700,
                color: '#fff',
                textShadow: '0 1px 2px rgba(0,0,0,0.5)',
              }}
            >
              {tier}
            </div>

            {/* 인격 카드들 */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 8px',
              }}
            >
              {tiers[tier].map(identity => (
                <MiniIdentityCard
                  key={identity.id}
                  identity={identity}
                  onDragStart={e => onDragStart(e, identity.id, tier)}
                />
              ))}
              {tiers[tier].length === 0 && (
                <p style={{ color: '#3a3028', fontSize: '0.75rem', fontStyle: 'italic' }}>
                  여기에 인격을 드래그하세요
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 미배정 인격 풀 */}
      <div style={{ marginTop: '24px' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif" style={{ color: '#8a7855', fontSize: '0.9375rem', fontWeight: 600 }}>
            미배정 ({unassigned.length})
          </h2>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#555566' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="인격 검색..."
              style={{
                padding: '6px 10px 6px 30px',
                background: '#1a1510',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                color: '#c8a450',
                fontSize: '0.75rem',
                outline: 'none',
                width: '180px',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: '#555566', cursor: 'pointer', background: 'none', border: 'none' }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
        <div
          onDragOver={e => onDragOver(e, 'unassigned')}
          onDragLeave={onDragLeave}
          onDrop={e => onDrop(e, 'unassigned')}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px',
            padding: '12px',
            background: dragOverTarget === 'unassigned' ? 'rgba(200,144,10,0.08)' : '#141210',
            border: dragOverTarget === 'unassigned' ? '1px dashed rgba(200,144,10,0.3)' : '1px solid var(--border)',
            borderRadius: '6px',
            minHeight: '80px',
            transition: 'background 0.15s, border-color 0.15s',
          }}
        >
          {filteredUnassigned.map(identity => (
            <MiniIdentityCard
              key={identity.id}
              identity={identity}
              onDragStart={e => onDragStart(e, identity.id, 'unassigned')}
            />
          ))}
          {filteredUnassigned.length === 0 && (
            <p style={{ color: '#3a3028', fontSize: '0.75rem', fontStyle: 'italic', margin: 'auto' }}>
              {searchQuery ? '검색 결과 없음' : '모든 인격이 배정되었습니다'}
            </p>
          )}
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="티어표 저장"
        message={`${totalAssigned}개 인격의 티어 배치를 저장하시겠습니까?`}
        confirmLabel="저장"
        cancelLabel="취소"
        variant="warning"
        onConfirm={handleSave}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}

function MiniIdentityCard({
  identity,
  onDragStart,
}: {
  identity: TierIdentity
  onDragStart: (e: DragEvent<HTMLDivElement>) => void
}) {
  const imgUrl = getIdentityInfoUrl(identity as Identity)
  const rarityIcon = RARITY_ICON_MAP[identity.rarity]

  return (
    <div
      draggable
      onDragStart={onDragStart}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 8px 3px 3px',
        background: '#1a1510',
        border: '1px solid var(--border)',
        borderRadius: '4px',
        cursor: 'grab',
        userSelect: 'none',
      }}
      className="transition-colors hover:border-[var(--gold-dim)]"
    >
      <GripVertical size={12} style={{ color: '#3a3028', flexShrink: 0 }} />
      {imgUrl && (
        <Image
          src={imgUrl}
          alt={identity.name_kr}
          width={32}
          height={32}
          unoptimized
          style={{ borderRadius: '2px', objectFit: 'cover' }}
        />
      )}
      <span style={{ fontSize: '0.6875rem', color: '#c8a450', whiteSpace: 'nowrap' }}>
        {identity.name_kr}
      </span>
      {rarityIcon && (
        <Image
          src={rarityIcon}
          alt={identity.rarity}
          width={14}
          height={14}
          unoptimized
          style={{ flexShrink: 0 }}
        />
      )}
    </div>
  )
}
