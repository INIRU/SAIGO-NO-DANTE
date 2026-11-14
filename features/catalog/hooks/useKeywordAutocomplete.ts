'use client'

import { useState, useMemo, useCallback } from 'react'

/** allKeywords: keyword name 배열 */
export function useKeywordAutocomplete(allKeywords: string[]) {
  const [query, setQuery] = useState('')

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []

    const matches = allKeywords.filter(kw => kw.toLowerCase().includes(q))

    // 정렬: 정확 일치 → 시작 일치 → 포함 일치
    matches.sort((a, b) => {
      const aLow = a.toLowerCase()
      const bLow = b.toLowerCase()
      const aExact = aLow === q
      const bExact = bLow === q
      if (aExact !== bExact) return aExact ? -1 : 1
      const aStarts = aLow.startsWith(q)
      const bStarts = bLow.startsWith(q)
      if (aStarts !== bStarts) return aStarts ? -1 : 1
      return a.localeCompare(b, 'ko')
    })

    return matches.slice(0, 12)
  }, [query, allKeywords])

  const reset = useCallback(() => setQuery(''), [])

  return { query, setQuery, suggestions, reset }
}
