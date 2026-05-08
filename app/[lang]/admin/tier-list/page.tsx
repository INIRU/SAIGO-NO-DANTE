'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from 'react'
import Image from 'next/image'
import { ArrowDown, ArrowUp, GripVertical, RotateCcw, Save, Search, X } from 'lucide-react'
import { AdminButton } from '@/components/admin'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { RARITY_ICON_MAP } from '@/lib/constants/game'
import { showError, showSuccess } from '@/lib/toast'
import type { Identity } from '@/lib/types'
import { getIdentityInfoUrl } from '@/lib/utils/images'

const ADMIN_REROLL_TIERS = ['S+', 'S', 'A', 'B', 'C'] as const
type AdminRerollTier = typeof ADMIN_REROLL_TIERS[number]
type DropTarget = AdminRerollTier | 'unassigned'

const TIER_COLORS: Record<AdminRerollTier, string> = {
  'S+': '#ff5050',
  S: '#ff7a2f',
  A: '#f3c13a',
  B: '#60c860',
  C: '#60a0ff',
}

const TIER_LABELS: Record<AdminRerollTier, string> = {
  'S+': '개사기',
  S: '매우 좋음',
  A: '좋음',
  B: '적당함',
  C: '유효',
}

type TierIdentity = Pick<
  Identity,
  'id' | 'name_kr' | 'rarity' | 'sinner_id' | 'game_id' | 'folder_name' | 'acquisition_info' | 'release_date'
>

type AssignedRow = {
  tier: string
  identity: TierIdentity | TierIdentity[] | null
}

type AdminTierResponse = {
  assigned?: AssignedRow[]
  unassigned?: TierIdentity[]
  error?: string
}

type AdminTierState = Record<AdminRerollTier, TierIdentity[]>

function createEmptyTierState(): AdminTierState {
  return {
    'S+': [],
    S: [],
    A: [],
    B: [],
    C: [],
  }
}

function isAdminRerollTier(value: string): value is AdminRerollTier {
  return ADMIN_REROLL_TIERS.includes(value as AdminRerollTier)
}

function getIdentityName(identity: TierIdentity) {
  return identity.name_kr || identity.id
}

function matchesIdentitySearch(identity: TierIdentity, query: string) {
  if (!query) return true
  return getIdentityName(identity).toLowerCase().includes(query)
}

export default function AdminTierListPage() {
  const [tiers, setTiers] = useState<AdminTierState>(() => createEmptyTierState())
  const [unassigned, setUnassigned] = useState<TierIdentity[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [dragOverTarget, setDragOverTarget] = useState<DropTarget | null>(null)
  const dragItem = useRef<{ id: string; source: DropTarget } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/tier-list', { cache: 'no-store' })
      const data = await res.json() as AdminTierResponse
      if (!res.ok) throw new Error(data.error ?? '티어표를 불러오지 못했습니다.')

      const nextTiers = createEmptyTierState()
      for (const row of data.assigned ?? []) {
        if (!isAdminRerollTier(row.tier)) continue
        const identity = Array.isArray(row.identity) ? row.identity[0] : row.identity
        if (identity) nextTiers[row.tier].push(identity)
      }

      setTiers(nextTiers)
      setUnassigned(data.unassigned ?? [])
    } catch (error) {
      showError(error instanceof Error ? error.message : '티어표를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const totalAssigned = useMemo(
    () => ADMIN_REROLL_TIERS.reduce((sum, tier) => sum + tiers[tier].length, 0),
    [tiers],
  )

  const normalizedSearchQuery = searchQuery.trim().toLowerCase()

  const filteredTiers = useMemo(() => {
    const next = createEmptyTierState()
    for (const tier of ADMIN_REROLL_TIERS) {
      next[tier] = tiers[tier].filter(identity => matchesIdentitySearch(identity, normalizedSearchQuery))
    }
    return next
  }, [normalizedSearchQuery, tiers])

  const filteredUnassigned = useMemo(() => {
    if (!normalizedSearchQuery) return unassigned
    return unassigned.filter(identity => matchesIdentitySearch(identity, normalizedSearchQuery))
  }, [normalizedSearchQuery, unassigned])

  const moveIdentity = useCallback((id: string, source: DropTarget, target: DropTarget) => {
    if (source === target) return

    let moving: TierIdentity | undefined
    if (source === 'unassigned') {
      moving = unassigned.find(identity => identity.id === id)
    } else {
      moving = tiers[source].find(identity => identity.id === id)
    }
    if (!moving) return

    if (source === 'unassigned') {
      setUnassigned(prev => prev.filter(identity => identity.id !== id))
    } else {
      setTiers(prev => ({ ...prev, [source]: prev[source].filter(identity => identity.id !== id) }))
    }

    if (target === 'unassigned') {
      setUnassigned(prev => [...prev, moving])
    } else {
      setTiers(prev => ({ ...prev, [target]: [...prev[target], moving] }))
    }
  }, [tiers, unassigned])

  const reorderIdentity = useCallback((tier: AdminRerollTier, id: string, direction: -1 | 1) => {
    setTiers(prev => {
      const current = prev[tier]
      const currentIndex = current.findIndex(identity => identity.id === id)
      const nextIndex = currentIndex + direction
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= current.length) return prev

      const reordered = [...current]
      const [moving] = reordered.splice(currentIndex, 1)
      reordered.splice(nextIndex, 0, moving)
      return { ...prev, [tier]: reordered }
    })
  }, [])

  const onDragStart = (event: DragEvent<HTMLElement>, id: string, source: DropTarget) => {
    dragItem.current = { id, source }
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', id)
  }

  const onDragOver = (event: DragEvent<HTMLElement>, target: DropTarget) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDragOverTarget(target)
  }

  const onDrop = (event: DragEvent<HTMLElement>, target: DropTarget) => {
    event.preventDefault()
    const drag = dragItem.current
    setDragOverTarget(null)
    dragItem.current = null
    if (!drag) return
    moveIdentity(drag.id, drag.source, target)
  }

  const handleSave = async () => {
    setConfirmOpen(false)
    setSaving(true)
    try {
      const tiersPayload: Record<AdminRerollTier, string[]> = {
        'S+': [],
        S: [],
        A: [],
        B: [],
        C: [],
      }
      for (const tier of ADMIN_REROLL_TIERS) {
        tiersPayload[tier] = tiers[tier].map(identity => identity.id)
      }

      const res = await fetch('/api/admin/tier-list', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiers: tiersPayload }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? '저장 실패')
      showSuccess('리세 티어표가 저장되었습니다.')
      await fetchData()
    } catch (error) {
      showError(error instanceof Error ? error.message : '저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[25rem] items-center justify-center">
        <p style={{ color: '#8a7855', fontSize: '1rem' }}>리세 티어표를 불러오는 중…</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p style={{ color: 'var(--gold-dim)', fontSize: '0.875rem', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
            REROLL TIER EDITOR
          </p>
          <h1 className="font-serif" style={{ color: 'var(--gold)', fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.25, marginTop: '0.25rem' }}>
            리세마라 티어표
          </h1>
          <p style={{ color: '#9d8b66', fontSize: '1rem', lineHeight: 1.55, marginTop: '0.375rem' }}>
            드래그, 직접 티어 지정, 같은 티어 내 순서 이동으로 저장 순서를 조정하세요. 현재 {totalAssigned}개 인격이 배정되어 있습니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AdminButton
            onClick={() => void fetchData()}
            variant="ghost"
            size="md"
            disabled={saving}
            style={{ minHeight: '2.75rem', fontSize: '0.9375rem' }}
          >
            <RotateCcw size={15} aria-hidden="true" />
            다시 불러오기
          </AdminButton>
          <AdminButton
            onClick={() => setConfirmOpen(true)}
            variant="gold"
            size="md"
            loading={saving}
            disabled={saving}
            style={{ minHeight: '2.75rem', fontSize: '0.9375rem' }}
          >
            <Save size={15} aria-hidden="true" />
            {saving ? '저장 중…' : '저장'}
          </AdminButton>
        </div>
      </header>

      <section
        aria-label="티어표 검색과 배정 현황"
        className="flex flex-wrap items-center justify-between gap-3"
        style={{
          padding: '0.75rem',
          border: '1px solid rgba(58,42,21,0.72)',
          borderRadius: '0.5rem',
          background: '#14100c',
        }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono tabular-nums" style={{ color: '#c8a450', fontSize: '0.9375rem', fontWeight: 800 }}>
            배정 {totalAssigned}
          </span>
          <span className="font-mono tabular-nums" style={{ color: '#8a7855', fontSize: '0.9375rem', fontWeight: 700 }}>
            미배정 {unassigned.length}
          </span>
        </div>
        <label className="relative block" style={{ width: 'min(100%, 22rem)' }}>
          <span className="sr-only">전체 인격 검색</span>
          <Search size={15} aria-hidden="true" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#8a7855' }} />
          <input
            type="search"
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            placeholder="배정/미배정 전체 검색"
            style={{
              width: '100%',
              minHeight: '2.75rem',
              padding: '0 2.5rem 0 2.25rem',
              border: '1px solid rgba(200,144,10,0.24)',
              borderRadius: '0.375rem',
              background: '#1a1510',
              color: '#d8c99b',
              fontSize: '0.9375rem',
              outline: 'none',
            }}
            className="focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="검색어 지우기"
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
              style={{
                position: 'absolute',
                right: '0.25rem',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '2.25rem',
                height: '2.25rem',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 0,
                background: 'transparent',
                color: '#8a7855',
                cursor: 'pointer',
              }}
            >
              <X size={15} aria-hidden="true" />
            </button>
          )}
        </label>
      </section>

      <section aria-label="티어 배치 영역" style={{ display: 'grid', gap: '0.375rem' }}>
        {ADMIN_REROLL_TIERS.map(tier => (
          <TierDropZone
            key={tier}
            tier={tier}
            identities={tiers[tier]}
            visibleIdentities={filteredTiers[tier]}
            dragOver={dragOverTarget === tier}
            searchActive={normalizedSearchQuery.length > 0}
            onDragOver={event => onDragOver(event, tier)}
            onDragLeave={() => setDragOverTarget(null)}
            onDrop={event => onDrop(event, tier)}
            onDragStart={(event, id) => onDragStart(event, id, tier)}
            onMoveTo={(id, target) => moveIdentity(id, tier, target)}
            onReorder={(id, direction) => reorderIdentity(tier, id, direction)}
          />
        ))}
      </section>

      <section
        aria-labelledby="unassigned-tier-title"
        onDragOver={event => onDragOver(event, 'unassigned')}
        onDragLeave={() => setDragOverTarget(null)}
        onDrop={event => onDrop(event, 'unassigned')}
        style={{
          display: 'grid',
          gap: '0.75rem',
          padding: '1rem',
          border: dragOverTarget === 'unassigned' ? '1px dashed rgba(200,144,10,0.52)' : '1px solid rgba(58,42,21,0.72)',
          borderRadius: '0.5rem',
          background: dragOverTarget === 'unassigned' ? 'rgba(200,144,10,0.08)' : '#14100c',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="unassigned-tier-title" className="font-serif" style={{ color: '#c8a450', fontSize: '1.125rem', fontWeight: 650 }}>
            미배정 인격 ({unassigned.length})
          </h2>
          {normalizedSearchQuery && (
            <span className="font-mono tabular-nums" style={{ color: '#6f5b3a', fontSize: '0.875rem' }}>
              검색 표시 {filteredUnassigned.length}/{unassigned.length}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2" style={{ minHeight: '5rem', alignItems: 'flex-start' }}>
          {filteredUnassigned.map(identity => (
            <MiniIdentityCard
              key={identity.id}
              identity={identity}
              source="unassigned"
              onDragStart={event => onDragStart(event, identity.id, 'unassigned')}
              onMoveTo={target => moveIdentity(identity.id, 'unassigned', target)}
            />
          ))}
          {filteredUnassigned.length === 0 && (
            <p style={{ margin: 'auto', color: '#75685a', fontSize: '0.9375rem' }}>
              {searchQuery ? '검색 결과가 없습니다.' : '모든 인격이 배정되었습니다.'}
            </p>
          )}
        </div>
      </section>

      <ConfirmModal
        open={confirmOpen}
        title="리세 티어표 저장"
        message={`${totalAssigned}개 인격의 S+/S/A/B/C 배치를 저장합니다.`}
        confirmLabel="저장"
        cancelLabel="취소"
        variant="warning"
        onConfirm={handleSave}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}

function TierDropZone({
  tier,
  identities,
  visibleIdentities,
  dragOver,
  searchActive,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragStart,
  onMoveTo,
  onReorder,
}: {
  tier: AdminRerollTier
  identities: TierIdentity[]
  visibleIdentities: TierIdentity[]
  dragOver: boolean
  searchActive: boolean
  onDragOver: (event: DragEvent<HTMLElement>) => void
  onDragLeave: () => void
  onDrop: (event: DragEvent<HTMLElement>) => void
  onDragStart: (event: DragEvent<HTMLElement>, id: string) => void
  onMoveTo: (id: string, target: DropTarget) => void
  onReorder: (id: string, direction: -1 | 1) => void
}) {
  const tierTextColor = tier === 'A' ? '#241900' : '#fff'
  const firstOrder = identities.length > 0 ? 1 : 0
  const lastOrder = identities.length

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(4.75rem, 5.5rem) minmax(0, 1fr)',
        minHeight: '5.25rem',
        border: dragOver ? '1px dashed rgba(200,144,10,0.52)' : '1px solid rgba(58,42,21,0.56)',
        borderRadius: '0.5rem',
        background: dragOver ? 'rgba(200,144,10,0.08)' : '#14100c',
        overflow: 'hidden',
        transition: 'background 160ms ease, border-color 160ms ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.125rem',
          padding: '0.5rem',
          background: TIER_COLORS[tier],
          color: tierTextColor,
          textShadow: tier === 'A' ? 'none' : '0 1px 3px rgba(0,0,0,0.45)',
        }}
      >
        <strong className="font-serif" style={{ fontSize: '1.25rem', lineHeight: 1 }}>
          {tier}
        </strong>
        <span style={{ fontSize: '0.875rem', fontWeight: 800, lineHeight: 1.2 }}>
          {TIER_LABELS[tier]}
        </span>
        <span className="font-mono tabular-nums" style={{ fontSize: '0.875rem', fontWeight: 800, lineHeight: 1.2 }}>
          {identities.length}개
        </span>
      </div>
      <div style={{ display: 'grid', gap: '0.5rem', padding: '0.625rem' }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono tabular-nums" style={{ color: '#8a7855', fontSize: '0.875rem', fontWeight: 700 }}>
            저장 순서 {firstOrder > 0 ? `#${firstOrder}-#${lastOrder}` : '없음'}
          </span>
          {searchActive && (
            <span className="font-mono tabular-nums" style={{ color: '#6f5b3a', fontSize: '0.875rem' }}>
              검색 표시 {visibleIdentities.length}/{identities.length}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2" style={{ alignItems: 'center' }}>
          {visibleIdentities.map(identity => {
            const orderIndex = identities.findIndex(item => item.id === identity.id)
            return (
              <MiniIdentityCard
                key={identity.id}
                identity={identity}
                source={tier}
                orderNumber={orderIndex + 1}
                isFirst={orderIndex === 0}
                isLast={orderIndex === identities.length - 1}
                onDragStart={event => onDragStart(event, identity.id)}
                onMoveTo={target => onMoveTo(identity.id, target)}
                onReorder={direction => onReorder(identity.id, direction)}
              />
            )
          })}
          {identities.length === 0 && (
            <p style={{ color: '#75685a', fontSize: '0.9375rem', fontStyle: 'italic' }}>
              여기에 인격을 드래그하세요.
            </p>
          )}
          {identities.length > 0 && visibleIdentities.length === 0 && (
            <p style={{ color: '#75685a', fontSize: '0.9375rem', fontStyle: 'italic' }}>
              검색 조건에 맞는 인격이 없습니다.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function MiniIdentityImage({ identity }: { identity: TierIdentity }) {
  const [failed, setFailed] = useState(false)
  const imageUrl = getIdentityInfoUrl(identity as Identity)
  const name = getIdentityName(identity)

  if (!imageUrl || failed) {
    return (
      <div
        aria-hidden="true"
        style={{
          width: '2.25rem',
          height: '2.25rem',
          borderRadius: '0.25rem',
          background: 'linear-gradient(160deg, #1e1810, #0d0a06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: '0 0 auto',
        }}
      >
        <span className="font-serif" style={{ fontSize: '0.9375rem', color: 'rgba(200,144,10,0.42)' }}>
          {name[0]}
        </span>
      </div>
    )
  }

  return (
    <Image
      src={imageUrl}
      alt={name}
      width={36}
      height={36}
      unoptimized
      onError={() => setFailed(true)}
      style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.25rem', objectFit: 'cover', flex: '0 0 auto' }}
    />
  )
}

function MiniIdentityCard({
  identity,
  source,
  orderNumber,
  isFirst = true,
  isLast = true,
  onDragStart,
  onMoveTo,
  onReorder,
}: {
  identity: TierIdentity
  source: DropTarget
  orderNumber?: number
  isFirst?: boolean
  isLast?: boolean
  onDragStart: (event: DragEvent<HTMLElement>) => void
  onMoveTo: (target: DropTarget) => void
  onReorder?: (direction: -1 | 1) => void
}) {
  const name = getIdentityName(identity)
  const rarityIcon = RARITY_ICON_MAP[identity.rarity]
  const tierButtonBase = {
    minWidth: '2.25rem',
    minHeight: '2.25rem',
    padding: '0 0.375rem',
    border: '1px solid rgba(58,42,21,0.82)',
    borderRadius: '0.375rem',
    background: '#14100c',
    color: '#a99768',
    fontSize: '0.9375rem',
    fontWeight: 800,
    cursor: 'pointer',
  } satisfies CSSProperties
  const iconButtonBase = {
    width: '2.25rem',
    height: '2.25rem',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(58,42,21,0.82)',
    borderRadius: '0.375rem',
    background: '#14100c',
    color: '#a99768',
    cursor: 'pointer',
  } satisfies CSSProperties

  return (
    <article
      draggable
      onDragStart={onDragStart}
      title={name}
      style={{
        display: 'grid',
        gap: '0.5rem',
        width: 'min(100%, 24rem)',
        minHeight: '2.75rem',
        padding: '0.375rem',
        border: '1px solid rgba(58,42,21,0.82)',
        borderRadius: '0.375rem',
        background: '#1a1510',
        color: '#d8c99b',
        cursor: 'grab',
        userSelect: 'none',
      }}
      className="transition-colors hover:border-[var(--gold-dim)]"
    >
      <div className="flex min-w-0 items-center gap-2">
        <GripVertical size={14} aria-hidden="true" style={{ color: '#6f5b3a', flex: '0 0 auto' }} />
        <MiniIdentityImage identity={identity} />
        {orderNumber !== undefined && (
          <span className="font-mono tabular-nums" style={{ flex: '0 0 auto', color: '#8a7855', fontSize: '0.875rem', fontWeight: 800 }}>
            #{orderNumber}
          </span>
        )}
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.9375rem', fontWeight: 700 }}>
          {name}
        </span>
        {rarityIcon && (
          <Image
            src={rarityIcon}
            alt={`${identity.rarity}성`}
            width={18}
            height={18}
            unoptimized
            style={{ flex: '0 0 auto', width: '1.125rem', height: 'auto' }}
          />
        )}
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-1.5" style={{ cursor: 'default' }}>
        {source !== 'unassigned' && onReorder && (
          <div className="flex items-center gap-1" aria-label={`${name} 순서 변경`}>
            <button
              type="button"
              onClick={() => onReorder(-1)}
              disabled={isFirst}
              aria-label={`${name} 위로 이동`}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] disabled:cursor-not-allowed disabled:opacity-40"
              style={iconButtonBase}
            >
              <ArrowUp size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onReorder(1)}
              disabled={isLast}
              aria-label={`${name} 아래로 이동`}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] disabled:cursor-not-allowed disabled:opacity-40"
              style={iconButtonBase}
            >
              <ArrowDown size={15} aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="flex min-w-0 flex-wrap items-center gap-1" aria-label={`${name} 티어 직접 지정`}>
          {ADMIN_REROLL_TIERS.map(tier => {
            const selected = source === tier
            return (
              <button
                key={tier}
                type="button"
                onClick={() => onMoveTo(tier)}
                disabled={selected}
                aria-label={`${name} ${tier} 티어로 이동`}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] disabled:cursor-not-allowed"
                style={{
                  ...tierButtonBase,
                  background: selected ? 'rgba(200,144,10,0.2)' : '#14100c',
                  borderColor: selected ? 'rgba(200,144,10,0.5)' : 'rgba(58,42,21,0.82)',
                  color: selected ? '#e8b030' : '#a99768',
                  cursor: selected ? 'not-allowed' : 'pointer',
                }}
              >
                {tier}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => onMoveTo('unassigned')}
            disabled={source === 'unassigned'}
            aria-label={`${name} 미배정으로 이동`}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] disabled:cursor-not-allowed disabled:opacity-40"
            style={iconButtonBase}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  )
}
