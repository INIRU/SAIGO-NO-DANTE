'use client'

import { useMemo } from 'react'
import { mayBeRawGameText } from '@/lib/game-text/rich-text'
import { useGameTextRefs } from '@/hooks/useGameTextRefs'
import { ownKeywordSet } from '@/lib/keywords/own-keywords'

type Text = string | null | undefined

/**
 * The keywords an identity / E.G.O owns (see ownKeywordSet), for `allowedKeywords` of its skill and passive texts.
 * `listed` and `texts` should be stable references (memoize the array of texts); the reference table is only
 * requested when one of the texts may hold a `[Id]`.
 */
export function useOwnKeywords(listed: readonly string[] | null | undefined, texts: readonly Text[]): ReadonlySet<string> {
  const { names } = useGameTextRefs({ lazy: !texts.some(text => text && mayBeRawGameText(text)) })
  return useMemo(() => ownKeywordSet(listed, texts, names), [listed, texts, names])
}

type OwnKeywordOwner = { id: string; keywords: readonly string[] | null | undefined; texts: readonly Text[] }

/** The same for several identities at once (a deck panel), by owner id. `owners` should be a stable (memoized) array. */
export function useOwnKeywordSets(owners: readonly OwnKeywordOwner[]): ReadonlyMap<string, ReadonlySet<string>> {
  const { names } = useGameTextRefs({ lazy: !owners.some(owner => owner.texts.some(text => text && mayBeRawGameText(text))) })
  return useMemo(() => new Map(owners.map(owner => [owner.id, ownKeywordSet(owner.keywords, owner.texts, names)])), [owners, names])
}
