'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { getIdentityInfoUrl, getSinnerLogoUrl } from '@/lib/utils/images'
import { RARITY_COLORS, GRADE_COLORS, STORAGE_BASE } from '@/lib/constants/game'
import { SIN_COLORS } from '@/lib/constants/sin'
import type { Sinner, Identity, SinType } from '@/lib/types'
import type { RandomResult } from '@/lib/random/engine'
import { RefreshCw } from 'lucide-react'

type Props = {
  sinners: Sinner[]
  pools: Record<string, Identity[]>
  result: RandomResult | null
  activeTab: 'identity' | 'ego'
  rollId: number
  rerolledSinnerId: string | null
  revealed: boolean
  onRevealDone: () => void
  onReroll: (sinnerId: string) => void
}

export default function ResultGrid({ sinners, pools, result, activeTab, rollId, rerolledSinnerId, revealed, onRevealDone, onReroll }: Props) {
  const gridRef = useRef<HTMLDivElement>(null)
  const lastRollId = useRef(0)
  const [rerollingId, setRerollingId] = useState<string | null>(null)

  // Full roll stagger animation (only on rollId change)
  useEffect(() => {
    if (rollId === 0 || rollId === lastRollId.current || !result) return
    lastRollId.current = rollId
    setRerollingId(null)

    ;(async () => {
      const { gsap } = await import('gsap')
      const cards = gridRef.current?.querySelectorAll('[data-card]')
      if (!cards?.length) return

      gsap.fromTo(cards,
        { opacity: 0, y: 30, scale: 0.92 },
        {
          opacity: 1, y: 0, scale: 1,
          duration: 0.5,
          stagger: 0.06,
          ease: 'back.out(1.4)',
          onComplete: () => onRevealDone(),
        },
      )
    })()
  }, [rollId, result, onRevealDone])

  // Individual reroll: immediately hide the card, wait for new image to load
  useEffect(() => {
    if (!rerolledSinnerId || !gridRef.current) return
    setRerollingId(rerolledSinnerId)
    const card = gridRef.current.querySelector(`[data-sinner="${rerolledSinnerId}"]`) as HTMLElement | null
    if (card) {
      card.style.opacity = '0'
      card.style.transform = 'scale(0.9)'
    }
  }, [rerolledSinnerId, result])

  // Called when the rerolled card's new image finishes loading
  const handleRerollImageLoad = useCallback((sinnerId: string) => {
    if (sinnerId !== rerollingId || !gridRef.current) return
    setRerollingId(null)

    ;(async () => {
      const { gsap } = await import('gsap')
      const card = gridRef.current?.querySelector(`[data-sinner="${sinnerId}"]`)
      if (!card) return

      gsap.fromTo(card,
        { opacity: 0, scale: 0.9 },
        { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(1.7)' },
      )
    })()
  }, [rerollingId])

  // No result — ghost cards
  if (!result) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-[0.75rem] gap-y-[1rem]">
        {sinners.map(sinner => (
          <div key={sinner.id}>
            <div
              className="w-full rounded-[0.25rem] overflow-hidden relative"
              style={{
                aspectRatio: '2/3',
                background: 'linear-gradient(160deg, #1e1810 0%, #0d0a06 100%)',
                border: '1.5px dashed #2a2015',
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[1.5rem] text-[#2a2015] select-none">?</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Identity tab
  if (activeTab === 'identity') {
    return (
      <div ref={gridRef} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-[0.75rem] gap-y-[1rem]">
        {sinners.map(sinner => {
          const identity = result.identities[sinner.id]
          if (!identity) return null
          const pool = pools[sinner.id]
          const canReroll = pool && pool.length > 1
          const colors = RARITY_COLORS[identity.rarity] ?? RARITY_COLORS[1]

          return (
            <div
              key={sinner.id}
              data-card
              data-sinner={sinner.id}
              style={{ opacity: lastRollId.current === rollId && revealed ? 1 : 0 }}
            >
              <div
                className="group relative w-full rounded-[0.25rem] overflow-hidden transition-all duration-300"
                style={{
                  aspectRatio: '2/3',
                  border: `1.5px solid ${colors.border}55`,
                  boxShadow: revealed ? `0 0 1rem ${colors.glow}` : 'none',
                  cursor: canReroll ? 'pointer' : 'default',
                }}
                onClick={() => canReroll && onReroll(sinner.id)}
                title={canReroll ? `${identity.name_kr} — 클릭하여 리롤` : identity.name_kr}
              >
                {/* Portrait — key forces remount on identity change */}
                <Image
                  key={identity.id}
                  src={getIdentityInfoUrl(identity)}
                  alt={identity.name_kr}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 16vw"
                  style={{ objectFit: 'cover', objectPosition: 'top' }}
                  onLoad={() => handleRerollImageLoad(sinner.id)}
                />

                {/* Bottom gradient */}
                <div
                  className="absolute inset-x-0 bottom-0 h-[50%] pointer-events-none"
                  style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)' }}
                />

                {/* Identity name */}
                <div className="absolute bottom-0 inset-x-0 px-[0.5rem] pb-[0.5rem]">
                  <p
                    className="text-[0.75rem] font-bold text-right leading-tight"
                    style={{
                      color: '#f0d060',
                      textShadow: '0 1px 4px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.7)',
                      wordBreak: 'keep-all',
                    }}
                  >
                    {identity.name_kr}
                  </p>
                </div>

                {/* Reroll hover */}
                {canReroll && (
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                    <RefreshCw style={{ width: '1.5rem', height: '1.5rem', color: '#e8b030' }} />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // EGO tab — deck builder style: sinner card + grade slot list
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-[1rem] gap-y-[1rem]">
      {sinners.map((sinner, idx) => {
        const ego = result.egos?.[sinner.id]

        return (
          <div
            key={sinner.id}
            className="animate-fade-in rounded-[0.25rem] overflow-hidden"
            style={{
              background: 'linear-gradient(160deg, #1a1510 0%, #100d08 100%)',
              border: '1px solid #221a0f',
              animationDelay: `${idx * 40}ms`,
              animationFillMode: 'both',
            }}
          >
            {/* Sinner header */}
            <div className="flex items-center gap-[0.375rem] px-[0.5rem] py-[0.375rem]" style={{ borderBottom: '1px solid #1a1208' }}>
              <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={14} height={14} style={{ width: '0.875rem', height: '0.875rem', opacity: 0.5 }} />
              <span className="font-serif font-bold truncate" style={{ color: '#4a3520', fontSize: '0.5625rem' }}>{sinner.name_kr}</span>
            </div>
            {/* Grade slots */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '2px' }}>
              {GRADE_ORDER.map(grade => {
                const isActive = ego?.grade === grade
                const gc = GRADE_COLORS[grade] ?? '#667788'
                const sc = isActive && ego?.sin_affinity ? (SIN_COLORS[ego.sin_affinity as SinType] ?? gc) : gc
                return (
                  <div
                    key={grade}
                    style={{
                      background: isActive ? `${sc}1a` : 'rgba(10,8,5,0.7)',
                      border: `1px solid ${isActive ? sc + '55' : '#18120a'}`,
                      borderRadius: '2px',
                      padding: '0.25rem 0.3125rem',
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: '0.3125rem',
                      minHeight: '1.5rem',
                      transition: 'all 0.15s',
                    }}
                  >
                    {/* Grade icon */}
                    {grade !== 'ALEPH' ? (
                      <Image
                        src={`${STORAGE_BASE}/icons/grade/${grade}.webp`}
                        alt={grade}
                        width={22}
                        height={11}
                        unoptimized
                        style={{ height: '0.6875rem', width: 'auto', opacity: isActive ? 0.9 : 0.3, flexShrink: 0 }}
                      />
                    ) : (
                      <span style={{ color: isActive ? sc : gc, fontSize: '0.375rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', opacity: isActive ? 0.9 : 0.3, flexShrink: 0 }}>ALEPH</span>
                    )}
                    {isActive && ego
                      ? <span style={{ color: sc, fontSize: '0.5rem', fontWeight: 700, lineHeight: 1.2, wordBreak: 'keep-all', flex: 1, textAlign: 'left' }}>{ego.name_kr || ego.name}</span>
                      : <span style={{ color: '#2a1e10', fontSize: '0.75rem', lineHeight: 1 }}>·</span>
                    }
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const GRADE_ORDER = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH']
