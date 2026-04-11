'use client'

import Image from 'next/image'
import { Identity, STORAGE_BASE } from '@/lib/data/sinners'
import { useLanguage } from '@/lib/i18n'

interface IdentityStatsCardProps {
  identity: Identity
  sinColor: string
}

export default function IdentityStatsCard({ identity, sinColor }: IdentityStatsCardProps) {
  const { t } = useLanguage()
  const defCorr = identity.def_level - 60
  const defCorrStr = defCorr === 0 ? '' : defCorr > 0 ? `(+${defCorr})` : `(${defCorr})`

  const stats = [
    { label: 'HP', value: String(identity.hp), iconUrl: `${STORAGE_BASE}/icons/stats/health.webp` },
    { label: t('identity.stats.speed'), value: `${identity.speed_min}-${identity.speed_max}`, iconUrl: `${STORAGE_BASE}/icons/stats/speed.webp` },
    { label: t('identity.stats.defLevel'), value: `${identity.def_level}${defCorrStr}`, iconUrl: `${STORAGE_BASE}/icons/stats/defense.webp` },
  ]

  const breakSection = identity.break_section
  const hp = identity.hp

  return (
    <div className="card p-6">
      <h2
        className="font-serif font-light mb-4"
        style={{ color: 'var(--gold)', fontSize: '1rem' }}
      >
        {t('identity.stats.title')}
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {stats.map(({ label, value, iconUrl }) => (
          <div
            key={label}
            className="text-center py-3 rounded"
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)' }}
          >
            <div className="flex justify-center mb-1">
              <Image src={iconUrl} alt="" width={20} height={20} style={{ width: '1.25rem', height: '1.25rem' }} />
            </div>
            <div
              className="font-mono font-bold"
              style={{ color: sinColor, fontSize: '1.25rem' }}
            >
              {value}
            </div>
            <div style={{ color: '#999', fontSize: '0.75rem', marginTop: '2px' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* {t('identity.stats.breakSection')} */}
      {breakSection && breakSection.length > 0 && (
        <div className="mt-5">
          <h3 className="font-serif font-light mb-3" style={{ color: 'var(--gold)', fontSize: '0.875rem' }}>
            {t('identity.stats.breakSection')}
          </h3>
          <div className="relative rounded-lg overflow-hidden" style={{ height: '2.5rem', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)' }}>
            {/* HP 바 — 왼쪽=100%(빨간, 체력 꽉 참) → 오른쪽=0%(sinColor, 체력 없음) */}
            <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, rgba(200,60,60,0.3), ${sinColor}20)` }} />

            {/* {t('identity.stats.breakSection')} 마커 */}
            {breakSection.map((pct, i) => (
              <div key={i}>
                {/* 구간선 */}
                <div
                  className="absolute top-0 bottom-0"
                  style={{ left: `${100 - pct}%`, width: '0.125rem', background: '#e04040', opacity: 0.8 }}
                />
                {/* 구간 라벨 */}
                <div
                  className="absolute flex flex-col items-center"
                  style={{ left: `${100 - pct}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
                >
                  <span style={{ color: '#e04040', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 700, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                    {pct}%
                  </span>
                </div>
              </div>
            ))}

            {/* 100% 시작 (왼쪽) */}
            <div className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: '#888', fontSize: '0.625rem', fontFamily: 'var(--font-mono)' }}>
              100%
            </div>
            {/* 0% 끝 (오른쪽) */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: '#555', fontSize: '0.625rem', fontFamily: 'var(--font-mono)' }}>
              0%
            </div>

            {/* 흐트러짐 영역 (각 구간 이하) */}
            {breakSection.map((pct, i) => {
              const nextPct = breakSection[i + 1] ?? 0
              return (
                <div
                  key={`zone-${i}`}
                  className="absolute top-0 bottom-0"
                  style={{
                    left: `${100 - pct}%`,
                    width: `${pct - nextPct}%`,
                    background: `rgba(224,64,64,${0.06 + i * 0.06})`,
                    borderLeft: '0.125rem solid rgba(224,64,64,0.3)',
                  }}
                />
              )
            })}
          </div>

          {/* 구간 설명 */}
          <div className="flex gap-3 mt-2 justify-center">
            {breakSection.map((pct, i) => {
              const hpVal = Math.round(hp * pct / 100)
              return (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: '#e04040', opacity: 0.5 + i * 0.2 }} />
                  <span style={{ color: '#aaa', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                    {t('identity.stats.breakPhase').replace('{n}', String(i + 1))}{' '}<span style={{ color: '#e04040' }}>{pct}%</span>
                    <span style={{ color: '#666' }}> ({hpVal})</span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
