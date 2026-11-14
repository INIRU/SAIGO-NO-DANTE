'use client'

import { useMemo } from 'react'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import type { CollectionData } from '@/lib/collection'
import { countCollection, filterCollection } from '@/features/tools/lib/collection-view'

export function useCollectionModel(data: CollectionData | null, owned: Set<string>, keyword: string | null) {
  const { sinMap } = useKeywordData()
  const counts = useMemo(() => countCollection(data, owned), [data, owned])
  const filtered = useMemo(() => filterCollection(data, keyword, sinMap), [data, keyword, sinMap])
  return { stats: counts.stats, sinnerCounts: counts.bySinner, filtered }
}
