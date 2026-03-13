'use client'

import { useRef, useEffect, useState } from 'react'
import Image from 'next/image'
import { getIdentityProfileUrl } from '@/lib/utils/images'
import type { Identity } from '@/lib/types'

type Props = {
  sinnerName: string
  pool: Identity[]
  result: Identity | null
  spinning: boolean
  stopDelay: number
  onStopped: () => void
  onReroll: () => void
}

const ITEM_REM = 5
const MIN_REEL_ITEMS = 8

export default function SlotReel({ sinnerName, pool, result, spinning, stopDelay, onStopped, onReroll }: Props) {
  const stripRef = useRef<HTMLDivElement>(null)
  const tweenRef = useRef<unknown>(null)
  const [settled, setSettled] = useState(false)

  const reelItems = (() => {
    if (pool.length === 0) return []
    const items = [...pool]
    while (items.length < MIN_REEL_ITEMS) items.push(...pool)
    return items
  })()

  const isSingle = pool.length <= 1

  const resultRef = useRef(result)
  const onStoppedRef = useRef(onStopped)
  resultRef.current = result
  onStoppedRef.current = onStopped

  useEffect(() => {
    if (!spinning || isSingle || reelItems.length === 0) {
      if (spinning && isSingle && pool.length === 1) {
        setSettled(true)
        const timer = setTimeout(() => onStoppedRef.current(), 100)
        return () => clearTimeout(timer)
      }
      return
    }

    setSettled(false)
    let cancelled = false

    ;(async () => {
      const { gsap } = await import('gsap')
      const el = stripRef.current
      if (!el || cancelled) return

      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize)
      const itemPx = ITEM_REM * rem
      const totalPx = reelItems.length * itemPx

      const t = gsap.to(el, {
        y: `-=${totalPx}`,
        duration: reelItems.length * 0.08,
        ease: 'none',
        repeat: -1,
        modifiers: {
          y: (y: string) => `${parseFloat(y) % totalPx}px`,
        },
      })
      tweenRef.current = t

      const timer = setTimeout(() => {
        if (cancelled) return
        const r = resultRef.current
        const rIdx = r ? reelItems.findIndex(i => i.id === r.id) : 0
        const targetY = -(rIdx * itemPx)

        ;(t as { kill: () => void }).kill()
        gsap.to(el, {
          y: targetY,
          duration: 1.2,
          ease: 'back.out(1.2)',
          onComplete: () => {
            if (!cancelled) {
              setSettled(true)
              onStoppedRef.current()
            }
          },
        })
      }, stopDelay)

      return () => clearTimeout(timer)
    })()

    return () => {
      cancelled = true
      if (tweenRef.current) {
        ;(tweenRef.current as { kill: () => void }).kill()
      }
    }
  }, [spinning, isSingle, reelItems.length, stopDelay])

  // No pool
  if (pool.length === 0) {
    return (
      <div className="flex flex-col items-center gap-[0.25rem]">
        <span className="font-mono text-[0.625rem] text-[#8a6010]">{sinnerName}</span>
        <div
          className="rounded border border-[#8a6010]/20 bg-[#0d0b08] flex items-center justify-center"
          style={{ width: `${ITEM_REM}rem`, height: `${ITEM_REM}rem` }}
        >
          <span className="text-[0.625rem] text-[#5a5040]">미보유</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-[0.25rem]">
      <span className="font-mono text-[0.625rem] text-[#8a6010]">{sinnerName}</span>
      <div
        className={`relative rounded overflow-hidden border transition-all ${
          settled ? 'border-[#c8900a] shadow-[0_0_0.75rem_#c8900a44]' : 'border-[#8a6010]/30'
        }`}
        style={{ width: `${ITEM_REM}rem`, height: `${ITEM_REM}rem` }}
        role="img"
        aria-label={settled && result ? result.name_kr : `${sinnerName} 인격 선택 중`}
      >
        {!settled && (
          <div ref={stripRef} className="absolute top-0 left-0 w-full" style={{ willChange: 'transform' }}>
            {reelItems.map((identity, idx) => (
              <div key={`${identity.id}-${idx}`} style={{ height: `${ITEM_REM}rem` }}>
                <Image
                  src={getIdentityProfileUrl(identity)}
                  alt={identity.name_kr}
                  width={80}
                  height={80}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            ))}
          </div>
        )}

        {settled && result && (
          <button
            onClick={onReroll}
            className="w-full h-full bg-[#1a1510]"
            title={`${result.name_kr} — 클릭하여 리롤`}
            tabIndex={0}
          >
            <Image
              src={getIdentityProfileUrl(result)}
              alt={result.name_kr}
              width={80}
              height={80}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </button>
        )}
      </div>
      {settled && result && (
        <span className="text-[0.5625rem] text-[#8a8070] text-center max-w-[5rem] truncate">{result.name_kr}</span>
      )}
    </div>
  )
}
