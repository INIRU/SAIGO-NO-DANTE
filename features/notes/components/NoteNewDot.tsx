'use client'
import { useCallback, useSyncExternalStore } from 'react'
import { useLocale } from 'next-intl'
import { markNoteFeatureUsed, newFeatureLabel, noteFeatureIsNew, subscribeNoteFeatures } from '@/features/notes/lib/new-feature'

/**
 * The gold dot of a new editor tool. Server and first client render show no dot (storage is not readable there), so
 * hydration matches; it appears once the browser says the tool is unused. `label(title)` is the button's accessible name.
 */
export function useNoteNew(feature: string) {
  const lang = useLocale()
  const isNew = useSyncExternalStore(subscribeNoteFeatures, () => noteFeatureIsNew(feature), () => false)
  const used = useCallback(() => markNoteFeatureUsed(feature), [feature])
  return { isNew, used, label: (title: string) => newFeatureLabel(title, isNew, lang), dot: isNew ? <span className="note-new-dot" aria-hidden="true" /> : null }
}
