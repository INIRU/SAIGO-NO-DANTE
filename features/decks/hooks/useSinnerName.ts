import { useTranslations } from 'next-intl'
import { localizeIdentityName } from '@/lib/decks/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import type { PlannerDeckSinner } from '@/features/decks/lib/deck-selection'

export function useSinnerName(locale: SupportedLang, getSinnerName?: (sinner: PlannerDeckSinner) => string) {
  const tSinner = useTranslations('sinner')

  return (sinner: PlannerDeckSinner) => {
    if (getSinnerName) return getSinnerName(sinner)
    if (sinner.id) return tSinner(sinner.id as Parameters<typeof tSinner>[0])
    return localizeIdentityName(sinner, locale)
  }
}
