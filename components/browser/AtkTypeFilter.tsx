'use client'

import { ATK_TYPE_ICON_MAP } from '@/lib/constants/game'
import { ATK_TYPES, ATK_TYPE_LABELS } from '@/lib/types/browser'
import FilterToggleGroup, { type FilterToggleItem } from './FilterToggleGroup'

type Props = {
  selected: Set<string>
  onToggle: (type: string) => void
}

export default function AtkTypeFilter({ selected, onToggle }: Props) {
  const items: FilterToggleItem<string>[] = ATK_TYPES.map(t => ({
    value: t,
    icon: ATK_TYPE_ICON_MAP[t],
    label: ATK_TYPE_LABELS[t],
  }))

  return (
    <FilterToggleGroup
      sectionLabel="스킬 유형"
      items={items}
      selected={selected}
      onToggle={onToggle}
      columns={3}
      iconSize={24}
    />
  )
}
