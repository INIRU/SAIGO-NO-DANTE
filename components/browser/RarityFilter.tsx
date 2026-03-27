'use client'

import { RARITY_ICON_MAP } from '@/lib/constants/game'
import { RARITIES } from '@/lib/types/browser'
import FilterToggleGroup, { type FilterToggleItem } from './FilterToggleGroup'

const RARITY_LABELS: Record<number, string> = { 1: '1성', 2: '2성', 3: '3성' }

type Props = {
  selected: Set<number>
  onToggle: (rarity: number) => void
}

export default function RarityFilter({ selected, onToggle }: Props) {
  const items: FilterToggleItem<number>[] = RARITIES.map(r => ({
    value: r,
    icon: RARITY_ICON_MAP[r],
    label: RARITY_LABELS[r],
  }))

  return (
    <FilterToggleGroup
      sectionLabel="등급"
      items={items}
      selected={selected}
      onToggle={onToggle}
      columns={3}
      iconSize={24}
    />
  )
}
