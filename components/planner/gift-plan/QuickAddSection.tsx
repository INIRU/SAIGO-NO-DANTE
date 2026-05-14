'use client'

import Image from 'next/image'
import { useLocale } from 'next-intl'
import { ChevronRight, Plus } from 'lucide-react'
import type { GiftData } from '@/lib/planner/types'
import { OCTAGON_CLIP, STORAGE_BASE } from './constants'

// ── Quick-add pills ──────────────────────────────────────────────────────────
export default function QuickAddSection({
  label,
  gifts,
  finalIds,
  onAdd,
}: {
  label: string
  gifts: GiftData[]
  finalIds: Set<number>
  onAdd: (gift: GiftData) => void
}) {
  const locale = useLocale()
  if (gifts.length === 0) return null
  return (
    <div className="planner-quick-add-section">
      <div className="planner-quick-add-label" style={{
        fontSize: '0.6875rem',
        color: '#666',
        marginBottom: '0.375rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem',
      }}>
        <ChevronRight size={10} color="#555" />
        {label}
      </div>
      <div className="planner-quick-add-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
        {gifts.map(gift => {
          const already = finalIds.has(gift.game_id)
          const displayName = locale === 'en'
            ? gift.name_en || gift.name
            : locale === 'ja'
              ? gift.name_jp || gift.name
              : gift.name
          return (
            <button
              key={gift.id}
              onClick={() => { if (!already) onAdd(gift) }}
              disabled={already}
              title={displayName}
              aria-label={displayName}
              className="planner-quick-add-chip"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.25rem 0.5rem',
                background: already ? 'rgba(200,144,10,0.1)' : '#1a1510',
                border: `1px solid ${already ? '#c8900a60' : '#2a2520'}`,
                borderRadius: '0.375rem',
                cursor: already ? 'default' : 'pointer',
                opacity: already ? 0.6 : 1,
                color: '#d1d5db',
                fontSize: '0.6875rem',
                transition: 'all 0.15s',
              }}
            >
              {/* Mini octagon */}
              <div style={{
                width: '1.25rem',
                height: '1.25rem',
                flexShrink: 0,
                clipPath: OCTAGON_CLIP,
                backgroundImage: `url(${STORAGE_BASE}/icons/ego-gift-bg.webp)`,
                backgroundSize: 'cover',
                position: 'relative',
                overflow: 'hidden',
              }}>
                {gift.image_url?.startsWith('http') && (
                  <Image src={gift.image_url} alt={displayName} fill sizes="20px" style={{ objectFit: 'contain', padding: '15%' }} />
                )}
              </div>
              <span style={{ wordBreak: 'keep-all' }}>{displayName}</span>
              {!already && <Plus size={10} color="#c8900a" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
