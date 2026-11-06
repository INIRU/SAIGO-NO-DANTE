'use client'

import { useTranslations } from 'next-intl'
import { getEgoGradeBannerUrl } from '@/lib/utils/images'

import { GRADE_COLORS } from '@/lib/constants/game'
import { EGO_GRADES } from '@/lib/types/browser'
import FilterToggleGroup, { type FilterToggleItem } from './FilterToggleGroup'

const GRADE_ICON_URL: Record<string, string | undefined> = {
  ZAYIN: getEgoGradeBannerUrl('ZAYIN'),
  TETH:  getEgoGradeBannerUrl('TETH'),
  HE:    getEgoGradeBannerUrl('HE'),
  WAW:   getEgoGradeBannerUrl('WAW'),
  ALEPH: getEgoGradeBannerUrl('ALEPH'),
}

type Props = {
  selected: Set<string>
  onToggle: (grade: string) => void
}

export default function GradeFilter({ selected, onToggle }: Props) {
  const t = useTranslations('browser')
  const items: FilterToggleItem<string>[] = EGO_GRADES.map(g => ({
    value: g,
    icon: GRADE_ICON_URL[g],
    color: GRADE_ICON_URL[g] ? undefined : GRADE_COLORS[g],
    label: g,
  }))

  return (
    <FilterToggleGroup
      sectionLabel={t('egoGrade')}
      items={items}
      selected={selected}
      onToggle={onToggle}
      columns={5}
      iconSize={14}
      showLabels={false}
    />
  )
}
