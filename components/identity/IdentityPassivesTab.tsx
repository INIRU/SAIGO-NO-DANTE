'use client'

import Image from 'next/image'
import { Passive, SIN_COLORS, SIN_KR_TO_EN, getSinIconUrl } from '@/lib/data/sinners'
import { useFormatSkillDesc } from '@/components/sinners/KeywordTooltip'

interface IdentityPassivesTabProps {
  filteredPassives: Passive[]
  sinColor: string
  skillNameColors: Record<string, string>
}

export default function IdentityPassivesTab({ filteredPassives, sinColor, skillNameColors }: IdentityPassivesTabProps) {
  const formatSkillDesc = useFormatSkillDesc()

  if (filteredPassives.length === 0) {
    return (
      <div
        className="card p-8 text-center"
        style={{ color: '#555566', borderTopLeftRadius: 0, borderTopRightRadius: 0 }}
      >
        <p className="font-serif text-lg italic">
          패시브 정보는 준비 중입니다.
        </p>
      </div>
    )
  }

  const battlePassives = filteredPassives.filter(p => p.passive_type === 'battle')
  const supportPassives = filteredPassives.filter(p => p.passive_type === 'support')

  const renderPassive = (p: Passive) => {
    const sinNames = p.sin_affinity ? p.sin_affinity.split(', ').map(s => s.trim()) : []
    const sinTypes = sinNames.map(s => SIN_KR_TO_EN[s] ?? (SIN_COLORS[s as keyof typeof SIN_COLORS] ? s : null)).filter(Boolean) as Array<keyof typeof SIN_COLORS>
    const primaryColor = sinTypes[0] ? SIN_COLORS[sinTypes[0]] : '#cccccc'

    return (
      <div
        key={p.id}
        className="p-3 rounded"
        style={{
          background: `${primaryColor}08`,
          border: `1px solid ${primaryColor}25`,
        }}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-semibold" style={{ color: primaryColor, fontSize: '0.8125rem' }}>
            {p.name}
          </span>
        </div>

        {/* 발동 조건 */}
        {(sinTypes.length > 0 || p.active_cond) && (
          <div className="flex items-center gap-1.5 mb-2">
            {sinTypes.map((st, i) => (
              <Image
                key={i}
                src={getSinIconUrl(st)}
                alt=""
                width={20}
                height={20}
                style={{ filter: `drop-shadow(0 0 2px ${SIN_COLORS[st]}60)` }}
              />
            ))}
            {p.sin_count != null && p.sin_count > 0 && (
              <span className="font-mono font-bold" style={{ color: primaryColor, fontSize: '0.875rem' }}>
                x{p.sin_count}
              </span>
            )}
            {p.active_cond && (
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{
                  background: `${primaryColor}18`,
                  color: primaryColor,
                  border: `1px solid ${primaryColor}35`,
                }}
              >
                {p.active_cond}
              </span>
            )}
          </div>
        )}

        {/* 설명 */}
        {p.description && (
          <div style={{ color: '#888', fontSize: '0.8125rem', lineHeight: 1.8, whiteSpace: 'pre-line' }}>
            {formatSkillDesc(p.description, primaryColor, skillNameColors)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="card p-6" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
      <h2
        className="font-serif font-bold mb-4"
        style={{ color: 'var(--gold)', fontSize: '1rem' }}
      >
        패시브
      </h2>

      {battlePassives.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded"
              style={{ background: `${sinColor}20`, color: sinColor, border: `1px solid ${sinColor}40` }}>
              배틀 패시브
            </span>
          </div>
          <div className="space-y-2">
            {battlePassives.map(renderPassive)}
          </div>
        </div>
      )}

      {supportPassives.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded"
              style={{ background: 'rgba(100,140,180,0.15)', color: '#6b9bc0', border: '1px solid rgba(100,140,180,0.3)' }}>
              서포트 패시브
            </span>
          </div>
          <div className="space-y-2">
            {supportPassives.map(renderPassive)}
          </div>
        </div>
      )}
    </div>
  )
}
