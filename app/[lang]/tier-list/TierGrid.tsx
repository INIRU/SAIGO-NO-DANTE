import TierCardInteractive, { type TierIdentity } from './TierCardInteractive'

const TIERS = ['S+', 'S', 'A', 'B', 'C', 'F'] as const
type Tier = typeof TIERS[number]

const TIER_COLORS: Record<Tier, string> = {
  'S+': '#ff5050',
  'S': '#ffa030',
  'A': '#ffd040',
  'B': '#60c860',
  'C': '#60a0ff',
  'F': '#909090',
}

const TIER_SCORES: Record<Tier, number> = {
  'S+': 3.0,
  'S': 2.5,
  'A': 2.0,
  'B': 1.5,
  'C': 1.0,
  'F': 0,
}

export default function TierGrid({
  tiers,
  currentSeason,
}: {
  tiers: Record<Tier, TierIdentity[]>
  currentSeason: number
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {TIERS.map(tier => {
        if (tiers[tier].length === 0) return null
        return (
          <div key={tier} className="tier-row">
            {/* 티어 헤더 */}
            <div className="flex items-center gap-3 mb-3">
              <div
                style={{
                  width: '3rem',
                  height: '3rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: TIER_COLORS[tier],
                  borderRadius: '0.375rem',
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: '#fff',
                  textShadow: '0 1px 3px rgba(0,0,0,0.4)',
                }}
              >
                {tier}
              </div>
              <span style={{ color: '#888888', fontSize: '0.75rem' }}>
                +{TIER_SCORES[tier].toFixed(1)}점
              </span>
              <div
                style={{
                  flex: 1,
                  height: '1px',
                  background: `linear-gradient(to right, ${TIER_COLORS[tier]}40, transparent)`,
                }}
              />
            </div>

            {/* 인격 카드 그리드 */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(6.875rem, 1fr))',
                gap: '0.5rem',
                position: 'relative',
                zIndex: 0,
              }}
            >
              {tiers[tier].map(identity => (
                <TierCardInteractive
                  key={identity.id}
                  identity={identity}
                  currentSeason={currentSeason}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
