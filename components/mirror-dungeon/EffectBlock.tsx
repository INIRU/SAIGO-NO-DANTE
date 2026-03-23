'use client'

import { useFormatSkillDesc } from '@/components/sinners/KeywordTooltip'

export default function EffectBlock({ label, text, color }: { label: string; text: string; color: string }) {
  const formatSkillDesc = useFormatSkillDesc()
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)

  return (
    <div>
      <p
        className="text-[0.625rem] font-bold mb-1.5"
        style={{ color: label === '++' ? '#e8b030' : '#666', fontFamily: 'var(--font-heading)' }}
      >
        효과 {label}
      </p>
      <div className="text-[0.75rem] leading-[1.7]" style={{ color }}>
        {lines.map((line, i) => {
          const isSub = /^-\s/.test(line)
          return (
            <p
              key={i}
              style={isSub ? { paddingLeft: '0.75rem', textIndent: '-0.5rem', marginTop: '0.125rem' } : { marginTop: i > 0 ? '0.375rem' : 0 }}
            >
              {formatSkillDesc(line, color)}
            </p>
          )
        })}
      </div>
    </div>
  )
}
