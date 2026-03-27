'use client'

import FilterToggleGroup, { type FilterToggleItem } from './FilterToggleGroup'

type Props = {
  sectionLabel: string
  values: number[]
  selected: Set<number>
  onToggle: (value: number) => void
}

export default function NumericFilter({ sectionLabel, values, selected, onToggle }: Props) {
  const sorted = [...new Set(values)].sort((a, b) => a - b)
  const items: FilterToggleItem<number>[] = sorted.map(v => ({
    value: v,
    label: String(v),
  }))

  return (
    <FilterToggleGroup
      sectionLabel={sectionLabel}
      items={items}
      selected={selected}
      onToggle={onToggle}
      columns={Math.min(sorted.length, 5)}
      iconSize={24}
    />
  )
}
