'use client'

import { useLocale } from 'next-intl'
import EgoDisplayCard from '@/components/cards/EgoDisplayCard'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import type { EGOBrowserItem } from '@/lib/types/browser'

type Props = {
  ego: EGOBrowserItem
  /** Load the artwork first (the first row of the grid). */
  preload?: boolean
}

export default function EGOBrowserCard({ ego, preload }: Props) {
  const lang = useLocale() as SupportedLang
  return (
    <EgoDisplayCard
      ego={ego}
      href={`/sinners/${ego.sinner_slug}/ego/${ego.id}`}
      name={getLocalizedName({ name_kr: ego.name_kr || ego.name, name_en: ego.name_en, name_jp: ego.name_jp }, lang)}
      sinnerId={ego.sinner_id}
      lang={lang}
      preload={preload}
    />
  )
}
