import type { EGO, Identity } from '@/lib/data/sinners'
import { getLocalizedAffiliations } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import { getRepresentativeKeywords } from './representative-keywords'

export type OwnershipFilter = 'all' | 'owned' | 'unowned'

const getEgoReleaseTime = (ego: EGO) => {
  if (!ego.release_date) return null
  const time = Date.parse(ego.release_date)
  return Number.isNaN(time) ? null : time
}

const compareEgoFallback = (a: EGO, b: EGO) => {
  const aGameId = parseInt(a.game_id ?? '', 10)
  const bGameId = parseInt(b.game_id ?? '', 10)
  if (!Number.isNaN(aGameId) && !Number.isNaN(bGameId) && aGameId !== bGameId) {
    return aGameId - bGameId
  }
  return a.id.localeCompare(b.id)
}

const compareEgosByReleaseDate = (a: EGO, b: EGO, sortOrder: 'newest' | 'oldest') => {
  const aTime = getEgoReleaseTime(a)
  const bTime = getEgoReleaseTime(b)

  if (aTime !== null && bTime !== null && aTime !== bTime) {
    return sortOrder === 'newest' ? bTime - aTime : aTime - bTime
  }
  if (aTime !== null && bTime === null) return -1
  if (aTime === null && bTime !== null) return 1
  const fallbackOrder = compareEgoFallback(a, b)
  return sortOrder === 'newest' ? -fallbackOrder : fallbackOrder
}

/** How many of the lists hold each keyword, most common first. */
export function countKeywords(lists: Iterable<readonly string[] | null | undefined>) {
  const freq = new Map<string, number>()
  for (const list of lists) {
    for (const kw of list ?? []) freq.set(kw, (freq.get(kw) ?? 0) + 1)
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([kw, count]) => ({ kw, count }))
}

export interface SinnerFilter {
  searchQuery: string
  selectedKeywords: ReadonlySet<string>
  sortOrder: 'newest' | 'oldest'
  ownershipFilter: OwnershipFilter
  ownedIds: ReadonlySet<string> | null
}

/** 인격 필터링: 등급 → 검색어 → 키워드 → 보유, then by game id. */
export function filterSinnerIdentities(identities: Identity[], f: SinnerFilter & { rarityFilter: string | null; lang: SupportedLang }) {
  const { rarityFilter, searchQuery, selectedKeywords, sortOrder, ownershipFilter, ownedIds, lang } = f
  let result = identities
  if (rarityFilter) result = result.filter(i => `${i.rarity}성` === rarityFilter)
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase()
    result = result.filter(i => {
      const rawAffiliations = [
        i.affiliation,
        ...(i.association_list ?? []),
      ].filter((affiliation): affiliation is string => Boolean(affiliation))
      const affiliationTerms = [
        ...rawAffiliations,
        ...getLocalizedAffiliations(rawAffiliations, lang),
      ]

      return i.name_kr.toLowerCase().includes(q) ||
        affiliationTerms.some(affiliation => affiliation.toLowerCase().includes(q)) ||
        getRepresentativeKeywords(i).some(kw => kw.toLowerCase().startsWith(q))
    })
  }
  if (selectedKeywords.size > 0) {
    result = result.filter(i =>
      [...selectedKeywords].every(kw => getRepresentativeKeywords(i).includes(kw))
    )
  }
  if (ownershipFilter !== 'all' && ownedIds) {
    result = result.filter(i =>
      ownershipFilter === 'owned' ? ownedIds.has(i.id) : !ownedIds.has(i.id)
    )
  }
  return [...result].sort((a, b) => {
    const aId = parseInt(a.game_id ?? '0')
    const bId = parseInt(b.game_id ?? '0')
    return sortOrder === 'newest' ? bId - aId : aId - bId
  })
}

/** EGO 필터링: 검색어 → 키워드 → 보유, then by release date. */
export function filterSinnerEgos(egos: EGO[], f: SinnerFilter) {
  const { searchQuery, selectedKeywords, sortOrder, ownershipFilter, ownedIds } = f
  let result = egos
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase()
    result = result.filter(e =>
      (e.name_kr && e.name_kr.toLowerCase().includes(q)) ||
      (e.keywords && e.keywords.some(kw => kw.toLowerCase().startsWith(q)))
    )
  }
  if (selectedKeywords.size > 0) {
    result = result.filter(e =>
      e.keywords && [...selectedKeywords].every(kw => e.keywords!.includes(kw))
    )
  }
  if (ownershipFilter !== 'all' && ownedIds) {
    result = result.filter(e =>
      ownershipFilter === 'owned' ? ownedIds.has(e.id) : !ownedIds.has(e.id)
    )
  }
  return [...result].sort((a, b) => compareEgosByReleaseDate(a, b, sortOrder))
}
