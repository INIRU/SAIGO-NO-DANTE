import { getGiftsFromThemes, themeExclusiveGiftIds, withThemeRewards } from './fusion'
import type { RunState } from './run-types'
import type { GiftData, ThemeData } from './types'

export function giftGameId(value: string): number | null {
  const match = /^(?:final_|observe_|start_)?(\d+)(?:_plusplus|_plus)?$/.exec(value)
  return match ? Number(match[1]) : null
}

/**
 * Gifts the plan sets for a pack: its floor entry for that pack, plus the given floor's entry, then the pack's clear
 * rewards, in plan order. The pack match keeps a swapped pack's gifts with it.
 */
export function planThemeGiftIds(state: RunState, themes: ThemeData[], themeId: string, floor?: number): number[] {
  const plan = state.sourcePlanSnapshot?.floorPlan ?? []
  const entries = plan.filter(entry => entry.theme_id === themeId || entry.floor === floor)
  const rewardFloor = plan.find(entry => entry.theme_id === themeId)?.floor ?? floor
  const keys = withThemeRewards(entries.flatMap(entry => entry.gift_ids ?? []), themes.find(theme => theme.id === themeId), rewardFloor)
  return [...new Set(keys.map(giftGameId).filter((id): id is number => id !== null))]
}

/** The plan's final targets, every floor's gifts, then its inventory (without start and observation gifts), in plan order. */
export function planGiftIds(state: RunState): number[] {
  const inventory = (state.sourcePlanSnapshot?.giftInventory ?? []).filter(id => !/^(start|observe)_/.test(id))
  return [...new Set([...state.targetGifts, ...(state.sourcePlanSnapshot?.floorPlan ?? []).flatMap(entry => entry.gift_ids ?? []), ...inventory]
    .map(giftGameId).filter((id): id is number => id !== null))]
}

/**
 * The plan's unowned tier IV and V gifts for the fusion screen, where they are mostly obtained, in plan order. A pack's
 * exclusive gift is listed only on the floor whose pack it is.
 */
export function getFusionTierGifts(state: RunState, themes: ThemeData[], giftMap: Map<number, GiftData>): GiftData[] {
  const owned = new Set(state.giftInventory.map(giftGameId))
  const exclusive = new Set(themes.flatMap(themeExclusiveGiftIds))
  const floorTheme = themes.find(theme => theme.id === state.floorLogs[state.currentFloor - 1]?.themeId)
  const here = new Set(themeExclusiveGiftIds(floorTheme))
  return planGiftIds(state).flatMap(id => {
    const gift = giftMap.get(id)
    return gift && ['4', '5'].includes(String(gift.grade)) && !owned.has(id) && (!exclusive.has(id) || here.has(id)) ? [gift] : []
  })
}

/**
 * Scene labels (features/assist/lib scene classifier) where gifts on screen are offered or shown outside combat, so a sighting
 * may move a gift forward. battle/battle_setup freeze the promotion; loading, unknown labels or no stable scene leave
 * it as it is.
 */
export const GIFT_PROMOTION_SCENES: ReadonlySet<string> = new Set(['shop', 'reward_choice', 'event', 'exploration',
  'gift_acquired', 'start_gift', 'enhance', 'fusion', 'sell', 'theme_select', 'run_setup', 'run_end'])

/** Gifts seen on confirmed non-combat screens for one floor and theme; `key` ties them to that floor and theme. */
export interface GiftPromotion { key: string; ids: readonly number[] }

/**
 * Next promotion state. Sightings only accumulate within a floor and theme, so a gift missing from one frame is not
 * demoted; combat and uncertain scenes keep the previous state. Returns the same object when nothing changes, and is
 * idempotent for the same inputs.
 */
export function nextGiftPromotion(previous: GiftPromotion | null, { state, running, scene, observedGiftIds }: {
  state: RunState
  running: boolean
  scene: { label: string } | null
  observedGiftIds: readonly number[]
}): GiftPromotion | null {
  if (!running || state.phase !== 'playing') return null
  const key = `${state.currentFloor}:${state.floorLogs[state.currentFloor - 1]?.themeId ?? ''}`
  const base = previous?.key === key ? previous : { key, ids: [] }
  if (!scene || !GIFT_PROMOTION_SCENES.has(scene.label)) return base
  const added = [...new Set(observedGiftIds)].filter(id => Number.isInteger(id) && !base.ids.includes(id))
  return added.length ? { key, ids: [...base.ids, ...added] } : base
}

/**
 * All unowned gifts from the floor's actual theme: this floor's planned gifts, registered targets in registration
 * order, theme exclusives outside the plan (only this floor gives them, so they lead the unplanned gifts), promoted
 * (seen) gifts, then the rest; exclusives, seen and the rest keep theme catalog order,
 * so the order of sightings never matters. Pass `nextGiftPromotion(...).ids`, not raw per-frame observations.
 */
export function getCurrentFloorPriorityGifts(state: RunState, themes: ThemeData[], giftMap: Map<number, GiftData>,
  promotedGiftIds: readonly number[] = []): GiftData[] {
  const planned = state.sourcePlanSnapshot?.floorPlan?.find(entry => entry.floor === state.currentFloor)
  const themeId = state.floorLogs[state.currentFloor - 1]?.themeId
  if (!themeId) return []

  const themeGifts = getGiftsFromThemes([themeId], themes, giftMap)
  const theme = themes.find(item => item.id === themeId)
  const exclusiveIds = new Set(themeExclusiveGiftIds(theme))
  const available = new Set(themeGifts.map(gift => gift.game_id))
  if (!available.size) return []
  const owned = new Set(state.giftInventory.map(giftGameId))
  const promoted = new Set(promotedGiftIds)
  const seen = new Set<number>()
  const result: GiftData[] = []
  const add = (gift: GiftData | undefined) => {
    if (!gift || owned.has(gift.game_id) || seen.has(gift.game_id)) return
    seen.add(gift.game_id)
    result.push(gift)
  }
  // The pack's clear rewards count as planned for the floor that has it.
  const addKeys = (keys: string[]) => {
    for (const key of keys) {
      const id = giftGameId(key)
      if (id !== null && available.has(id)) add(giftMap.get(id))
    }
  }
  addKeys(withThemeRewards(planned?.gift_ids ?? [], theme, state.currentFloor))
  addKeys(state.targetGifts)
  for (const gift of themeGifts) if (exclusiveIds.has(gift.game_id)) add(gift)
  for (const gift of themeGifts) if (promoted.has(gift.game_id)) add(gift)
  for (const gift of themeGifts) add(gift)
  return result
}
