'use client'

// Design Ref: §5.2 — 모든 이미지 토글 필터의 기반 원시 컴포넌트
import Image from 'next/image'

export type FilterToggleItem<T extends string | number> = {
  value: T
  icon?: string          // 이미지 URL
  color?: string         // 색상 배지 (EGO 등급용)
  label: string
}

type Props<T extends string | number> = {
  sectionLabel: string
  items: FilterToggleItem<T>[]
  selected: Set<T>
  onToggle: (value: T) => void
  columns?: number
  iconSize?: number      // rem 단위의 px 값 (next/image width/height용)
}

export default function FilterToggleGroup<T extends string | number>({
  sectionLabel,
  items,
  selected,
  onToggle,
  columns = 4,
  iconSize = 28,
}: Props<T>) {
  return (
    <div role="group" aria-label={sectionLabel}>
      <div className="font-mono mb-2" style={{
        fontSize: '0.5625rem',
        letterSpacing: '0.15em',
        color: 'var(--gold-dim)',
        textTransform: 'uppercase',
      }}>
        {sectionLabel}
      </div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {items.map(item => {
          const active = selected.has(item.value)
          return (
            <button
              key={String(item.value)}
              onClick={() => onToggle(item.value)}
              aria-pressed={active}
              aria-label={item.label}
              title={item.label}
              className="flex flex-col items-center justify-center rounded transition-all duration-200"
              style={{
                cursor: 'pointer',
                padding: '0.375rem 0.25rem',
                border: `1px solid ${active ? 'var(--gold)' : 'rgba(255,255,255,0.08)'}`,
                background: active ? 'rgba(200,144,10,0.1)' : 'rgba(255,255,255,0.02)',
                opacity: active ? 1 : 0.45,
                filter: active ? 'none' : 'grayscale(0.5)',
              }}
            >
              {item.icon ? (
                <Image
                  src={item.icon}
                  alt={item.label}
                  width={iconSize}
                  height={iconSize}
                  style={{ width: `${iconSize / 16}rem`, height: `${iconSize / 16}rem`, objectFit: 'contain' }}
                  unoptimized
                />
              ) : item.color ? (
                <div style={{
                  width: `${iconSize / 16}rem`,
                  height: `${iconSize / 16}rem`,
                  borderRadius: '0.25rem',
                  background: item.color,
                  border: '1px solid rgba(255,255,255,0.15)',
                }} />
              ) : (
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: active ? 'var(--gold)' : '#888' }}>
                  {item.label}
                </span>
              )}
              <span className="mt-1 text-center leading-tight" style={{
                fontSize: '0.5rem',
                color: active ? 'var(--gold)' : '#666',
              }}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
