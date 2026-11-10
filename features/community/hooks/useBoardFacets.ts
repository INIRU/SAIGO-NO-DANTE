'use client'

import useSWR from 'swr'

export type FacetEgo = { id: string; sinner_id: string; grade: string; sin_affinity: string | null; name: string; name_kr: string | null; name_en: string | null; name_jp: string | null; image_url: string | null; count: number }
export type FacetGift = { game_id: number; name: string; name_en: string | null; name_jp: string | null; grade: string | null; keyword: string | null; image_url: string | null; count: number }
export type FacetTheme = { id: number; name: string; name_en: string | null; name_jp: string | null; image_url: string | null; count: number }
export type BoardFacets = {
  identityAffiliations: Record<string, string[]>
  affiliations: { key: string; count: number }[]
  egos: FacetEgo[]
  gifts: FacetGift[]
  themes: FacetTheme[]
}

/** Filter options drawn from the board's posts (app/api/board/facets). */
export function useBoardFacets(kind: 'deck' | 'planner') {
  return useSWR<BoardFacets>(`/api/board/facets?kind=${kind}`, { revalidateOnFocus: false })
}

/** Every value in the post's set: selected facets narrow, they never widen. */
export const hasAll = (selected: readonly string[], values: ReadonlySet<string>) => selected.every(value => values.has(value))

