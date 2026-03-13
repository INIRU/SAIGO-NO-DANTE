'use client'

import { useRef, useEffect, useState } from 'react'
import Image from 'next/image'
import { getIdentityInfoUrl, getEGOImageUrl } from '@/lib/utils/images'
import { RARITY_COLORS, GRADE_COLORS } from '@/lib/constants/game'
import type { Sinner, Identity } from '@/lib/types'
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
  const egoGridRef = useRef<HTMLDivElement>(null)
  const lastRollId = useRef(0)
  const [egoRevealed, setEgoRevealed] = useState(false)

  // Full roll stagger animation (only on rollId change)
  useEffect(() => {
    if (rollId === 0 || rollId === lastRollId.current || !result) return
    lastRollId.current = rollId
    setEgoRevealed(false)

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
          onComplete: () => {
            onRevealDone()
            setTimeout(() => setEgoRevealed(true), 200)
          },
        },
      )
    })()
  }, [rollId, result, onRevealDone])

  // Individual reroll animation (only the specific card)
  useEffect(() => {
    if (!rerolledSinnerId || !gridRef.current) return

    ;(async () => {
      const { gsap } = await import('gsap')
      const card = gridRef.current?.querySelector(`[data-sinner="${rerolledSinnerId}"]`)
      if (!card) return

      gsap.fromTo(card,
        { opacity: 0.4, scale: 0.9, rotateY: 90 },
        { opacity: 1, scale: 1, rotateY: 0, duration: 0.45, ease: 'back.out(1.7)' },
      )
    })()
  }, [rerolledSinnerId, result])

  // EGO grid reveal
  useEffect(() => {
    if (!egoRevealed || !egoGridRef.current) return

    ;(async () => {
      const { gsap } = await import('gsap')
      const cards = egoGridRef.current?.querySelectorAll('[data-ego]')
      if (!cards?.length) return

      gsap.fromTo(cards,
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.04, ease: 'power2.out' },
      )
    })()
  }, [egoRevealed])

  // No result — ghost cards
  if (!result) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-[0.75rem] gap-y-[1rem]">
        {sinners.map(sinner => (
          <div key={sinner.id} className="flex flex-col items-center">
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
                {/* Portrait */}
                <Image
                  src={getIdentityInfoUrl(identity)}
                  alt={identity.name_kr}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 16vw"
                  style={{ objectFit: 'cover', objectPosition: 'top' }}
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

  // EGO tab
  return (
    <div ref={egoGridRef} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-[0.75rem]">
      {sinners.map(sinner => {
        const ego = result.egos?.[sinner.id]
        const gradeColor = ego ? (GRADE_COLORS[ego.grade] ?? '#667788') : '#2a2015'

        if (!ego?.folder_name) {
          return (
            <div
              key={sinner.id}
              data-ego
              className="rounded-[0.25rem] overflow-hidden"
              style={{
                background: 'linear-gradient(160deg, #16120d 0%, #0d0a06 100%)',
                border: '1.5px dashed #2a2015',
                opacity: 0,
              }}
            >
              <div style={{ aspectRatio: '1' }} className="flex items-center justify-center">
                <span className="text-[0.75rem] text-[#2a2015]">-</span>
              </div>
              <div className="px-[0.5rem] py-[0.375rem]" style={{ borderTop: '1px solid #1a1208' }}>
                <p className="text-[0.625rem] text-[#3a2a10] truncate">{sinner.name_kr}</p>
              </div>
            </div>
          )
        }

        return (
          <div
            key={sinner.id}
            data-ego
            className="rounded-[0.25rem] overflow-hidden transition-all duration-300"
            style={{
              background: '#16120d',
              border: `1.5px solid ${gradeColor}40`,
              boxShadow: egoRevealed ? `0 0 0.75rem ${gradeColor}20` : 'none',
              opacity: 0,
            }}
          >
            <div className="relative overflow-hidden" style={{ aspectRatio: '1' }}>
              <Image
                src={`${getEGOImageUrl(sinner.id, ego.folder_name)}profile.webp`}
                alt={ego.name_kr ?? ego.name}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 16vw"
                style={{ objectFit: 'cover' }}
              />
              {/* Grade badge */}
              <div
                className="absolute top-[0.375rem] left-[0.375rem] px-[0.375rem] py-[0.0625rem] rounded-[0.125rem] text-[0.5625rem] font-mono"
                style={{
                  background: `${gradeColor}30`,
                  color: gradeColor,
                  border: `1px solid ${gradeColor}50`,
                  backdropFilter: 'blur(4px)',
                }}
              >
                {ego.grade}
              </div>
            </div>
            <div className="px-[0.5rem] py-[0.375rem]" style={{ borderTop: `1px solid ${gradeColor}20` }}>
              <p className="text-[0.6875rem] truncate" style={{ color: gradeColor }}>
                {ego.name_kr ?? ego.name}
              </p>
              <p className="text-[0.5rem] text-[#5a5040] truncate">{sinner.name_kr}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
