'use client'

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { useTranslations } from 'next-intl'
import { showError } from '@/lib/toast'
import { mergeViewerFields, normalizeDeckDetail, type DeckDetail } from '../lib/deck-detail-analysis'

export type { DeckDetail } from '../lib/deck-detail-analysis'

const postedDeckViews = new Set<string>()

/** The deck of the detail page and whether it is still being loaded: the server-rendered deck if there is one. */
export function useDeckDetailState(initialDeck?: DeckDetail | null) {
  const [deck, setDeck] = useState<DeckDetail | null>(initialDeck ?? null)
  const [loading, setLoading] = useState(!initialDeck)
  return { deck, setDeck, loading, setLoading }
}

/**
 * Loads the deck of the detail page into `useDeckDetailState` (with a server-rendered deck, only the viewer part is
 * fetched and patched in, else the whole deck). Counts one view per deck and page load. `onVoteCount` gets the fresh
 * vote count. Called after the page's other requests, so those start first.
 */
export function useDeckDetailLoad({ id, initialDeck, setDeck, setLoading, onVoteCount }: {
  id: string
  initialDeck?: DeckDetail | null
  setDeck: Dispatch<SetStateAction<DeckDetail | null>>
  setLoading: Dispatch<SetStateAction<boolean>>
  onVoteCount: (count: number) => void
}) {
  const t = useTranslations('decks.detail')

  useEffect(() => {
    const viewKey = `deck-view:${id}`
    if (postedDeckViews.has(viewKey)) return
    postedDeckViews.add(viewKey)

    fetch(`/api/decks/${id}/view`, {
      method: 'POST',
      cache: 'no-store',
      keepalive: true,
    }).catch(() => {})
  }, [id])

  useEffect(() => {
    let cancelled = false

    // With the first view rendered, only the viewer part (deck code, ownership, the sinners' E.G.O list, counts) is missing.
    fetch(initialDeck ? `/api/decks/${id}?part=viewer` : `/api/decks/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled || !data || data.error) return

        const fixed = normalizeDeckDetail(data)
        if (initialDeck) {
          setDeck(prev => prev ? mergeViewerFields(prev, fixed) : fixed)
        } else {
          setDeck(fixed)
        }
        onVoteCount(data.vote_count ?? 0)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Failed to fetch deck detail:', err)
        if (!initialDeck) showError(t('loadFailed'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id, initialDeck, t]) // eslint-disable-line react-hooks/exhaustive-deps
}
