import type { EgoGift } from '@/features/mirror-dungeon/types'

const keywordRank = (keyword: string | null | undefined, order: readonly string[]) => {
  const index = order.indexOf(!keyword || keyword.startsWith('공통') ? '공통' : keyword)
  return index < 0 ? 99 : index
}

const GRADE_ORDER: Record<string, number> = { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, 'EX': 6 }

/** Group key prefix of a pinned group (followed by its index in `pinned`). */
export const PINNED_GROUP = '__pinned'

type PinnedGroups = readonly { ids: ReadonlySet<string> }[] | undefined

interface GiftFilterOptions {
  keywords: ReadonlySet<string>
  grades: ReadonlySet<string>
  tiers: ReadonlySet<string>
  /** Gift id -> place in the search engine's order; null when nothing is searched. Only these gifts pass. */
  ranks: ReadonlyMap<string, number> | null
  sortBy: 'default' | 'name' | 'grade'
  sortDesc: boolean
  slotFilter: string
  themeGiftNames: ReadonlySet<string> | null
  giftSlotMap: ReadonlyMap<string, ReadonlySet<number>>
  pinned?: PinnedGroups
  keywordOrder: readonly string[]
  keepOrder: boolean
}

/** The gifts that pass every filter, in the catalog's order: pinned groups first, then by keyword, name or grade. */
export function filterAndSortGifts(gifts: readonly EgoGift[], o: GiftFilterOptions): EgoGift[] {
  const { keywords, grades, tiers, ranks, sortBy, sortDesc, slotFilter, themeGiftNames, giftSlotMap, pinned, keywordOrder, keepOrder } = o
  const slotNum = slotFilter !== '전체' ? Number(slotFilter) : null
  const result = gifts.filter(g => {
    if (keywords.size > 0 && !keywords.has(g.keyword)) return false
    if (grades.size > 0 && !grades.has(g.grade)) return false
    // Difficulty = the first difficulty the gift can be obtained in (sync: giftTiers), so each option lists only the
    // gifts that start there: 익스트림 shows the extreme-only gifts, not everything obtainable in extreme.
    if (tiers.size > 0 && !tiers.has(g.difficulty || '노말')) return false
    if (slotNum !== null) {
      const slots = giftSlotMap.get(g.id)
      if (!slots || !slots.has(slotNum)) return false
    }
    if (ranks && !ranks.has(g.id)) return false
    if (themeGiftNames && !themeGiftNames.has(g.name)) return false
    return true
  })

  if (ranks && !keepOrder && sortBy === 'default') {
    // A search lists the best match first, until the person picks a sort.
    result.sort((a, b) => ranks.get(a.id)! - ranks.get(b.id)!)
  } else if (keepOrder) {
    // The sort is stable: inside a keyword the gifts stay in the order given. Pinned groups keep that order as it is.
    if (!pinned?.length) return result.sort((a, b) => keywordRank(a.keyword, keywordOrder) - keywordRank(b.keyword, keywordOrder))
  } else if (sortBy === 'name') {
    result.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  } else if (sortBy === 'grade') {
    result.sort((a, b) => (GRADE_ORDER[a.grade] ?? 0) - (GRADE_ORDER[b.grade] ?? 0))
  } else {
    // 키워드별: 공통 → 키워드 → 참격·관통·타격, 같은 키워드는 등급순
    result.sort((a, b) => keywordRank(a.keyword, keywordOrder) - keywordRank(b.keyword, keywordOrder) || (GRADE_ORDER[a.grade] ?? 0) - (GRADE_ORDER[b.grade] ?? 0))
  }

  if (sortDesc && !keepOrder) result.reverse()
  if (!pinned?.length) return result
  const rank = (g: EgoGift) => { const index = pinned.findIndex(group => group.ids.has(g.id)); return index < 0 ? pinned.length : index }
  return result.map((g, i) => [g, rank(g), i] as const).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map(([g]) => g)
}

type GiftGroupBy = 'keyword' | 'grade' | null

const groupKey = (g: EgoGift, groupBy: GiftGroupBy, pinned: PinnedGroups) => {
  const pin = pinned?.findIndex(group => group.ids.has(g.id)) ?? -1
  return pin >= 0 ? PINNED_GROUP + pin : groupBy === 'keyword' ? g.keyword : groupBy === 'grade' ? g.grade : ''
}

/** How many gifts each group (pinned index, keyword, grade or '') holds. */
export function countGiftGroups(gifts: readonly EgoGift[], groupBy: GiftGroupBy, pinned: PinnedGroups) {
  const map = new Map<string, number>()
  for (const g of gifts) {
    const key = groupKey(g, groupBy, pinned)
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
}

/** The gifts cut into runs of the same group key, in order. */
export function groupGifts(gifts: readonly EgoGift[], groupBy: GiftGroupBy, pinned: PinnedGroups) {
  const out: { key: string; gifts: EgoGift[] }[] = []
  for (const g of gifts) {
    const key = groupKey(g, groupBy, pinned)
    const last = out[out.length - 1]
    if (last && last.key === key) last.gifts.push(g)
    else out.push({ key, gifts: [g] })
  }
  return out
}
