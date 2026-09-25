'use client'

import { useTranslations } from 'next-intl'
import type { SinType } from '@/lib/types'
import { SIN_ORDER, SIN_ICON_MAP } from '@/lib/constants/sin'
import FilterToggleGroup, { type FilterToggleItem } from './FilterToggleGroup'

type Props = {
  selected: Set<SinType>
  onToggle: (sin: SinType) => void
}

export default function SinFilter({ selected, onToggle }: Props) {
  const t = useTranslations()
  const items: FilterToggleItem<SinType>[] = SIN_ORDER.map(s => ({
    value: s,
    icon: SIN_ICON_MAP[s],
    label: t(`sin.${s}`),
  }))

  return (
    <FilterToggleGroup
      sectionLabel={t('browser.sin')}
      items={items}
      selected={selected}
      onToggle={onToggle}
      columns={4}
      iconSize={24}
    />
  )
}
