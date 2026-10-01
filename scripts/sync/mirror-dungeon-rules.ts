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

/**
 * The DB row a source gift updates: the one with its game_id, or by name only a legacy row that has no game_id yet.
 * Story (20xx) and Mirror Dungeon (97xx) gifts share 29 names, so a name match against a row with a game_id would
 * rewrite another gift's row.
 */
export function existingGiftLookup<T extends { game_id: number | null; name: string }>(rows: readonly T[]) {
  const byGameId = new Map<number, T>()
  const legacyByName = new Map<string, T>()
  for (const row of rows) {
    if (row.game_id) byGameId.set(row.game_id, row)
    else legacyByName.set(row.name, row)
  }
  return {
    find: (gameId: number, name: string): T | undefined => byGameId.get(gameId) ?? legacyByName.get(name),
    /** Rows the source no longer has: by game_id, and legacy rows by name. */
    missingFrom: (source: readonly { game_id: number; name: string }[]): number => {
      const ids = new Set(source.map(gift => gift.game_id)), names = new Set(source.map(gift => gift.name))
      return rows.filter(row => row.game_id ? !ids.has(row.game_id) : !names.has(row.name)).length
    },
  }
}

/** The difficulty a gift first appears in. 평행중첩 (dungeonIdx 2) is a hard-mode variant, so it counts as 하드. */
export type GiftTier = '노말' | '하드' | '익스트림'
const GIFT_TIER_ORDER: readonly GiftTier[] = ['노말', '하드', '익스트림']
const DUNGEON_IDX_TIER: Readonly<Record<number, GiftTier>> = { 0: '노말', 1: '하드', 2: '하드', 3: '익스트림' }

export interface GiftTierTheme {
  /** exceptionConditions[].dungeonIdx: the difficulties the pack is offered in. */
  dungeonIdxs: readonly number[]
  /** specificEgoGiftPool + extra exclusives + fixed rewards: given in every difficulty the pack is offered in. */
  exclusive: readonly number[]
  /** egoGiftPool: the pack's drop pool, still subject to the droppool's normal-mode exclusions. */
  pool: readonly number[]
  /** mapGenOption.eventPool */
  eventIds: readonly number[]
}

export interface GiftTierSources {
  /** mirrordungeon-egogift-droppool: random drop pool and its exclusions. excludeEgoGifts applies to dungeonIdx 0. */
  dropPool: readonly number[]
  normalExclude: readonly number[]
  globalExclude: readonly number[]
  themes: readonly GiftTierTheme[]
  /** acquirable-egogifts-in-event: event id → gifts it can give. */
  eventGifts: ReadonlyMap<number, readonly number[]>
  /** Combine recipes: the result needs every material. */
  recipes: readonly { result: number; materials: readonly number[] }[]
  /** Gift → the gift it turns into (convertDataList). */
  conversions: ReadonlyMap<number, number>
  /** Hidden-boss rewards (ego-gift-mirrordungeon*-hb), used only when nothing else places them. */
  hiddenBoss: ReadonlySet<number>
}

const lowerTier = (a: GiftTier | undefined, b: GiftTier): GiftTier =>
  a === undefined || GIFT_TIER_ORDER.indexOf(b) < GIFT_TIER_ORDER.indexOf(a) ? b : a
const higherTier = (a: GiftTier, b: GiftTier): GiftTier => (GIFT_TIER_ORDER.indexOf(b) > GIFT_TIER_ORDER.indexOf(a) ? b : a)

/**
 * The lowest difficulty each gift can be obtained in, from the game's own sources: the random drop pool (minus the
 * normal-mode exclusions), the packs it belongs to (their exceptionConditions), the events of those packs, then
 * combine recipes (the hardest material decides) and conversions (the source gift decides). Gifts none of these reach
 * keep the old rule: hidden-boss rewards 익스트림, gifts excluded from normal drops 하드, the rest 노말.
 */
export function giftTiers(giftIds: Iterable<number>, src: GiftTierSources): Map<number, GiftTier> {
  const normalExclude = new Set(src.normalExclude)
  const globalExclude = new Set(src.globalExclude)
  const tiers = new Map<number, GiftTier>()
  const offer = (gift: number, tier: GiftTier) => tiers.set(gift, lowerTier(tiers.get(gift), tier))

  for (const gift of src.dropPool) {
    if (globalExclude.has(gift)) continue
    offer(gift, normalExclude.has(gift) ? '하드' : '노말')
  }
  for (const theme of src.themes) {
    const packTiers = [...new Set(theme.dungeonIdxs.map(idx => DUNGEON_IDX_TIER[idx]).filter((t): t is GiftTier => t !== undefined))]
    for (const tier of packTiers) {
      for (const gift of theme.exclusive) offer(gift, tier)
      for (const gift of theme.pool) if (!(tier === '노말' && normalExclude.has(gift))) offer(gift, tier)
      for (const eventId of theme.eventIds) for (const gift of src.eventGifts.get(eventId) ?? []) offer(gift, tier)
    }
  }

  // Recipes and conversions can chain, so settle them until nothing changes. Gifts with a direct source keep it; a
  // result made by several recipes takes the easiest one.
  const direct = new Set(tiers.keys())
  for (let changed = true; changed;) {
    changed = false
    const derived = (gift: number, tier: GiftTier) => {
      if (direct.has(gift)) return
      const next = lowerTier(tiers.get(gift), tier)
      if (next !== tiers.get(gift)) { tiers.set(gift, next); changed = true }
    }
    for (const recipe of src.recipes) {
      const materialTiers = recipe.materials.map(id => tiers.get(id))
      if (materialTiers.length === 0 || materialTiers.some(t => t === undefined)) continue
      derived(recipe.result, (materialTiers as GiftTier[]).reduce(higherTier))
    }
    for (const [from, to] of src.conversions) {
      const fromTier = tiers.get(from)
      if (fromTier !== undefined) derived(to, fromTier)
    }
  }

  // Unplaced gifts: a conversion target follows its source; otherwise the old rule.
  const convertedFrom = new Map([...src.conversions].map(([from, to]) => [to, from]))
  const resolve = (gift: number, seen = new Set<number>()): GiftTier => {
    const known = tiers.get(gift)
    if (known) return known
    const from = convertedFrom.get(gift)
    if (from !== undefined && !seen.has(from)) return resolve(from, seen.add(gift))
    return src.hiddenBoss.has(gift) ? '익스트림' : normalExclude.has(gift) || globalExclude.has(gift) ? '하드' : '노말'
  }
  const result = new Map<number, GiftTier>()
  for (const gift of giftIds) result.set(gift, resolve(gift))
  return result
}
