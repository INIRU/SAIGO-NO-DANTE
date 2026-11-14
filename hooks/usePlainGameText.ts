'use client'

import { useCallback } from 'react'
import { useLocale } from 'next-intl'
import { gameTextToPlain, mayBeRawGameText, refNameLabels } from '@/lib/game-text/rich-text'
import { useGameTextRefs, wantGameTextRefs } from './useGameTextRefs'

// The table object is shared by every component of a language, so its labels are built once, not once per card.
const labelsOf = new WeakMap<object, Record<string, string>>()

/**
 * Game source text as a plain string for places that cannot draw it (title attributes, previews inside a button):
 * tags dropped, `[Id]` as its name once the reference table is loaded (it is requested the first time raw text is
 * seen), `{{token}}` kept as written unless `keepPlaceholders` is false. Text that cannot be raw game text is returned as is.
 */
export function usePlainGameText(locale?: string) {
  const pageLocale = useLocale()
  const { names } = useGameTextRefs({ lazy: true })
  let labels: Record<string, string> | undefined
  if (names) {
    labels = labelsOf.get(names)
    if (!labels) labelsOf.set(names, (labels = refNameLabels(names)))
  }
  return useCallback((raw: string, { keepPlaceholders = true }: { keepPlaceholders?: boolean } = {}) => {
    if (!mayBeRawGameText(raw)) return raw
    wantGameTextRefs()
    return gameTextToPlain(raw, { names: labels, locale: locale ?? pageLocale, keepPlaceholders })
  }, [labels, locale, pageLocale])
}
