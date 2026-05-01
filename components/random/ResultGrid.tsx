'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'motion/react'
import ImageWithFallback from '@/components/ui/ImageWithFallback'
import { getIdentityInfoUrl, getSinnerLogoUrl } from '@/lib/utils/images'
import { RARITY_COLORS, RARITY_ICON_MAP, GRADE_COLORS, STORAGE_BASE } from '@/lib/constants/game'
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
  const lastRollId = useRef(0)
  const [rerollingIds, setRerollingIds] = useState<Set<string>>(new Set())
  // Track which sinners have been rerolled and are ready to animate back in
  const [rerollRevealIds, setRerollRevealIds] = useState<Set<string>>(new Set())

  // Full roll stagger: track rollId change to trigger entrance animations
  useEffect(() => {
    if (rollId === 0 || rollId === lastRollId.current || !result) return
    lastRollId.current = rollId
    setRerollingIds(new Set())
    setRerollRevealIds(new Set())
    // onRevealDone is called after the last card's animation completes
    // The last card (index 11) has delay 11 * 0.055 = 0.605s + duration 0.55s ≈ 1.16s total
    const timer = setTimeout(() => onRevealDone(), 1200)
    return () => clearTimeout(timer)
  }, [rollId, result, onRevealDone])

  // Individual reroll: mark sinner as rerolling (hides card via animate prop)
  useEffect(() => {
    if (!rerolledSinnerId) return
    setRerollingIds(prev => new Set([...prev, rerolledSinnerId]))
    setRerollRevealIds(prev => {
      const next = new Set(prev)
      next.delete(rerolledSinnerId)
      return next
    })
  }, [rerolledSinnerId, result])

  // Called when the rerolled card's new image finishes loading
  const handleRerollImageLoad = useCallback((sinnerId: string) => {
    if (!rerollingIds.has(sinnerId)) return
    setRerollingIds(prev => {
      const next = new Set(prev)
      next.delete(sinnerId)
      return next
    })
    setRerollRevealIds(prev => new Set([...prev, sinnerId]))
  }, [rerollingIds])

  // No result — ghost cards
  if (!result) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-[0.75rem] gap-y-[1rem]">
        {sinners.map((sinner, idx) => (
          <div
            key={sinner.id}
            className="animate-fade-in"
            style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'both' }}
          >
            <div
              className="w-full rounded-[0.375rem] overflow-hidden relative animate-ghost-pulse"
              style={{
                aspectRatio: '2/3',
                background: 'linear-gradient(160deg, #1a1510 0%, #0d0a06 60%, #100c08 100%)',
                border: '1.5px dashed rgba(42,32,21,0.4)',
                animationDelay: `${idx * 150}ms`,
                transition: 'border-color 0.3s, box-shadow 0.3s',
              }}
            >
              {/* Sinner logo watermark */}
              <div className="absolute inset-0 flex items-center justify-center">
                <Image
                  src={getSinnerLogoUrl(sinner.id)}
                  alt=""
                  width={48}
                  height={48}
                  style={{ width: '3rem', height: '3rem', opacity: 0.08, filter: 'grayscale(1)' }}
                />
              </div>
              {/* Corner ornaments */}
              <div className="absolute top-0 left-0 w-[1.25rem] h-[1.25rem]" style={{ borderTop: '1px solid rgba(138,96,16,0.12)', borderLeft: '1px solid rgba(138,96,16,0.12)' }} />
              <div className="absolute top-0 right-0 w-[1.25rem] h-[1.25rem]" style={{ borderTop: '1px solid rgba(138,96,16,0.08)', borderRight: '1px solid rgba(138,96,16,0.08)' }} />
              <div className="absolute bottom-0 left-0 w-[1.25rem] h-[1.25rem]" style={{ borderBottom: '1px solid rgba(138,96,16,0.08)', borderLeft: '1px solid rgba(138,96,16,0.08)' }} />
              <div className="absolute bottom-0 right-0 w-[1.25rem] h-[1.25rem]" style={{ borderBottom: '1px solid rgba(138,96,16,0.12)', borderRight: '1px solid rgba(138,96,16,0.12)' }} />
              {/* Sinner name hint */}
              <div className="absolute bottom-[0.375rem] inset-x-0 flex justify-center">
                <span style={{ fontSize: '0.5rem', color: '#2a2015', letterSpacing: '0.08em', fontFamily: 'var(--font-heading)' }}>{sinner.name_kr}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Identity tab
  if (activeTab === 'identity') {
    const isCurrentRoll = lastRollId.current === rollId
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-[0.75rem] gap-y-[1rem]">
        {sinners.map((sinner, idx) => {
          const identity = result.identities[sinner.id]
          if (!identity) return null
          const pool = pools[sinner.id]
          const canReroll = pool && pool.length > 1
          const colors = RARITY_COLORS[identity.rarity] ?? RARITY_COLORS[1]
          const isRerolling = rerollingIds.has(sinner.id)
          const isRevealingReroll = rerollRevealIds.has(sinner.id)

          return (
            <motion.div
              key={sinner.id}
              data-card
              data-sinner={sinner.id}
              // Full roll stagger entrance
              initial={{ opacity: 0, y: 40, scale: 0.88, rotateX: 8 }}
              animate={
                isRerolling
                  // Hide while rerolling (card spins away)
                  ? { opacity: 0, scale: 0.9, rotateY: 90 }
                  : isRevealingReroll
                  // Flip back in after reroll image loads
                  ? { opacity: 1, scale: 1, rotateY: 0 }
                  : isCurrentRoll
                  // Normal stagger entrance
                  ? { opacity: 1, y: 0, scale: 1, rotateX: 0 }
                  : { opacity: revealed ? 1 : 0, y: 0, scale: 1, rotateX: 0 }
              }
              transition={
                isRerolling
                  ? { duration: 0.2, ease: 'easeIn' }
                  : isRevealingReroll
                  ? { duration: 0.4, ease: [0.175, 0.885, 0.32, 1.7] }
                  : {
                      duration: 0.55,
                      delay: isCurrentRoll ? idx * 0.055 : 0,
                      ease: [0.175, 0.885, 0.32, 1.6],
                    }
              }
              style={{ perspective: '600px' }}
            >
              <div
                className={`group relative w-full rounded-[0.375rem] overflow-hidden transition-all duration-300 ${revealed ? 'card-shimmer' : ''}`}
                style={{
                  aspectRatio: '2/3',
                  border: `1.5px solid ${colors.border}55`,
                  boxShadow: revealed
                    ? `0 0 1.25rem ${colors.glow}, 0 0.5rem 2rem rgba(0,0,0,0.5)`
                    : '0 0.25rem 1rem rgba(0,0,0,0.3)',
                  cursor: canReroll ? 'pointer' : 'default',
                  transform: 'translateZ(0)',
                }}
                onClick={() => canReroll && onReroll(sinner.id)}
                title={canReroll ? `${identity.name_kr} — 클릭하여 리롤` : identity.name_kr}
              >
                {/* Portrait — key forces remount on identity change */}
                <ImageWithFallback
                  key={identity.id}
                  src={getIdentityInfoUrl(identity)}
                  alt={identity.name_kr}
                  fill
                  sizes="6rem"
                  unoptimized
                  fallbackType="identity"
                  className="transition-transform duration-500 group-hover:scale-[1.03]"
                  style={{ objectFit: 'cover', objectPosition: 'top' }}
                  onLoad={() => handleRerollImageLoad(sinner.id)}
                />

                {/* Top rarity accent bar */}
                <div
                  className="absolute top-0 inset-x-0 h-[0.125rem] pointer-events-none"
                  style={{ background: `linear-gradient(90deg, transparent, ${colors.border}, transparent)` }}
                />

                {/* Sinner logo — top left */}
                <div className="absolute top-[0.375rem] left-[0.375rem] pointer-events-none">
                  <Image
                    src={getSinnerLogoUrl(sinner.id)}
                    alt=""
                    width={16}
                    height={16}
                    style={{ width: '1rem', height: '1rem', opacity: 0.5, filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.9))' }}
                  />
                </div>

                {/* Rarity icon — top right */}
                {RARITY_ICON_MAP[identity.rarity] && (
                  <div className="absolute top-[0.375rem] right-[0.375rem] pointer-events-none">
                    <Image
                      src={RARITY_ICON_MAP[identity.rarity]}
                      alt=""
                      width={32}
                      height={32}
                      unoptimized
                      style={{ height: '1.5rem', width: 'auto', opacity: 0.85, filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.9))' }}
                    />
                  </div>
                )}

                {/* Cinematic vignette */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ boxShadow: 'inset 0 0 2rem rgba(0,0,0,0.4), inset 0 -3rem 3rem -1.5rem rgba(0,0,0,0.7)' }}
                />

                {/* Bottom gradient */}
                <div
                  className="absolute inset-x-0 bottom-0 h-[55%] pointer-events-none"
                  style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.5) 45%, transparent 100%)' }}
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

                {/* Bottom rarity accent */}
                <div
                  className="absolute bottom-0 inset-x-0 h-[0.0625rem] pointer-events-none"
                  style={{ background: `linear-gradient(90deg, transparent, ${colors.border}88, transparent)` }}
                />

                {/* Reroll hover overlay */}
                {canReroll && (
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center" style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.45) 100%)', backdropFilter: 'blur(1px)' }}>
                    <RefreshCw className="transition-transform duration-300 group-hover:rotate-180" style={{ width: '1.5rem', height: '1.5rem', color: '#e8b030', filter: 'drop-shadow(0 0 6px rgba(232,176,48,0.5))' }} />
                    <span style={{ fontSize: '0.5625rem', color: '#e8b030', marginTop: '0.375rem', letterSpacing: '0.05em', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>리롤</span>
                  </div>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    )
  }

  // EGO tab — deck builder style: sinner card + grade slot list
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-[1rem] gap-y-[1rem]">
      {sinners.map((sinner, idx) => {
        const egoList = result.egos?.[sinner.id] ?? []
        const hasAny = egoList.length > 0
        const firstActiveSin = egoList[0]?.sin_affinity
        const accentColor = firstActiveSin ? (SIN_COLORS[firstActiveSin as SinType] ?? '#8a6010') : '#8a6010'

        return (
          <div
            key={sinner.id}
            className="animate-fade-in rounded-[0.375rem] overflow-hidden"
            style={{
              background: 'linear-gradient(160deg, #1a1510 0%, #100d08 100%)',
              border: `1px solid ${hasAny ? accentColor + '30' : '#221a0f'}`,
              animationDelay: `${idx * 40}ms`,
              animationFillMode: 'both',
              boxShadow: hasAny ? `0 0 1rem ${accentColor}10` : 'none',
            }}
          >
            {/* Sinner header */}
            <div className="flex items-center gap-[0.375rem] px-[0.5rem] py-[0.375rem] relative" style={{ borderBottom: `1px solid ${hasAny ? accentColor + '20' : '#1a1208'}` }}>
              {/* Accent line at top */}
              <div className="absolute top-0 inset-x-0 h-[0.0625rem]" style={{ background: hasAny ? `linear-gradient(90deg, transparent, ${accentColor}55, transparent)` : 'none' }} />
              <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={14} height={14} style={{ width: '0.875rem', height: '0.875rem', opacity: hasAny ? 0.7 : 0.35 }} unoptimized />
              <span className="font-serif font-light truncate" style={{ color: hasAny ? '#6a5530' : '#4a3520', fontSize: '0.5625rem' }}>{sinner.name_kr}</span>
            </div>

            {/* Grade slots */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem', padding: '0.125rem' }}>
              {GRADE_ORDER.map(grade => {
                const ego = egoList.find(e => e.grade === grade)
                const isActive = !!ego
                const gc = GRADE_COLORS[grade] ?? '#667788'
                const sc = isActive && ego?.sin_affinity ? (SIN_COLORS[ego.sin_affinity as SinType] ?? gc) : gc

                return (
                  <div
                    key={grade}
                    style={{
                      background: isActive ? `${sc}15` : 'rgba(10,8,5,0.5)',
                      borderRadius: '0.1875rem',
                      padding: '0.25rem 0.3125rem',
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: '0.3125rem',
                      minHeight: '1.5rem',
                      transition: 'all 0.2s',
                      borderLeft: isActive ? `2px solid ${sc}88` : '2px solid transparent',
                      borderTop: 'none',
                      borderRight: 'none',
                      borderBottom: 'none',
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
                        style={{ height: '0.6875rem', width: 'auto', opacity: isActive ? 0.9 : 0.2, flexShrink: 0, transition: 'opacity 0.2s' }}
                      />
                    ) : (
                      <span style={{ color: isActive ? sc : gc, fontSize: '0.375rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', opacity: isActive ? 0.9 : 0.2, flexShrink: 0 }}>ALEPH</span>
                    )}
                    {isActive && ego
                      ? <span style={{ color: sc, fontSize: '0.5rem', fontWeight: 700, lineHeight: 1.2, wordBreak: 'keep-all', flex: 1, textAlign: 'left', textShadow: `0 0 0.5rem ${sc}30` }}>{ego.name_kr || ego.name}</span>
                      : <span style={{ color: '#1a1208', fontSize: '0.625rem', lineHeight: 1 }}>—</span>
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
