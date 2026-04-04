'use client'

import Image from 'next/image'
import { getSinnerLogoUrl } from '@/lib/data/sinners'
import type { Sinner } from '@/lib/data/sinners'
import type { MetaData } from '@/lib/db/meta'
import { useProgressiveRender } from '@/hooks/useProgressiveRender'
import { identityCardUrl } from './metaConstants'

interface SynergyTabProps {
  data: MetaData
  sinnerMap: Map<string, Sinner>
}

export default function SynergyTab({ data, sinnerMap }: SynergyTabProps) {
  const maxCount = data.synergies[0]?.count || 1
  const { visible, sentinelRef } = useProgressiveRender(data.synergies.length)

  return (
    <div className="max-w-4xl">
      <h2 className="font-serif text-xl font-semibold mb-2" style={{ color: 'var(--gold-light)' }}>
        동시 편성 TOP 20
      </h2>
      <p className="text-xs mb-6" style={{ color: '#888888' }}>
        같은 덱에서 함께 편성된 인격 조합
      </p>
      <div className="usage-chart space-y-3">
        {data.synergies.slice(0, visible).map((syn, i) => {
          const pct = (syn.count / maxCount) * 100
          const aImg = identityCardUrl(syn.a_sinner_id, syn.a_folder, syn.a_game_id)
          const bImg = identityCardUrl(syn.b_sinner_id, syn.b_folder, syn.b_game_id)
          const aSinnerName = sinnerMap.get(syn.a_sinner_id)?.name_kr ?? ''
          const bSinnerName = sinnerMap.get(syn.b_sinner_id)?.name_kr ?? ''

          return (
            <div
              key={`${syn.a_id}-${syn.b_id}`}
              className="rounded-lg overflow-hidden"
              style={{
                background: 'rgba(26,21,16,0.6)',
                border: i < 3 ? '1px solid rgba(200,144,10,0.25)' : '1px solid rgba(255,255,255,0.03)',
              }}
            >
              <div className="p-2.5 md:p-3">
                {/* 상단: 순위 + 카운트 */}
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="font-mono text-base md:text-lg w-7 text-center font-bold"
                    style={{
                      color: i === 0 ? '#e8b030' : i === 1 ? '#b0a088' : i === 2 ? '#a07040' : '#6a6a80',
                    }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span
                      className="count-up font-mono text-sm font-bold"
                      data-target={syn.count}
                      style={{ color: 'var(--gold)' }}
                    >
                      {syn.count}
                    </span>
                    <span className="text-[0.625rem]" style={{ color: '#888888' }}>덱</span>
                  </div>
                </div>

                {/* 인격 카드 쌍 */}
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-3">
                  {/* 인격 A */}
                  <div
                    className="flex items-center gap-2.5 flex-1 min-w-0 px-2.5 py-2 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                  >
                    {aImg ? (
                      <div className="relative w-9 h-12 md:w-10 md:h-14 shrink-0 rounded overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                        <Image src={aImg} alt="" fill className="object-cover" sizes="60px" />
                      </div>
                    ) : syn.a_sinner_id && (
                      <div className="relative w-5 h-5 shrink-0">
                        <Image src={getSinnerLogoUrl(syn.a_sinner_id)} alt="" fill className="object-contain" sizes="60px" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="text-xs md:text-sm font-medium truncate block" style={{ color: '#e8e4d8' }}>{syn.a_name}</span>
                      {aSinnerName && (
                        <span className="text-[0.625rem] block mt-0.5" style={{ color: '#888888' }}>{aSinnerName}</span>
                      )}
                    </div>
                  </div>

                  {/* 연결 */}
                  <div
                    className="w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center shrink-0 self-center"
                    style={{ background: 'rgba(200,144,10,0.1)', border: '1px solid rgba(200,144,10,0.25)' }}
                  >
                    <span className="text-[0.625rem] md:text-xs font-bold" style={{ color: 'var(--gold-dim)' }}>+</span>
                  </div>

                  {/* 인격 B */}
                  <div
                    className="flex items-center gap-2.5 flex-1 min-w-0 px-2.5 py-2 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                  >
                    {bImg ? (
                      <div className="relative w-9 h-12 md:w-10 md:h-14 shrink-0 rounded overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                        <Image src={bImg} alt="" fill className="object-cover" sizes="60px" />
                      </div>
                    ) : syn.b_sinner_id && (
                      <div className="relative w-5 h-5 shrink-0">
                        <Image src={getSinnerLogoUrl(syn.b_sinner_id)} alt="" fill className="object-contain" sizes="60px" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="text-xs md:text-sm font-medium truncate block" style={{ color: '#e8e4d8' }}>{syn.b_name}</span>
                      {bSinnerName && (
                        <span className="text-[0.625rem] block mt-0.5" style={{ color: '#888888' }}>{bSinnerName}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 바 */}
              <div className="h-1 overflow-hidden">
                <div
                  className="usage-bar h-full"
                  style={{
                    width: `${pct}%`,
                    background: 'linear-gradient(to right, rgba(200,144,10,0.2), var(--gold))',
                  }}
                />
              </div>
            </div>
          )
        })}
        {data.synergies.length === 0 && (
          <p className="text-center py-12" style={{ color: '#888888' }}>데이터가 없습니다</p>
        )}
        <div ref={sentinelRef} />
      </div>
    </div>
  )
}
