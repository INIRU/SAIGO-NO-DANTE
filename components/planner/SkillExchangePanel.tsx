'use client'

import ImageWithFallback from '@/components/ui/ImageWithFallback'

export const SKILL_EXCHANGE_PRESETS: [number, number, number][] = [[3, 2, 1], [1, 0, 5], [0, 0, 6]]

export type SkillExchangeSkill = {
  name?: string | null
  iconSrc?: string | null
  sinColor?: string | null
}

type SkillExchangePanelProps = {
  distribution: [number, number, number]
  skills: [SkillExchangeSkill | null, SkillExchangeSkill | null, SkillExchangeSkill | null]
  isDefault?: boolean
  showTotal?: boolean
  canDecrease?: (idx: number) => boolean
  canIncrease?: (idx: number) => boolean
  onAdjust: (idx: number, delta: number) => void
  onPresetSelect: (preset: [number, number, number]) => void
}

export default function SkillExchangePanel({
  distribution,
  skills,
  isDefault = distribution[0] === 3 && distribution[1] === 2 && distribution[2] === 1,
  showTotal = true,
  canDecrease,
  canIncrease,
  onAdjust,
  onPresetSelect,
}: SkillExchangePanelProps) {
  const total = distribution[0] + distribution[1] + distribution[2]
  const mayDecrease = (idx: number) => canDecrease?.(idx) ?? distribution[idx] > 0
  const mayIncrease = (idx: number) => canIncrease?.(idx) ?? total < 6

  return (
    <div style={{
      marginTop: '6px',
      background: 'linear-gradient(160deg, #1a1510 0%, #100d08 100%)',
      border: `1px solid ${isDefault ? '#221a0f' : 'rgba(200,144,10,0.4)'}`,
      borderRadius: '4px',
      padding: '6px',
    }}>
      {[0, 1, 2].map(idx => {
        const skill = skills[idx]
        const sinColor = skill?.sinColor ?? '#555'
        const decreaseEnabled = mayDecrease(idx)
        const increaseEnabled = mayIncrease(idx)
        return (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 0' }}>
            {skill?.iconSrc ? (
              <ImageWithFallback
                src={skill.iconSrc}
                alt={skill.name ?? `S${idx + 1}`}
                width={16}
                height={16}
                fallbackType="skill"
                style={{ borderRadius: '2px', flexShrink: 0 }}
              />
            ) : (
              <div style={{ width: '16px', height: '16px', borderRadius: '2px', background: '#1a1510', flexShrink: 0 }} />
            )}
            <span style={{ fontSize: '0.5625rem', color: sinColor, fontFamily: 'var(--font-mono)', fontWeight: 700, width: '18px', flexShrink: 0 }}>
              S{idx + 1}
            </span>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              onClick={() => onAdjust(idx, -1)}
              disabled={!decreaseEnabled}
              aria-label={`S${idx + 1} -`}
              className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c8900a]"
              style={{
                width: '18px', height: '18px', borderRadius: '2px',
                background: !decreaseEnabled ? 'rgba(10,8,5,0.5)' : 'rgba(200,144,10,0.1)',
                border: `1px solid ${!decreaseEnabled ? '#18120a' : 'rgba(200,144,10,0.3)'}`,
                color: !decreaseEnabled ? '#2a2015' : '#c8900a',
                fontSize: '0.75rem', cursor: !decreaseEnabled ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                lineHeight: 1, padding: 0,
              }}
            >
              &#x2212;
            </button>
            <span style={{
              width: '16px', textAlign: 'center', fontSize: '0.8125rem',
              fontFamily: 'var(--font-mono)', fontWeight: 700,
              color: distribution[idx] === 0 ? '#3a2a10' : sinColor,
            }}>
              {distribution[idx]}
            </span>
            <button
              type="button"
              onClick={() => onAdjust(idx, 1)}
              disabled={!increaseEnabled}
              aria-label={`S${idx + 1} +`}
              className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c8900a]"
              style={{
                width: '18px', height: '18px', borderRadius: '2px',
                background: !increaseEnabled ? 'rgba(10,8,5,0.5)' : 'rgba(200,144,10,0.1)',
                border: `1px solid ${!increaseEnabled ? '#18120a' : 'rgba(200,144,10,0.3)'}`,
                color: !increaseEnabled ? '#2a2015' : '#c8900a',
                fontSize: '0.75rem', cursor: !increaseEnabled ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                lineHeight: 1, padding: 0,
              }}
            >
              +
            </button>
          </div>
        )
      })}
      <div style={{
        borderTop: '1px solid #1a1208', marginTop: '4px', paddingTop: '4px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {showTotal ? (
          <span style={{
            fontSize: '0.5625rem', fontFamily: 'var(--font-mono)', fontWeight: 700,
            color: total === 6 ? '#5a8a40' : '#c83020',
          }}>
            {total}/6
          </span>
        ) : (
          <span aria-hidden="true" />
        )}
        <div style={{ display: 'flex', gap: '2px' }}>
          {SKILL_EXCHANGE_PRESETS.map(preset => {
            const active = distribution[0] === preset[0] && distribution[1] === preset[1] && distribution[2] === preset[2]
            return (
              <button
                key={preset.join(',')}
                type="button"
                onClick={() => onPresetSelect(preset)}
                className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c8900a]"
                style={{
                  fontSize: '0.5rem', fontFamily: 'var(--font-mono)',
                  padding: '1px 4px', borderRadius: '2px',
                  background: active ? 'rgba(200,144,10,0.2)' : 'transparent',
                  border: `1px solid ${active ? 'rgba(200,144,10,0.5)' : '#18120a'}`,
                  color: active ? '#c8900a' : '#444',
                  cursor: 'pointer', lineHeight: 1.4,
                }}
              >
                {preset.join('/')}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
