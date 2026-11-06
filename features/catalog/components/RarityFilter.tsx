'use client'

import { useTranslations } from 'next-intl'
import { RARITY_ICON_MAP } from '@/lib/constants/game'
import { RARITIES } from '@/lib/types/browser'
import FilterToggleGroup, { type FilterToggleItem } from './FilterToggleGroup'

type Props = {
  selected: Set<number>
  onToggle: (rarity: number) => void
}

export default function RarityFilter({ selected, onToggle }: Props) {
  const t = useTranslations('browser')
  const items: FilterToggleItem<number>[] = RARITIES.map(r => ({
    value: r,
    icon: RARITY_ICON_MAP[r],
    label: t('rarityStar', { n: r }),
  }))

  return (
    <FilterToggleGroup
      sectionLabel={t('rarity')}
      items={items}
      selected={selected}
      onToggle={onToggle}
      columns={3}
      iconSize={24}
    />
  )
}
