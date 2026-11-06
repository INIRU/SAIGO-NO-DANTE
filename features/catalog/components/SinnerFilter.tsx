'use client'

import { useLocale, useTranslations } from 'next-intl'
import type { Sinner } from '@/lib/types'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import { getSinnerLogoUrl } from '@/lib/utils/images'
import { sinnerColor } from '@/lib/constants/sinner-colors'
import FilterToggleGroup, { type FilterToggleItem } from './FilterToggleGroup'

type Props = {
  sinners: Sinner[]
  selected: Set<string>
  onToggle: (sinnerId: string) => void
}

export default function SinnerFilter({ sinners, selected, onToggle }: Props) {
  const lang = useLocale() as SupportedLang
  const t = useTranslations('browser')
  const items: FilterToggleItem<string>[] = sinners.map(s => ({
    value: s.id,
    icon: getSinnerLogoUrl(s.id),
    label: getLocalizedName(s, lang),
    accent: sinnerColor(s.id),
  }))

  return (
    <FilterToggleGroup
      sectionLabel={t('sinner')}
      items={items}
      selected={selected}
      onToggle={onToggle}
      columns={4}
      iconSize={32}
    />
  )
}
