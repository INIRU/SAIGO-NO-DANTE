import Image from 'next/image'
import { Identity, STORAGE_BASE } from '@/lib/data/sinners'

interface IdentityStatsCardProps {
  identity: Identity
  sinColor: string
}

export default function IdentityStatsCard({ identity, sinColor }: IdentityStatsCardProps) {
  const defCorr = identity.def_level - 60
  const defCorrStr = defCorr === 0 ? '' : defCorr > 0 ? `(+${defCorr})` : `(${defCorr})`

  const stats = [
    { label: 'HP', value: String(identity.hp), iconUrl: `${STORAGE_BASE}/icons/stats/health.webp` },
    { label: '속도', value: `${identity.speed_min}-${identity.speed_max}`, iconUrl: `${STORAGE_BASE}/icons/stats/speed.webp` },
    { label: '방어 레벨', value: `${identity.def_level}${defCorrStr}`, iconUrl: `${STORAGE_BASE}/icons/stats/defense.webp` },
  ]

  return (
    <div className="card p-6">
      <h2
        className="font-serif font-bold mb-4"
        style={{ color: 'var(--gold)', fontSize: '1rem' }}
      >
        스탯
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
            <div style={{ color: '#555', fontSize: '0.625rem', marginTop: '2px' }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
