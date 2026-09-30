/**
 * Rules of the Mirror Dungeon sync (mirror-dungeon-data.ts) that need neither game files nor the database, so they are
 * tested on their own. The cases come from the extraction audit of 2026-09-30 (complete-data of 2026-09-24).
 */

/** Theme source fields the sync reads. Anything else is reported by `unreadThemeKeys` instead of being dropped unseen. */
export const READ_THEME_KEYS: ReadonlySet<string> = new Set([
  'id', 'desc', 'hiddenThemeRate', 'egoGiftPool', 'specificEgoGiftPool', 'fixedRewardEgoGifts', 'uiConfigs',
  'unlockCondition', 'exceptionConditions', 'difficulty', 'mapGenSequence', 'mapGenOption',
])
const READ_UI_CONFIG_KEYS: ReadonlySet<string> = new Set(['packSpriteId', 'bossSpriteId'])

/**
 * Keys of a theme source item that the sync does not read ("uiConfigs.showBossIds" for nested ones). The audit found
 * specificEgoGiftForUpegsProbs, excludeSpecificEgoGiftFromUpEgs, isUnrecordable, uiConfigs.showBossIds and type among
 * them; a key added by a later update shows up the same way.
 */
export function unreadThemeKeys(item: unknown): string[] {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return []
  const keys = Object.keys(item).filter(key => !READ_THEME_KEYS.has(key))
  const ui = (item as { uiConfigs?: unknown }).uiConfigs
  if (ui && typeof ui === 'object' && !Array.isArray(ui)) {
    for (const key of Object.keys(ui)) if (!READ_UI_CONFIG_KEYS.has(key)) keys.push(`uiConfigs.${key}`)
  }
  return keys
}

const GIFT_ID_KEYS = /^(id|egoGiftId|giftId|rewardId)$/i

/** Gift ids in a theme's fixedRewardEgoGifts, whether it lists bare ids or entries that hold an id. */
export function fixedRewardGiftIds(value: unknown): number[] {
  const ids: number[] = []
  const visit = (node: unknown) => {
    if (typeof node === 'number') {
      if (Number.isInteger(node)) ids.push(node)
    } else if (Array.isArray(node)) {
      for (const entry of node) visit(entry)
    } else if (node && typeof node === 'object') {
      for (const [key, entry] of Object.entries(node)) {
        if (typeof entry === 'number') { if (GIFT_ID_KEYS.test(key) && Number.isInteger(entry)) ids.push(entry) }
        else visit(entry)
      }
    }
  }
  visit(value)
  return [...new Set(ids)]
}

/**
 * Gifts a pack always gives: its fixedRewardEgoGifts (뽕.황 3001 lists 9242, 9083, 9082, 9081 there) and the single
 * guaranteed reward of each boss stage. Only gifts that exist count (some stages reward a placeholder such as 993005).
 */
export function themeFixedRewards(theme: { fixedRewardEgoGifts?: unknown; mapGenOption?: { bossPool?: number[] } },
  stageRewards: ReadonlyMap<number, number>, giftIds: ReadonlySet<number>): number[] {
  const bossRewards = (theme.mapGenOption?.bossPool ?? []).flatMap(stage => {
    const gift = stageRewards.get(stage)
    return gift === undefined ? [] : [gift]
  })
  return [...new Set([...fixedRewardGiftIds(theme.fixedRewardEgoGifts), ...bossRewards])].filter(id => giftIds.has(id))
}

/**
 * Exclusive gifts that the pack's own specificEgoGiftPool does not list:
 * - 3001 뽕.황: 봉이 인형 (9242), its fixed reward.
 * - 1122 선의의 순례: 9831~9835. They come from the pilgrimage story dungeon (912014/912114, events 971074~971078); the
 *   pack shares only its name and background (Pilgrimage.prefab), has an empty event pool and no id links to them.
 * - 1124 호박색 어스름의 시련: 아직 따뜻한 커피 (9241), given only by its event 971092.
 */
export const THEME_EXTRA_EXCLUSIVE_GIFTS: ReadonlyMap<number, readonly number[]> = new Map([
  [3001, [9242]],
  [1122, [9831, 9832, 9833, 9834, 9835]],
  [1124, [9241]],
])

/** specific_ego_gift_ids of a pack: its specificEgoGiftPool plus the exclusive gifts above. */
export function themeExclusiveGifts(themeId: number, specificPool: readonly number[] | undefined): number[] {
  return [...new Set([...(specificPool ?? []), ...(THEME_EXTRA_EXCLUSIVE_GIFTS.get(themeId) ?? [])])]
}

/** Whether a stored id list already holds `next` (order ignored). A NULL column differs from `[]`, so it gets written. */
export function sameStoredIds(stored: readonly number[] | null | undefined, next: readonly number[]): boolean {
  if (stored == null) return false
  const sorted = (values: readonly number[]) => JSON.stringify([...values].sort((a, b) => a - b))
  return sorted(stored) === sorted(next)
}

const filled = (value: unknown) => value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && value.length === 0)

/**
 * Of one gift's entries in several files (in file order), the one with the most filled fields; ties keep the first.
 * Story files can hold a bare `{ id }` stub: 원목 술잔 (9781) is a stub in ego-gift-a1c7p3.txt and complete (TIER_3,
 * price 250) in ego-gift-story-ycgd-BokGak.txt.
 */
export function richestEntry<T extends object>(entries: readonly T[]): T | undefined {
  let best: T | undefined
  let bestScore = -1
  for (const entry of entries) {
    const score = Object.values(entry).filter(filled).length
    if (score > bestScore) { best = entry; bestScore = score }
  }
  return best
}

/** Gift ids a theme item points at: its pools and fixed rewards (used to recover gifts kept in story files). */
export function themeGiftRefs(item: unknown): number[] {
  if (!item || typeof item !== 'object') return []
  const theme = item as { egoGiftPool?: unknown; specificEgoGiftPool?: unknown; fixedRewardEgoGifts?: unknown }
  const pool = (value: unknown) => Array.isArray(value) ? value.filter((id): id is number => typeof id === 'number') : []
  return [...new Set([...pool(theme.egoGiftPool), ...pool(theme.specificEgoGiftPool), ...fixedRewardGiftIds(theme.fixedRewardEgoGifts)])]
}
