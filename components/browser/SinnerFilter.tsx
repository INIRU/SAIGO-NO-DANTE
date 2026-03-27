'use client'

import type { Sinner } from '@/lib/types'
import { getSinnerLogoUrl } from '@/lib/utils/images'
import FilterToggleGroup, { type FilterToggleItem } from './FilterToggleGroup'

type Props = {
  sinners: Sinner[]
  selected: Set<string>
  onToggle: (sinnerId: string) => void
}

export default function SinnerFilter({ sinners, selected, onToggle }: Props) {
  const items: FilterToggleItem<string>[] = sinners.map(s => ({
    value: s.id,
    icon: getSinnerLogoUrl(s.id),
    label: s.name_kr,
  }))

  return (
    <FilterToggleGroup
      sectionLabel="수감자"
      items={items}
      selected={selected}
      onToggle={onToggle}
      columns={4}
      iconSize={32}
    />
  )
}
