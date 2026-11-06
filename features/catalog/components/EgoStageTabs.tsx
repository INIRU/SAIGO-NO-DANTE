'use client'
import Image from 'next/image'

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V']

type Props = {
  levels: number[]
  value: number
  onChange: (level: number) => void
  label: string
  color: string
  corrosion?: boolean
}

export default function EgoStageTabs({ levels, value, onChange, label, color, corrosion = false }: Props) {
  const border = corrosion ? 'rgba(180,20,20,0.4)' : '#2e2417'
  return (
    <div role="tablist" aria-label={label} className="flex rounded overflow-hidden" style={{ border: `1px solid ${border}` }}>
      {levels.map((level, index) => (
        <button key={level} type="button" role="tab" aria-selected={value === level}
          aria-label={`${level} ${label}`} tabIndex={value === level ? 0 : -1}
          onClick={() => onChange(level)}
          onKeyDown={event => {
            const target = event.key === 'ArrowRight' ? (index + 1) % levels.length
              : event.key === 'ArrowLeft' ? (index + levels.length - 1) % levels.length
              : event.key === 'Home' ? 0 : event.key === 'End' ? levels.length - 1 : -1
            if (target < 0) return
            event.preventDefault()
            onChange(levels[target])
            ;(event.currentTarget.parentElement?.children[target] as HTMLButtonElement)?.focus()
          }}
          className="min-h-10 px-3 py-1.5 text-xs font-semibold transition-colors"
          style={{ minWidth: '2.5rem', background: value === level ? (corrosion ? 'rgba(180,20,20,0.3)' : `${color}20`) : 'transparent', borderRight: index < levels.length - 1 ? `1px solid ${border}` : undefined }}>
          <Image src={`/assets/ego-stages/${level}.webp`} alt={ROMAN[level]} width={224} height={192} unoptimized
            style={{ height: '1.5rem', width: '1.75rem', maxWidth: 'none', margin: 'auto', opacity: value === level ? 1 : 0.5 }} />
        </button>
      ))}
    </div>
  )
}
