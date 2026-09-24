'use client'

// 모든 이미지 토글 필터의 기반 원시 컴포넌트
import Image from 'next/image'
import styles from './FilterToggleGroup.module.css'

export const filterStyles = styles

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
  iconSize?: number      // 아이콘 높이(px, next/image용)
  /** 아이콘 아래 이름 표시. 아이콘 안에 글자가 있으면(등급 배너) false. */
  showLabels?: boolean
}

export default function FilterToggleGroup<T extends string | number>({
  sectionLabel,
  items,
  selected,
  onToggle,
  columns = 4,
  iconSize = 28,
  showLabels = true,
}: Props<T>) {
  const size = `${iconSize / 16}rem`
  return (
    <div role="group" aria-label={sectionLabel}>
      <div className={styles.label}>{sectionLabel}</div>
      <div className={styles.grid} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {items.map(item => (
          <button
            type="button"
            key={String(item.value)}
            onClick={() => onToggle(item.value)}
            aria-pressed={selected.has(item.value)}
            aria-label={item.label}
            title={item.label}
            className={styles.item}
          >
            {item.icon ? (
              <Image src={item.icon} alt="" width={iconSize} height={iconSize} className={styles.icon} style={{ height: size }} unoptimized />
            ) : item.color ? (
              <span className={styles.swatch} style={{ width: size, height: size, background: item.color }} />
            ) : (
              <span className={styles.text}>{item.label}</span>
            )}
            {showLabels && (item.icon || item.color) && <span className={styles.sub}>{item.label}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
