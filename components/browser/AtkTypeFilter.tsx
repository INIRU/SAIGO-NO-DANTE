'use client'

import { useTranslations } from 'next-intl'
import { ATK_TYPE_ICON_MAP } from '@/lib/constants/game'
import { ATK_TYPES } from '@/lib/types/browser'
import FilterToggleGroup, { type FilterToggleItem } from './FilterToggleGroup'

type Props = {
  selected: Set<string>
  onToggle: (type: string) => void
}

export default function AtkTypeFilter({ selected, onToggle }: Props) {
  const t = useTranslations('browser')
  const items: FilterToggleItem<string>[] = ATK_TYPES.map(type => ({
    value: type,
    icon: ATK_TYPE_ICON_MAP[type],
    label: t(`atk.${type}`),
  }))

  return (
    <FilterToggleGroup
      sectionLabel={t('skillType')}
      items={items}
      selected={selected}
      onToggle={onToggle}
      columns={3}
      iconSize={24}
    />
  )
}
