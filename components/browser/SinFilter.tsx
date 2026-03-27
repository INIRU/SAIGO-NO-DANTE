'use client'

import type { SinType } from '@/lib/types'
import { SIN_ORDER, SIN_LABELS_KR, SIN_ICON_MAP } from '@/lib/constants/sin'
import FilterToggleGroup, { type FilterToggleItem } from './FilterToggleGroup'

type Props = {
  selected: Set<SinType>
  onToggle: (sin: SinType) => void
}

export default function SinFilter({ selected, onToggle }: Props) {
  const items: FilterToggleItem<SinType>[] = SIN_ORDER.map(s => ({
    value: s,
    icon: SIN_ICON_MAP[s],
    label: SIN_LABELS_KR[s],
  }))

  return (
    <FilterToggleGroup
      sectionLabel="죄악 속성"
      items={items}
      selected={selected}
      onToggle={onToggle}
      columns={4}
      iconSize={24}
    />
  )
}
