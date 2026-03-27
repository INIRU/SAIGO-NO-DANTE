'use client'

import { STORAGE_BASE, GRADE_COLORS } from '@/lib/constants/game'
import { EGO_GRADES } from '@/lib/types/browser'
import FilterToggleGroup, { type FilterToggleItem } from './FilterToggleGroup'

const GRADE_ICON_URL: Record<string, string | undefined> = {
  ZAYIN: `${STORAGE_BASE}/icons/grade/ZAYIN.webp`,
  TETH:  `${STORAGE_BASE}/icons/grade/TETH.webp`,
  HE:    `${STORAGE_BASE}/icons/grade/HE.webp`,
  WAW:   `${STORAGE_BASE}/icons/grade/WAW.webp`,
  // ALEPH는 아이콘 없음 — 색상 배지 폴백
}

type Props = {
  selected: Set<string>
  onToggle: (grade: string) => void
}

export default function GradeFilter({ selected, onToggle }: Props) {
  const items: FilterToggleItem<string>[] = EGO_GRADES.map(g => ({
    value: g,
    icon: GRADE_ICON_URL[g],
    color: GRADE_ICON_URL[g] ? undefined : GRADE_COLORS[g],
    label: g,
  }))

  return (
    <FilterToggleGroup
      sectionLabel="EGO 등급"
      items={items}
      selected={selected}
      onToggle={onToggle}
      columns={5}
      iconSize={28}
    />
  )
}
