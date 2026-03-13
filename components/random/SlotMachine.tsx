'use client'

import SlotReel from './SlotReel'
import type { Sinner, Identity } from '@/lib/types'
import type { RandomResult } from '@/lib/random/engine'
import Image from 'next/image'
import { getEGOImageUrl } from '@/lib/utils/images'

type Props = {
  sinners: Sinner[]
  pools: Record<string, Identity[]>
  result: RandomResult | null
  egoEnabled: boolean
  isSpinning: boolean
  showEgo: boolean
  onReelStopped: () => void
  onReroll: (sinnerId: string) => void
}

const STOP_INTERVAL = 300

export default function SlotMachine({ sinners, pools, result, egoEnabled, isSpinning, showEgo, onReelStopped, onReroll }: Props) {
  return (
    <div className="space-y-[1.5rem]">
      <div className="grid grid-cols-6 gap-[0.5rem] max-md:grid-cols-2">
        {sinners.map((sinner, idx) => (
          <SlotReel
            key={sinner.id}
            sinnerName={sinner.name_kr}
            pool={pools[sinner.id] ?? []}
            result={result?.identities[sinner.id] ?? null}
            spinning={isSpinning}
            stopDelay={1500 + idx * STOP_INTERVAL}
            onStopped={() => onReelStopped()}
            onReroll={() => onReroll(sinner.id)}
          />
        ))}
      </div>

      {egoEnabled && showEgo && result && (
        <div className="animate-fade-in">
          <h3 className="font-mono text-[0.75rem] text-[#8a6010] mb-[0.5rem]">E.G.O</h3>
          <div className="grid grid-cols-6 gap-[0.5rem] max-md:grid-cols-3">
            {sinners.map(sinner => {
              const ego = result.egos[sinner.id]
              if (!ego || !ego.folder_name) return (
                <div key={sinner.id} className="text-center text-[0.5625rem] text-[#5a5040]">-</div>
              )
              return (
                <div key={sinner.id} className="flex flex-col items-center gap-[0.125rem]">
                  <div className="rounded border border-[#8a6010]/30 overflow-hidden bg-[#1a1510]" style={{ width: '3rem', height: '3rem' }}>
                    <Image
                      src={`${getEGOImageUrl(sinner.id, ego.folder_name)}profile.webp`}
                      alt={ego.name_kr ?? ego.name}
                      width={48}
                      height={48}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                  <span className="text-[0.5rem] text-[#8a8070] text-center truncate max-w-[4rem]">{ego.name_kr ?? ego.name}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
